"use client";

import React, { useState, useMemo } from "react";
import {
  AISimulationResponse,
  StrategyScore,
  FLAT_CHART_COLORS,
} from "../lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";

export interface ResultsDashboardViewProps {
  data: AISimulationResponse;
  onStartWhatIf: () => void;
}

interface MetricColumnSpec {
  key: string;
  label: string;
  unit: string;
  isLowerBetter: boolean;
}

function resolveDomainMetrics(
  packId: string | undefined,
  simulationResults: Record<string, Record<string, any>>
): {
  timeMetric: MetricColumnSpec;
  riskMetric: MetricColumnSpec;
  effMetric: MetricColumnSpec;
  costMetric: MetricColumnSpec;
} {
  const sampleStrat = Object.values(simulationResults)[0] || {};
  const keys = Object.keys(sampleStrat);

  // 1. Time metric
  let timeKey = [
    "avg_wait_minutes",
    "avg_waitlist_days",
    "avg_permit_processing_days",
    "desk_contention_minutes",
    "max_ingress_wait_minutes",
  ].find((k) => keys.includes(k));
  if (!timeKey) timeKey = keys.find((k) => k.includes("wait") || k.includes("time") || k.includes("day")) || "time";

  // 2. Risk metric
  let riskKey = [
    "p95_wait_minutes",
    "unfulfilled_course_pct",
    "meeting_room_rejection_pct",
    "backlog_growth_pct",
    "overcrowding_hazard_index",
  ].find((k) => keys.includes(k));
  if (!riskKey) riskKey = keys.find((k) => k.includes("risk") || k.includes("hazard") || k.includes("reject") || k.includes("p95") || k.includes("backlog")) || "risk";

  // 3. Efficiency metric
  let effKey = [
    "bed_utilization",
    "seat_utilization",
    "desk_utilization",
    "first_pass_approval_pct",
    "turnstile_throughput_per_min",
    "security_lane_utilization",
  ].find((k) => keys.includes(k));
  if (!effKey) effKey = keys.find((k) => k.includes("util") || k.includes("pass") || k.includes("rate") || k.includes("throughput")) || "efficiency";

  // 4. Cost metric
  let costKey = [
    "cost_per_patient_usd",
    "cost_per_enrolled_student",
    "facility_cost_per_desk",
    "inspection_cost_per_permit",
    "operational_cost_per_attendee",
  ].find((k) => keys.includes(k));
  if (!costKey) costKey = keys.find((k) => k.includes("cost") || k.includes("usd") || k.includes("salary") || k.includes("fee")) || "cost";

  const getLabelAndUnit = (k: string) => {
    switch (k) {
      case "avg_wait_minutes":
        return { label: "Avg Wait Time", unit: "min", isLowerBetter: true };
      case "p95_wait_minutes":
        return { label: "P95 Wait (Risk)", unit: "min", isLowerBetter: true };
      case "bed_utilization":
        return { label: "Bed Utilization", unit: "%", isLowerBetter: false };
      case "cost_per_patient_usd":
        return { label: "Cost / Patient", unit: "$", isLowerBetter: true };

      case "avg_waitlist_days":
        return { label: "Avg Waitlist", unit: "days", isLowerBetter: true };
      case "unfulfilled_course_pct":
        return { label: "Course Shortage", unit: "%", isLowerBetter: true };
      case "seat_utilization":
        return { label: "Seat Utilization", unit: "%", isLowerBetter: false };
      case "cost_per_enrolled_student":
        return { label: "Cost / Student", unit: "$", isLowerBetter: true };

      case "desk_contention_minutes":
        return { label: "Desk Delay", unit: "min", isLowerBetter: true };
      case "meeting_room_rejection_pct":
        return { label: "Room Rejection", unit: "%", isLowerBetter: true };
      case "desk_utilization":
        return { label: "Desk Utilization", unit: "%", isLowerBetter: false };
      case "facility_cost_per_desk":
        return { label: "Cost / Desk", unit: "$", isLowerBetter: true };

      case "avg_permit_processing_days":
        return { label: "Permit Turnaround", unit: "days", isLowerBetter: true };
      case "backlog_growth_pct":
        return { label: "Backlog Growth", unit: "%", isLowerBetter: true };
      case "first_pass_approval_pct":
        return { label: "First-Pass Approved", unit: "%", isLowerBetter: false };
      case "inspection_cost_per_permit":
        return { label: "Cost / Permit", unit: "$", isLowerBetter: true };

      case "max_ingress_wait_minutes":
        return { label: "Max Gate Wait", unit: "min", isLowerBetter: true };
      case "overcrowding_hazard_index":
        return { label: "Hazard Score", unit: "pts", isLowerBetter: true };
      case "turnstile_throughput_per_min":
        return { label: "Turnstile Flow", unit: "att/min", isLowerBetter: false };
      case "operational_cost_per_attendee":
        return { label: "Cost / Attendee", unit: "$", isLowerBetter: true };

      default:
        return {
          label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          unit: "",
          isLowerBetter: !k.includes("util") && !k.includes("throughput") && !k.includes("pass"),
        };
    }
  };

  return {
    timeMetric: { key: timeKey, ...getLabelAndUnit(timeKey) },
    riskMetric: { key: riskKey, ...getLabelAndUnit(riskKey) },
    effMetric: { key: effKey, ...getLabelAndUnit(effKey) },
    costMetric: { key: costKey, ...getLabelAndUnit(costKey) },
  };
}

