"use client";

import React, { useState } from "react";
import { StrategyInfo } from "../lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

export interface LiveRunProps {
  strategies: StrategyInfo[];
  currentReplication: number;
  totalReplications: number;
  activeStrategyIndex: number;
  logs: string[];
  onCancel: () => void;
  isComplete: boolean;
  onViewResults: () => void;
}

export function LiveRun({
  strategies,
  currentReplication,
  totalReplications,
  activeStrategyIndex,
  logs,
  onCancel,
  isComplete,
  onViewResults,
}: LiveRunProps) {
  const [showLogs, setShowLogs] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">
            Monte Carlo Simulation Execution
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Deterministic parallel execution across all alternative strategies with seed sequence branching.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isComplete ? (
            <Button variant="destructive" size="sm" onClick={onCancel}>
              Cancel run
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={onViewResults}>
              View simulation results
            </Button>
          )}
        </div>
      </div>

      {/* Strategies Progress List */}
      <div className="space-y-3">
        {strategies.map((strat, idx) => {
          let statusText = "QUEUED";
          let badgeVariant: "neutral" | "accent" | "success" = "neutral";
          let progressPercent = 0;

          if (isComplete || idx < activeStrategyIndex) {
            statusText = "COMPLETED";
            badgeVariant = "success";
            progressPercent = 100;
          } else if (idx === activeStrategyIndex) {
            statusText = "RUNNING";
            badgeVariant = "accent";
            progressPercent = Math.min(
              100,
              Math.round((currentReplication / Math.max(1, totalReplications)) * 100)
            );
          }

          return (
            <div
              key={strat.strategy_id}
              className="p-3.5 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[var(--text-muted)]">
                    [{idx}]
                  </span>
                  <span className="font-semibold text-[var(--text)]">
                    {strat.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[var(--text-muted)]">
                    {statusText === "RUNNING"
                      ? `${currentReplication} / ${totalReplications} reps`
                      : statusText === "COMPLETED"
                      ? `${totalReplications} / ${totalReplications} reps`
                      : `0 / ${totalReplications} reps`}
                  </span>
                  <Badge label={statusText} variant={badgeVariant} />
                </div>
              </div>

              {/* Thin Flat Progress Bar */}
              <div className="w-full bg-[var(--bg)] border border-[var(--border)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[var(--accent)] h-full transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Agent Execution Log */}
      <div className="border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text)] cursor-pointer"
        >
          <span>AGENT EXECUTION TRACE & RUNNER LOGS ({logs.length} EVENTS)</span>
          <span className="font-mono text-[var(--text-muted)]">
            {showLogs ? "[COLLAPSE]" : "[EXPAND]"}
          </span>
        </button>

        {showLogs && (
          <div className="p-3 bg-[var(--surface)] max-h-56 overflow-y-auto font-mono text-xs text-[var(--text-muted)] space-y-1">
            {logs.length === 0 ? (
              <div className="text-[var(--text-muted)] italic">
                Awaiting pipeline dispatch...
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[var(--text-muted)] opacity-60">
                    &gt;
                  </span>
                  <span className="text-[var(--text)]">{log}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
