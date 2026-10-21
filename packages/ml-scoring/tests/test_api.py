from fastapi.testclient import TestClient

import api
from model.train import synthetic_dataset, train

GOOD = {
    "account_age_days": 400, "savings_balance": 600_000, "savings_regularity": 0.95, "tx_count_90d": 70,
    "avg_monthly_inflow": 300_000, "mobile_money_volume_90d": 900_000, "loans_repaid": 3, "loans_late": 0,
    "tontine_on_time_ratio": 1.0, "kyc_level": 2,
}
BAD = {**GOOD, "account_age_days": 10, "savings_regularity": 0.0, "savings_balance": 0, "tx_count_90d": 1, "loans_repaid": 0, "loans_late": 2, "tontine_on_time_ratio": 0.2, "kyc_level": 1}


def client(tmp_path=None, trained=False):
    api._bundle = None
    if trained:
        path = tmp_path / "m.joblib"
        train(4_000, path)
        api.MODEL_PATH = path
    else:
        api.MODEL_PATH = api.Path("/nonexistent.joblib")
    return TestClient(api.app)


def test_health_heuristic():
    r = client().get("/health")
    assert r.status_code == 200 and r.json()["model_version"] == "heuristic"


def test_heuristic_ranks_profiles():
    c = client()
    good = c.post("/score", json={"features": GOOD}).json()
    bad = c.post("/score", json={"features": BAD}).json()
    assert good["probability"] > bad["probability"]
    assert good["decision"] == "APPROVED" and bad["decision"] == "REJECTED"


def test_validation_rejects_out_of_range():
    r = client().post("/score", json={"features": {**GOOD, "savings_regularity": 3}})
    assert r.status_code == 422


def test_trained_model_monotonic_and_explained(tmp_path):
    c = client(tmp_path, trained=True)
    good = c.post("/score", json={"features": GOOD}).json()
    worse = c.post("/score", json={"features": {**GOOD, "loans_late": 2}}).json()
    assert good["model_version"].startswith("xgb-")
    assert worse["probability"] <= good["probability"]
    assert len(good["top_factors"]) == 3


def test_synthetic_dataset_shape():
    df = synthetic_dataset(500)
    assert len(df) == 500 and 0.2 < df["repaid"].mean() < 0.95
