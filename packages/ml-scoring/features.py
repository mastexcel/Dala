"""Définition des variables du modèle de scoring DALA.

L'ordre de FEATURES doit rester identique entre l'entraînement et l'inférence ; il reprend
les clés envoyées par l'API Node (apps/api/src/services/scoring.ts › ScoringFeatures).
"""

from pydantic import BaseModel, Field

FEATURES: list[str] = [
    "account_age_days",
    "savings_balance",
    "savings_regularity",
    "tx_count_90d",
    "avg_monthly_inflow",
    "mobile_money_volume_90d",
    "loans_repaid",
    "loans_late",
    "tontine_on_time_ratio",
    "kyc_level",
]


class ScoringFeatures(BaseModel):
    account_age_days: float = Field(ge=0, description="Ancienneté du compte (jours)")
    savings_balance: float = Field(ge=0, description="Solde épargne (FCFA)")
    savings_regularity: float = Field(ge=0, le=1, description="Part des 12 dernières semaines avec dépôt d'épargne")
    tx_count_90d: float = Field(ge=0, description="Nombre de transactions sur 90 jours")
    avg_monthly_inflow: float = Field(ge=0, description="Entrées mensuelles moyennes (FCFA)")
    mobile_money_volume_90d: float = Field(ge=0, description="Volume mobile money 90 j (FCFA)")
    loans_repaid: float = Field(ge=0, description="Prêts DALA remboursés")
    loans_late: float = Field(ge=0, description="Prêts en retard ou en défaut")
    tontine_on_time_ratio: float = Field(ge=0, le=1, description="Ponctualité des cotisations de tontine")
    kyc_level: float = Field(ge=1, le=3, description="Niveau KYC (1 à 3)")

    def to_row(self) -> list[float]:
        return [float(getattr(self, f)) for f in FEATURES]
