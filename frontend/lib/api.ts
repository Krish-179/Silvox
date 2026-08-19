const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  type?: string;
  constructor(status: number, message: string, type?: string) {
    super(message);
    this.status = status;
    this.type = type;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.message ?? body?.message ?? "Request failed",
      body?.error?.type,
    );
  }

  return res.json();
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  slack_webhook_url: string | null;
}

export interface ApiKeySummary {
  id: string;
  display_prefix: string;
  active: boolean;
  created_at: string;
  revoked_at: string | null;
}

export interface GeneratedKey {
  id: string;
  key: string;
  displayPrefix: string;
  createdAt: string;
}

export interface SpendData {
  windowDays: number;
  daily: { day: string; spend: number }[];
  byModel: { model: string; spend: number }[];
  byKey: { apiKeyId: string | null; displayPrefix: string; spend: number }[];
  currentMonthSpend: number;
  currentDaySpend: number;
  activeRules: {
    id: string;
    scopeType: "project" | "api_key";
    period: string;
    limitUsd: number;
    action: string;
    keyDisplayPrefix: string | null;
    currentSpend: number;
  }[];
}

export interface BudgetRule {
  id: string;
  scope_type: "project" | "api_key";
  scope_id: string;
  key_display_prefix: string | null; // populated only for scope_type === "api_key"
  period: "daily" | "monthly";
  limit_usd: string;
  action: "alert" | "downgrade" | "block";
  downgrade_model: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleInput {
  period: "daily" | "monthly";
  limitUsd: number;
  action: "alert" | "downgrade" | "block";
  downgradeModel?: string;
  keyId?: string; // presence scopes the rule to a specific key instead of the whole project
}

export interface RateCardEntry {
  model: string;
  inputPer1k: number;
  outputPer1k: number;
}

export interface RequestLogRow {
  id: string;
  apiKeyId: string;
  displayPrefix: string;
  model: string;
  statusCode: number;
  stream: boolean;
  tokensIn: number | null;
  tokensOut: number | null;
  cost: number | null;
  errorType: string | null;
  createdAt: string;
}

export interface RequestLogResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: RequestLogRow[];
}

export interface RequestLogFilters {
  model?: string;
  status?: "success" | "error";
  keyId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "cost" | "tokensIn" | "tokensOut" | "model";
  sortOrder?: "asc" | "desc";
}

export interface Subscription {
  id: string;
  plan: string;
  planName: string;
  status: "active" | "canceled" | "expired";
  amountUsd: number;
  startedAt: string;
  currentPeriodEnd: string;
  canceledAt: string | null;
}

export interface SubscriptionPurchase {
  id: string;
  amountUsd: number;
  status: "paid" | "failed" | "refunded";
  purchasedAt: string;
  note: string | null;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ id: string; email: string; requiresVerification: boolean }>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    ),
  login: (email: string, password: string, rememberMe: boolean = false) =>
    request<{ id: string; email: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe }),
    }),
  verifyEmail: (email: string, code: string) =>
    request<{ id: string; email: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
  resendOtp: (email: string, purpose: "verify_email" | "reset_password") =>
    request<{ ok: true; cooldownSeconds: number }>("/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email, purpose }),
    }),
  forgotPassword: (email: string) =>
    request<{ ok: true }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ ok: true }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, code, newPassword }),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ userId: string; email: string }>("/auth/me"),

  listProjects: () => request<Project[]>("/projects"),
  createProject: (name: string) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  listKeys: (projectId: string) =>
    request<ApiKeySummary[]>(`/projects/${projectId}/keys`),
  createKey: (projectId: string) =>
    request<GeneratedKey>(`/projects/${projectId}/keys`, { method: "POST" }),
  rotateKey: (keyId: string) =>
    request<GeneratedKey>(`/keys/${keyId}/rotate`, { method: "POST" }),
  revokeKey: (keyId: string) =>
    request<{ ok: true }>(`/keys/${keyId}/revoke`, { method: "POST" }),

  getSpend: (projectId: string, days: number = 7) =>
    request<SpendData>(`/projects/${projectId}/spend?days=${days}`),

  listRules: (projectId: string) =>
    request<BudgetRule[]>(`/projects/${projectId}/rules`),
  createRule: (projectId: string, input: RuleInput) =>
    request<BudgetRule>(`/projects/${projectId}/rules`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateRule: (ruleId: string, input: RuleInput) =>
    request<BudgetRule>(`/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteRule: (ruleId: string) =>
    request<{ ok: true }>(`/rules/${ruleId}`, { method: "DELETE" }),

  getRateCard: () => request<RateCardEntry[]>("/rate-card"),
  listRequests: (projectId: string, filters: RequestLogFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.model) params.set("model", filters.model);
    if (filters.status) params.set("status", filters.status);
    if (filters.keyId) params.set("keyId", filters.keyId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    params.set("page", String(filters.page ?? 1));
    params.set("pageSize", String(filters.pageSize ?? 50));
    return request<RequestLogResponse>(
      `/projects/${projectId}/requests?${params.toString()}`,
    );
  },
  listRequestModels: (projectId: string) =>
    request<string[]>(`/projects/${projectId}/requests/models`),
  renameProject: (projectId: string, name: string) =>
    request<Project>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteProject: (projectId: string) =>
    request<{ ok: true }>(`/projects/${projectId}`, { method: "DELETE" }),
  updateSlackWebhook: (projectId: string, slackWebhookUrl: string | null) =>
    request<Project>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ slackWebhookUrl }),
    }),
  getSubscription: () =>
    request<{
      subscription: Subscription | null;
      purchases: SubscriptionPurchase[];
    }>("/billing/subscription"),
};
