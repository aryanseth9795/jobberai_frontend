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

export interface DraftResponse {
  draft_id: string;
  job_info: JobInfo;
  cover_email: CoverEmail | null;
  draft_status: "drafted" | "duplicate" | "error";
  duplicate_details: { matched_job: string; applied_on: string; similarity_score: number } | null;
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
}

export interface ApplicationsResponse {
  total: number;
  applications: JobApplication[];
}

// Upload files and get drafts
export async function applyBatch(files: File[]): Promise<BatchResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const res = await fetch(`${API_BASE}/apply/batch`, {
    method: "POST",
    body: formData,
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
}): Promise<ApplicationsResponse> {
  const qs = new URLSearchParams();
  if (params?.skip !== undefined) qs.set("skip", String(params.skip));
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  const res = await fetch(`${API_BASE}/jobs?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
export async function ingestProfile(files?: File[]): Promise<{ status: string; chunks_ingested: number; message: string }> {
  const formData = new FormData();
  if (files) {
    for (const f of files) formData.append("files", f);
  }
  const res = await fetch(`${API_BASE}/ingest`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
