"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ErrorBar, Cell,
} from "recharts";
import type { RunResponse, AggregateStats } from "../lib/types";
import { METRIC_META } from "../lib/types";

interface Props {
  result: RunResponse;
}

const DISPLAY_METRICS = [
  "avg_wait_minutes",
  "p95_wait_minutes",
  "bed_utilization",
  "cost_per_patient_usd",
  "patients_seen",
];

function MetricCard({ stat }: { stat: AggregateStats }) {
  const meta = METRIC_META[stat.metric_key];
  if (!meta) return null;
  const ciWidth = ((stat.ci_upper - stat.ci_lower) / 2).toFixed(2);

  return (
    <div className="glass-card p-4 space-y-3 hover:border-indigo-500/30 transition-all duration-200 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-300">{meta.label}</span>
        </div>
        <span className="text-[10px] text-slate-600 font-mono">{meta.unit}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-white tabular-nums" style={{ color: meta.color }}>
            {stat.mean.toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">mean</p>
        </div>
        <div className="text-right space-y-0.5">
          <p className="text-xs text-slate-400 tabular-nums">
            p5: <span className="text-slate-300">{stat.p5.toFixed(1)}</span>
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            p95: <span className="text-slate-300">{stat.p95.toFixed(1)}</span>
          </p>
          <p className="text-[10px] text-slate-600 tabular-nums">±{ciWidth} 95% CI</p>
        </div>
      </div>
      {/* CI bar */}
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, (stat.mean / (stat.p95 || 1)) * 100)}%`,
            backgroundColor: meta.color,
          }}
        />
      </div>
    </div>
  );
}

function MetricBarChart({ aggregates }: { aggregates: AggregateStats[] }) {
  const chartData = aggregates
    .filter((s) => DISPLAY_METRICS.includes(s.metric_key) && s.metric_key !== "patients_seen")
    .map((s) => ({
      name: METRIC_META[s.metric_key]?.label ?? s.metric_key,
      value: parseFloat(s.mean.toFixed(3)),
      error: parseFloat(((s.ci_upper - s.ci_lower) / 2).toFixed(3)),
      color: METRIC_META[s.metric_key]?.color ?? "#6366f1",
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="name"
          tick={{ fill: "#64748b", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "#12141a",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8,
            color: "#f1f5f9",
            fontSize: 12,
          }}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
          <ErrorBar dataKey="error" strokeWidth={2} stroke="rgba(255,255,255,0.3)" />
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ResultsDashboard({ result }: Props) {
  const displayAgg = result.aggregate.filter((s) => DISPLAY_METRICS.includes(s.metric_key));
  const hasDegradations = result.degradations.length > 0;

  return (
    <div className="space-y-6 animate-slide-up stagger-children">
      {/* Run metadata */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${result.status === "completed" ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
          <span className="text-xs font-semibold text-white capitalize">{result.status}</span>
          <span className="text-xs text-slate-600 font-mono">{result.run_id.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{result.n_successful} replications OK</span>
          {result.n_failed > 0 && (
            <span className="text-amber-400">{result.n_failed} failed</span>
          )}
          <span className="hidden sm:inline">Pack: {result.pack_id}</span>
        </div>
      </div>

      {/* Degradation notice */}
      {hasDegradations && (
        <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5">
          <p className="text-xs font-semibold text-amber-400 font-mono uppercase tracking-wider">
            Notice: Degraded Results
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Fallbacks fired: {result.degradations.join(", ")}
          </p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {displayAgg.map((stat) => (
          <MetricCard key={stat.metric_key} stat={stat} />
        ))}
      </div>

      {/* Bar chart */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white">Metric Overview</h3>
          <span className="text-[10px] text-slate-600 font-mono">Error bars = 95% CI</span>
        </div>
        <MetricBarChart aggregates={result.aggregate} />
      </div>

      {/* Assumptions panel */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="text-xs font-semibold text-white">
          Assumptions & Parameters
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(result.parameters).map(([key, val]) => (
            <div key={key} className="bg-white/3 rounded-lg px-3 py-2 space-y-0.5">
              <p className="text-[10px] text-slate-600 font-mono">{key}</p>
              <p className="text-xs text-slate-300 font-semibold">{String(val)}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600">
          Distributions sourced from Mataloni et al. (2020) · Hospital Pack v1.0.0 ·
          <span className="ml-1 text-indigo-400/70">AI-generated, based on model assumptions. Not medical advice.</span>
        </p>
      </div>
    </div>
  );
}
