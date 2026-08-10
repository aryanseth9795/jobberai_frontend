// API client for the JobberAI backend.
//
// Every call goes through `authFetch`, which attaches the bearer token and
// transparently refreshes it on a 401. Before Task 1.6 each function below
// hand-rolled its own `fetch` + error unwrapping; that duplication is now in
// one place.

import { API_BASE } from "./config";
import {
  TokenPair,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
} from "./auth";

export { API_BASE };

// ── Transport ────────────────────────────────────────────────────────────

function buildHeaders(init: RequestInit, token: string | null): Headers {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Never set Content-Type for a FormData body: the browser has to generate
  // the multipart boundary itself, and naming the type here strips it, which
  // makes the server fail to parse the upload. applyUnified() and
  // ingestProfile() both post multipart.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

/**
 * fetch() with the access token attached, refreshing once on a 401.
 *
 * The retry is deliberately capped at one attempt: if a request 401s with a
 * token that was just minted, the problem is authorization rather than
 * expiry, and retrying in a loop would just hammer the endpoint.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = getAccessToken();

  // The access cookie expires 15 minutes in, well before the 30-day refresh
  // cookie. Refreshing up front costs one round trip; sending a request we
  // know carries no credential costs the same round trip *and* a guaranteed
  // 401 first.
  if (!token && getRefreshToken()) {
    token = await refreshAccessToken();
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(init, token),
  });
  if (res.status !== 401) return res;

  const refreshed = await refreshAccessToken();
  // refreshAccessToken() has already redirected to /login if the refresh
  // token was actively rejected. A null here with no redirect means the
  // network failed — hand back the original 401 rather than inventing one.
  if (!refreshed) return res;

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(init, refreshed),
  });
}

/**
 * Turn a failed Response into an Error carrying the backend's own message.
 *
 * FastAPI returns `detail` as a string for HTTPException but as an array of
 * `{loc, msg, type}` objects for a 422 validation failure — which is exactly
 * what registration returns for a short password. The old `err.detail || ...`
 * rendered that array as "[object Object]".
 */
async function toError(res: Response): Promise<Error> {
  const payload = await res.json().catch(() => null);
  const detail = payload?.detail;

  if (Array.isArray(detail)) {
    const joined = detail
      .map((d: { msg?: string }) => d?.msg)
      .filter(Boolean)
      .join("; ");
    return new Error(joined || `HTTP ${res.status}`);
  }
  if (typeof detail === "string" && detail) return new Error(detail);
  return new Error(`HTTP ${res.status}`);
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw await toError(res);
  return res.json();
}

/** GET returning JSON. */
async function apiGet<T>(path: string): Promise<T> {
  return readJson<T>(await authFetch(path));
}

/** Any method with an optional JSON body, returning JSON. */
async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  return readJson<T>(
    await authFetch(path, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  );
}

/** Any method whose response body we don't care about. */
async function apiVoid(path: string, method: string): Promise<void> {
  const res = await authFetch(path, { method });
  if (!res.ok) throw await toError(res);
}

// ── Auth ─────────────────────────────────────────────────────────────────
//
// register/login use a plain fetch rather than authFetch: there is no token
// yet, and routing them through the refresh path would let a stale cookie
// trigger a pointless refresh attempt in the middle of signing in.

export interface UserPublic {
  id: string;
  email: string;
  created_at: string;
}

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<T>(res);
}

export async function register(email: string, password: string): Promise<TokenPair> {
  return publicPost<TokenPair>("/api/auth/register", { email, password });
}

export async function login(email: string, password: string): Promise<TokenPair> {
  return publicPost<TokenPair>("/api/auth/login", { email, password });
}

export async function getMe(): Promise<UserPublic> {
  return apiGet<UserPublic>("/api/auth/me");
}

// ── Settings: API keys + candidate identity ──────────────────────────────

export type KeyStatus = "unset" | "ok" | "unreadable";

/** GET/PUT /api/auth/me/keys. The two API keys come back *masked* — never the
 * plaintext — so they can be displayed but not round-tripped. */
