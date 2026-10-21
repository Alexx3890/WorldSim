"use client";

import { useState } from "react";

interface Props {
  onRunPlan: (prompt: string, strategyCount: number) => void;
  loading: boolean;
}

const PRESETS = [
  {
    title: "Night Shift ED Surge",
    desc: "4 doctors, 6 nurses, 20 beds facing heavy queue buildup with 14 arrivals/hr.",
    prompt: "Our emergency department is overwhelmed during night shifts with 4 doctors, 6 nurses, and 20 beds. Average wait times are spiking above 70 minutes with 14 patient arrivals per hour. We want to evaluate whether hiring additional triage nurses, bringing in float doctors, or adding observation beds will best reduce wait times without ballooning costs.",
  },
  {
    title: "College Advising & Course Capacity",
    desc: "350 matriculating undergraduates face enrollment delays for graduation courses.",
    prompt: "Our university cohort of 350 incoming undergraduates faces course enrollment bottlenecks. Core prerequisites fill within 48 hours, leaving 20% on waitlists. Test hiring 3 adjunct professors versus expanding lecture hall caps.",
  },
  {
    title: "Hybrid Workspace & Hot-Desking",
    desc: "Midweek attendance surges create room contention and desk shortages.",
    prompt: "We have 100 hybrid employees sharing 60 hot-desks and 6 conference rooms. Midweek attendance peaks at 80 people, causing 25% room booking rejections. Test reallocating budget to add phone booths or staggering remote days.",
  },
  {
    title: "Municipal Permitting Backlog",
    desc: "Building and zoning review turnaround delays reach 28 days.",
    prompt: "Our municipal building department receives 40 new permit applications per day. Turnaround time has ballooned to 28 days due to zoning review bottlenecks. Test adding 2 zoning examiners vs launching a priority fast-track fee tier.",
  },
  {
    title: "Event Stadium Crowd Ingress",
    desc: "1,800 spectators surge into arena gates 30 minutes before kickoff.",
    prompt: "A concert arena with 1,800 expected attendees experiences a severe gate surge 30 minutes before start. Max wait times exceed 25 minutes. Test adding 4 security search lanes versus opening 6 extra digital turnstiles.",
  },
];

export default function AIDecisionStudio({ onRunPlan, loading }: Props) {
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [strategyCount, setStrategyCount] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    onRunPlan(prompt.trim(), strategyCount);
  };

  return (
    <div className="glass-card p-6 sm:p-8 space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Agentic AI Pipeline · Gemini Multi-Model Chain
          </div>
          <h2 className="text-xl font-bold text-white">Describe Your Real-World Decision</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            State your scenario, constraints, and goals. The LangGraph multi-agent network will extract
            parameters, generate alternative strategies, and test each in deterministic SimPy Monte Carlo simulations.
          </p>
        </div>
      </div>

      {/* Preset selection buttons */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Quick Preset Scenarios
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPrompt(p.prompt)}
              className="text-left p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-indigo-500/40 transition-all text-xs space-y-1.5 group"
            >
              <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                {p.title}
              </div>
              <div className="text-slate-400 leading-snug line-clamp-2">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="ai-prompt-input" className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Natural Language Scenario Prompt</span>
            <span className="text-slate-500 text-[11px]">Free-form or paste operational logs</span>
          </label>
          <textarea
            id="ai-prompt-input"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            placeholder="Describe your current situation, staffing, and what decisions you want to simulate..."
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-y"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label htmlFor="strategy-count" className="text-xs text-slate-400 whitespace-nowrap">
              Alternatives to Generate:
            </label>
            <select
              id="strategy-count"
              value={strategyCount}
              onChange={(e) => setStrategyCount(parseInt(e.target.value))}
              disabled={loading}
              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={2}>2 Alternatives (+ Baseline)</option>
              <option value={3}>3 Alternatives (+ Baseline)</option>
              <option value={4}>4 Alternatives (+ Baseline)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Orchestrating Agents & Running SimPy...
              </>
            ) : (
              <span>Simulate & Rank Decisions</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
