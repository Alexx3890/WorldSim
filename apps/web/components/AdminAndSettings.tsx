"use client";

import React, { useState } from "react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

export interface AdminAndSettingsProps {
  mode?: "admin" | "settings";
}

export function AdminAndSettings({ mode = "admin" }: AdminAndSettingsProps) {
  const [activeAdminTab, setActiveAdminTab] = useState<
    "health" | "providers" | "packs" | "quotas"
  >("health");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">
            {mode === "admin" ? "System Administration & Infrastructure" : "Application Settings"}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {mode === "admin"
              ? "LLM key rotation pools, circuit breaker thresholds, pack registry, and Monte Carlo worker health."
              : "User preferences, default simulation parameters, and theme configuration."}
          </p>
        </div>
      </div>

      {mode === "admin" ? (
        <div className="space-y-4">
          {/* Admin Subtabs */}
          <div className="flex border-b border-[var(--border)] gap-6 text-xs">
            <button
              onClick={() => setActiveAdminTab("health")}
              className={`pb-2 font-medium cursor-pointer border-b-2 transition-colors ${
                activeAdminTab === "health"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              System Health & Engine
            </button>
            <button
              onClick={() => setActiveAdminTab("providers")}
              className={`pb-2 font-medium cursor-pointer border-b-2 transition-colors ${
                activeAdminTab === "providers"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              LLM Key Rotator & Circuit Breakers
            </button>
            <button
              onClick={() => setActiveAdminTab("packs")}
              className={`pb-2 font-medium cursor-pointer border-b-2 transition-colors ${
                activeAdminTab === "packs"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Installed Scenario Packs
            </button>
            <button
              onClick={() => setActiveAdminTab("quotas")}
              className={`pb-2 font-medium cursor-pointer border-b-2 transition-colors ${
                activeAdminTab === "quotas"
                  ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              Quotas & Rate Limits
            </button>
          </div>

          {/* Health Tab */}
          {activeAdminTab === "health" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-2">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                  FastAPI Server
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--text)]">Port 8000</span>
                  <Badge label="OPERATIONAL" variant="success" />
                </div>
                <div className="text-xs text-[var(--text-muted)] font-mono">
                  Uptime: 99.98% · Worker pool: 4 CPU
                </div>
              </div>

              <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-2">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                  Deterministic SimPy Engine
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--text)]">SimPy 4.1.2</span>
                  <Badge label="ACTIVE" variant="success" />
                </div>
                <div className="text-xs text-[var(--text-muted)] font-mono">
                  Seed: np.random.SeedSequence
                </div>
              </div>

              <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-2">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                  LLM Gateway Status
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--text)]">Gemini Chain</span>
                  <Badge label="HEALTHY" variant="success" />
                </div>
                <div className="text-xs text-[var(--text-muted)] font-mono">
                  Chain: 2.0-flash → 1.5-flash → Degraded
                </div>
              </div>
            </div>
          )}

          {/* Providers Tab */}
          {activeAdminTab === "providers" && (
            <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-x-auto bg-[var(--surface)]">
              <table className="w-full text-left border-collapse text-xs tabular-numbers">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
                    <th className="p-3">Model</th>
                    <th className="p-3">Circuit State</th>
                    <th className="p-3">Failure Threshold</th>
                    <th className="p-3">Recovery Cooldown</th>
                    <th className="p-3">Consecutive Errors</th>
                    <th className="p-3 text-right">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="p-3 font-semibold text-[var(--text)]">gemini-2.0-flash (Primary)</td>
                    <td className="p-3"><Badge label="CLOSED" variant="success" /></td>
                    <td className="p-3 font-mono">3 errors</td>
                    <td className="p-3 font-mono">30.0s</td>
                    <td className="p-3 font-mono">0</td>
                    <td className="p-3 text-right text-[var(--success)] font-semibold">Active</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-[var(--text)]">gemini-1.5-flash (Secondary)</td>
                    <td className="p-3"><Badge label="CLOSED" variant="success" /></td>
                    <td className="p-3 font-mono">3 errors</td>
                    <td className="p-3 font-mono">30.0s</td>
                    <td className="p-3 font-mono">0</td>
                    <td className="p-3 text-right text-[var(--success)] font-semibold">Standby</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-[var(--text)]">gemini-1.5-flash-8b (Tertiary)</td>
                    <td className="p-3"><Badge label="CLOSED" variant="success" /></td>
                    <td className="p-3 font-mono">3 errors</td>
                    <td className="p-3 font-mono">30.0s</td>
                    <td className="p-3 font-mono">0</td>
                    <td className="p-3 text-right text-[var(--success)] font-semibold">Standby</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Packs Tab */}
          {activeAdminTab === "packs" && (
            <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-x-auto bg-[var(--surface)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
                    <th className="p-3">Pack ID</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Version</th>
                    <th className="p-3">Modelling Type</th>
                    <th className="p-3">Author</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="p-3 font-mono font-semibold text-[var(--text)]">hospital</td>
                    <td className="p-3 text-[var(--text)]">Hospital Emergency Department</td>
                    <td className="p-3 font-mono">1.0.0</td>
                    <td className="p-3 font-mono">discrete_event (SimPy)</td>
                    <td className="p-3 text-[var(--text-muted)]">Ankit Kumar Singh</td>
                    <td className="p-3 text-right"><Badge label="LOADED" variant="success" /></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-semibold text-[var(--text)]">college</td>
                    <td className="p-3 text-[var(--text)]">College Admissions &amp; Course Scheduling</td>
                    <td className="p-3 font-mono">1.0.0</td>
                    <td className="p-3 font-mono">discrete_event (SimPy)</td>
                    <td className="p-3 text-[var(--text-muted)]">Ankit Kumar Singh</td>
                    <td className="p-3 text-right"><Badge label="LOADED" variant="success" /></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-semibold text-[var(--text)]">office</td>
                    <td className="p-3 text-[var(--text)]">Office Workspace &amp; Meeting Rooms</td>
                    <td className="p-3 font-mono">1.0.0</td>
                    <td className="p-3 font-mono">discrete_event (SimPy)</td>
                    <td className="p-3 text-[var(--text-muted)]">Ankit Kumar Singh</td>
                    <td className="p-3 text-right"><Badge label="LOADED" variant="success" /></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-semibold text-[var(--text)]">policy</td>
                    <td className="p-3 text-[var(--text)]">Municipal Permitting &amp; Regulatory Bureau</td>
                    <td className="p-3 font-mono">1.0.0</td>
                    <td className="p-3 font-mono">discrete_event (SimPy)</td>
                    <td className="p-3 text-[var(--text-muted)]">Ankit Kumar Singh</td>
                    <td className="p-3 text-right"><Badge label="LOADED" variant="success" /></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-semibold text-[var(--text)]">social</td>
                    <td className="p-3 text-[var(--text)]">Public Event Crowd &amp; Venue Congestion</td>
                    <td className="p-3 font-mono">1.0.0</td>
                    <td className="p-3 font-mono">discrete_event (SimPy)</td>
                    <td className="p-3 text-[var(--text-muted)]">Ankit Kumar Singh</td>
                    <td className="p-3 text-right"><Badge label="LOADED" variant="success" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Quotas Tab */}
          {activeAdminTab === "quotas" && (
            <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] text-xs space-y-2">
              <div className="font-semibold text-[var(--text)]">Free-Tier Gemini API Quota Management</div>
              <p className="text-[var(--text-muted)]">
                The gateway distributes requests round-robin across configured keys. When HTTP 429 rate limit is received,
                the affected key is placed into temporary backoff cooldown while surviving keys continue serving traffic.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Settings Mode */
        <div className="max-w-xl space-y-4 text-xs">
          <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-3">
            <h3 className="font-semibold uppercase tracking-wider text-[var(--text)] border-b border-[var(--border)] pb-2">
              Simulation Execution Defaults
            </h3>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text)] block">
                Default Monte Carlo Replications
              </label>
              <input
                type="number"
                defaultValue={20}
                className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius)] font-mono text-[var(--text)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] block">
                Default number of seeds simulated per alternative decision strategy.
              </span>
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-xs font-semibold text-[var(--text)] block">
                Convergence Confidence Interval Width Target
              </label>
              <input
                type="number"
                step="0.01"
                defaultValue={0.05}
                className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius)] font-mono text-[var(--text)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] block">
                Early stopping trigger when 95% CI half-width / mean &lt; 0.05.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