export interface KeysResponse {
  gemini_api_key: string | null;
  gemini_configured: boolean;
  gemini_status: KeyStatus;
  resend_api_key: string | null;
  resend_configured: boolean;
  resend_status: KeyStatus;
  sender_email: string | null;
  reply_to_email: string | null;

  full_name: string | null;
  headline: string | null;
  phone: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  contact_email: string | null;
  writing_notes: string | null;
}

/** PUT /api/auth/me/keys is a genuine partial update: an omitted field is left
 * untouched, and a blank string *clears* an identity field. Callers must omit
 * what the user didn't change rather than echoing a masked key back. */
export interface UpdateKeysRequest {
  gemini_api_key?: string;
  resend_api_key?: string;
  sender_email?: string;
  reply_to_email?: string;
  full_name?: string;
  headline?: string;
  phone?: string;
  portfolio_url?: string;
  github_url?: string;
  linkedin_url?: string;
  contact_email?: string;
  writing_notes?: string;
}

export async function getKeys(): Promise<KeysResponse> {
  return apiGet<KeysResponse>("/api/auth/me/keys");
}

export async function updateKeys(payload: UpdateKeysRequest): Promise<KeysResponse> {
  return apiSend<KeysResponse>("/api/auth/me/keys", "PUT", payload);
}

// ── Domain types ─────────────────────────────────────────────────────────

export interface JobInfo {
  company_name: string;
  role: string;
  hr_email: string;
  description: string;
  requirements: string;
  location: string;
  salary_range: string;
  job_url: string;
}

export interface CoverEmail {
  subject: string;
  body: string;
}

export interface DuplicateDetails {
  matched_job: string;
  applied_on: string;
  similarity_score: number;
  reason?: string;
}

export interface DraftResponse {
  draft_id: string;
  job_info: JobInfo;
  cover_email: CoverEmail | null;
  draft_status: "drafted" | "duplicate" | "error";
  duplicate_details: DuplicateDetails | null;
  error: string | null;
}

export interface BatchResponse {
  batch_id: string;
  total_jobs_found: number;
  drafts: DraftResponse[];
}

export interface ApprovedDraft {
  draft_id: string;
  cover_email: CoverEmail;
  hr_email?: string;
  attach_resume: boolean;
  attach_cover_letter: boolean;
}

export interface SendResult {
  draft_id: string;
  status: "sent" | "failed";
  error: string | null;
}

export interface ConfirmResponse {
  batch_id: string;
  results: SendResult[];
}

export interface JobApplication {
  _id: string;
  company_name: string;
  role: string;
  hr_email: string;
  status: string;
  applied_at: string;
  cover_email_subject: string;
  cover_email_body: string;
  job_description?: string;
  location?: string;
  salary_range?: string;
}

export interface ApplicationsResponse {
  total: number;
  applications: JobApplication[];
}

export interface DashboardStats {
  total: number;
  sent: number;
  failed: number;
  rejected: number;
  this_week: number;
  today: number;
  by_status: Record<string, number>;
}

// ── Mail: apply ──────────────────────────────────────────────────────────

// Upload files and text as unified multimodal request
export async function applyUnified(text: string, files: File[]): Promise<BatchResponse> {
  const formData = new FormData();
  if (text) {
    formData.append("text", text);
  }
  for (const file of files) {
    formData.append("files", file);
  }
  return readJson<BatchResponse>(
    await authFetch("/api/mail/apply/unified", { method: "POST", body: formData })
  );
}

// Regenerate batch based on feedback
export async function regenerateBatch(
  batch_id: string,
  feedback: string
): Promise<BatchResponse> {
  return apiSend<BatchResponse>("/api/mail/apply/regenerate", "POST", { batch_id, feedback });
}

// Send approved emails
export async function confirmBatch(
  batch_id: string,
  approved_drafts: ApprovedDraft[]
): Promise<ConfirmResponse> {
  return apiSend<ConfirmResponse>("/api/mail/apply/confirm", "POST", {
    batch_id,
    approved_drafts,
  });
}

