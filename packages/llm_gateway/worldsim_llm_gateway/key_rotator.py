"""
WorldSim LLM Gateway — Multi-Key Rotator
=========================================
Manages multiple Gemini API keys with round-robin load distribution,
per-key rate limit cooldowns, and automatic key rotation on 429 errors.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Sequence

logger = logging.getLogger(__name__)


def mask_key(key: str) -> str:
    """Safely mask an API key for logging purposes."""
    if not key:
        return "[NONE]"
    if len(key) <= 8:
        return "..." + key[-3:]
    return f"...{key[-4:]}"


class KeyState:
    def __init__(self, key: str):
        self.key: str = key
        self.masked: str = mask_key(key)
        self.cooldown_until: float = 0.0
        self.consecutive_failures: int = 0
        self.total_successes: int = 0
        self.total_requests: int = 0

    @property
    def is_available(self) -> bool:
        return time.time() >= self.cooldown_until


class KeyRotator:
    """
    Thread-safe rotator for multiple Gemini API keys.
    """

    def __init__(self, api_keys: Sequence[str] | None = None, default_cooldown_seconds: float = 60.0):
        self._lock = threading.Lock()
        self._states: list[KeyState] = []
        self._index = 0
        self._default_cooldown = default_cooldown_seconds

        if api_keys:
            self.set_keys(api_keys)

    def set_keys(self, api_keys: Sequence[str]) -> None:
        """Update the pool of keys."""
        with self._lock:
            cleaned = [k.strip() for k in api_keys if k and k.strip()]
            existing = {s.key: s for s in self._states}
            new_states: list[KeyState] = []
            for k in cleaned:
                if k in existing:
                    new_states.append(existing[k])
                else:
                    new_states.append(KeyState(k))
            self._states = new_states
            self._index = 0
            logger.info("KeyRotator initialized with %d keys.", len(self._states))

    @property
    def total_keys(self) -> int:
        with self._lock:
            return len(self._states)

    def get_next_key(self) -> tuple[str, str] | None:
        """
        Returns (api_key, masked_key) for the next healthy key, or None if no keys are configured.
        Prioritizes keys not currently in cooldown.
        """
        with self._lock:
            if not self._states:
                return None

            n = len(self._states)
            # Try to find next key that is available starting from current index
            for i in range(n):
                idx = (self._index + i) % n
                state = self._states[idx]
                if state.is_available:
                    self._index = (idx + 1) % n
                    state.total_requests += 1
                    return state.key, state.masked

            # If all are in cooldown, pick the one that expires soonest
            soonest = min(self._states, key=lambda s: s.cooldown_until)
            self._index = (self._states.index(soonest) + 1) % n
            soonest.total_requests += 1
            return soonest.key, soonest.masked

    def report_success(self, key: str) -> None:
        """Report successful API call using this key."""
        with self._lock:
            for s in self._states:
                if s.key == key:
                    s.total_successes += 1
                    s.consecutive_failures = 0
                    break

    def report_rate_limit(self, key: str, cooldown_seconds: float | None = None) -> None:
        """Mark key in cooldown due to 429 / RESOURCE_EXHAUSTED."""
        cd = cooldown_seconds or self._default_cooldown
        with self._lock:
            for s in self._states:
                if s.key == key:
                    s.consecutive_failures += 1
                    s.cooldown_until = time.time() + cd
                    logger.warning(
                        "Key %s hit rate limit. Put in cooldown for %.1fs (failures: %d).",
                        s.masked,
                        cd,
                        s.consecutive_failures,
                    )
                    break

    def report_failure(self, key: str) -> None:
        """Report general failure for key."""
        with self._lock:
            for s in self._states:
                if s.key == key:
                    s.consecutive_failures += 1
                    break
