"""
WorldSim Engine — Pack Interface (ABC)
=======================================
Every scenario pack MUST subclass BasePack and implement all abstract methods.
The engine registry refuses to load packs that fail manifest validation.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Generator

import simpy

from worldsim_shared.schemas import (
    AggregateStats,
    MetricDefinition,
    PackManifest,
    PackSchema,
    ReplicationMetrics,
)


class KnownResultTest:
    """
    A validation test with a known analytical answer.
    Packs ship these to prove the model is calibrated correctly
    (e.g., M/M/c formula for an ED simulation).
    """

    def __init__(
        self,
        name: str,
        params: dict[str, Any],
        seed: int,
        expected_metrics: dict[str, float],
        tolerance_fraction: float = 0.15,  # allow 15% relative error vs analytical
    ) -> None:
        self.name = name
        self.params = params
        self.seed = seed
        self.expected_metrics = expected_metrics
        self.tolerance_fraction = tolerance_fraction

    def check(self, actual: dict[str, float]) -> list[str]:
        """Returns list of failure messages; empty list means pass."""
        failures: list[str] = []
        for key, expected in self.expected_metrics.items():
            actual_val = actual.get(key)
            if actual_val is None:
                failures.append(f"{key}: not found in actual metrics")
                continue
            if expected == 0:
                if abs(actual_val) > 1e-6:
                    failures.append(f"{key}: expected ~0, got {actual_val}")
            else:
                rel_err = abs(actual_val - expected) / abs(expected)
                if rel_err > self.tolerance_fraction:
                    failures.append(
                        f"{key}: expected {expected:.4f}, got {actual_val:.4f} "
                        f"(relative error {rel_err:.1%} > {self.tolerance_fraction:.1%})"
                    )
        return failures


class SimPyModel(ABC):
    """
    A single runnable model instance for one replication.
    Built by BasePack.build() with specific params and seed.
    """

    def __init__(self, env: simpy.Environment, rng: Any) -> None:
        self.env = env
        self.rng = rng
        self._metrics: dict[str, list[float]] = {}

    @abstractmethod
    def run(self) -> Generator[Any, Any, None]:
        """SimPy generator — the top-level process for this model."""
        ...

    @abstractmethod
    def collect_metrics(self) -> dict[str, float]:
        """Return final metric values after simulation completes."""
        ...

    def record(self, key: str, value: float) -> None:
        """Track a running metric value (accumulated during simulation)."""
        if key not in self._metrics:
            self._metrics[key] = []
        self._metrics[key].append(value)


class BasePack(ABC):
    """
    Abstract base class every WorldSim scenario pack must implement.
    The engine registry loads packs via this interface exclusively.
    """

    @property
    @abstractmethod
    def manifest(self) -> PackManifest:
        """Pack identity and compatibility metadata."""
        ...

    @property
    @abstractmethod
    def schema(self) -> PackSchema:
        """Describes all configurable parameters with bounds and units."""
        ...

    @property
    @abstractmethod
    def metric_definitions(self) -> list[MetricDefinition]:
        """Maps raw model outputs to cost/risk/time/efficiency axes."""
        ...

    @abstractmethod
    def build(self, params: dict[str, Any], seed: int, env: simpy.Environment) -> SimPyModel:
        """
        Instantiate and return a SimPyModel for one replication.
        The engine calls this once per replication with the given seed.
        Must NOT run the simulation — only set up the model.
        """
        ...

    @abstractmethod
    def validate_params(self, params: dict[str, Any]) -> list[str]:
        """
        Validate domain-specific parameter constraints.
        Returns a list of error messages; empty list means valid.
        Core engine bounds (min/max on schema) are checked separately.
        """
        ...

    @abstractmethod
    def validation_tests(self) -> list[KnownResultTest]:
        """
        Return a list of known-result tests (e.g., queueing-theory benchmarks).
        CI runs these against the built model to detect regressions.
        """
        ...

    def default_params(self) -> dict[str, Any]:
        """Return a dict of all parameter defaults from the pack schema."""
        return {field.name: field.default for field in self.schema.parameters}

    def aggregate_metrics(
        self, replications: list[ReplicationMetrics]
    ) -> list[AggregateStats]:
        """
        Default aggregation: mean, median, std, p5/p95, 95% CI.
        Packs may override for custom aggregation logic.
        """
        import numpy as np
        from scipy import stats

        successful = [r for r in replications if not r.failed]
        if not successful:
            return []

        all_keys = set(successful[0].metrics.keys())
        results: list[AggregateStats] = []
        for key in all_keys:
            values = np.array([r.metrics[key] for r in successful], dtype=float)
            n = len(values)
            mean = float(np.mean(values))
            se = float(stats.sem(values)) if n > 1 else 0.0
            ci_margin = float(stats.t.ppf(0.975, df=max(n - 1, 1)) * se)
            results.append(
                AggregateStats(
                    metric_key=key,
                    mean=mean,
                    median=float(np.median(values)),
                    std_dev=float(np.std(values, ddof=1)) if n > 1 else 0.0,
                    p5=float(np.percentile(values, 5)),
                    p95=float(np.percentile(values, 95)),
                    ci_lower=mean - ci_margin,
                    ci_upper=mean + ci_margin,
                    n_successful=n,
                )
            )
        return results
