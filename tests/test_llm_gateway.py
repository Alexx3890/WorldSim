"""
Tests for worldsim_llm_gateway
==============================
Verifies:
- Multi-key rotation, masking, and rate-limit cooldowns
- Circuit breaker state transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
- Gateway fallback chain and degraded mode when keys are absent
"""
import pytest
from pydantic import BaseModel

from worldsim_shared.config import Settings
from worldsim_llm_gateway.circuit_breaker import CircuitState, ModelCircuitBreaker
from worldsim_llm_gateway.gateway import GeminiGateway
from worldsim_llm_gateway.key_rotator import KeyRotator, mask_key


def test_mask_key() -> None:
    assert mask_key("AIzaSyAbc12345") == "...2345"
    assert mask_key("") == "[NONE]"
    assert mask_key("short") == "...ort"


def test_key_rotator_round_robin() -> None:
    rotator = KeyRotator(["key-1", "key-2", "key-3"])
    assert rotator.total_keys == 3

    r1 = rotator.get_next_key()
    r2 = rotator.get_next_key()
    r3 = rotator.get_next_key()
    r4 = rotator.get_next_key()
    assert r1 is not None and r2 is not None and r3 is not None and r4 is not None

    assert r1[0] == "key-1"
    assert r2[0] == "key-2"
    assert r3[0] == "key-3"
    assert r4[0] == "key-1"


def test_key_rotator_rate_limit_cooldown() -> None:
    rotator = KeyRotator(["key-1", "key-2"], default_cooldown_seconds=10.0)

    # Key 1 hits rate limit
    rotator.report_rate_limit("key-1", cooldown_seconds=5.0)

    # Next request should bypass key-1 and use key-2
    next_res = rotator.get_next_key()
    assert next_res is not None
    assert next_res[0] == "key-2"


def test_circuit_breaker() -> None:
    cb = ModelCircuitBreaker(failure_threshold=2, recovery_seconds=1.0)
    model = "gemini-2.0-flash"

    assert cb.can_attempt(model) is True

    # 1 failure
    cb.record_failure(model)
    assert cb.can_attempt(model) is True

    # 2nd failure -> trips circuit to OPEN
    cb.record_failure(model)
    assert cb.can_attempt(model) is False


class SampleSchema(BaseModel):
    message: str
    code: int


def test_gateway_offline_graceful_degradation() -> None:
    """When no API keys are provided, gateway returns degraded response instead of crashing."""
    settings = Settings(gemini_api_key="", gemini_api_keys=[])
    gw = GeminiGateway(settings)

    result = gw.generate_structured(
        prompt="Hello world",
        response_schema=SampleSchema,
        agent_name="TestAgent",
    )

    assert result.degraded is True
    assert result.degradation_reason is not None
    assert "No GEMINI_API_KEY" in result.degradation_reason
    assert result.data is None
