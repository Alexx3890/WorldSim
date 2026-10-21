"use client";

import { useState } from "react";

interface Param {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
  description: string;
}

const PARAMS: Param[] = [
  { key: "num_doctors",        label: "Doctors",        min: 1, max: 20,  step: 1,   default: 3,  unit: "staff",  description: "Physicians on shift" },
  { key: "num_nurses",         label: "Nurses",         min: 1, max: 30,  step: 1,   default: 5,  unit: "staff",  description: "Nurses on shift" },
  { key: "num_beds",           label: "Beds",           min: 5, max: 100, step: 1,   default: 20, unit: "beds",   description: "Available treatment beds" },
  { key: "sim_duration_hours", label: "Shift Duration", min: 1, max: 24,  step: 0.5, default: 8,  unit: "hours",  description: "Simulated time window" },
];

interface Props {
  onRun: (params: Record<string, number>) => void;
  loading: boolean;
}

export default function SimulatorForm({ onRun, loading }: Props) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(PARAMS.map((p) => [p.key, p.default]))
  );

  const handleChange = (key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRun(values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card p-6 space-y-6 h-fit animate-slide-up"
      id="simulator-form"
    >
      <div>
        <h2 className="text-sm font-semibold text-white">
          Hospital ED Parameters
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Schema-driven from pack v1.0.0
        </p>
      </div>

      <div className="space-y-5">
        {PARAMS.map((param) => (
          <div key={param.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`param-${param.key}`}
                className="text-xs font-medium text-slate-300"
              >
                {param.label}
              </label>
              <div className="flex items-center gap-1">
                <input
                  id={`param-${param.key}-number`}
                  type="number"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={values[param.key]}
                  onChange={(e) => handleChange(param.key, parseFloat(e.target.value))}
                  className="w-16 text-right text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <span className="text-xs text-slate-600 w-10">{param.unit}</span>
              </div>
            </div>
            <input
              id={`param-${param.key}`}
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={values[param.key]}
              onChange={(e) => handleChange(param.key, parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(99,102,241,0.6)]
                         [&::-webkit-slider-thumb]:transition-transform
                         [&::-webkit-slider-thumb]:hover:scale-125"
            />
            <p className="text-xs text-slate-600">{param.description}</p>
          </div>
        ))}
      </div>

      {/* Constraint warnings */}
      {values.num_nurses < values.num_doctors && (
        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 font-mono">
          Constraint: Nurse count must be at least equal to Doctor count
        </div>
      )}
      {values.num_beds < values.num_nurses + values.num_doctors && (
        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 font-mono">
          Constraint: Bed count must be at least equal to total staff ({values.num_nurses + values.num_doctors})
        </div>
      )}

      <button
        id="run-simulation-btn"
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white
                   bg-indigo-600 hover:bg-indigo-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all duration-200
                   active:scale-[0.98]"
      >
        {loading ? "Running..." : "Run Simulation"}
      </button>

      <div className="border-t border-white/5 pt-4 space-y-1">
        <p className="text-[10px] text-slate-600 font-mono">Engine: SimPy 4.1.2 · 15 replications</p>
        <p className="text-[10px] text-slate-600 font-mono">ProcessPoolExecutor · Deterministic seeds</p>
        <p className="text-[10px] text-slate-600">
          <span className="text-slate-500">AI-generated, based on model assumptions.</span> Not medical advice.
        </p>
      </div>
    </form>
  );
}
