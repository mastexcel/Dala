"""Micro-service de scoring crédit DALA (FastAPI).

POST /score   → probabilité de remboursement + score DALA (0-100) + facteurs explicatifs
GET  /health  → état du service et version du modèle
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict

from features import FEATURES, ScoringFeatures

MODEL_PATH = Path(os.environ.get("MODEL_PATH", Path(__file__).parent / "model" / "credit_model.joblib"))
APPROVE_THRESHOLD = 0.70
REVIEW_THRESHOLD = 0.50

app = FastAPI(title="DALA Scoring", version="0.1.0")
_bundle: dict[str, Any] | None = None


def load_model() -> dict[str, Any] | None:
    global _bundle
    if _bundle is None and MODEL_PATH.exists():
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def heuristic_probability(f: ScoringFeatures) -> float:
    """Repli identique à celui de l'API Node, utilisé si aucun modèle n'est entraîné."""
    z = (
        -1.2
        + 0.004 * min(f.account_age_days, 365)
        + 1.6 * f.savings_regularity
        + 0.000004 * min(f.savings_balance, 500_000)
        + 0.012 * min(f.tx_count_90d, 100)
        + 0.0000015 * min(f.avg_monthly_inflow, 1_000_000)
        + 0.35 * min(f.loans_repaid, 5)
        - 1.4 * f.loans_late
        + 0.8 * (f.tontine_on_time_ratio - 0.5)
        + 0.25 * (f.kyc_level - 1)
    )
    return 1 / (1 + math.exp(-z))


REASONS = {
    "savings_regularity": "Régularité de l'épargne",
    "account_age_days": "Ancienneté du compte",
    "loans_late": "Retards de remboursement",
    "loans_repaid": "Prêts remboursés",
    "tontine_on_time_ratio": "Ponctualité en tontine",
    "tx_count_90d": "Activité du compte",
    "savings_balance": "Montant épargné",
    "kyc_level": "Niveau de vérification",
    "avg_monthly_inflow": "Revenus entrants",
    "mobile_money_volume_90d": "Activité mobile money",
}


class ScoreRequest(BaseModel):
    features: ScoringFeatures


class ScoreResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    probability: float
    score: int
    decision: str
    model_version: str
    top_factors: list[dict[str, Any]]


def decide(p: float) -> str:
    if p >= APPROVE_THRESHOLD:
        return "APPROVED"
    if p >= REVIEW_THRESHOLD:
        return "MANUAL_REVIEW"
    return "REJECTED"


@app.get("/health")
def health() -> dict[str, Any]:
    bundle = load_model()
    return {"status": "ok", "model_version": bundle["version"] if bundle else "heuristic", "auc": bundle.get("auc") if bundle else None}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    bundle = load_model()
    row = np.array([req.features.to_row()])
    factors: list[dict[str, Any]] = []
    if bundle:
        model = bundle["model"]
        p = float(model.predict_proba(row)[0, 1])
        # Contributions SHAP natives d'XGBoost : explication de la décision (droit à l'explication).
        contribs = model.get_booster().predict(_dmatrix(row), pred_contribs=True)[0][:-1]
        ranked = sorted(zip(FEATURES, contribs), key=lambda x: abs(x[1]), reverse=True)[:3]
        factors = [{"feature": k, "label": REASONS[k], "impact": round(float(v), 4)} for k, v in ranked]
        version = bundle["version"]
    else:
        p = heuristic_probability(req.features)
        version = "heuristic"
    return ScoreResponse(probability=round(p, 4), score=round(p * 100), decision=decide(p), model_version=version, top_factors=factors)


def _dmatrix(row: np.ndarray):
    from xgboost import DMatrix

    return DMatrix(row, feature_names=FEATURES)
