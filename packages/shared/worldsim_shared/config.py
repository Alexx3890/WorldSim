"""
WorldSim Shared — Typed Configuration System
=============================================
Loads config in strict priority order:
  1. config/defaults.toml  (base values)
  2. Environment variables  (WS_* prefix)
  3. DB platform_config table  (runtime overrides — applied by app layer, not here)
  4. Per-request overrides     (validated against bounds — applied by app layer)

No business value, threshold, model name, or prompt may appear in application code.
All numeric limits come from this Settings object or pack data files.
"""
from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

if sys.version_info >= (3, 11):
    import tomllib
else:
    try:
        import tomllib  # type: ignore[no-redef]
    except ImportError:
        import tomli as tomllib  # type: ignore[no-redef]

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# ---------------------------------------------------------------------------
# Sub-models — each section of defaults.toml maps to one sub-model
# ---------------------------------------------------------------------------

class AppSettings(BaseSettings):
    name: str = "WorldSim AI"
    version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"

    @field_validator("log_level")
    @classmethod
    def _valid_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in allowed:
            raise ValueError(f"log_level must be one of {allowed}")
        return v.upper()

    @field_validator("environment")
    @classmethod
    def _valid_env(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"environment must be one of {allowed}")
        return v


class ApiSettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = Field(default=8000, ge=1024, le=65535)
    cors_origins: list[str] = ["http://localhost:3000"]
    request_timeout_seconds: int = Field(default=30, ge=1, le=300)
    max_request_body_bytes: int = Field(default=1_048_576, ge=1024)


class SimulationSettings(BaseSettings):
    default_replications: int = Field(default=20, ge=1)
    min_replications: int = Field(default=5, ge=1)
    max_replications: int = Field(default=200, ge=1)
    replication_timeout_seconds: int = Field(default=120, ge=5)
    warmup_fraction: float = Field(default=0.1, ge=0.0, lt=1.0)
    convergence_ci_width: float = Field(default=0.05, ge=0.001, le=1.0)
    worker_pool_size: int = Field(default=4, ge=1, le=64)

    @model_validator(mode="after")
    def _min_le_default_le_max(self) -> "SimulationSettings":
        if self.min_replications > self.default_replications:
            raise ValueError("min_replications must be ≤ default_replications")
        if self.default_replications > self.max_replications:
            raise ValueError("default_replications must be ≤ max_replications")
        return self


class AgentSettings(BaseSettings):
    max_clarification_questions: int = Field(default=5, ge=0, le=20)
    max_repair_retries: int = Field(default=3, ge=0, le=10)
    max_agent_steps: int = Field(default=50, ge=1)
    agent_timeout_seconds: int = Field(default=60, ge=5)
    router_confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    strategy_count_default: int = Field(default=4, ge=1, le=20)


class LLMSettings(BaseSettings):
    # Model names live ONLY in config — never hardcoded in logic.
    primary_model: str = "gemini-2.0-flash"
    secondary_model: str = "gemini-1.5-flash"
    tertiary_model: str = "gemini-1.5-flash-8b"
    fallback_model: str = "gemini-2.0-flash-lite"
    request_timeout_seconds: int = Field(default=20, ge=1, le=120)
    max_tokens: int = Field(default=8192, ge=256)
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    circuit_breaker_failure_threshold: int = Field(default=5, ge=1)
    circuit_breaker_recovery_seconds: int = Field(default=60, ge=10)
    daily_quota_per_model: int = Field(default=1500, ge=1)


class QueueSettings(BaseSettings):
    redis_url: str = "redis://localhost:6379/0"
    simulation_queue: str = "sim_workers"
    agent_queue: str = "agent_workers"
    job_timeout_seconds: int = Field(default=300, ge=30)
    max_job_retries: int = Field(default=3, ge=0, le=10)
    dlq_name: str = "worldsim_dlq"
    heartbeat_interval_seconds: int = Field(default=10, ge=1)


class AuthSettings(BaseSettings):
    secret: str = Field(default="dev-secret-change-me-in-production", description="Auth signing secret")
    session_ttl_seconds: int = Field(default=86400, ge=300)
    token_algorithm: str = "HS256"


class StorageSettings(BaseSettings):
    result_raw_size_cap_bytes: int = Field(default=104_857_600, ge=0)
    export_timeout_seconds: int = Field(default=30, ge=5)


class QuotaSettings(BaseSettings):
    max_runs_per_workspace_per_day: int = Field(default=50, ge=1)
    max_replications_per_run: int = Field(default=200, ge=1)
    max_concurrent_runs_per_workspace: int = Field(default=3, ge=1)


# ---------------------------------------------------------------------------
# Root Settings — loaded once at startup; fails fast on any invalid value.
# ---------------------------------------------------------------------------

class Settings(BaseSettings):
    """
    Single, fully-typed settings object for WorldSim.
    Reads WS_* env vars; nested fields use WS_SECTION__KEY notation.
    Example: WS_LLM__PRIMARY_MODEL overrides llm.primary_model.
    """
    model_config = SettingsConfigDict(
        env_prefix="WS_",
        env_nested_delimiter="__",
        case_sensitive=False,
    )

    # Required secrets (no default — startup fails if missing in production)
    gemini_api_key: str = Field(default="", description="Google Gemini API key")
    gemini_api_keys: list[str] = Field(default_factory=list, description="Multiple Gemini API keys for round-robin rotation & fallback")

    app: AppSettings = Field(default_factory=AppSettings)
    api: ApiSettings = Field(default_factory=ApiSettings)
    simulation: SimulationSettings = Field(default_factory=SimulationSettings)
    agents: AgentSettings = Field(default_factory=AgentSettings)
    llm: LLMSettings = Field(default_factory=LLMSettings)
    queue: QueueSettings = Field(default_factory=QueueSettings)
    auth: AuthSettings = Field(default_factory=AuthSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    quota: QuotaSettings = Field(default_factory=QuotaSettings)

    def get_gemini_api_keys(self) -> list[str]:
        """Returns list of all available Gemini API keys with no duplicates or empty values."""
        keys: list[str] = []
        if self.gemini_api_keys:
            keys.extend([k.strip() for k in self.gemini_api_keys if k and k.strip()])
        if self.gemini_api_key:
            # support comma-separated in single env var too
            parts = [k.strip() for k in self.gemini_api_key.split(",") if k.strip()]
            for p in parts:
                if p not in keys:
                    keys.append(p)
        return keys

    @model_validator(mode="after")
    def _require_api_key_in_prod(self) -> "Settings":
        keys = self.get_gemini_api_keys()
        if self.app.environment == "production" and not keys:
            raise ValueError("GEMINI_API_KEY (or GEMINI_API_KEYS) is required in production")
        if (
            self.app.environment == "production"
            and self.auth.secret == "dev-secret-change-me-in-production"
        ):
            raise ValueError("WS_AUTH__SECRET must be set to a real secret in production")
        return self

    @classmethod
    def from_toml_and_env(cls, toml_path: Path | None = None) -> "Settings":
        """
        Load defaults.toml for documentation purposes; actual loading is done
        by pydantic-settings from environment variables.
        The TOML file is the canonical reference for defaults (already reflected
        in Field defaults above). This method exists for future hot-reload support.
        """
        return cls()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cached singleton — call this everywhere instead of instantiating Settings directly.
    The cache is cleared in tests via get_settings.cache_clear().
    """
    return Settings.from_toml_and_env()
