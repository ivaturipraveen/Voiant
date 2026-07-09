// Typed client for the Voiant backend.
// - Dev: Vite proxies "/api" -> the backend (strips the /api prefix).
// - Prod: set VITE_API_BASE to the backend's public URL (e.g. https://voiant-backend.onrender.com).
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export interface Health {
  status: string;
  product: string;
  powered_by: string;
  shield: { status: string; base_url: string };
  llm: { enabled: boolean; default_model: string; complex_model: string };
  client: { id: string; name: string; config_version: number };
  dataset: { loaded: boolean; mock_data: boolean; rep_count: number; snapshot_id: string | null };
}

export interface Finding {
  code: string;
  severity: "info" | "warn" | "critical";
  subject: string;
  message: string;
  evidence: Record<string, string | number>;
}

export interface Assumption {
  id: string;
  statement: string;
  basis: string;
  confidence: string;
}

export interface HeatmapCell {
  rep_id: string;
  display_name: string;
  segment: string;
  region: string;
  fairness_ratio: number;
  deviation: number;
  band: string;
  color: string;
}

export interface FairnessResult {
  rep_id: string;
  display_name: string;
  email: string;
  segment: string;
  region: string;
  quota: string;
  opportunity: string;
  fairness_ratio: number;
  segment_median_ratio: number;
  deviation: number;
  band: string;
}

export interface SegmentSummary {
  segment: string;
  rep_count: number;
  deployed_quota: string;
  total_pipeline: string;
  quota_cv: number;
  is_paintbrushed: boolean;
  company_target: string;
  over_assignment: string;
  over_assignment_pct: number;
}

export interface RecommendationTag {
  label: string;
  color_scheme: string;
}

export interface RecommendationCard {
  id: string;
  priority_num: string;
  priority_label: string;
  priority_color: string;
  title: string;
  description: string;
  tags: RecommendationTag[];
  impact_dollars: string;
  effort: string;
  confidence_level: string;
  confidence_icon: string;
}

export interface RecommendationsReport {
  aggregate_impact: string;
  cards: RecommendationCard[];
  client_name: string;
  company_target_str: string;
  snapshot_date_str: string;
  refresh_cadence: string;
}

export interface QuotaEquityReport {
  deployed_quota: string;
  top_down_target: string;
  over_assignment: string;
  over_assignment_pct: number;
  rep_count: number;
  per_rep: FairnessResult[];
  heatmap: HeatmapCell[];
  segments: SegmentSummary[];
  findings: Finding[];
  assumptions: Assumption[];
}

// Capacity Headroom report shapes
export interface RepLoad {
  rep_id: string;
  display_name: string;
  segment: string;
  region: string;
  quota: string;
  baseline: string;
  load_index: number;
  load_delta: string;
  classification: string;
  headroom: string;
  color: string;
}

export interface RedistributionMove {
  from_rep: string;
  to_rep: string;
  from_rep_name: string;
  to_rep_name: string;
  segment: string;
  amount: string;
  context: string;
  from_was_pct: string;
  from_new_pct: string;
  to_was_pct: string;
  to_new_pct: string;
}

export interface ScenarioOutcome {
  kind: string;
  params: Record<string, string | number>;
  summary: string;
  before: Record<string, string | number>;
  after: Record<string, string | number>;
  feasible: boolean;
}

export interface CapacityReport {
  team_total_quota: string;
  team_additional_capacity: string;
  team_additional_capacity_pct: number;
  rep_count: number;
  overloaded: number;
  balanced: number;
  underloaded: number;
  qoq_balanced: number;
  qoq_overloaded: number;
  qoq_underloaded: number;
  per_rep: RepLoad[];
  rollups: Array<{
    segment: string;
    rep_count: number;
    mean_quota: string;
    total_quota: string;
    total_headroom: string;
    overloaded: number;
    balanced: number;
    underloaded: number;
  }>;
  redistribution: RedistributionMove[];
  findings: Finding[];
  assumptions: Assumption[];
  scenario: ScenarioOutcome | null;
}

export interface AgentRunResponse {
  run_id: string;
  agent: string;
  agent_version: string;
  report_type: string; // quota_equity | capacity_headroom | synthesis
  question: string;
  routed_from: string;
  // report shape depends on report_type; cast in the view that handles it.
  report: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  narrative: string;
  narrative_source: string;
  determinism_hash: string;
  mock_data: boolean;
  suggested_followups: string[];
  session_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trace?: any; // per-step technical trace (shield sample, engine, model I/O)
  memory?: { question: string; agent: string; run_id?: string }[]; // session turns remembered
}

export interface ExecMetric {
  label: string;
  value: string;
  tone: string;
  subtitle?: string;
  trend_text?: string;
  trend_value?: string;
  trend_color_class?: string;
  chart_label?: string;
}

