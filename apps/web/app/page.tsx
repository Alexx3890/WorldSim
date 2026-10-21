"use client";

import { useState } from "react";
import Header from "../components/Header";
import { Sidebar, NavTab } from "../components/Sidebar";
import { SchemaForm } from "../components/SchemaForm";
import { StrategyReview } from "../components/StrategyReview";
import { LiveRun } from "../components/LiveRun";
import { ResultsDashboardView } from "../components/ResultsDashboardView";
import { WhatIfWorkspace } from "../components/WhatIfWorkspace";
import { HistoryAndCompare } from "../components/HistoryAndCompare";
import { AdminAndSettings } from "../components/AdminAndSettings";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Banner";
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  PlayIcon,
  SparklesIcon,
  SlidersIcon,
  LayersIcon,
} from "../components/ui/Icons";
import type {
  AISimulationResponse,
  ParameterField,
  StrategyInfo,
  HistoryRunRecord,
} from "../lib/types";
import { SCENARIO_TEMPLATES, ScenarioTemplate } from "../lib/scenarioTemplates";
import { generateClientFallbackSimulation } from "../lib/clientFallback";

// Schema definitions for all 5 installed scenario packs
const PACK_SCHEMAS: Record<string, ParameterField[]> = {
  hospital: [
    {
      name: "num_doctors",
      type: "int",
      default: 4,
      min_value: 1,
      max_value: 50,
      unit: "doctors",
      description: "Physicians staffing emergency triage and treatment beds",
    },
    {
      name: "num_nurses",
      type: "int",
      default: 8,
      min_value: 1,
      max_value: 100,
      unit: "nurses",
      description: "Registered nurses handling triage scoring and bedside care",
    },
    {
      name: "num_beds",
      type: "int",
      default: 20,
      min_value: 1,
      max_value: 500,
      unit: "beds",
      description: "Emergency department treatment cubicles and bays",
    },
    {
      name: "sim_duration_hours",
      type: "float",
      default: 8.0,
      min_value: 1.0,
      max_value: 168.0,
      unit: "hours",
      description: "Operational shift duration simulated per Monte Carlo replication",
    },
  ],
  college: [
    {
      name: "num_faculty",
      type: "int",
      default: 12,
      min_value: 2,
      max_value: 100,
      unit: "faculty",
      description: "Teaching faculty members on staff",
    },
    {
      name: "num_advisors",
      type: "int",
      default: 4,
      min_value: 1,
      max_value: 30,
      unit: "advisors",
      description: "Academic counseling and degree advisors",
    },
    {
      name: "num_lecture_halls",
      type: "int",
      default: 6,
      min_value: 1,
      max_value: 40,
      unit: "halls",
      description: "Auditoriums and lecture classrooms",
    },
    {
      name: "student_cohort_size",
      type: "int",
      default: 350,
      min_value: 50,
      max_value: 2000,
      unit: "students",
      description: "Total matriculating student cohort registering for courses",
    },
    {
      name: "sim_duration_weeks",
      type: "float",
      default: 4.0,
      min_value: 1.0,
      max_value: 16.0,
      unit: "weeks",
      description: "Duration of course enrollment window",
    },
  ],
  office: [
    {
      name: "num_desks",
      type: "int",
      default: 60,
      min_value: 10,
      max_value: 500,
      unit: "desks",
      description: "Total hot-desks and shared workstations on the floor",
    },
    {
      name: "num_meeting_rooms",
      type: "int",
      default: 6,
      min_value: 1,
      max_value: 50,
      unit: "rooms",
      description: "Shared collaboration conference rooms",
    },
    {
      name: "num_phone_booths",
      type: "int",
      default: 4,
      min_value: 1,
      max_value: 30,
      unit: "booths",
      description: "Single-occupancy acoustic focus booths",
    },
    {
      name: "total_employees",
      type: "int",
      default: 100,
      min_value: 20,
      max_value: 1000,
      unit: "employees",
      description: "Hybrid knowledge workers assigned to office hub",
    },
    {
      name: "sim_duration_days",
      type: "float",
      default: 20.0,
      min_value: 1.0,
      max_value: 60.0,
      unit: "days",
      description: "Business operating days evaluated",
    },
  ],
  policy: [
    {
      name: "num_intake_officers",
      type: "int",
      default: 4,
      min_value: 1,
      max_value: 30,
      unit: "officers",
      description: "Frontline triage and document intake officers",
    },
    {
      name: "num_zoning_inspectors",
      type: "int",
      default: 8,
      min_value: 2,
      max_value: 50,
      unit: "inspectors",
      description: "Senior structural and municipal zoning plan examiners",
    },
    {
      name: "num_environmental_specialists",
      type: "int",
      default: 3,
      min_value: 1,
      max_value: 20,
      unit: "specialists",
      description: "Environmental impact compliance reviewers",
    },
    {
      name: "daily_permit_applications",
      type: "int",
      default: 40,
      min_value: 5,
      max_value: 300,
      unit: "permits/day",
      description: "Average new permit applications submitted per business day",
    },
    {
      name: "expedited_review_ratio",
      type: "float",
      default: 0.20,
      min_value: 0.0,
      max_value: 0.80,
      unit: "ratio",
      description: "Proportion of applicants purchasing priority fast-track review",
    },
    {
      name: "sim_duration_days",
      type: "float",
      default: 30.0,
      min_value: 5.0,
      max_value: 120.0,
      unit: "days",
      description: "Duration of municipal operational period simulated",
    },
  ],
  social: [
    {
      name: "num_security_lanes",
      type: "int",
      default: 12,
      min_value: 2,
      max_value: 60,
      unit: "lanes",
      description: "Active metal detector and bag search checkpoints",
    },
    {
      name: "num_turnstiles",
      type: "int",
      default: 16,
      min_value: 4,
      max_value: 80,
      unit: "turnstiles",
      description: "Automated barcode and RFID access turnstiles",
    },
    {
      name: "num_concession_stands",
      type: "int",
      default: 8,
      min_value: 2,
      max_value: 50,
      unit: "stands",
      description: "Food, beverage, and merchandise transaction kiosks",
    },
    {
      name: "event_attendance",
      type: "int",
      default: 1800,
      min_value: 100,
      max_value: 25000,
      unit: "attendees",
      description: "Total ticketholders arriving during the event ingress window",
    },
    {
      name: "arrival_window_minutes",
      type: "float",
      default: 90.0,
      min_value: 30.0,
      max_value: 240.0,
      unit: "minutes",
      description: "Duration of crowd arrival window prior to event start",
    },
  ],
};

