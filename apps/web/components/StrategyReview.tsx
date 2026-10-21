"use client";

import React, { useState } from "react";
import { StrategyInfo } from "../lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

export interface StrategyReviewProps {
  strategies: StrategyInfo[];
  onAddStrategy: (newStrategy: StrategyInfo) => void;
  onRemoveStrategy: (strategyId: string) => void;
  onRunSimulation: () => void;
  onBack?: () => void;
  isSimulating?: boolean;
}

export function StrategyReview({
  strategies,
  onAddStrategy,
  onRemoveStrategy,
  onRunSimulation,
  onBack,
  isSimulating = false,
}: StrategyReviewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStratName, setNewStratName] = useState("");
  const [newStratDesc, setNewStratDesc] = useState("");
  const [newDeltaParam, setNewDeltaParam] = useState("num_doctors");
  const [newDeltaVal, setNewDeltaVal] = useState(1);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStratName.trim()) return;

    const baseParams = strategies[0]?.parameters || {};
    const newParams = { ...baseParams, [newDeltaParam]: (baseParams[newDeltaParam] || 0) + newDeltaVal };

    const newStrat: StrategyInfo = {
      strategy_id: "user-strat-" + Date.now(),
      name: newStratName.trim(),
      description: newStratDesc.trim() || `User manual variant adjusting ${newDeltaParam}`,
      parameter_deltas: { [newDeltaParam]: newDeltaVal },
      parameters: newParams,
      origin: "user",
      hypothesis: `Adjusting ${newDeltaParam} will directly impact throughput.`,
      is_baseline: false,
    };

    onAddStrategy(newStrat);
    setNewStratName("");
    setNewStratDesc("");
    setShowAddModal(false);
  };

  const formatDeltas = (deltas: Record<string, any>) => {
    const keys = Object.keys(deltas);
    if (keys.length === 0) return "No modifications (Status quo)";
    return keys
      .map((k) => {
        const val = deltas[k];
        const sign = typeof val === "number" && val > 0 ? "+" : "";
        return `${k.replace(/_/g, " ")}: ${sign}${val}`;
      })
      .join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">
            Decision Strategies & Interventions
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Baseline status quo is simulated alongside counterfactual strategies to rank comparative outcomes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="secondary"
              size="md"
              onClick={onBack}
              disabled={isSimulating}
            >
              ← Back to Parameters
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowAddModal(true)}
            disabled={isSimulating}
          >
            Add strategy
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onRunSimulation}
            loading={isSimulating}
          >
            Run simulation ({strategies.length} strategies) →
          </Button>
        </div>
      </div>

      {/* Strategies Table */}
      <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-x-auto bg-[var(--surface)]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
              <th className="p-3">#</th>
              <th className="p-3">Strategy Name</th>
              <th className="p-3">Parameter Deltas</th>
              <th className="p-3">Origin</th>
              <th className="p-3">Core Hypothesis</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {strategies.map((strat, idx) => (
              <tr
                key={strat.strategy_id}
                className={
                  strat.is_baseline
                    ? "bg-[var(--surface)] font-medium"
                    : "hover:bg-[var(--bg)]"
                }
              >
                <td className="p-3 font-mono text-[var(--text-muted)]">{idx}</td>
                <td className="p-3">
                  <div className="font-semibold text-[var(--text)]">{strat.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {strat.description}
                  </div>
                </td>
                <td className="p-3 font-mono text-[var(--text)]">
                  {formatDeltas(strat.parameter_deltas)}
                </td>
                <td className="p-3">
                  {strat.is_baseline ? (
                    <Badge label="BASELINE" variant="neutral" />
                  ) : strat.origin === "user" ? (
                    <Badge label="USER" variant="neutral" />
                  ) : (
                    <Badge label="AI PROPOSAL" variant="accent" />
                  )}
                </td>
                <td className="p-3 text-[var(--text-muted)] max-w-xs truncate">
                  {strat.hypothesis || "None specified"}
                </td>
                <td className="p-3 text-right">
                  {strat.is_baseline ? (
                    <span className="text-[11px] text-[var(--text-muted)] italic">
                      Locked
                    </span>
                  ) : (
                    <button
                      onClick={() => onRemoveStrategy(strat.strategy_id)}
                      disabled={isSimulating}
                      className="text-xs text-[var(--danger)] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Strategy Modal / Form */}
      {showAddModal && (
        <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              Create Alternative Intervention Strategy
            </h3>
            <button
              onClick={() => setShowAddModal(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  Strategy Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Add 2 Doctor Night Shift"
                  value={newStratName}
                  onChange={(e) => setNewStratName(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius)] text-xs text-[var(--text)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  Parameter to Modify
                </label>
                <select
                  value={newDeltaParam}
                  onChange={(e) => setNewDeltaParam(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius)] text-xs font-mono text-[var(--text)]"
                >
                  <option value="num_doctors">num_doctors</option>
                  <option value="num_nurses">num_nurses</option>
                  <option value="num_beds">num_beds</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  Delta (Signed Offset from Baseline)
                </label>
                <input
                  type="number"
                  value={newDeltaVal}
                  onChange={(e) => setNewDeltaVal(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius)] text-xs font-mono text-[var(--text)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  Description / Rationale
                </label>
                <input
                  type="text"
                  placeholder="Optional rationale"
                  value={newStratDesc}
                  onChange={(e) => setNewStratDesc(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius)] text-xs text-[var(--text)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Strategy
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
