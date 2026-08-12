"use client";

import { useState } from "react";
import { ExternalLink, Radar, Search } from "lucide-react";

import { getScrapedJobs, triggerScrape, type JobListing, type ScrapeResponse } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorNote,
  Skeleton,
  useToast,
} from "@/components/ui";

const TARGET_ROLES = [
  "Frontend React Developer",
  "Backend Developer",
  "Full Stack Developer",
  "MERN Stack Developer",
  "GenAI Developer",
  "GenAI + Full Stack",
  "GenAI + Backend",
  "GenAI + Agentic AI",
  "Android (Expo React Native) Developer",
  "Python Developer",
  "FastAPI Developer",
  "Express / Node Developer",
];

function JobCard({ job }: { job: JobListing }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold">{job.role}</h3>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">
            {job.company_name || "Company not listed"}
            {job.location ? ` · ${job.location}` : ""}
          </p>
        </div>
        {job.salary && <Badge tone="accent">{job.salary}</Badge>}
      </div>

      {(job.description || job.company_detail) && (
        <p className="line-clamp-2 text-[12.5px] text-muted">{job.description || job.company_detail}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="text-[11.5px] text-faint">
          {job.source_site}
          {job.experience_required ? ` · ${job.experience_required}` : ""}
        </span>
        {job.job_apply_link && (
          <a
            href={job.job_apply_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12.5px] text-accent hover:underline"
          >
            Open listing <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function ScrapingPage() {
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const [previous, setPrevious] = useState<JobListing[] | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  const toggle = (role: string) =>
    setSelected((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await triggerScrape({ roles: selected, max_results_per_role: 10 });
      setResult(res);
      toast.success(
        res.new_jobs === 0
          ? "Search finished — nothing new this time."
          : `Found ${res.new_jobs} new listing${res.new_jobs === 1 ? "" : "s"}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The search failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadPrevious = async () => {
    setLoadingPrevious(true);
    try {
      const { jobs } = await getScrapedJobs({ limit: 40 });
      setPrevious(jobs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load earlier results.");
    } finally {
      setLoadingPrevious(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[22px] font-semibold">Find jobs</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Search job boards for openings matching the roles you want.
        </p>
      </header>

      <Card className="mb-4">
        <CardHeader
          title="Roles to search for"
          description="Leave everything unticked to search all of them."
        />
        <CardBody>
          <div className="grid gap-1 sm:grid-cols-2 md:grid-cols-3">
            {TARGET_ROLES.map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12.5px] hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(role)}
                  onChange={() => toggle(role)}
                  className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0 truncate">{role}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-[12px] text-muted">
              {selected.length === 0
                ? `Searching all ${TARGET_ROLES.length} roles`
                : `${selected.length} role${selected.length === 1 ? "" : "s"} selected`}
            </p>
            <div className="flex items-center gap-2">
              {selected.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                  Clear
                </Button>
              )}
              <Button variant="primary" icon={<Search size={13} />} loading={loading} onClick={handleScrape}>
                {loading ? "Searching…" : "Search"}
              </Button>
            </div>
          </div>

          {/* Honest about the wait: this drives real headless browsers across
              several sites, and a silent two-minute spinner reads as a hang. */}
          {loading && (
            <p className="mt-3 text-[12px] text-muted">
              This opens each job board in turn, so it can take a couple of minutes. You can
              leave this page — results are saved either way.
            </p>
          )}
        </CardBody>
      </Card>

      {error && (
        <div className="mb-4">
          <ErrorNote action={<Button size="sm" variant="ghost" onClick={handleScrape}>Retry</Button>}>
            {error}
          </ErrorNote>
        </div>
      )}

      {result && (
        <section className="mb-4">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[15px] font-semibold">
              {result.new_jobs} new listing{result.new_jobs === 1 ? "" : "s"}
            </h2>
            {result.duplicates_skipped > 0 && (
              <span className="text-[12px] text-muted">
                {result.duplicates_skipped} already seen, skipped
              </span>
            )}
          </div>

          {result.jobs.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Radar size={18} />}
                title="Nothing new this time"
                body="Every listing found was one you had already seen. Try different roles, or come back tomorrow."
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {result.jobs.map((job, i) => (
                <JobCard key={job.job_apply_link || `${job.role}-${i}`} job={job} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Everything found before, which otherwise had no route into the UI at
          all — the endpoint existed and nothing called it. */}
      <section>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold">Earlier results</h2>
          {previous === null && (
            <Button size="sm" variant="ghost" loading={loadingPrevious} onClick={loadPrevious}>
              Show
            </Button>
          )}
        </div>

        {loadingPrevious && <Skeleton className="h-24 rounded-lg" />}

        {previous !== null &&
          (previous.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Radar size={18} />}
                title="No saved listings yet"
                body="Run a search above and anything found is kept here."
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {previous.map((job, i) => (
                <JobCard key={job.job_apply_link || `${job.role}-${i}`} job={job} />
              ))}
            </div>
          ))}
      </section>
    </div>
  );
}
