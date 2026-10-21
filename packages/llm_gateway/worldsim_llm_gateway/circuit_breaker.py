"""
WorldSim LLM Gateway — Circuit Breaker
=======================================
Protects against cascaded outages and quota exhaustion by fast-failing
calls to failing models/endpoints and half-open probing for recovery.
"""
from __future__ import annotations

import logging
import threading
import time
from enum import Enum

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"        # Normal operation
    OPEN = "open"            # Failing; fast-fail without calling backend
    HALF_OPEN = "half_open"  # Testing recovery


class ModelCircuitBreaker:
    """Per-model circuit breaker."""

    def __init__(self, failure_threshold: int = 5, recovery_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_seconds = recovery_seconds
        self._lock = threading.Lock()
        self._states: dict[str, dict[str, float | int | CircuitState]] = {}

    def _get_entry(self, model: str) -> dict[str, float | int | CircuitState]:
        if model not in self._states:
            self._states[model] = {
                "state": CircuitState.CLOSED,
                "consecutive_failures": 0,
                "last_failure_time": 0.0,
                "opened_at": 0.0,
            }
        return self._states[model]

    def can_attempt(self, model: str) -> bool:
        """Returns True if the circuit allows an attempt to the given model."""
        with self._lock:
            entry = self._get_entry(model)
            state = entry["state"]

            if state == CircuitState.CLOSED:
                return True

            now = time.time()
            opened_at = float(entry["opened_at"])
            if state == CircuitState.OPEN:
                if now - opened_at >= self.recovery_seconds:
                    entry["state"] = CircuitState.HALF_OPEN
                    logger.info("Circuit breaker for %s transitioned to HALF_OPEN (probing).", model)
                    return True
                return False

            if state == CircuitState.HALF_OPEN:
                # Allow probe attempt
                return True

            return True

    def record_success(self, model: str) -> None:
        """Record successful call for model, closing the circuit."""
        with self._lock:
            entry = self._get_entry(model)
            if entry["state"] != CircuitState.CLOSED:
                logger.info("Circuit breaker for %s recovered -> CLOSED.", model)
            entry["state"] = CircuitState.CLOSED
            entry["consecutive_failures"] = 0

    def record_failure(self, model: str) -> None:
        """Record failure for model, incrementing counter and potentially opening circuit."""
        with self._lock:
            entry = self._get_entry(model)
            entry["consecutive_failures"] = int(entry["consecutive_failures"]) + 1
            entry["last_failure_time"] = time.time()

            if (
                entry["state"] == CircuitState.HALF_OPEN
                or int(entry["consecutive_failures"]) >= self.failure_threshold
            ):
                entry["state"] = CircuitState.OPEN
                entry["opened_at"] = time.time()
                logger.warning(
                    "Circuit breaker for %s tripped -> OPEN for %.1fs (failures: %d).",
                    model,
                    self.recovery_seconds,
                    entry["consecutive_failures"],
                )
