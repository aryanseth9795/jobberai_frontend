// API client for the Job Application Agent backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

// Upload files and text as unified multimodal request
export async function applyUnified(text: string, files: File[]): Promise<BatchResponse> {
  const formData = new FormData();
  if (text) {
    formData.append("text", text);
  }
  for (const file of files) {
    formData.append("files", file);
  }
  const res = await fetch(`${API_BASE}/api/mail/apply/unified`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Regenerate batch based on feedback
export async function regenerateBatch(
  batch_id: string,
  feedback: string
): Promise<BatchResponse> {
  const res = await fetch(`${API_BASE}/api/mail/apply/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch_id, feedback }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Send approved emails
export async function confirmBatch(
  batch_id: string,
  approved_drafts: ApprovedDraft[]
): Promise<ConfirmResponse> {
  const res = await fetch(`${API_BASE}/api/mail/apply/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch_id, approved_drafts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

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
  const res = await fetch(`${API_BASE}/api/shared/jobs?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Get a single application
export async function getJob(id: string): Promise<JobApplication> {
  const res = await fetch(`${API_BASE}/api/shared/jobs/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Dashboard stats
export async function getJobStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/api/shared/jobs/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Update status of an application
export async function updateJobStatus(id: string, status: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/shared/jobs/${id}/status?status=${encodeURIComponent(status)}`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Delete an application
export async function deleteJob(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/shared/jobs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Get current profile ingestion status
export async function getProfileStatus(): Promise<{
  status: string;
  chunks: number;
  sources: string[];
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/shared/profile/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Ingest profile docs
export async function ingestProfile(files?: File[]): Promise<{ status: string; chunks_ingested: number; message: string; sources: string[] }> {
  const formData = new FormData();
  if (files) {
    for (const f of files) formData.append("files", f);
  }
  const res = await fetch(`${API_BASE}/api/shared/ingest`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const res = await fetch(`${API_BASE}/api/shared/profile/uploads`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Delete an uploaded file
export async function deleteUploadedFile(fileType: "resume" | "cover_letter"): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/shared/profile/uploads/${fileType}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const res = await fetch(`${API_BASE}/api/gform/forms/fill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, instructions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getFormPreview(id: string): Promise<FormFillPreview> {
  const res = await fetch(`${API_BASE}/api/gform/forms/preview/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function editAnswer(id: string, field_id: string, new_answer: string | string[]): Promise<FormFillPreview> {
  const res = await fetch(`${API_BASE}/api/gform/forms/edit/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field_id, new_answer }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function approveForm(id: string): Promise<{status: string, message: string, screenshot_b64?: string}> {
  const res = await fetch(`${API_BASE}/api/gform/forms/approve/${id}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function loginGoogle(): Promise<{status: string, message: string}> {
  const res = await fetch(`${API_BASE}/api/gform/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "default_user" }),
  });
  if (!res.ok) {
     const err = await res.json().catch(() => ({ detail: "Unknown Error" }));
     throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- New Form Filling History API ---

export interface FormSession {
  preview_id: string;      // The session ID
  form_url: string;
  form_title: string;
  company: string;
  role: string;
  status: string;
  filled_at: string;
  questions_count: number;
  questions: any[];
  answers: any[];
}

export interface FormHistoryResponse {
  total: number;
  sessions: FormSession[];
}

export async function getFormHistory(params?: { skip?: number; limit?: number }): Promise<FormHistoryResponse> {
  const qs = new URLSearchParams();
  if (params?.skip !== undefined) qs.set("skip", String(params.skip));
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/api/gform/fill-form/history?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const res = await fetch(`${API_BASE}/api/scraper/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getScrapedJobs(params?: { role?: string; skip?: number; limit?: number }): Promise<{total: number, jobs: JobListing[]}> {
  const qs = new URLSearchParams();
  if (params?.role) qs.set("role", params.role);
  if (params?.skip !== undefined) qs.set("skip", String(params.skip));
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  
  const res = await fetch(`${API_BASE}/api/scraper/jobs/scraped?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

