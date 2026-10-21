"""Entraînement du modèle de scoring crédit (XGBoost).

En l'absence d'historique de remboursements, on génère un jeu de données synthétique
réaliste pour amorcer le modèle. Dès que DALA dispose de prêts arrivés à échéance,
remplacer `synthetic_dataset` par l'export des tables Loan / Transaction (cible = prêt
remboursé à temps).

Usage : python -m model.train [--rows 20000] [--out model/credit_model.joblib]
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from features import FEATURES

DEFAULT_OUT = Path(__file__).parent / "credit_model.joblib"


def synthetic_dataset(rows: int, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    df = pd.DataFrame(
        {
            "account_age_days": rng.gamma(2.0, 90, rows).clip(0, 1500),
            "savings_balance": rng.lognormal(11, 1.2, rows).clip(0, 5_000_000),
            "savings_regularity": rng.beta(2, 2, rows),
            "tx_count_90d": rng.poisson(25, rows),
            "avg_monthly_inflow": rng.lognormal(11.5, 0.9, rows).clip(0, 3_000_000),
            "mobile_money_volume_90d": rng.lognormal(12, 1.0, rows).clip(0, 10_000_000),
            "loans_repaid": rng.poisson(1.0, rows),
            "loans_late": rng.binomial(2, 0.08, rows),
            "tontine_on_time_ratio": rng.beta(4, 1.5, rows),
            "kyc_level": rng.choice([1, 2, 3], rows, p=[0.55, 0.35, 0.10]),
        }
    )
    logit = (
        -1.0
        + 0.003 * df.account_age_days.clip(upper=365)
        + 1.8 * df.savings_regularity
        + 0.25 * np.log1p(df.savings_balance) / 5
        + 0.01 * df.tx_count_90d.clip(upper=100)
        + 0.3 * df.loans_repaid.clip(upper=5)
        - 1.6 * df.loans_late
        + 1.0 * (df.tontine_on_time_ratio - 0.5)
        + 0.2 * (df.kyc_level - 1)
        + rng.normal(0, 0.6, rows)
    )
    df["repaid"] = (rng.random(rows) < 1 / (1 + np.exp(-logit))).astype(int)
    return df


def train(rows: int, out: Path) -> dict:
    df = synthetic_dataset(rows)
    x_train, x_test, y_train, y_test = train_test_split(df[FEATURES], df["repaid"], test_size=0.2, random_state=0, stratify=df["repaid"])
    model = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="auc",
        # Contraintes monotones : plus d'épargne / d'ancienneté ne doit jamais dégrader le score,
        # plus de retards ne doit jamais l'améliorer (explicabilité exigée pour le crédit).
        monotone_constraints="(1,1,1,1,1,1,1,-1,1,1)",
    )
    model.fit(x_train, y_train)
    auc = float(roc_auc_score(y_test, model.predict_proba(x_test)[:, 1]))
    version = f"xgb-{datetime.now(timezone.utc):%Y%m%d%H%M}"
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": FEATURES, "version": version, "auc": auc}, out)
    return {"version": version, "auc": auc, "path": str(out)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=20_000)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    print(train(args.rows, args.out))
