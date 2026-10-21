"""
WorldSim LLM Gateway — Data Models & Schemas
=============================================
Type definitions for LLM requests, responses, call logging, and status.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class LLMCallLog(BaseModel):
    """Log record for an LLM API call."""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    agent_name: str
    model: str
    key_hint: str  # Masked key, e.g. "...A1B2"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    status: str = "success"  # success | repaired | failed | fallback_manual
    error_message: str | None = None
    repair_count: int = 0
    degradation_reason: str | None = None


class GatewayResult(BaseModel, Generic[T]):
    """Standard result envelope returned by GeminiGateway."""
    data: T | None = None
    raw_text: str = ""
    model_used: str = ""
    key_hint: str = ""
    latency_ms: float = 0.0
    repaired: bool = False
    repair_attempts: int = 0
    degraded: bool = False
    degradation_reason: str | None = None
    call_log: LLMCallLog | None = None