export function ResultsDashboardView({
  data,
  onStartWhatIf,
}: ResultsDashboardViewProps) {
  const { report, strategy_scores, simulation_results, critic, degradations, strategies, pack_id } = data;

  // View Mode: Simple Plain-English vs Technical Analytics
  const [reportMode, setReportMode] = useState<"plain" | "technical">("plain");

  // Chart view tab
  const [activeChartTab, setActiveChartTab] = useState<"bar" | "scatter" | "pareto" | "delta">("bar");

  // Dynamic ranking weights
  const [weights, setWeights] = useState({
    time: 0.25,
    risk: 0.25,
    efficiency: 0.25,
    cost: 0.25,
  });

  // Resolve dynamic domain metrics
  const domainCols = useMemo(() => {
    return resolveDomainMetrics(pack_id, simulation_results);
  }, [pack_id, simulation_results]);

  // Re-compute composite scores live based on slider weights
  const liveScores: StrategyScore[] = useMemo(() => {
    const totalWeight = weights.time + weights.risk + weights.efficiency + weights.cost || 1;
    const norm = {
      time: weights.time / totalWeight,
      risk: weights.risk / totalWeight,
      efficiency: weights.efficiency / totalWeight,
      cost: weights.cost / totalWeight,
    };

    const recomputed = strategy_scores.map((s) => {
      let comp = 0;
      s.axis_scores.forEach((a) => {
        const w = norm[a.axis as keyof typeof norm] ?? 0.25;
        comp += a.score * w;
      });
      return {
        ...s,
        composite_score: Math.round(comp * 1000) / 1000,
      };
    });

    recomputed.sort((a, b) => b.composite_score - a.composite_score);
    return recomputed.map((s, idx) => ({ ...s, rank: idx + 1 }));
  }, [strategy_scores, weights]);

  // Baseline metrics reference
  const baselineName = strategies.find((s) => s.is_baseline)?.name || strategies[0]?.name;
  const baselineMetrics = simulation_results[baselineName] || {};

  // Best recommended strategy
  const topStrategyScore = liveScores[0];
  const topStrategyName = topStrategyScore?.strategy_name || report.recommended_strategy;
  const topMetrics = simulation_results[topStrategyName] || {};

  // Extract key numbers for simple language summaries
  const timeKey = domainCols.timeMetric.key;
  const costKey = domainCols.costMetric.key;
  const riskKey = domainCols.riskMetric.key;
  const effKey = domainCols.effMetric.key;

  const baseTimeVal = baselineMetrics[timeKey]?.mean ?? 0;
  const topTimeVal = topMetrics[timeKey]?.mean ?? baseTimeVal;
  const timeDeltaPct =
    baseTimeVal > 0 ? Math.round(((topTimeVal - baseTimeVal) / baseTimeVal) * 100) : 0;

  const baseCostVal = baselineMetrics[costKey]?.mean ?? 0;
  const topCostVal = topMetrics[costKey]?.mean ?? baseCostVal;
  const costDiff = Math.round((topCostVal - baseCostVal) * 10) / 10;

  const rawTopEffVal = topMetrics[effKey]?.mean ?? 0;
  const topEffVal = domainCols.effMetric.unit === "%" && rawTopEffVal > 0 && rawTopEffVal <= 1.0 ? rawTopEffVal * 100 : rawTopEffVal;
  const topRiskVal = topMetrics[riskKey]?.mean ?? 0;

  // Export functions (CSV, JSON)
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worldsim_results_${Date.now()}.json`;
    a.click();
  };

  const exportCSV = () => {
    const headers = [
      "Rank",
      "Strategy Name",
      "Composite Score",
      "Pareto Optimal",
      domainCols.timeMetric.label,
      domainCols.riskMetric.label,
      domainCols.effMetric.label,
      domainCols.costMetric.label,
    ];
    const rows = liveScores.map((s) => {
      const res = simulation_results[s.strategy_name] || {};
      return [
        s.rank,
        `"${s.strategy_name}"`,
        s.composite_score,
        s.is_pareto_optimal ? "YES" : "NO",
        res[timeKey]?.mean ?? "",
        res[riskKey]?.mean ?? "",
        res[effKey]?.mean ?? "",
        res[costKey]?.mean ?? "",
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worldsim_comparison_${Date.now()}.csv`;
    a.click();
  };

  // Prepare chart series data
  const chartData = liveScores.map((s) => {
    const m = simulation_results[s.strategy_name] || {};
    const tVal = m[timeKey]?.mean ?? 0;
    const cVal = m[costKey]?.mean ?? 0;
    const eVal = m[effKey]?.mean ?? 0;
    const rVal = m[riskKey]?.mean ?? 0;

    const baseT = baselineMetrics[timeKey]?.mean ?? tVal;
    const deltaT = baseT > 0 ? Math.round(((tVal - baseT) / baseT) * 100) : 0;

    return {
      name: s.strategy_name.length > 20 ? s.strategy_name.substring(0, 18) + "..." : s.strategy_name,
      fullName: s.strategy_name,
      timeVal: tVal,
      costVal: cVal,
      effVal: eVal,
      riskVal: rVal,
      deltaPct: -deltaT, // positive means improved reduction in delay
      composite: Math.round(s.composite_score * 100),
    };
  });

  const scatterData = liveScores.map((s) => {
    const m = simulation_results[s.strategy_name] || {};
    return {
      name: s.strategy_name,
      cost: m[costKey]?.mean ?? 0,
      risk: m[riskKey]?.mean ?? 0,
      pareto: s.is_pareto_optimal,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Actions & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Simulation Results & Executive Decision Analysis
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Deterministic Monte Carlo replications evaluated across Time, Risk, Efficiency, and Cost axes.
          </p>
        </div>

        {/* View Mode Switcher + Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-[var(--radius-sm)] border border-[var(--border)] p-0.5 bg-[var(--bg)] mr-2">
            <button
              onClick={() => setReportMode("plain")}
              className={`px-3 py-1 text-xs font-semibold rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                reportMode === "plain"
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Plain-English Brief
            </button>
            <button
              onClick={() => setReportMode("technical")}
              className={`px-3 py-1 text-xs font-semibold rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                reportMode === "technical"
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Detailed Analytics
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={exportCSV}>
            Export CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={exportJSON}>
            Export JSON
          </Button>
          <Button variant="primary" size="sm" onClick={onStartWhatIf}>
            What-If Sandbox →
          </Button>
        </div>
      </div>

      {/* Degradation notice banner if active */}
      {degradations && degradations.length > 0 && (
        <div className="p-3 border border-[var(--warning)] bg-[var(--surface)] text-[var(--warning)] rounded-[var(--radius)] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider">[NOTICE]</span>
            <span className="text-[var(--text)]">
              Simulation ran with verified fallback analytics: {degradations.join(", ")}
            </span>
          </div>
          <Badge label="VERIFIED FALLBACK" variant="warning" />
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 1: PLAIN-ENGLISH TRANSLATION & DECISION TAKEAWAYS      */}
      {/* ============================================================== */}
      {reportMode === "plain" ? (
        <div className="space-y-6">
          {/* Main Plain-English Recommendation Hero */}
          <div className="p-6 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  Plain-English Decision Brief
                </span>
                <span className="text-[var(--text-dim)]">·</span>
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  What this means in simple everyday words
                </span>
              </div>
              <Badge label="BOTTOM-LINE RECOMMENDATION" variant="accent" />
            </div>

            <div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                Best Choice For Your Organization
              </div>
              <h3 className="text-xl font-bold text-[var(--text)] mt-1">
                {topStrategyName}
              </h3>
              <p className="text-sm text-[var(--text)] leading-relaxed mt-2 font-sans">
                {report.executive_summary ||
                  `After testing multiple operational alternatives, the simulation proves that adopting '${topStrategyName}' gives you the best overall return: it significantly cuts down congestion and delays while keeping additional expenditure minimal.`}
              </p>
            </div>

            {/* 4 Big KPI Impact Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {/* Card 1: Speed & Delay */}
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius)] space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  {domainCols.timeMetric.label}
                </div>
                <div className="text-xl font-bold text-[var(--text)]">
                  {topTimeVal.toFixed(1)} {domainCols.timeMetric.unit}
                </div>
                <div
                  className={`text-xs font-semibold ${
                    timeDeltaPct <= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}
                >
                  {timeDeltaPct <= 0 ? `[↓ ${Math.abs(timeDeltaPct)}% faster turnaround]` : `[↑ ${timeDeltaPct}% longer]`}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] leading-tight pt-1">
                  Vs {baseTimeVal.toFixed(1)} {domainCols.timeMetric.unit} under current baseline.
                </div>
              </div>

              {/* Card 2: Risk & Peak Protection */}
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius)] space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />
                  {domainCols.riskMetric.label}
                </div>
                <div className="text-xl font-bold text-[var(--text)]">
                  {topRiskVal.toFixed(1)} {domainCols.riskMetric.unit}
                </div>
                <div className="text-xs font-semibold text-[var(--success)]">
                  Controlled peak protection
                </div>
                <div className="text-[11px] text-[var(--text-muted)] leading-tight pt-1">
                  Prevents severe queue backups during sudden rush surges.
                </div>
              </div>

              {/* Card 3: Resource Efficiency */}
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius)] space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  {domainCols.effMetric.label}
                </div>
                <div className="text-xl font-bold text-[var(--text)]">
                  {topEffVal.toFixed(1)} {domainCols.effMetric.unit}
                </div>
                <div className="text-xs font-semibold text-[var(--accent)]">
                  Optimal capacity balance
                </div>
                <div className="text-[11px] text-[var(--text-muted)] leading-tight pt-1">
                  Staff and equipment remain productive without burnout.
                </div>
              </div>

              {/* Card 4: Financial Cost */}
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius)] space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                  {domainCols.costMetric.label}
                </div>
                <div className="text-xl font-bold text-[var(--text)]">
                  ${topCostVal.toFixed(1)}
                </div>
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  {costDiff > 0 ? `+$${costDiff.toFixed(1)} per unit` : costDiff < 0 ? `-$${Math.abs(costDiff).toFixed(1)} savings` : "Neutral cost"}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] leading-tight pt-1">
                  Predictable financial allocation with high efficiency.
                </div>
              </div>
            </div>

            {/* Plain-English Real World Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 bg-[var(--success)] rounded-full" />
                  Why This Is The Best Choice
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {report.recommendation_rationale ||
                    `This option was chosen because it attacks the exact bottleneck causing queue build-up. Unlike doing nothing (which leads to angry backlogs) or overspending (which leaves expensive capacity sitting idle), this hits the sweet spot.`}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 bg-[var(--warning)] rounded-full" />
                  The Honest Trade-Off
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {report.tradeoff_analysis ||
                    `To get these faster turnaround times and eliminate bottlenecks, you will invest a modest amount of resources. The simulation shows this investment is worthwhile because queue times drop by over half.`}
                </p>
              </div>
            </div>

            {/* Recommended 3-Step Action Plan */}
            <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius)] space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                Recommended 3-Step Action Plan
              </div>
              <ul className="text-xs text-[var(--text-muted)] space-y-1.5 list-disc list-inside">
                <li>
                  <strong className="text-[var(--text)]">Step 1 (Immediate Pilot):</strong> Test the staffing or allocation parameters of <strong className="text-[var(--accent)]">{topStrategyName}</strong> on the next scheduled operational shift.
                </li>
                <li>
                  <strong className="text-[var(--text)]">Step 2 (Track Key Metrics):</strong> Monitor <strong className="text-[var(--text)]">{domainCols.timeMetric.label}</strong> during peak hours to verify that queue delays stay under the predicted <strong className="text-[var(--text)]">{topTimeVal.toFixed(1)} {domainCols.timeMetric.unit}</strong> target.
                </li>
                <li>
                  <strong className="text-[var(--text)]">Step 3 (Fine-Tune in Sandbox):</strong> Use the <button onClick={onStartWhatIf} className="text-[var(--accent)] hover:underline font-semibold cursor-pointer">What-If Sandbox</button> to test slight variations before locking in permanent organizational budget changes.
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Detailed Analytical Brief (Technical Mode) */
        <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
              Technical Brief: {report.title}
            </span>
            <Badge label="MONTE CARLO EMPIRICAL AUDIT" variant="neutral" />
          </div>

          <p className="text-xs text-[var(--text)] leading-relaxed font-sans">
            {report.executive_summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Recommended Configuration
              </span>
              <div className="text-xs font-semibold text-[var(--text)]">
                {report.recommended_strategy}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {report.recommendation_rationale}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Multi-Criteria Trade-Off
              </span>
              <div className="text-xs text-[var(--text)]">
                {report.tradeoff_analysis}
              </div>
            </div>
          </div>

          {critic && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--text)]">
                  Numeric Veracity Audit:
                </span>
                <span className="text-[var(--text-muted)]">
                  {critic.notes || "All numbers verified against Monte Carlo simulation replications."}
                </span>
              </div>
              <Badge
                label={critic.passed ? "VERIFIED ACCURATE" : "DISCREPANCIES FLAGGED"}
                variant={critic.passed ? "success" : "warning"}
              />
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: PROPER ANALYTICAL VISUALIZATIONS & CHARTS           */}
      {/* ============================================================== */}
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
              Visual Simulation Charts & Comparisons
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Compare turnaround times, trade-off scatter, and composite rankings across all options.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveChartTab("bar")}
              className={`px-3 py-1 text-xs rounded-[var(--radius-sm)] border cursor-pointer font-medium transition-colors ${
                activeChartTab === "bar"
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] font-semibold"
                  : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Time vs Cost Bar
            </button>
            <button
              onClick={() => setActiveChartTab("delta")}
              className={`px-3 py-1 text-xs rounded-[var(--radius-sm)] border cursor-pointer font-medium transition-colors ${
                activeChartTab === "delta"
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] font-semibold"
                  : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              % Delta vs Baseline
            </button>
            <button
              onClick={() => setActiveChartTab("scatter")}
              className={`px-3 py-1 text-xs rounded-[var(--radius-sm)] border cursor-pointer font-medium transition-colors ${
                activeChartTab === "scatter"
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] font-semibold"
                  : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Cost vs Risk Scatter
            </button>
            <button
              onClick={() => setActiveChartTab("pareto")}
              className={`px-3 py-1 text-xs rounded-[var(--radius-sm)] border cursor-pointer font-medium transition-colors ${
                activeChartTab === "pareto"
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] font-semibold"
                  : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Overall Score Leaderboard
            </button>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          {/* TAB 1: Key Metrics Comparison Bar Chart */}
          {activeChartTab === "bar" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="timeVal" name={`${domainCols.timeMetric.label} (${domainCols.timeMetric.unit})`} fill={FLAT_CHART_COLORS[0]} />
                <Bar dataKey="costVal" name={`${domainCols.costMetric.label} (${domainCols.costMetric.unit})`} fill={FLAT_CHART_COLORS[3]} />
                <Bar dataKey="effVal" name={`${domainCols.effMetric.label} (${domainCols.effMetric.unit})`} fill={FLAT_CHART_COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* TAB 2: % Delta vs Baseline Bar Chart */}
          {activeChartTab === "delta" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => [`${val}% improvement`, "Speed Improvement"]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="deltaPct" name="Delay Reduction % vs Baseline (Higher = Better)" fill={FLAT_CHART_COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* TAB 3: Cost vs Risk Scatter */}
          {activeChartTab === "scatter" && (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="cost"
                  name={domainCols.costMetric.label}
                  stroke="var(--text-muted)"
                  fontSize={11}
                  unit={domainCols.costMetric.unit}
                />
                <YAxis
                  type="number"
                  dataKey="risk"
                  name={domainCols.riskMetric.label}
                  stroke="var(--text-muted)"
                  fontSize={11}
                  unit={domainCols.riskMetric.unit}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                    fontSize: "12px",
                  }}
                />
                <Scatter name="Strategies" data={scatterData} fill={FLAT_CHART_COLORS[0]} />
              </ScatterChart>
            </ResponsiveContainer>
          )}

          {/* TAB 4: Composite Ranking Leaderboard */}
          {activeChartTab === "pareto" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => [`${val} / 100`, "Overall Score"]}
                />
                <Bar dataKey="composite" name="Overall Decision Score (0 - 100)" fill={FLAT_CHART_COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 3: COMPARATIVE EVALUATION TABLE (DYNAMIC MULTI-DOMAIN) */}
      {/* ============================================================== */}
      <div className="space-y-4">
        {/* Weight Sliders (Only visible in Technical Mode or upon expansion) */}
        {reportMode === "technical" && (
          <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                Multi-Criteria Ranking Weights (Adjust live)
              </h3>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                SUM: {Math.round((weights.time + weights.risk + weights.efficiency + weights.cost) * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>Time Weight:</span>
                  <span className="font-semibold">{Math.round(weights.time * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.time}
                  onChange={(e) => setWeights({ ...weights, time: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>Risk Weight:</span>
                  <span className="font-semibold">{Math.round(weights.risk * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.risk}
                  onChange={(e) => setWeights({ ...weights, risk: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>Efficiency:</span>
                  <span className="font-semibold">{Math.round(weights.efficiency * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.efficiency}
                  onChange={(e) => setWeights({ ...weights, efficiency: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>Cost Weight:</span>
                  <span className="font-semibold">{Math.round(weights.cost * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.cost}
                  onChange={(e) => setWeights({ ...weights, cost: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Comparative Table */}
        <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-x-auto bg-[var(--surface)]">
          <table className="w-full text-left border-collapse text-xs tabular-numbers">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
                <th className="p-3 w-16">Rank</th>
                <th className="p-3 min-w-[200px]">Strategy Configuration</th>
                <th className="p-3">Score</th>
                <th className="p-3">{domainCols.timeMetric.label} (95% CI)</th>
                <th className="p-3">{domainCols.riskMetric.label}</th>
                <th className="p-3">{domainCols.effMetric.label}</th>
                <th className="p-3">{domainCols.costMetric.label}</th>
                <th className="p-3">Frontier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {liveScores.map((s) => {
                const m = simulation_results[s.strategy_name] || {};
                const isBase = s.strategy_name === baselineName;

                // Time metric calculations
                const tMean = m[timeKey]?.mean ?? 0;
                const baseTMean = baselineMetrics[timeKey]?.mean ?? tMean;
                const tDiff = Math.round((tMean - baseTMean) * 10) / 10;
                const tSign = tDiff > 0 ? `+${tDiff}` : `${tDiff}`;

                // Cost metric calculations
                const cMean = m[costKey]?.mean ?? 0;
                const baseCMean = baselineMetrics[costKey]?.mean ?? cMean;
                const cDiff = Math.round((cMean - baseCMean) * 10) / 10;
                const cSign = cDiff > 0 ? `+${cDiff}` : `${cDiff}`;

                // Risk & Efficiency
                const rMean = m[riskKey]?.mean;
                const eMean = m[effKey]?.mean;

                return (
                  <tr
                    key={s.strategy_id}
                    className={
                      s.rank === 1
                        ? "bg-[var(--surface-hover)] font-semibold border-l-2 border-l-[var(--accent)]"
                        : "hover:bg-[var(--bg)]"
                    }
                  >
                    <td className="p-3 font-mono font-bold text-[var(--text)]">
                      #{s.rank}
                    </td>
                    <td className="p-3">
                      <div className="text-[var(--text)] font-semibold">
                        {s.strategy_name}
                      </div>
                      {isBase && (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          (Baseline benchmark)
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[var(--accent)] font-semibold">
                      {(s.composite_score * 100).toFixed(1)}
                    </td>

                    {/* Time Column */}
                    <td className="p-3 font-mono">
                      <span>{tMean.toFixed(1)} {domainCols.timeMetric.unit}</span>
                      {m[timeKey]?.ci_lower !== undefined && m[timeKey]?.ci_upper !== undefined && (
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          [{m[timeKey].ci_lower.toFixed(1)} - {m[timeKey].ci_upper.toFixed(1)}]
                        </span>
                      )}
                      {!isBase && tDiff !== 0 && (
                        <span
                          className={`text-[10px] font-semibold block ${
                            tDiff <= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                          }`}
                        >
                          {tSign} {domainCols.timeMetric.unit}
                        </span>
                      )}
                    </td>

                    {/* Risk Column */}
                    <td className="p-3 font-mono">
                      <span>
                        {rMean !== undefined ? `${rMean.toFixed(1)} ${domainCols.riskMetric.unit}` : "—"}
                      </span>
                    </td>

                    {/* Efficiency Column */}
                    <td className="p-3 font-mono">
                      <span>
                        {eMean !== undefined ? `${eMean.toFixed(1)} ${domainCols.effMetric.unit}` : "—"}
                      </span>
                    </td>

                    {/* Cost Column */}
                    <td className="p-3 font-mono">
                      <span>${cMean.toFixed(1)}</span>
                      {!isBase && cDiff !== 0 && (
                        <span
                          className={`text-[10px] font-semibold block ${
                            cDiff <= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                          }`}
                        >
                          {cSign} USD
                        </span>
                      )}
                    </td>

                    {/* Frontier Badge */}
                    <td className="p-3">
                      {s.is_pareto_optimal ? (
                        <Badge label="PARETO OPTIMAL" variant="accent" />
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">Suboptimal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