// ── Applications ─────────────────────────────────────────────────────────

// List past applications
export async function getJobs(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<ApplicationsResponse> {
  const qs = new URLSearchParams();
  if (params?.skip !== undefined) qs.set("skip", String(params.skip));
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  return apiGet<ApplicationsResponse>(`/api/shared/jobs?${qs}`);
}

// Get a single application
export async function getJob(id: string): Promise<JobApplication> {
  return apiGet<JobApplication>(`/api/shared/jobs/${id}`);
}

// Dashboard stats
export async function getJobStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>("/api/shared/jobs/stats");
}

// Update status of an application
export async function updateJobStatus(id: string, status: string): Promise<void> {
  return apiVoid(
    `/api/shared/jobs/${id}/status?status=${encodeURIComponent(status)}`,
    "PATCH"
  );
}

// Delete an application
export async function deleteJob(id: string): Promise<void> {
  return apiVoid(`/api/shared/jobs/${id}`, "DELETE");
}

// ── Profile ingestion ────────────────────────────────────────────────────

// Get current profile ingestion status
export async function getProfileStatus(): Promise<{
  status: string;
  chunks: number;
  sources: string[];
  message: string;
}> {
  return apiGet("/api/shared/profile/status");
}

// Ingest profile docs
export async function ingestProfile(
  files?: File[]
): Promise<{ status: string; chunks_ingested: number; message: string; sources: string[] }> {
  const formData = new FormData();
  if (files) {
    for (const f of files) formData.append("files", f);
  }
  return readJson(await authFetch("/api/shared/ingest", { method: "POST", body: formData }));
}

// Get uploaded resume/cover letter status
export interface UploadedFileInfo {
  filename: string | null;
  size_bytes: number;
  uploaded: boolean;
}

export interface UploadedFiles {
  resume: UploadedFileInfo;
  cover_letter: UploadedFileInfo;
}

export async function getUploadedFiles(): Promise<UploadedFiles> {
  return apiGet<UploadedFiles>("/api/shared/profile/uploads");
}

// Delete an uploaded file
export async function deleteUploadedFile(
  fileType: "resume" | "cover_letter"
): Promise<{ status: string; message: string }> {
  return apiSend(`/api/shared/profile/uploads/${fileType}`, "DELETE");
}

// --- NeuralAgent Forms API ---

export interface FormField {
  field_id: string;
  question: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  helper_text?: string;
  section?: string;
}

export interface FormAnswer {
  field_id: string;
  question: string;
  question_type: string;
  answer: string | string[];
  confidence: number;
  source: string;
  reasoning?: string;
}

export interface FormFillPreview {
  preview_id: string;
  form_url: string;
  provider: string;
  form_title: string;
  metadata: Record<string, string>;
  fields: FormField[];
  answers: FormAnswer[];
  status: string;
  filled_screenshot_b64?: string;
  error?: string;
}

export async function fillForm(url: string, instructions?: string): Promise<FormFillPreview> {
  return apiSend<FormFillPreview>("/api/gform/forms/fill", "POST", { url, instructions });
}

export async function getFormPreview(id: string): Promise<FormFillPreview> {
  return apiGet<FormFillPreview>(`/api/gform/forms/preview/${id}`);
}

export async function editAnswer(
  id: string,
  field_id: string,
  new_answer: string | string[]
): Promise<FormFillPreview> {
  return apiSend<FormFillPreview>(`/api/gform/forms/edit/${id}`, "PATCH", {
    field_id,
    new_answer,
  });
}

export async function approveForm(
  id: string
): Promise<{ status: string; message: string; screenshot_b64?: string }> {
  return apiSend(`/api/gform/forms/approve/${id}`, "POST");
}

/** Google *Forms* sign-in — unrelated to JobberAI account auth, despite the
 * name. It authenticates the headless browser that fills forms on the user's
 * behalf, and like every other call it is scoped by the bearer token. */
export async function loginGoogle(): Promise<{ status: string; message: string }> {
  return apiSend("/api/gform/auth/login", "POST", { user_id: "default_user" });
}

// --- New Form Filling History API ---