export interface ExecutiveSummaryResponse {
  run_id: string;
  mock_data: boolean;
  page_metadata?: Record<string, string>;
  headline_insight?: Record<string, string>;
  headroom_context?: Record<string, string>;
  metrics: ExecMetric[];
  top_findings: Finding[];
  narrative: string;
  narrative_source: string;
  generated_for: string;
}

export interface LineageResponse {
  run_id: string;
  events: Array<Record<string, string>>;
  summary: Array<{ agent: string; field: string; masking: string; reads: number; first_ts: string; last_ts: string }>;
}

export interface AuditResponse {
  run_id: string;
  inferences: Array<Record<string, unknown>>;
  llm_calls: Array<Record<string, unknown>>;
}

export interface AuditEvent {
  run_id: string;
  agent: string;
  agent_version: string;
  determinism_hash: string;
  config_version: number;
  field_reads: number;
  mock_data: boolean;
  detail?: Record<string, unknown> | null;
  ts: string;
}

export interface ClientConfig {
  client_id: string;
  client_name: string;
  version: number;
  company: { name: string; top_down_target: string };
  interpretation_rules: Array<{ id: string; label: string; rule: string }>;
  segment_definitions: Array<{ name: string; expected_quota_to_pipeline: number; paintbrush_cv_threshold: number }>;
  stage_criteria: Array<{ name: string; min_probability: number }>;
  fairness_bands: Array<{ name: string; max_deviation: number; color: string }>;
  rbac_roles: Array<{ name: string; mask: Record<string, string>; allowed_fields?: string[] }>;
  model_routing?: { default: string; complex: string };
  capacity?: { over_threshold: number; under_threshold: number; max_stretch: number; colors: Record<string, string> };
}

export interface SystemInfo {
  platform: {
    shield: { status: string; base_url: string };
    llm: { enabled: boolean; default_model: string; complex_model: string; routing: string };
    config: { client_id: string; client_name: string; version: number };
    dataset: {
      rep_count: number;
      mock_data: boolean;
      snapshot_id: string | null;
      deployed_quota: number | null;
      top_down_target: number | null;
      paintbrush_segment: string | null;
      overloaded_rep_ids: string[];
      segments: string[];
      regions: string[];
    };
  };
  agents: {
    registered: Array<{ name: string; version: string; required_fields: string[] }>;
    library: Array<{ key: string; name: string; responsibility: string; status: string; phase: string }>;
  };
  connectors: Array<Record<string, unknown>>;
  pipeline: Array<{ step: string; detail: string }>;
  shield_tokens: Array<{ token: string; entity_type: string; field: string }>;
  shield_token_summary?: { total: number; by_type: Record<string, number> };
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} -> ${r.status}`);
  return r.json();
}

export const api = {
  health: () => get<Health>("/health"),
  login: (username: string, password: string) =>
    post<{ ok: boolean; user: string }>("/auth/login", { username, password }),
  recentAudit: (limit = 100) => get<{ events: AuditEvent[] }>(`/audit/recent?limit=${limit}`),
  toggleShield: (enabled: boolean) =>
    post<{ enabled: boolean; status: string; reps: number }>("/shield/toggle", { enabled }),
  config: () => get<ClientConfig>("/config"),
  reloadConfig: () => post<{ reloaded: boolean; version: number }>("/config/reload", {}),
  updateConfig: (patch: Record<string, unknown>) => post<ClientConfig>("/config/update", patch),
  chat: (question: string, role: string, sessionId: string | null, allowLlm = true) =>
    post<AgentRunResponse>("/agents/chat", { question, role, session_id: sessionId, allow_llm: allowLlm }),
  connectors: () => get<{ connectors: Array<Record<string, unknown>> }>("/ingest/connectors"),
  territoryEquity: (role: string) =>
    get<AgentRunResponse>(`/dashboards/territory-equity?role=${role}`),
  capacityOverview: (role: string) =>
    get<AgentRunResponse>(`/dashboards/capacity-overview?role=${role}`),
  recommendationsOverview: (role: string) =>
    get<AgentRunResponse>(`/dashboards/recommendations?role=${role}`),
  executiveSummary: (role: string) =>
    get<ExecutiveSummaryResponse>(`/dashboards/executive-summary?role=${role}`),
  system: () => get<SystemInfo>("/system"),
  lineage: (runId: string) => get<LineageResponse>(`/lineage/${runId}`),
  audit: (runId: string) => get<AuditResponse>(`/audit/${runId}`),
  uploadCsv: async (file: File, setActive: boolean) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("set_active", String(setActive));
    const r = await fetch(`${BASE}/ingest/upload`, { method: "POST", body: fd });
    if (!r.ok) throw new Error(`upload -> ${r.status}`);
    return r.json();
  },
};

export function fmtMoney(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
