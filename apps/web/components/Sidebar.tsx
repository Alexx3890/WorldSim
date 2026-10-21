"use client";

import React from "react";
import {
  SparklesIcon,
  SlidersIcon,
  LayersIcon,
  PlayIcon,
  ActivityIcon,
  HistoryIcon,
  CompareIcon,
  ShieldCheckIcon,
  SettingsIcon,
} from "./ui/Icons";

export type NavTab =
  | "new_simulation"
  | "scenario_review"
  | "strategy_review"
  | "live_run"
  | "results"
  | "what_if"
  | "history"
  | "compare"
  | "admin"
  | "settings";

export interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  hasActiveRun?: boolean;
  hasResults?: boolean;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  hasActiveRun = false,
  hasResults = false,
}: SidebarProps) {
  const primaryNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: "new_simulation", label: "New simulation", icon: <SparklesIcon className="w-4 h-4" /> },
    { id: "history", label: "History", icon: <HistoryIcon className="w-4 h-4" /> },
    { id: "compare", label: "Compare", icon: <CompareIcon className="w-4 h-4" /> },
    { id: "admin", label: "Admin", icon: <ShieldCheckIcon className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  const workflowItems: { id: NavTab; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    { id: "scenario_review", label: "Scenario review", icon: <SlidersIcon className="w-4 h-4" />, enabled: true },
    { id: "strategy_review", label: "Strategy review", icon: <LayersIcon className="w-4 h-4" />, enabled: true },
    { id: "live_run", label: "Live run", icon: <PlayIcon className="w-4 h-4" />, enabled: hasActiveRun },
    { id: "results", label: "Results dashboard", icon: <ActivityIcon className="w-4 h-4" />, enabled: hasResults },
    { id: "what_if", label: "What-if workspace", icon: <SlidersIcon className="w-4 h-4" />, enabled: hasResults },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] min-h-screen flex flex-col justify-between p-4 select-none">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-2 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-text)] flex items-center justify-center font-bold text-sm tracking-wider">
            W
          </div>
          <div>
            <div className="font-bold text-sm text-[var(--text)] tracking-tight">
              WorldSim AI
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)]">
              Simulation Engine
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            Platform
          </div>
          <nav className="space-y-0.5">
            {primaryNavItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full text-left px-3 py-2 text-xs rounded-[var(--radius)] transition-colors duration-150 cursor-pointer flex items-center gap-2.5 font-medium ${
                    isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold border-l-2 border-l-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] border-l-2 border-l-transparent"
                  }`}
                >
                  <span className={isActive ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Active Pipeline Navigation */}
        <div className="space-y-1 pt-2 border-t border-[var(--border)]">
          <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            Active Workspace
          </div>
          <nav className="space-y-0.5">
            {workflowItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  disabled={!item.enabled}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full text-left px-3 py-2 text-xs rounded-[var(--radius)] transition-colors duration-150 flex items-center justify-between font-medium ${
                    !item.enabled
                      ? "text-[var(--text-dim)] opacity-40 cursor-not-allowed border-l-2 border-l-transparent"
                      : isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold border-l-2 border-l-[var(--accent)] cursor-pointer"
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] border-l-2 border-l-transparent cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.id === "live_run" && hasActiveRun && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Engine Status Card */}
      <div className="p-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg)] text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">Core Engine</span>
          <span className="font-mono text-[11px] text-[var(--text)] font-semibold">SimPy 4.1</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">LLM Gateway</span>
          <span className="font-mono text-[11px] text-[var(--accent)] font-semibold">Gemini Flash</span>
        </div>
        <div className="pt-1 border-t border-[var(--border)] text-[10px] text-[var(--text-dim)]">
          ProcessPool workers: 4 parallel
        </div>
      </div>
    </aside>
  );
}
