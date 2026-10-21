"use client";

import { useState } from "react";
import type { AISimulationResponse, StrategyScore, StrategyInfo } from "../lib/types";

interface Props {
  data: AISimulationResponse;
}

export default function AIDashboard({ data }: Props) {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(
    data.strategy_scores[0]?.strategy_id || ""
  );

  const {
    pack_name,
    objectives,
    constraints,
    assumptions,
    strategies,
    strategy_scores,
    simulation_results,
    report,
    critic,
    degradations,
  } = data;

  const scoreMap = new Map(strategy_scores.map((s) => [s.strategy_id, s]));
  const stratMap = new Map(strategies.map((s) => [s.strategy_id, s]));

  const activeStrategy = stratMap.get(selectedStrategyId) || strategies[0];
  const activeScore = scoreMap.get(selectedStrategyId) || strategy_scores[0];
  const activeMetrics = simulation_results[activeStrategy?.name || ""] || {};

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Top Bar: Executive Brief Header & Critic Badge */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                Pack: {pack_name}
              </span>
              {degradations && degradations.length > 0 ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">
                  Degradations Active ({degradations.length})
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                  Nominal Execution
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {report.title}
            </h1>
          </div>

          {/* Critic Verification Box */}
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 ${
              critic.passed
                ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                : "bg-amber-950/30 border-amber-500/30 text-amber-300"
            }`}
          >
            <div className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-1 rounded border border-current">
              {critic.passed ? "VERIFIED" : "FLAGGED"}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                Factual Fidelity: {critic.passed ? "PASSED" : "DISCREPANCY"}
              </div>
              <div className="text-[11px] opacity-90 max-w-xs">{critic.notes}</div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Executive Summary
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">{report.executive_summary}</p>
        </div>

        {/* Top Recommendation Box */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-500/30 space-y-3">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
            <span>Recommended Decision:</span>
            <span className="text-white bg-indigo-600 px-3 py-0.5 rounded-lg font-bold">
              {report.recommended_strategy}
            </span>
          </div>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            {report.recommendation_rationale}
          </p>
        </div>

        {/* Key Findings List */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Key Quantitative Findings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.key_findings.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300"
              >
                <span className="text-indigo-400 font-bold">•</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strategy Comparison Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Ranked Strategy Comparison</span>
            <span className="text-xs font-normal text-slate-400">
              (Deterministic SimPy Monte Carlo Outputs)
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {strategy_scores.map((sc) => {
            const strat = stratMap.get(sc.strategy_id);
            const isSelected = selectedStrategyId === sc.strategy_id;
            const metrics = simulation_results[sc.strategy_name] || {};
            const waitTime = metrics["avg_wait_minutes"]?.mean ?? "N/A";
            const costVal = metrics["total_cost_usd"]?.mean ?? "N/A";
            const bedUtil = metrics["bed_utilization"]?.mean ?? "N/A";

            return (
              <div
                key={sc.strategy_id}
                onClick={() => setSelectedStrategyId(sc.strategy_id)}
                className={`glass-card p-5 cursor-pointer transition-all space-y-4 relative overflow-hidden ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-950/20"
                    : "hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                {sc.is_pareto_optimal && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase tracking-wider font-mono">
                    Pareto Optimal
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-400 font-mono">RANK #{sc.rank}</div>
                  <div className="font-bold text-white text-sm line-clamp-1">
                    {sc.strategy_name}
                  </div>
                </div>

                {/* Score bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Composite Score</span>
                    <span className="font-bold text-indigo-400 font-mono">
                      {(sc.composite_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, sc.composite_score * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Metrics preview */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Avg Wait</span>
                    <span className="font-semibold text-slate-200">
                      {typeof waitTime === "number" ? `${waitTime} min` : waitTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Bed Util</span>
                    <span className="font-semibold text-slate-200">
                      {typeof bedUtil === "number" ? `${bedUtil}%` : bedUtil}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Strategy Deep-Dive */}
      {activeStrategy && (
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                Detailed Strategy Analysis
              </div>
              <h3 className="text-xl font-bold text-white mt-1">{activeStrategy.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{activeStrategy.description}</p>
            </div>
            {activeScore?.is_pareto_optimal && (
              <div className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold w-fit uppercase tracking-wider font-mono">
                Pareto Frontier Member
              </div>
            )}
          </div>

          {/* 4 Axis Scores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {activeScore?.axis_scores.map((ax) => (
              <div
                key={ax.axis}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2"
              >
                <div className="text-xs font-semibold uppercase text-slate-400">{ax.axis}</div>
                <div className="text-2xl font-bold text-white font-mono">{(ax.score * 100).toFixed(0)}%</div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${ax.score * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Detailed metrics table with Confidence Intervals */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Monte Carlo Simulation Metrics (95% Confidence Intervals)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-white/5 text-slate-400 uppercase font-semibold font-mono">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Metric</th>
                    <th className="py-2.5 px-3">Mean</th>
                    <th className="py-2.5 px-3">Median</th>
                    <th className="py-2.5 px-3">Std Dev</th>
                    <th className="py-2.5 px-3">95% CI Range</th>
                    <th className="py-2.5 px-3 rounded-r-lg">P95 Worst-Case</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {Object.entries(activeMetrics).map(([key, val]) => (
                    <tr key={key} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-medium text-white">{key}</td>
                      <td className="py-2.5 px-3 font-bold text-indigo-300">{val.mean}</td>
                      <td className="py-2.5 px-3">{val.median}</td>
                      <td className="py-2.5 px-3 text-slate-400">{val.std_dev}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        [{val.ci_lower} - {val.ci_upper}]
                      </td>
                      <td className="py-2.5 px-3 text-amber-300 font-semibold">{val.p95}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Parameter deltas */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="text-xs font-semibold text-slate-400">Parameter Configuration</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(activeStrategy.parameters).map(([k, v]) => (
                <span
                  key={k}
                  className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs text-slate-300 font-mono"
                >
                  <strong className="text-white">{k}:</strong> {String(v)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assumptions & Integrity Disclosure (Honesty PRD Section 12) */}
      <div className="glass-card p-6 space-y-4 border-slate-700/50">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span>Explicit Model Assumptions and Defaults</span>
          <span className="text-[10px] text-slate-500 font-normal">
            (Zero silent inventions - PRD Honesty Rule)
          </span>
        </h3>
        <div className="space-y-2">
          {assumptions && assumptions.length > 0 ? (
            assumptions.map((asm, i) => (
              <div key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-slate-600 font-bold font-mono">#</span>
                <span>{asm}</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500">All parameters explicitly provided.</div>
          )}
        </div>
      </div>
    </div>
  );
}