/** The stored question/answer rows on a past form session. These were typed
 * `any[]` before Task 1.6; they carry more fields than this, but these are the
 * ones the history view reads, and naming them is what lets the dashboard
 * match an answer back to its question. */
export interface FormSessionQuestion {
  index: number;
  question: string;
}

export interface FormSessionAnswer {
  index: number;
  question: string;
  answer: string | string[];
}

export interface FormSession {
  preview_id: string; // The session ID
  form_url: string;
  form_title: string;
  company: string;
  role: string;
  status: string;
  filled_at: string;
  questions_count: number;
  questions: FormSessionQuestion[];
  answers: FormSessionAnswer[];
}

export interface FormHistoryResponse {
  total: number;
  sessions: FormSession[];
}

export async function getFormHistory(params?: {
  skip?: number;
  limit?: number;
}): Promise<FormHistoryResponse> {
  const qs = new URLSearchParams();
  if (params?.skip !== undefined) qs.set("skip", String(params.skip));
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  return apiGet<FormHistoryResponse>(`/api/gform/fill-form/history?${qs}`);
}

// --- Job Scraping API ---

export interface JobListing {
  company_name: string | null;
  company_detail: string | null;
  salary: string | null;
  location: string | null;
  experience_required: string | null;
  other_requirements: string | null;
  hr_email_or_number: string | null;
  job_apply_link: string | null;
  additional_data: string | null;
  scraped_at: string;
  source_site: string;
  search_role: string;
  role: string | null;
  description: string | null;
}

export interface ScrapeRequest {
  roles: string[];
  max_results_per_role: number;
}

export interface ScrapeResponse {
  status: string;
  total_found: number;
  new_jobs: number;
  duplicates_skipped: number;
  jobs: JobListing[];
}

export async function triggerScrape(req: ScrapeRequest): Promise<ScrapeResponse> {
  return apiSend<ScrapeResponse>("/api/scraper/scrape", "POST", req);
}

export async function getScrapedJobs(params?: {
  role?: string;
  skip?: number;
  limit?: number;
}): Promise<{ total: number; jobs: JobListing[] }> {
  const qs = new URLSearchParams();
  if (params?.role) qs.set("role", params.role);
  if (params?.skip !== undefined) qs.set("skip", String(params.skip));
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  return apiGet(`/api/scraper/listings?${qs}`);
}

// --- Re-Apply API ---

export interface ReapplyDraft {
  original_app_id: string;
  company_name: string;
  role: string;
  hr_email: string;
  original_subject: string;
  original_body: string;
  new_cover_email: CoverEmail | null;
  draft_status: "drafted" | "error";
  error: string | null;
}

export interface ReapplyBatchResponse {
  batch_id: string;
  total_found: number;
  total_drafted: number;
  drafts: ReapplyDraft[];
}

export interface ReapplyApprovedDraft {
  original_app_id: string;
  cover_email: CoverEmail;
  hr_email?: string; // optional override
  attach_resume: boolean;
  attach_cover_letter: boolean;
}

export interface ReapplySendResult {
  original_app_id: string;
  status: "sent" | "failed";
  error: string | null;
}

export interface ReapplyConfirmResponse {
  batch_id: string;
  results: ReapplySendResult[];
}

/** Phase 1: Fetch historical applications in date range and re-draft emails. */
export async function reapplyDraft(
  start_date: string,
  end_date: string,
  status_filter?: string
): Promise<ReapplyBatchResponse> {
  return apiSend<ReapplyBatchResponse>("/api/mail/reapply/draft", "POST", {
    start_date,
    end_date,
    status_filter: status_filter || null,
  });
}

/** Phase 2: Send approved re-drafted emails (writes to 'reapplications' collection only). */
export async function reapplyConfirm(
  batch_id: string,
  approved_drafts: ReapplyApprovedDraft[]
): Promise<ReapplyConfirmResponse> {
  return apiSend<ReapplyConfirmResponse>("/api/mail/reapply/confirm", "POST", {
    batch_id,
    approved_drafts,
  });
}
