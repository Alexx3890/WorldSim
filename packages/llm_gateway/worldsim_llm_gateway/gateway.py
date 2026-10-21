"""
WorldSim LLM Gateway — Gemini Multi-Model & Multi-Key Gateway
==============================================================
Implements:
  - Multi-model fallback chain: gemini-2.0-flash → gemini-1.5-flash → gemini-1.5-flash-8b → gemini-2.0-flash-lite → manual
  - Multi-key rotation & per-key 429 rate limit backoff
  - Circuit breaking per model
  - Structured output with Pydantic validation
  - Self-healing repair loop on schema validation failures
  - Call audit logging with token count and latency tracking
"""
from __future__ import annotations

import json
import logging
import time
from collections import deque
from typing import Any, Type, TypeVar

from pydantic import BaseModel, ValidationError

from worldsim_shared.config import Settings, get_settings
from worldsim_llm_gateway.circuit_breaker import ModelCircuitBreaker
from worldsim_llm_gateway.key_rotator import KeyRotator, mask_key
from worldsim_llm_gateway.models import GatewayResult, LLMCallLog

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class GeminiGateway:
    """
    Production-grade LLM Gateway for Google Gemini models.
    """

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.rotator = KeyRotator(
            api_keys=self.settings.get_gemini_api_keys(),
            default_cooldown_seconds=float(self.settings.llm.circuit_breaker_recovery_seconds),
        )
        self.circuit_breaker = ModelCircuitBreaker(
            failure_threshold=self.settings.llm.circuit_breaker_failure_threshold,
            recovery_seconds=float(self.settings.llm.circuit_breaker_recovery_seconds),
        )
        # In-memory log buffer for recent calls (capped at 500)
        self._call_logs: deque[LLMCallLog] = deque(maxlen=500)

    @property
    def model_priority_chain(self) -> list[str]:
        """Ordered list of Gemini free-tier models configured for the platform."""
        return [
            self.settings.llm.primary_model,
            self.settings.llm.secondary_model,
            self.settings.llm.tertiary_model,
            self.settings.llm.fallback_model,
        ]

    def get_recent_logs(self, limit: int = 50) -> list[LLMCallLog]:
        """Return the most recent call logs."""
        logs = list(self._call_logs)
        return logs[-limit:]

    def _get_client(self, api_key: str):
        """Lazy client creator using google.genai."""
        try:
            from google import genai
            return genai.Client(api_key=api_key)
        except Exception as e:
            logger.error("Failed to initialize genai.Client: %s", e)
            raise

    def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        system_instruction: str | None = None,
        agent_name: str = "generic_agent",
        max_repair_retries: int | None = None,
    ) -> GatewayResult[T]:
        """
        Generate structured output conforming to response_schema.
        Iterates through the model chain and rotating keys.
        Executes repair loop if schema validation fails.
        """
        start_time = time.time()
        retries_allowed = (
            max_repair_retries
            if max_repair_retries is not None
            else self.settings.agents.max_repair_retries
        )

        keys = self.settings.get_gemini_api_keys()
        if not keys:
            # Degraded manual mode fallback when no keys are supplied
            latency = (time.time() - start_time) * 1000.0
            log = LLMCallLog(
                agent_name=agent_name,
                model="manual_offline",
                key_hint="[NONE]",
                latency_ms=latency,
                status="fallback_manual",
                degradation_reason="No GEMINI_API_KEY provided in environment",
            )
            self._call_logs.append(log)
            return GatewayResult[T](
                data=None,
                raw_text="",
                model_used="manual_offline",
                key_hint="[NONE]",
                latency_ms=latency,
                degraded=True,
                degradation_reason="No GEMINI_API_KEY provided in environment. Switched to manual mode.",
                call_log=log,
            )

        last_error: Exception | None = None
        models = self.model_priority_chain

        for model in models:
            if not self.circuit_breaker.can_attempt(model):
                logger.info("Circuit breaker OPEN for model %s. Skipping to next model.", model)
                continue

            # Attempt across available keys
            num_keys = max(self.rotator.total_keys, 1)
            for _ in range(num_keys):
                key_info = self.rotator.get_next_key()
                if not key_info:
                    break
                api_key, key_hint = key_info

                try:
                    result = self._execute_with_repair(
                        model=model,
                        api_key=api_key,
                        key_hint=key_hint,
                        prompt=prompt,
                        response_schema=response_schema,
                        system_instruction=system_instruction,
                        agent_name=agent_name,
                        max_repairs=retries_allowed,
                    )
                    self.rotator.report_success(api_key)
                    self.circuit_breaker.record_success(model)
                    return result
                except Exception as exc:
                    last_error = exc
                    err_str = str(exc)
                    is_rate_limit = (
                        "429" in err_str
                        or "RESOURCE_EXHAUSTED" in err_str
                        or "quota" in err_str.lower()
                    )

                    if is_rate_limit:
                        self.rotator.report_rate_limit(api_key)
                    else:
                        self.rotator.report_failure(api_key)

                    logger.warning(
                        "LLM call failed [model=%s, key=%s]: %s",
                        model,
                        key_hint,
                        err_str[:200],
                    )

            # If all keys failed for this model, record model circuit failure
            self.circuit_breaker.record_failure(model)

        # If all models in the chain were exhausted
        latency = (time.time() - start_time) * 1000.0
        log = LLMCallLog(
            agent_name=agent_name,
            model="exhausted",
            key_hint="all",
            latency_ms=latency,
            status="failed",
            error_message=str(last_error),
            degradation_reason="All Gemini models and keys exhausted or throttled",
        )
        self._call_logs.append(log)

        return GatewayResult[T](
            data=None,
            raw_text="",
            model_used="none",
            key_hint="none",
            latency_ms=latency,
            degraded=True,
            degradation_reason=f"Gemini fallback chain exhausted: {last_error}",
            call_log=log,
        )

    def _execute_with_repair(
        self,
        model: str,
        api_key: str,
        key_hint: str,
        prompt: str,
        response_schema: Type[T],
        system_instruction: str | None,
        agent_name: str,
        max_repairs: int,
    ) -> GatewayResult[T]:
        """Calls Gemini API and runs schema validation with repair attempts."""
        from google.genai import types

        client = self._get_client(api_key)
        current_prompt = prompt
        repair_attempts = 0
        call_start = time.time()

        for attempt in range(max_repairs + 1):
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=self.settings.llm.temperature,
                max_output_tokens=self.settings.llm.max_tokens,
                system_instruction=system_instruction,
            )

            response = client.models.generate_content(
                model=model,
                contents=current_prompt,
                config=config,
            )

            raw_text = response.text or ""
            latency = (time.time() - call_start) * 1000.0

            # Usage tokens
            prompt_tokens = 0
            completion_tokens = 0
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
                completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

            # Validate against Pydantic model
            try:
                # Clean any markdown fences if present
                clean_json = raw_text.strip()
                if clean_json.startswith("```json"):
                    clean_json = clean_json[7:]
                elif clean_json.startswith("```"):
                    clean_json = clean_json[3:]
                if clean_json.endswith("```"):
                    clean_json = clean_json[:-3]
                clean_json = clean_json.strip()

                parsed_data = response_schema.model_validate_json(clean_json)

                log = LLMCallLog(
                    agent_name=agent_name,
                    model=model,
                    key_hint=key_hint,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    latency_ms=latency,
                    status="repaired" if repair_attempts > 0 else "success",
                    repair_count=repair_attempts,
                )
                self._call_logs.append(log)

                return GatewayResult[T](
                    data=parsed_data,
                    raw_text=raw_text,
                    model_used=model,
                    key_hint=key_hint,
                    latency_ms=latency,
                    repaired=(repair_attempts > 0),
                    repair_attempts=repair_attempts,
                    degraded=False,
                    call_log=log,
                )

            except (ValidationError, json.JSONDecodeError) as val_err:
                repair_attempts += 1
                if attempt < max_repairs:
                    logger.info(
                        "Schema validation failed for %s (attempt %d/%d). Invoking repair prompt.",
                        agent_name,
                        attempt + 1,
                        max_repairs,
                    )
                    current_prompt = (
                        f"{prompt}\n\n"
                        f"IMPORTANT: Your previous output failed schema validation:\n"
                        f"Error: {val_err}\n"
                        f"Previous output was:\n{raw_text}\n\n"
                        f"Please output ONLY valid JSON satisfying the schema requirements strictly."
                    )
                else:
                    raise val_err

        raise RuntimeError(f"Execution failed to return a result for {agent_name}")
