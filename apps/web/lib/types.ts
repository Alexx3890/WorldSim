// WorldSim AI — Frontend Type Definitions (matching schema & API specifications)

export interface AggregateStats {
  metric_key: string;
  mean: number;
  median: number;
  std_dev: number;
  p5: number;
  p95: number;
  ci_lower: number;
  ci_upper: number;
  n_successful: number;
}

export interface RunResponse {
  run_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "partial";
  pack_id: string;
  parameters: Record<string, number | string | boolean>;
  n_successful: number;
  n_failed: number;
  aggregate: AggregateStats[];
  degradations: string[];
}

export interface AxisScore {
  axis: "cost" | "risk" | "time" | "efficiency";
  score: number;
  weight: number;
}

export interface StrategyScore {
  strategy_id: string;
  strategy_name: string;
  composite_score: number;
  axis_scores: AxisScore[];
  is_pareto_optimal: boolean;
  rank: number;
}

export interface StrategyInfo {
  strategy_id: string;
  name: string;
  description: string;
  parameter_deltas: Record<string, any>;
  parameters: Record<string, any>;
  origin?: "ai" | "user" | "template";
  hypothesis?: string;
  expected_tradeoff?: string;
  is_baseline: boolean;
}

export interface MetricSummary {
  mean: number;
  median: number;
  std_dev: number;
  ci_lower: number;
  ci_upper: number;
  p5: number;
  p95: number;
}

export interface ReportOutput {
  title: string;
  executive_summary: string;
  key_findings: string[];
  recommended_strategy: string;
  recommendation_rationale: string;
  tradeoff_analysis: string;
  degradations_and_limitations?: string | null;
}

export interface CriticOutput {
  passed: boolean;
  score: number;
  discrepancies: string[];
  notes: string;
}

export interface AISimulationResponse {
  pack_id: string;
  pack_name: string;
  objectives: string[];
  constraints: string[];
  assumptions: string[];
  strategies: StrategyInfo[];
  strategy_scores: StrategyScore[];
  simulation_results: Record<string, Record<string, MetricSummary>>;
  report: ReportOutput;
  critic: CriticOutput;
  degradations: string[];
}

export interface ParameterField {
  name: string;
  type: "int" | "float" | "str" | "bool" | "choice";
  default: any;
  description: string;
  unit: string;
  min_value?: number | null;
  max_value?: number | null;
  choices?: string[] | null;
}

export interface PackSchema {
  pack_id: string;
  parameters: ParameterField[];
  objectives?: string[];
  constraints?: string[];
}

export interface PackManifest {
  id: string;
  name: string;
  version: string;
  modelling_type: string;
  required_engine_version: string;
  description: string;
  author: string;
}

export interface HistoryRunRecord {
  id: string;
  date: string;
  scenario_title: string;
  pack_id: string;
  status: "completed" | "partial" | "failed";
  strategy_count: number;
  best_strategy: string;
  degradations: string[];
}

// 6 flat categorical colors matching Section 7 without gradients
export const FLAT_CHART_COLORS = [
  "#2563EB", // Accent Blue
  "#0D9488", // Teal
  "#D97706", // Amber
  "#7C3AED", // Violet
  "#DC2626", // Red
  "#4B5563", // Gray
];

export const METRIC_META: Record<string, { label: string; unit: string; color: string; axis: string }> = {
  avg_wait_minutes:      { label: "Avg Wait Time",     unit: "min",      color: "#2563EB", axis: "Time" },
  p95_wait_minutes:      { label: "P95 Wait Time",     unit: "min",      color: "#DC2626", axis: "Risk" },
  avg_treatment_minutes: { label: "Avg Treatment",     unit: "min",      color: "#0D9488", axis: "Time" },
  bed_utilization:       { label: "Bed Utilization",   unit: "%",        color: "#7C3AED", axis: "Efficiency" },
  cost_per_patient_usd:  { label: "Cost per Patient",  unit: "USD",      color: "#D97706", axis: "Cost" },
  patients_seen:         { label: "Patients Seen",     unit: "patients", color: "#4B5563", axis: "Efficiency" },
  total_cost_usd:        { label: "Total Cost",        unit: "USD",      color: "#D97706", axis: "Cost" },
  overload_risk_pct:     { label: "Overload Risk",     unit: "%",        color: "#DC2626", axis: "Risk" },
};