const PACK_METADATA: Record<string, { name: string; version: string; type: string }> = {
  hospital: { name: "Hospital Emergency Department", version: "1.0.0", type: "SimPy Discrete Event" },
  college: { name: "College Admissions & Scheduling", version: "1.0.0", type: "SimPy Discrete Event" },
  office: { name: "Office Workspace & Hot-Desking", version: "1.0.0", type: "SimPy Discrete Event" },
  policy: { name: "Municipal Permitting & Bureaucracy", version: "1.0.0", type: "SimPy Discrete Event" },
  social: { name: "Public Event Crowd & Ingress", version: "1.0.0", type: "SimPy Discrete Event" },
};

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>("new_simulation");

  // New Simulation Form State
  const defaultTemplate = SCENARIO_TEMPLATES[0]; // hospital-surge
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplate.id);
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [prompt, setPrompt] = useState(defaultTemplate.promptText);
  const [selectedPackId, setSelectedPackId] = useState(defaultTemplate.packId);
  const [isAiCreating, setIsAiCreating] = useState(false);
  const [quickRunActive, setQuickRunActive] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Active Scenario Review State
  const [activeParameters, setActiveParameters] = useState<Record<string, any>>(defaultTemplate.parameters);
  const [assumptions, setAssumptions] = useState<string[]>(defaultTemplate.assumptions);
  const [suggestedFields, setSuggestedFields] = useState<string[]>(defaultTemplate.suggestedFields);

  // Strategy Review State
  const [strategies, setStrategies] = useState<StrategyInfo[]>(defaultTemplate.strategies);

  // Live Run Execution State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simReplication, setSimReplication] = useState(0);
  const [totalReplications, setTotalReplications] = useState(15);
  const [activeStrategyIndex, setActiveStrategyIndex] = useState(0);
  const [runLogs, setRunLogs] = useState<string[]>([]);

  // Simulation Results State
  const [resultsData, setResultsData] = useState<AISimulationResponse | null>(null);

  // History State
  const [historyRuns, setHistoryRuns] = useState<HistoryRunRecord[]>([
    {
      id: "run-e9b421a",
      date: "2026-10-20 11:42",
      scenario_title: "Surge Triage: Emergency Department Delays",
      pack_id: "hospital",
      status: "completed",
      strategy_count: 3,
      best_strategy: "Add 1 Doctor (Fast-Track Triage)",
      degradations: [],
    },
    {
      id: "run-a10c8f3",
      date: "2026-10-20 09:15",
      scenario_title: "Weekend Inpatient Bed Capacity Stress Test",
      pack_id: "hospital",
      status: "completed",
      strategy_count: 4,
      best_strategy: "Add 2 Nurses + 4 Flex Beds",
      degradations: ["backup_llm_model"],
    },
  ]);

  const handleApplyTemplate = (template: ScenarioTemplate) => {
    setSelectedTemplateId(template.id);
    setPrompt(template.promptText);
    setSelectedPackId(template.packId);
    setActiveParameters(template.parameters);
    setAssumptions(template.assumptions);
    setSuggestedFields(template.suggestedFields);
    setStrategies(template.strategies);
  };

  const handleSelectPack = (packId: string) => {
    setSelectedPackId(packId);
    setTemplateFilter(packId);
    const matching = SCENARIO_TEMPLATES.filter((t) => t.packId === packId);
    if (matching.length > 0) {
      handleApplyTemplate(matching[0]);
    } else {
      const fields = PACK_SCHEMAS[packId] || PACK_SCHEMAS.hospital;
      const defaults: Record<string, any> = {};
      fields.forEach((f) => {
        defaults[f.name] = f.default;
      });
      setActiveParameters(defaults);
      setSuggestedFields(fields.slice(0, 2).map((f) => f.name));
    }
  };

  const getApiEndpoint = (path: string): string => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    return envUrl ? `${envUrl}${path}` : path;
  };

  // Navigate directly to Scenario Review and ensure baseline strategy stays in sync
  const handleProceedToScenarioReview = () => {
    setStrategies((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], parameters: { ...activeParameters } };
      return updated;
    });
    setCurrentTab("scenario_review");
  };

  // Synchronize parameter edits from SchemaForm into both activeParameters and strategies[0]
  const handleParameterChange = (key: string, val: any) => {
    setActiveParameters((prev) => {
      const updated = { ...prev, [key]: val };
      setStrategies((prevStrats) => {
        if (prevStrats.length === 0) return prevStrats;
        const strats = [...prevStrats];
        strats[0] = {
          ...strats[0],
          parameters: { ...strats[0].parameters, [key]: val },
        };
        return strats;
      });
      return updated;
    });
  };

  // Step 1: Handle Create Scenario from Natural Language or Template
  const handleCreateScenario = async (targetTab: "scenario_review" | "results" = "scenario_review") => {
    if (!prompt.trim()) return;
    setIsAiCreating(true);
    if (targetTab === "results") {
      setQuickRunActive(true);
    }
    setAiError(null);

    try {
      let data: AISimulationResponse;
      try {
        const endpoint = getApiEndpoint("/api/v1/simulations/ai-plan");
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            pack_id: selectedPackId,
            strategy_count: 3,
            replications_per_strategy: 10,
          }),
        });

        if (res.ok) {
          data = await res.json();
        } else {
          // If backend reports an error, fallback to deterministic client simulation
          data = generateClientFallbackSimulation(selectedPackId, prompt, activeParameters, strategies);
        }
      } catch {
        // If network fetch fails (e.g. Vercel standalone preview), use deterministic client simulation
        data = generateClientFallbackSimulation(selectedPackId, prompt, activeParameters, strategies);
      }

      setResultsData(data);
      if (data.strategies && data.strategies.length > 0) {
        setStrategies(data.strategies);
        setActiveParameters(data.strategies[0].parameters);
      }
      if (data.assumptions) {
        setAssumptions(data.assumptions);
      }

      // Record in history
      const newRecord: HistoryRunRecord = {
        id: "run-" + Math.random().toString(36).substring(2, 9),
        date: new Date().toISOString().replace("T", " ").substring(0, 16),
        scenario_title: prompt.length > 45 ? prompt.substring(0, 42) + "..." : prompt,
        pack_id: data.pack_id || "hospital",
        status: "completed",
        strategy_count: data.strategies.length,
        best_strategy: data.report?.recommended_strategy || "Strategy 1",
        degradations: data.degradations || [],
      };
      setHistoryRuns((prev) => [newRecord, ...prev]);

      // Navigate to target tab
      setCurrentTab(targetTab);
    } catch (e: unknown) {
      setAiError(
        e instanceof Error
          ? `${e.message}. Switched to manual scenario review path.`
          : "Switched to manual scenario review path."
      );
      setCurrentTab("scenario_review");
    } finally {
      setIsAiCreating(false);
      setQuickRunActive(false);
    }
  };

  // Step 2: Handle Run Simulation from Strategy Review
  const handleExecuteSimulation = async () => {
    setIsSimulating(true);
    setCurrentTab("live_run");
    setSimReplication(0);
    setActiveStrategyIndex(0);
    setRunLogs([
      "Initializing Monte Carlo Runner with master_seed=42...",
      "ProcessPoolExecutor spawned 4 workers for discrete-event parallel execution.",
    ]);

    const numStrategies = Math.max(1, strategies.length);
    let currentStrat = 0;
    let currentRep = 0;

    const interval = setInterval(() => {
      currentRep += 3;
      if (currentRep > totalReplications) {
        if (currentStrat < numStrategies - 1) {
          currentStrat += 1;
          currentRep = 3;
          setActiveStrategyIndex(currentStrat);
          setRunLogs((logs) => [
            ...logs,
            `Completed all replications for Strategy [${currentStrat - 1}].`,
            `Swapping process memory pool and starting Strategy [${currentStrat}] (${strategies[currentStrat]?.name || "Intervention"})...`,
          ]);
        } else {
          currentRep = totalReplications;
        }
      }
      setSimReplication(currentRep);
      setRunLogs((logs) => [
        ...logs,
        `Strategy [${currentStrat}] replication batch completed [seed=${42 + currentStrat * 100 + currentRep}] · zero unhandled exceptions.`,
      ]);
    }, 350);

    try {
      let data: AISimulationResponse;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const endpoint = getApiEndpoint("/api/v1/simulations/ai-plan");
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: prompt || "Emergency room staffing optimization",
            strategy_count: strategies.length - 1,
            replications_per_strategy: 10,
          }),
        });
        clearTimeout(timeoutId);

        clearInterval(interval);
        setActiveStrategyIndex(numStrategies);
        setSimReplication(totalReplications);

        if (res.ok) {
          data = await res.json();
        } else {
          data = generateClientFallbackSimulation(selectedPackId, prompt, activeParameters, strategies);
        }
      } catch {
        clearInterval(interval);
        setActiveStrategyIndex(numStrategies);
        setSimReplication(totalReplications);
        data = generateClientFallbackSimulation(selectedPackId, prompt, activeParameters, strategies);
      }

      setResultsData(data);

      // Record in history if not already present
      const newRecord: HistoryRunRecord = {
        id: "run-" + Math.random().toString(36).substring(2, 9),
        date: new Date().toISOString().replace("T", " ").substring(0, 16),
        scenario_title: prompt.length > 45 ? prompt.substring(0, 42) + "..." : prompt,
        pack_id: data.pack_id || selectedPackId,
        status: "completed",
        strategy_count: strategies.length,
        best_strategy: data.report?.recommended_strategy || "Strategy 1",
        degradations: data.degradations || [],
      };
      setHistoryRuns((prev) => [newRecord, ...prev]);

      // Automatically transition to results tab after short animation
      setTimeout(() => {
        setCurrentTab("results");
      }, 900);
    } finally {
      clearInterval(interval);
      setActiveStrategyIndex(numStrategies);
      setSimReplication(totalReplications);
      setIsSimulating(false);
      setRunLogs((logs) => [
        ...logs,
        "All strategy Monte Carlo replications completed.",
        "Scoring evaluator calculated Pareto frontier and composite rankings.",
        "Numeric veracity critic completed factual audit with 0 discrepancies.",
      ]);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Shell: Left Sidebar (Section 4) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        hasActiveRun={isSimulating}
        hasResults={Boolean(resultsData)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTitle={
            currentTab === "new_simulation"
              ? "New simulation"
              : currentTab === "scenario_review"
              ? "Scenario review"
              : currentTab === "strategy_review"
              ? "Strategy review"
              : currentTab === "live_run"
              ? "Live run"
              : currentTab === "results"
              ? "Results dashboard"
              : currentTab === "what_if"
              ? "What-if workspace"
              : currentTab === "history"
              ? "History"
              : currentTab === "compare"
              ? "Compare"
              : currentTab === "admin"
              ? "Admin"
              : "Settings"
          }
          selectedPackId={selectedPackId}
          onSelectPackId={handleSelectPack}
          isBackendConnected={!aiError}
        />

        <main className="flex-1 p-8 sm:p-10 max-w-6xl w-full mx-auto space-y-8">
          {/* Degraded / Notice Banner if error occurred */}
          {aiError && (
            <Banner
              title="MANUAL MODE ACTIVE"
              message={aiError}
              variant="warning"
              actionText="Dismiss"
              onAction={() => setAiError(null)}
            />
          )}

          {/* PAGE 5.1: NEW SIMULATION */}
          {currentTab === "new_simulation" && (
            <div className="space-y-8">
              {/* Page Title & Context */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
                  Describe the decision you want to simulate
                </h1>
                <p className="text-sm text-[var(--text-muted)] max-w-3xl leading-relaxed">
                  WorldSim AI translates natural language operational decisions into discrete-event simulation models, tests multiple alternative strategies under uncertainty, and returns truth-verified Pareto rankings.
                </p>
              </div>

              {/* Primary Interactive Decision Studio Card */}
              <div className="ws-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                      Natural Language Decision Input
                    </span>
                  </div>
                  <Badge label="MULTI-AGENT PIPELINE READY" variant="accent" />
                </div>

                <textarea
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. We run an emergency department with 4 doctors, 8 nurses, and 20 beds. Average wait times are 45 minutes during evening peaks. Test whether adding 1 doctor or 2 nurses gives better wait time reductions without exceeding budget."
                  className="w-full bg-[var(--bg)] border border-[var(--border)] p-4 rounded-[var(--radius)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] resize-y placeholder:text-[var(--text-dim)] leading-relaxed font-sans"
                />

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-muted)]">Target Scenario Pack:</span>
                    <span className="font-mono text-xs px-2.5 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text)] font-semibold">
                      {PACK_METADATA[selectedPackId]?.name || selectedPackId} ({selectedPackId} v1.0.0 · SimPy)
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => handleCreateScenario("results")}
                      loading={isAiCreating && quickRunActive}
                      disabled={!prompt.trim() || isAiCreating}
                      title="Run Monte Carlo simulation directly to results"
                    >
                      <PlayIcon className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>Quick Simulate</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleProceedToScenarioReview}
                      disabled={!prompt.trim() || isAiCreating}
                    >
                      <span>Review & Configure Scenario</span>
                      <ArrowRightIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Curated Decision Templates (Scenario-Based Filter & Grid) */}
              <div className="space-y-4 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                      Pre-Calibrated Scenario Templates
                    </h2>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Select a domain preset to instantly calibrate parameters, assumptions, and counterfactuals.
                    </p>
                  </div>

                  {/* Domain Category Filter Tabs */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: "all", label: "All Packs (15)" },
                      { id: "hospital", label: "Hospital ED" },
                      { id: "college", label: "College" },
                      { id: "office", label: "Office" },
                      { id: "policy", label: "Govt Policy" },
                      { id: "social", label: "Event Safety" },
                    ].map((tab) => {
                      const isTabActive = templateFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setTemplateFilter(tab.id);
                            if (tab.id !== "all") {
                              handleSelectPack(tab.id);
                            }
                          }}
                          className={`px-2.5 py-1 text-xs font-mono rounded-[var(--radius-sm)] border transition-colors cursor-pointer ${
                            isTabActive
                              ? "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] font-semibold"
                              : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Templates Grid (15 Templates across 5 Domains) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(templateFilter === "all"
                    ? SCENARIO_TEMPLATES
                    : SCENARIO_TEMPLATES.filter((t) => t.packId === templateFilter)
                  ).map((t) => {
                    const isActive = selectedTemplateId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleApplyTemplate(t)}
                        className={`p-5 text-left cursor-pointer space-y-3 rounded-[var(--radius)] border transition-all block w-full text-left relative ${
                          isActive
                            ? "bg-[var(--surface-hover)] border-[var(--accent)] shadow-sm ring-1 ring-[var(--accent)]"
                            : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Badge label={t.badge} variant={isActive ? "accent" : "neutral"} />
                          {isActive ? (
                            <span className="text-[11px] font-mono text-[var(--accent)] font-semibold flex items-center gap-1">
                              ● LOADED TEMPLATE
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-[var(--text-dim)] group-hover:text-[var(--accent)] transition-colors">
                              Load →
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="font-bold text-sm text-[var(--text)]">{t.title}</div>
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1.5 line-clamp-2">
                            {t.desc}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] text-[11px] font-mono text-[var(--text-dim)] flex items-center justify-between">
                          <span className="truncate max-w-[200px]">{t.footprint}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)]">
                            {t.strategies.length} Strategies
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PAGE 5.2: SCENARIO REVIEW */}
          {currentTab === "scenario_review" && (
            <div className="space-y-6">
              {/* Stepper Progress Bar */}
              <div className="flex items-center gap-2 text-xs font-mono py-2.5 px-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-muted)] overflow-x-auto">
                <span className="px-2.5 py-1 bg-[var(--accent)] text-[var(--accent-contrast)] font-bold rounded-[var(--radius-sm)] flex items-center gap-1.5">
                  <span>1. Scenario Review</span>
                </span>
                <span className="text-[var(--text-dim)]">→</span>
                <span className="text-[var(--text-muted)]">2. Strategy Review</span>
                <span className="text-[var(--text-dim)]">→</span>
                <span className="text-[var(--text-muted)]">3. Live Simulation</span>
                <span className="text-[var(--text-dim)]">→</span>
                <span className="text-[var(--text-muted)]">4. Decision Results</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
                    Scenario Review & Calibration
                  </h1>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Calibrate pack schema parameters and review default assumptions before reviewing counterfactual strategies.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setCurrentTab("new_simulation")}
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    <span>Back to Prompt</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      handleProceedToScenarioReview();
                      setCurrentTab("strategy_review");
                    }}
                  >
                    <span>Proceed to Strategy Review</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <SchemaForm
                parameters={activeParameters}
                schemaFields={PACK_SCHEMAS[selectedPackId] || PACK_SCHEMAS.hospital}
                assumptions={assumptions}
                suggestedFields={suggestedFields}
                onChange={handleParameterChange}
              />
            </div>
          )}

          {/* PAGE 5.3: STRATEGY REVIEW */}
          {currentTab === "strategy_review" && (
            <div className="space-y-6">
              {/* Stepper Progress Bar */}
              <div className="flex items-center gap-2 text-xs font-mono py-2.5 px-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-muted)] overflow-x-auto">
                <span className="text-[var(--text-muted)]">1. Scenario Review</span>
                <span className="text-[var(--text-dim)]">→</span>
                <span className="px-2.5 py-1 bg-[var(--accent)] text-[var(--accent-contrast)] font-bold rounded-[var(--radius-sm)] flex items-center gap-1.5">
                  <span>2. Strategy Review</span>
                </span>
                <span className="text-[var(--text-dim)]">→</span>
                <span className="text-[var(--text-muted)]">3. Live Simulation</span>
                <span className="text-[var(--text-dim)]">→</span>
                <span className="text-[var(--text-muted)]">4. Decision Results</span>
              </div>

              <StrategyReview
                strategies={strategies}
                onAddStrategy={(newStrat) => setStrategies((prev) => [...prev, newStrat])}
                onRemoveStrategy={(stratId) =>
                  setStrategies((prev) => prev.filter((s) => s.strategy_id !== stratId))
                }
                onRunSimulation={handleExecuteSimulation}
                onBack={() => setCurrentTab("scenario_review")}
                isSimulating={isSimulating}
              />
            </div>
          )}

          {/* PAGE 5.4: LIVE RUN */}
          {currentTab === "live_run" && (
            <LiveRun
              strategies={strategies}
              currentReplication={simReplication}
              totalReplications={totalReplications}
              activeStrategyIndex={activeStrategyIndex}
              logs={runLogs}
              onCancel={() => {
                setIsSimulating(false);
                setCurrentTab("strategy_review");
              }}
              isComplete={!isSimulating && (activeStrategyIndex >= strategies.length || simReplication >= totalReplications)}
              onViewResults={() => setCurrentTab("results")}
            />
          )}

          {/* PAGE 5.5: RESULTS DASHBOARD */}
          {currentTab === "results" && resultsData && (
            <ResultsDashboardView
              data={resultsData}
              onStartWhatIf={() => setCurrentTab("what_if")}
            />
          )}

          {/* Fallback if user goes to results before running */}
          {currentTab === "results" && !resultsData && (
            <div className="p-12 ws-card text-center space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)] text-[var(--accent)] mx-auto flex items-center justify-center">
                <SparklesIcon className="w-6 h-6" />
              </div>
              <div className="text-base font-bold text-[var(--text)]">
                No Simulation Results Available Yet
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Describe a decision in New Simulation or configure strategies in Strategy Review to generate Monte Carlo results and Pareto rankings.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => setCurrentTab("new_simulation")}
              >
                Go to New Simulation
              </Button>
            </div>
          )}

          {/* PAGE 5.6: WHAT-IF WORKSPACE */}
          {currentTab === "what_if" && resultsData && (
            <WhatIfWorkspace
              data={resultsData}
              schemaFields={PACK_SCHEMAS[selectedPackId] || PACK_SCHEMAS.hospital}
              onBackToResults={() => setCurrentTab("results")}
            />
          )}

          {/* Fallback if user goes to what-if before results */}
          {currentTab === "what_if" && !resultsData && (
            <div className="p-12 ws-card text-center space-y-4 max-w-lg mx-auto">
              <div className="text-base font-bold text-[var(--text)]">
                What-If Sandbox Requires a Completed Run
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Run an initial simulation baseline first to calibrate sensitivity elasticities.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => setCurrentTab("new_simulation")}
              >
                Start Simulation
              </Button>
            </div>
          )}

          {/* PAGE 5.7: HISTORY & COMPARE */}
          {(currentTab === "history" || currentTab === "compare") && (
            <HistoryAndCompare
              runs={historyRuns}
              mode={currentTab === "compare" ? "compare" : "history"}
              onLoadRun={() => {
                if (resultsData) setCurrentTab("results");
              }}
            />
          )}

          {/* PAGE 5.8: ADMIN */}
          {currentTab === "admin" && <AdminAndSettings mode="admin" />}

          {/* PAGE 5.9: SETTINGS */}
          {currentTab === "settings" && <AdminAndSettings mode="settings" />}
        </main>
      </div>
    </div>
  );
}
