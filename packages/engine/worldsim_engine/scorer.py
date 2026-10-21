"""
WorldSim Engine — Weighted Scorer & Pareto Frontier
=====================================================
Converts aggregate simulation statistics into composite scores across
Cost, Risk, Time, and Efficiency axes, then identifies Pareto-optimal strategies.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

import numpy as np

from worldsim_shared.schemas import (
    AggregateStats,
    AxisScore,
    MetricAxis,
    MetricDefinition,
    StrategyScore,
)


def score_strategies(
    strategy_results: list[dict[str, Any]],  # [{strategy_id, strategy_name, aggregate: list[AggregateStats]}]
    metric_definitions: list[MetricDefinition],
    axis_weights: dict[MetricAxis, float] | None = None,
) -> list[StrategyScore]:
    """
    Rank all strategies by weighted composite score.

    Args:
        strategy_results: List of dicts with strategy metadata and their aggregate stats.
        metric_definitions: Metric-to-axis mappings from the pack.
        axis_weights: Optional user-configured weights (default: 0.25 each axis).

    Returns:
        List of StrategyScore sorted by composite_score descending (best first).
    """
    weights = axis_weights or {axis: 0.25 for axis in MetricAxis}
    total_weight = sum(weights.values())
    normalized_weights = {k: v / total_weight for k, v in weights.items()}

    metric_map = {m.key: m for m in metric_definitions}

    # Build raw axis scores per strategy (mean values)
    raw: list[dict[str, Any]] = []
    for sr in strategy_results:
        agg_map = {a.metric_key: a for a in sr["aggregate"]}
        axis_means: dict[MetricAxis, list[float]] = {ax: [] for ax in MetricAxis}
        for mdef in metric_map.values():
            if mdef.key in agg_map:
                axis_means[mdef.axis].append(agg_map[mdef.key].mean)
        raw.append({"id": sr["strategy_id"], "name": sr["strategy_name"], "axis_means": axis_means})

    # Normalize per axis across all strategies (min-max, respecting lower_is_better)
    axis_all: dict[MetricAxis, list[float]] = {ax: [] for ax in MetricAxis}
    for r in raw:
        for ax, vals in r["axis_means"].items():
            if vals:
                axis_all[ax].append(np.mean(vals))
            else:
                axis_all[ax].append(np.nan)

    def _normalize_axis(values: list[float], lower_is_better: bool) -> list[float]:
        arr = np.array(values, dtype=float)
        valid = arr[~np.isnan(arr)]
        if len(valid) == 0:
            return [0.5] * len(values)
        vmin, vmax = float(np.min(valid)), float(np.max(valid))
        if vmin == vmax:
            return [0.5] * len(values)
        normed = (arr - vmin) / (vmax - vmin)
        if lower_is_better:
            normed = 1.0 - normed
        return [float(v) for v in normed]

    # Determine lower_is_better per axis (majority vote across metrics in that axis)
    axis_lower: dict[MetricAxis, bool] = {}
    for ax in MetricAxis:
        axis_metrics = [m for m in metric_definitions if m.axis == ax]
        if not axis_metrics:
            axis_lower[ax] = True
        else:
            axis_lower[ax] = sum(1 for m in axis_metrics if m.lower_is_better) >= len(axis_metrics) / 2

    normed_per_axis: dict[MetricAxis, list[float]] = {
        ax: _normalize_axis(axis_all[ax], axis_lower[ax]) for ax in MetricAxis
    }

    # Build StrategyScore objects
    scores: list[StrategyScore] = []
    for i, r in enumerate(raw):
        axis_scores: list[AxisScore] = []
        composite = 0.0
        for ax in MetricAxis:
            norm_val = normed_per_axis[ax][i]
            w = normalized_weights.get(ax, 0.25)
            axis_scores.append(AxisScore(axis=ax, score=norm_val, weight=w))
            composite += norm_val * w

        scores.append(
            StrategyScore(
                strategy_id=r["id"],
                strategy_name=r["name"],
                composite_score=composite,
                axis_scores=axis_scores,
                is_pareto_optimal=False,
                rank=0,
            )
        )

    # Assign ranks
    scores.sort(key=lambda s: s.composite_score, reverse=True)
    for rank, s in enumerate(scores, start=1):
        s.rank = rank

    # Mark Pareto-optimal strategies
    _mark_pareto(scores)
    return scores


def _mark_pareto(scores: list[StrategyScore]) -> None:
    """
    Mark each strategy as Pareto-optimal (non-dominated) across all axis scores.
    A strategy is dominated if another strategy is at least as good on every axis
    and strictly better on at least one.
    """
    n = len(scores)
    for i in range(n):
        dominated = False
        for j in range(n):
            if i == j:
                continue
            si = scores[i].axis_scores
            sj = scores[j].axis_scores
            si_map = {a.axis: a.score for a in si}
            sj_map = {a.axis: a.score for a in sj}
            axes = list(si_map.keys())
            if all(sj_map[ax] >= si_map[ax] for ax in axes) and any(
                sj_map[ax] > si_map[ax] for ax in axes
            ):
                dominated = True
                break
        scores[i].is_pareto_optimal = not dominated
