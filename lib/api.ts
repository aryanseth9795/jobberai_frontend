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
  const res = await fetch(`${API_BASE}/apply/unified`, {
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
  const res = await fetch(`${API_BASE}/apply/regenerate`, {
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
  const res = await fetch(`${API_BASE}/apply/confirm`, {
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
  const res = await fetch(`${API_BASE}/jobs?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Get a single application
export async function getJob(id: string): Promise<JobApplication> {
  const res = await fetch(`${API_BASE}/jobs/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Dashboard stats
export async function getJobStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/jobs/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Update status of an application
export async function updateJobStatus(id: string, status: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${id}/status?status=${encodeURIComponent(status)}`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Delete an application
export async function deleteJob(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Get current profile ingestion status
export async function getProfileStatus(): Promise<{
  status: string;
  chunks: number;
  sources: string[];
  message: string;
}> {
  const res = await fetch(`${API_BASE}/profile/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Ingest profile docs
export async function ingestProfile(files?: File[]): Promise<{ status: string; chunks_ingested: number; message: string; sources: string[] }> {
  const formData = new FormData();
  if (files) {
    for (const f of files) formData.append("files", f);
  }
  const res = await fetch(`${API_BASE}/ingest`, { method: "POST", body: formData });
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
  const res = await fetch(`${API_BASE}/profile/uploads`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Delete an uploaded file
export async function deleteUploadedFile(fileType: "resume" | "cover_letter"): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/profile/uploads/${fileType}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
