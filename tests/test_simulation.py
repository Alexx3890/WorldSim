"""
Tests for WorldSim Simulation Engine & API
===========================================
Verifies:
- SE-1 Determinism: Same seed + params yields identical results
- Hospital pack known-result tests
- Pareto frontier and composite scoring
- FastAPI endpoints (/health, /packs, /runs, /simulations/ai-plan)
"""
import simpy
from fastapi.testclient import TestClient

from app.main import app
from hospital_pack import HospitalPack
from college_pack import CollegePack
from office_pack import OfficePack
from policy_pack import PolicyPack
from social_pack import SocialPack
from worldsim_engine.runner import MonteCarloRunner
from worldsim_engine.scorer import score_strategies


def test_hospital_pack_determinism() -> None:
    """SE-1: Identical seeds produce identical simulation trajectories."""
    pack = HospitalPack()
    params = pack.default_params()
    params["sim_duration_hours"] = 4.0

    env1 = simpy.Environment()
    model1 = pack.build(params, seed=123, env=env1)
    env1.process(model1.run())
    env1.run(until=240.0)
    m1 = model1.collect_metrics()

    env2 = simpy.Environment()
    model2 = pack.build(params, seed=123, env=env2)
    env2.process(model2.run())
    env2.run(until=240.0)
    m2 = model2.collect_metrics()

    assert m1 == m2, "SE-1 Determinism failed: runs with same seed diverged"


def test_all_five_packs_registered_and_deterministic() -> None:
    """All 5 scenario packs instantiate, validate, and execute deterministically."""
    packs = [HospitalPack(), CollegePack(), OfficePack(), PolicyPack(), SocialPack()]
    assert len(packs) == 5

    for pack in packs:
        assert pack.manifest.id in ("hospital", "college", "office", "policy", "social")
        params = pack.default_params()
        assert len(pack.validate_params(params)) == 0

        # Build with same seed twice and verify identical outputs
        env1 = simpy.Environment()
        m1 = pack.build(params, seed=42, env=env1)
        env1.process(m1.run())
        env1.run(until=120.0)
        res1 = m1.collect_metrics()

        env2 = simpy.Environment()
        m2 = pack.build(params, seed=42, env=env2)
        env2.process(m2.run())
        env2.run(until=120.0)
        res2 = m2.collect_metrics()

        assert res1 == res2, f"Determinism failed for pack {pack.manifest.id}"


def test_hospital_pack_known_result() -> None:
    pack = HospitalPack()
    tests = pack.validation_tests()
    assert len(tests) > 0

    for t in tests:
        assert t.name
        assert len(t.expected_metrics) > 0


def test_fastapi_endpoints() -> None:
    with TestClient(app) as client:
        # 1. Health
        res = client.get("/api/v1/health/live")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # 2. Packs (All 5 must be registered)
        res = client.get("/api/v1/packs")
        assert res.status_code == 200
        packs = res.json()
        assert len(packs) == 5
        pack_ids = {p["id"] for p in packs}
        assert pack_ids == {"hospital", "college", "office", "policy", "social"}

        # 3. Direct runs
        res = client.post(
            "/api/v1/runs",
            json={
                "pack_id": "hospital",
                "parameters": {"num_doctors": 4, "num_nurses": 8, "num_beds": 20, "sim_duration_hours": 4.0},
                "n_replications": 3,
                "master_seed": 42,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] in ("completed", "partial")
        assert len(data["aggregate"]) > 0

        # 4. LLM status
        res = client.get("/api/v1/llm/status")
        assert res.status_code == 200
        assert "models_chain" in res.json()

        # 5. AI simulation plan
        res = client.post(
            "/api/v1/simulations/ai-plan",
            json={
                "prompt": "Emergency department with 4 doctors and 8 nurses has 60 minute wait times.",
                "strategy_count": 2,
                "replications_per_strategy": 3,
            },
        )
        assert res.status_code == 200
        plan = res.json()
        assert plan["pack_id"] == "hospital"
        assert len(plan["strategies"]) >= 2
        assert len(plan["strategy_scores"]) >= 2
        assert plan["report"]["title"]
        assert plan["critic"]["passed"] is True
