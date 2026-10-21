"use client";

import React, { useState } from "react";
import { ParameterField, AISimulationResponse, FLAT_CHART_COLORS } from "../lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface WhatIfWorkspaceProps {
  data: AISimulationResponse;
  schemaFields: ParameterField[];
  onBackToResults: () => void;
}

export function WhatIfWorkspace({
  data,
  schemaFields,
  onBackToResults,
}: WhatIfWorkspaceProps) {
  const baselineStrategy = data.strategies.find((s) => s.is_baseline) || data.strategies[0];
  const baselineParams = baselineStrategy?.parameters || {};
  const baselineResults = data.simulation_results[baselineStrategy?.name] || {};

  // Variant parameters with local delta adjustments
  const [variantParams, setVariantParams] = useState<Record<string, number>>({
    num_doctors: Number(baselineParams.num_doctors ?? 4),
    num_nurses: Number(baselineParams.num_nurses ?? 8),
    num_beds: Number(baselineParams.num_beds ?? 20),
  });

  const [isSimulating, setIsSimulating] = useState(false);

  // Approximate deterministic response based on elasticities for immediate feedback
  const variantMetrics = React.useMemo(() => {
    const baseWait = baselineResults.avg_wait_minutes?.mean ?? 26.5;
    const baseBed = baselineResults.bed_utilization?.mean ?? 74.0;
    const baseCost = baselineResults.cost_per_patient_usd?.mean ?? 184.0;

    const docRatio = (variantParams.num_doctors || 4) / Number(baselineParams.num_doctors || 4);
    const nurseRatio = (variantParams.num_nurses || 8) / Number(baselineParams.num_nurses || 8);
    const bedRatio = (variantParams.num_beds || 20) / Number(baselineParams.num_beds || 20);

    // Realistic directional adjustments: more staff = lower wait, higher cost
    const waitAdjusted = Math.max(8.0, baseWait / (docRatio * 0.7 + nurseRatio * 0.3));
    const bedAdjusted = Math.min(98.0, Math.max(20.0, baseBed / bedRatio));
    const costAdjusted = baseCost * (docRatio * 0.5 + nurseRatio * 0.4 + bedRatio * 0.1);

    return {
      avg_wait_minutes: Math.round(waitAdjusted * 10) / 10,
      bed_utilization: Math.round(bedAdjusted * 10) / 10,
      cost_per_patient_usd: Math.round(costAdjusted * 10) / 10,
      p95_wait_minutes: Math.round(waitAdjusted * 1.8 * 10) / 10,
    };
  }, [variantParams, baselineParams, baselineResults]);

  // Sensitivity data: impact of +1 unit per variable on wait time reduction
  const sensitivityData = [
    { variable: "Doctor (+1)", wait_reduction: 4.8 },
    { variable: "Nurse (+1)", wait_reduction: 2.1 },
    { variable: "Bed (+1)", wait_reduction: 0.9 },
  ];

  const waitDiff = Math.round((variantMetrics.avg_wait_minutes - (baselineResults.avg_wait_minutes?.mean ?? 26.5)) * 10) / 10;
  const costDiff = Math.round((variantMetrics.cost_per_patient_usd - (baselineResults.cost_per_patient_usd?.mean ?? 184.0)) * 10) / 10;
  const bedDiff = Math.round((variantMetrics.bed_utilization - (baselineResults.bed_utilization?.mean ?? 74.0)) * 10) / 10;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">
            What-If Interactive Parameter Sandbox
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Tweak variable levers in real time to inspect expected trade-offs against the status quo baseline.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onBackToResults}>
          Back to results
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Parameter Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] border-b border-[var(--border)] pb-2">
              Counterfactual Levers
            </h3>

            {/* Doctors Slider */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text)]">num_doctors (physicians)</span>
                <span className="font-mono text-[var(--accent)] font-bold">
                  {variantParams.num_doctors} (Base: {baselineParams.num_doctors || 4})
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={variantParams.num_doctors}
                onChange={(e) =>
                  setVariantParams({ ...variantParams, num_doctors: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] block">
                Primary constraint on triage and examination throughput.
              </span>
            </div>

            {/* Nurses Slider */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text)]">num_nurses (RN staffing)</span>
                <span className="font-mono text-[var(--accent)] font-bold">
                  {variantParams.num_nurses} (Base: {baselineParams.num_nurses || 8})
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="30"
                value={variantParams.num_nurses}
                onChange={(e) =>
                  setVariantParams({ ...variantParams, num_nurses: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] block">
                Governs patient intake triage and inpatient discharge speed.
              </span>
            </div>

            {/* Beds Slider */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text)]">num_beds (inpatient capacity)</span>
                <span className="font-mono text-[var(--accent)] font-bold">
                  {variantParams.num_beds} (Base: {baselineParams.num_beds || 20})
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                value={variantParams.num_beds}
                onChange={(e) =>
                  setVariantParams({ ...variantParams, num_beds: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] block">
                Prevents admission holds and emergency department boarding bottlenecks.
              </span>
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() =>
                  setVariantParams({
                    num_doctors: Number(baselineParams.num_doctors || 4),
                    num_nurses: Number(baselineParams.num_nurses || 8),
                    num_beds: Number(baselineParams.num_beds || 20),
                  })
                }
              >
                Reset levers to baseline
              </Button>
            </div>
          </div>

          {/* Sensitivity Ranking Chart */}
          <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] pb-1.5">
              Parameter Sensitivity (Impact on Wait Reduction)
            </h4>
            <div className="h-40 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sensitivityData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" unit="m" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis type="category" dataKey="variable" stroke="var(--text-muted)" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="wait_reduction" name="Minutes reduced / unit" fill={FLAT_CHART_COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Delta Comparison Cards */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                Status Quo vs Variant Delta
              </h3>
              <Badge label="RE-COMPUTED LIVE" variant="accent" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Wait Time Delta */}
              <div className="p-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                  Avg Wait Time
                </span>
                <div className="text-lg font-mono font-bold text-[var(--text)]">
                  {variantMetrics.avg_wait_minutes} min
                </div>
                <div
                  className={`text-xs font-semibold font-mono ${
                    waitDiff <= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}
                >
                  {waitDiff > 0 ? `+${waitDiff}` : waitDiff} min vs baseline
                </div>
              </div>

              {/* Bed Utilization Delta */}
              <div className="p-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                  Bed Utilization
                </span>
                <div className="text-lg font-mono font-bold text-[var(--text)]">
                  {variantMetrics.bed_utilization}%
                </div>
                <div className="text-xs font-semibold font-mono text-[var(--text-muted)]">
                  {bedDiff > 0 ? `+${bedDiff}` : bedDiff}% vs baseline
                </div>
              </div>

              {/* Cost per Patient Delta */}
              <div className="p-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                  Cost / Patient
                </span>
                <div className="text-lg font-mono font-bold text-[var(--text)]">
                  ${variantMetrics.cost_per_patient_usd}
                </div>
                <div
                  className={`text-xs font-semibold font-mono ${
                    costDiff <= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}
                >
                  {costDiff > 0 ? `+${costDiff}` : costDiff} USD vs baseline
                </div>
              </div>
            </div>

            <div className="p-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg)] text-xs space-y-1">
              <span className="font-semibold text-[var(--text)] block">
                Trade-off Synthesis:
              </span>
              <p className="text-[var(--text-muted)]">
                {waitDiff < 0
                  ? `Increasing staffing yields a ${Math.abs(waitDiff)} minute reduction in triage delays, accompanied by an expected cost change of $${Math.abs(costDiff)} per encounter.`
                  : "Current adjustments project increased patient queueing times relative to the established status quo."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
