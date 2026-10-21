"use client";

import React, { useState } from "react";
import { HistoryRunRecord } from "../lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

export interface HistoryAndCompareProps {
  runs: HistoryRunRecord[];
  onLoadRun?: (runId: string) => void;
  mode?: "history" | "compare";
}

export function HistoryAndCompare({
  runs,
  onLoadRun,
  mode = "history",
}: HistoryAndCompareProps) {
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);

  const toggleSelectRun = (id: string) => {
    setSelectedRunIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const selectedRuns = runs.filter((r) => selectedRunIds.includes(r.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">
            {mode === "history" ? "Simulation Run History" : "Side-by-Side Run Comparison"}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {mode === "history"
              ? "Audit trail of executed Monte Carlo simulations with degradation tracking."
              : "Compare alternative decision runs across scenarios and pack versions."}
          </p>
        </div>
      </div>

      {/* Runs Table */}
      <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-x-auto bg-[var(--surface)]">
        <table className="w-full text-left border-collapse text-xs tabular-numbers">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
              <th className="p-3 w-8">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3">Run ID</th>
              <th className="p-3">Scenario Decision</th>
              <th className="p-3">Pack</th>
              <th className="p-3">Status</th>
              <th className="p-3">Top Ranked Strategy</th>
              <th className="p-3">Degradations</th>
              <th className="p-3">Timestamp</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-xs text-[var(--text-muted)] italic">
                  No simulation runs recorded yet. Start a new simulation to generate results.
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                const isSelected = selectedRunIds.includes(run.id);
                return (
                  <tr
                    key={run.id}
                    className={isSelected ? "bg-[var(--bg)] font-semibold" : "hover:bg-[var(--bg)]"}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRun(run.id)}
                        className="rounded border-[var(--border)]"
                      />
                    </td>
                    <td className="p-3 font-mono text-[var(--text-muted)]">
                      {run.id.slice(0, 8)}
                    </td>
                    <td className="p-3 font-semibold text-[var(--text)]">
                      {run.scenario_title}
                    </td>
                    <td className="p-3 font-mono text-[var(--text-muted)]">
                      {run.pack_id}
                    </td>
                    <td className="p-3">
                      <Badge
                        label={run.status.toUpperCase()}
                        variant={
                          run.status === "completed"
                            ? "success"
                            : run.status === "partial"
                            ? "warning"
                            : "danger"
                        }
                      />
                    </td>
                    <td className="p-3 text-[var(--text)]">
                      {run.best_strategy}
                    </td>
                    <td className="p-3">
                      {run.degradations.length > 0 ? (
                        <Badge label="DEGRADED" variant="warning" title={run.degradations.join(", ")} />
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)]">None (Clean)</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[var(--text-muted)]">
                      {run.date}
                    </td>
                    <td className="p-3 text-right">
                      {onLoadRun && (
                        <button
                          onClick={() => onLoadRun(run.id)}
                          className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Side-by-Side Comparison Box if 2 or more selected */}
      {selectedRuns.length >= 2 && (
        <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
              Direct Multi-Run Comparison ({selectedRuns.length} selected)
            </h3>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setSelectedRunIds([])}
            >
              Clear selection
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {selectedRuns.map((r) => (
              <div
                key={r.id}
                className="p-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg)] space-y-2 text-xs"
              >
                <div className="font-semibold text-[var(--text)] border-b border-[var(--border)] pb-1">
                  {r.scenario_title}
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Pack:</span>
                  <span className="font-mono">{r.pack_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Best Strategy:</span>
                  <span className="font-semibold">{r.best_strategy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Total Strategies:</span>
                  <span className="font-mono">{r.strategy_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Status:</span>
                  <Badge label={r.status.toUpperCase()} variant={r.status === "completed" ? "success" : "warning"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
