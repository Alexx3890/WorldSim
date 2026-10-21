"""
WorldSim Engine — Monte Carlo Runner
======================================
Runs R replications of a pack model in parallel using ProcessPoolExecutor.
Each replication is deterministic given (pack, params, seed).
Failed replications are captured and excluded without discarding completed ones.
"""
from __future__ import annotations

import time
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Any, Callable

import numpy as np
import simpy

from worldsim_shared.schemas import DegradationType, ReplicationMetrics, RunStatus


def _run_single_replication(
    pack_factory: Callable[[], Any],  # returns a BasePack instance (must be picklable)
    params: dict[str, Any],
    seed: int,
    replication_index: int,
    sim_duration: float,
    warmup_duration: float,
) -> ReplicationMetrics:
    """
    Top-level function (must be at module level for pickle / ProcessPoolExecutor).
    Builds the pack model, runs the SimPy environment, and returns metrics.
    """
    start = time.perf_counter()
    try:
        rng = np.random.default_rng(seed)
        env = simpy.Environment()
        pack = pack_factory()
        model = pack.build(params=params, seed=seed, env=env)

        # Wrap the model's run generator in the SimPy env
        env.process(model.run())
        env.run(until=sim_duration)

        raw_metrics = model.collect_metrics()

        return ReplicationMetrics(
            replication_index=replication_index,
            seed=seed,
            metrics=raw_metrics,
            duration_seconds=time.perf_counter() - start,
        )
    except Exception as exc:
        return ReplicationMetrics(
            replication_index=replication_index,
            seed=seed,
            metrics={},
            duration_seconds=time.perf_counter() - start,
            failed=True,
            error=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}",
        )


class MonteCarloRunner:
    """
    Orchestrates parallel simulation replications.
    - Uses ProcessPoolExecutor for true CPU parallelism.
    - Streams progress via an optional callback.
    - Captures failed replications without discarding successful ones.
    - Applies convergence check to stop early if CI width is met.
    """

    def __init__(
        self,
        worker_pool_size: int,
        min_replications: int,
        max_replications: int,
        convergence_ci_width: float,
        replication_timeout_seconds: float,
        warmup_fraction: float,
    ) -> None:
        self.worker_pool_size = worker_pool_size
        self.min_replications = min_replications
        self.max_replications = max_replications
        self.convergence_ci_width = convergence_ci_width
        self.replication_timeout_seconds = replication_timeout_seconds
        self.warmup_fraction = warmup_fraction

    def run(
        self,
        pack_factory: Callable[[], Any],
        params: dict[str, Any],
        master_seed: int,
        n_replications: int,
        sim_duration: float,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> tuple[list[ReplicationMetrics], list[DegradationType]]:
        """
        Run n_replications Monte Carlo replications.

        Args:
            pack_factory: Zero-arg callable returning a BasePack (picklable).
            params: Validated parameter dict.
            master_seed: Master seed; per-replication seeds derived deterministically.
            n_replications: Requested replication count (clamped to [min, max]).
            sim_duration: Total simulated time units.
            progress_callback: Optional fn(completed, total) called after each result.

        Returns:
            (replications, degradations)
        """
        n = max(self.min_replications, min(n_replications, self.max_replications))
        warmup = sim_duration * self.warmup_fraction

        # Deterministic per-replication seeds derived from master seed
        seed_sequence = np.random.SeedSequence(master_seed)
        seeds = [int(s.generate_state(1)[0]) for s in seed_sequence.spawn(n)]

        results: list[ReplicationMetrics] = []
        degradations: list[DegradationType] = []

        with ProcessPoolExecutor(max_workers=self.worker_pool_size) as executor:
            futures = {
                executor.submit(
                    _run_single_replication,
                    pack_factory,
                    params,
                    seed,
                    idx,
                    sim_duration,
                    warmup,
                ): idx
                for idx, seed in enumerate(seeds)
            }

            for future in as_completed(futures, timeout=self.replication_timeout_seconds * n):
                result = future.result()
                results.append(result)
                completed = len(results)
                if progress_callback:
                    progress_callback(completed, n)

                # Early convergence check (only after min replications)
                if completed >= self.min_replications:
                    if self._converged(results):
                        # Cancel remaining futures
                        for f in futures:
                            f.cancel()
                        break

        # Classify partial-result degradation
        successful = [r for r in results if not r.failed]
        failed = [r for r in results if r.failed]

        if failed:
            degradations.append(DegradationType.PARTIAL_REPLICATIONS)
        if len(successful) < self.min_replications:
            degradations.append(DegradationType.LOW_CONFIDENCE)

        return sorted(results, key=lambda r: r.replication_index), degradations

    def _converged(self, results: list[ReplicationMetrics]) -> bool:
        """
        Check if all metrics have 95% CI half-width < convergence_ci_width * mean.
        Returns True if convergence threshold met for all tracked metrics.
        """
        from scipy import stats

        successful = [r for r in results if not r.failed]
        if len(successful) < self.min_replications:
            return False

        metric_keys = list(successful[0].metrics.keys())
        for key in metric_keys:
            values = np.array([r.metrics[key] for r in successful], dtype=float)
            mean = float(np.mean(values))
            if abs(mean) < 1e-9:
                continue  # skip near-zero metrics
            se = float(stats.sem(values))
            ci_half = float(stats.t.ppf(0.975, df=len(values) - 1) * se)
            if (ci_half / abs(mean)) > self.convergence_ci_width:
                return False
        return True


def compute_run_status(
    n_requested: int,
    n_successful: int,
    min_replications: int,
) -> RunStatus:
    """Determine final run status from replication counts."""
    if n_successful == 0:
        return RunStatus.FAILED
    if n_successful < min_replications:
        return RunStatus.FAILED
    if n_successful < n_requested:
        return RunStatus.PARTIAL
    return RunStatus.COMPLETED
