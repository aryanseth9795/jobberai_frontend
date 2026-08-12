"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, RefreshCw, Search, SlidersHorizontal } from "lucide-react";

import {
  deleteJob,
  getAnalytics,
  getFormHistory,
  getJobs,
  updateJobStatus,
  type Analytics,
  type FormSession,
  type JobApplication,
} from "@/lib/api";
import { compact, longDate, percent } from "@/lib/format";
import { statusMeta } from "@/lib/status";
import {
  AreaChart,
  BarChart,
  bucket,
  FunnelChart,
  SeriesTable,
  StatTile,
  type AreaPoint,
  type AreaSeries,
} from "@/components/charts";
import { ApplicationDialog, FormSessionDialog } from "@/components/dashboard/ApplicationDialog";
import { ApplicationsTable, type SortState } from "@/components/dashboard/ApplicationsTable";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  SegmentedControl,
  Skeleton,
  SkeletonTable,
  StatusBadge,
  Tabs,
  useToast,
} from "@/components/ui";

const PAGE_SIZE = 15;

const RANGES = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 0, label: "All" },
];

/** The two series on the activity chart.
 *
 *  This is an emphasis pair, not a categorical one: `responded` is the story
 *  and `applied` is the volume it is read against, which is why only one of
 *  them is allowed a saturated colour. */
const SERIES: AreaSeries[] = [
  { key: "applied", label: "Sent", color: "var(--chart-1)", fill: true },
  { key: "responded", label: "Replied", color: "var(--signal)" },
];

export default function DashboardPage() {
  const toast = useToast();

  const [range, setRange] = useState(30);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [tab, setTab] = useState<"emails" | "forms">("emails");
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [forms, setForms] = useState<FormSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>({ field: "applied_at", dir: -1 });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const [openApp, setOpenApp] = useState<JobApplication | null>(null);
  const [openForm, setOpenForm] = useState<FormSession | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JobApplication | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── data ──

  const loadAnalytics = useCallback(async () => {
    setAnalyticsError(null);
    try {
      setAnalytics(await getAnalytics(range));
    } catch (e) {
      setAnalyticsError(e instanceof Error ? e.message : "Could not load analytics.");
    }
  }, [range]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "emails") {
        const res = await getJobs({
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          status: statusFilter || undefined,
          search: search || undefined,
          sortBy: sort.field,
          sortDir: sort.dir,
        });
        setApps(res.applications);
        setTotal(res.total);
      } else {
        const res = await getFormHistory({ skip: page * PAGE_SIZE, limit: PAGE_SIZE });
        setForms(res.sessions);
        setTotal(res.total);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, statusFilter, sort]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const refresh = () => {
    loadAnalytics();
    loadRows();
  };

  // ── derived ──

  const points: AreaPoint[] = useMemo(
    () =>
      (analytics?.series ?? []).map((p) => ({
        id: p.date,
        label: longDate(p.date).replace(/ \d{4}$/, ""),
        values: { applied: p.applied, responded: p.responded },
      })),
    [analytics]
  );

  /**
   * Movement across the window, measured by splitting it in half.
   *
   * The alternative — a second request for the preceding window — is a truer
   * "vs previous 30 days", and it is one more round trip on every range
   * change for a number nobody reads that precisely. The label says exactly
   * what was compared so the figure cannot be misread.
   */
  const split = useMemo(() => {
    const series = analytics?.series ?? [];
    if (series.length < 4) return null;
    const mid = Math.floor(series.length / 2);
    const sum = (from: number, to: number, key: "applied" | "responded") =>
      series.slice(from, to).reduce((acc, p) => acc + p[key], 0);
    return {
      halfDays: series.length - mid,
      applied: { current: sum(mid, series.length, "applied"), previous: sum(0, mid, "applied") },
      responded: {
        current: sum(mid, series.length, "responded"),
        previous: sum(0, mid, "responded"),
      },
    };
  }, [analytics]);

  const periodLabel = split ? `vs prior ${split.halfDays}d` : undefined;

  const statusMix = useMemo(() => {
    const by = analytics?.by_status ?? {};
    return Object.entries(by)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => {
        const meta = statusMeta(status);
        return {
          label: meta.label,
          value: count,
          // Register, not magnitude. Colouring these by size would re-encode
          // the bar length and say nothing new.
          color:
            meta.register === "live"
              ? "var(--signal)"
              : meta.register === "closed"
                ? "var(--closed)"
                : meta.register === "failed"
                  ? "var(--warning)"
                  : "var(--chart-1)",
        };
      });
  }, [analytics]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = tab === "emails" ? apps.length : forms.length;
  const filtered = Boolean(search || statusFilter);

  // ── actions ──

  const handleStatus = (id: string, status: string) => {
    setApps((prev) => prev.map((a) => (a._id === id ? { ...a, status } : a)));
    setOpenApp((prev) => (prev && prev._id === id ? { ...prev, status } : prev));
    loadAnalytics();
  };

  const handleBulkStatus = async (ids: string[], status: string) => {
    const before = apps;
    setApps((prev) => prev.map((a) => (ids.includes(a._id) ? { ...a, status } : a)));

    const results = await Promise.allSettled(ids.map((id) => updateJobStatus(id, status)));
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed === 0) {
      toast.success(`Updated ${ids.length} ${ids.length === 1 ? "application" : "applications"}.`);
      loadAnalytics();
      return;
    }

    // A partial failure is the dangerous case: some rows moved and some did
    // not, and the optimistic view now agrees with neither. Roll back to what
    // was on screen and reload rather than guessing which half succeeded.
    setApps(before);
    toast.error(`${failed} of ${ids.length} could not be updated.`);
    loadRows();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteJob(pendingDelete._id);
      setApps((prev) => prev.filter((a) => a._id !== pendingDelete._id));
      setTotal((t) => Math.max(0, t - 1));
      setPendingDelete(null);
      toast.success("Application deleted.");
      loadAnalytics();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the application.");
    } finally {
      setDeleting(false);
    }
  };

  const empty = analytics !== null && analytics.total === 0 && !filtered;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Everything you have sent, and what came back.
          </p>
        </div>

        {/* One filter row, scoping everything below it. */}
        <div className="flex items-center gap-2">
          <SegmentedControl
            label="Time range"
            options={RANGES}
            value={range}
            onChange={(v) => setRange(v)}
          />
          <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={refresh}>
            Refresh
          </Button>
        </div>
      </header>

      {analyticsError && (
        <div className="mb-4">
          <ErrorNote action={<Button size="sm" variant="ghost" onClick={loadAnalytics}>Retry</Button>}>
            {analyticsError}
          </ErrorNote>
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {analytics === null ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-lg" />)
        ) : (
          <>
            <StatTile
              label="Applications sent"
              value={compact(analytics.total)}
              current={split?.applied.current}
              previous={split?.applied.previous}
              periodLabel={periodLabel}
              trend={bucket(analytics.series.map((p) => p.applied), 20)}
              // More applications is not self-evidently better, so the delta
              // stays neutral rather than colouring volume as success.
              upIsGood={false}
            />
            <StatTile
              label="Replies"
              value={compact(analytics.responded)}
              current={split?.responded.current}
              previous={split?.responded.previous}
              periodLabel={periodLabel}
              trend={bucket(analytics.series.map((p) => p.responded), 20)}
              accent
            />
            <StatTile label="Response rate" value={percent(analytics.response_rate)} />
            <StatTile label="Forms filled" value={compact(analytics.forms)} />
          </>
        )}
      </div>

      {empty ? (
        <Card className="mb-4">
          <EmptyState
            icon={<Inbox size={18} />}
            title="No applications yet"
            body="Once you send your first cover email, this is where the charts, the funnel and the reply rate appear."
            action={
              <Button variant="primary" onClick={() => (window.location.href = "/")}>
                Send your first application
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* ── Activity ── */}
          <Card className="mb-4">
            <CardHeader
              title="Activity"
              description={range === 0 ? "All time" : `Last ${range} days`}
              action={
                <SegmentedControl
                  label="View"
                  options={[
                    { value: "chart", label: "Chart" },
                    { value: "table", label: "Table" },
                  ]}
                  value={showTable ? "table" : "chart"}
                  onChange={(v) => setShowTable(v === "table")}
                />
              }
            />
            <CardBody>
              <div className="mb-3 flex items-center gap-4">
                {SERIES.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-[12px] text-muted">
                    <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>

              {analytics === null ? (
                <Skeleton className="h-[240px] rounded-md" />
              ) : showTable ? (
                <SeriesTable points={points} series={SERIES} />
              ) : (
                <AreaChart points={points} series={SERIES} />
              )}
            </CardBody>
          </Card>

          {/* ── Funnel · companies · status mix ── */}
          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Funnel" description="Where applications stop" />
              <CardBody>
                {analytics === null ? (
                  <Skeleton className="h-32 rounded-md" />
                ) : (
                  <FunnelChart data={analytics.funnel} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Top companies" description="Most applied to" />
              <CardBody>
                {analytics === null ? (
                  <Skeleton className="h-32 rounded-md" />
                ) : (
                  <BarChart
                    data={analytics.top_companies.map((c) => ({ label: c.company, value: c.count }))}
                    emptyLabel="No applications in this range."
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Status mix" description="Colour follows what it means" />
              <CardBody>
                {analytics === null ? (
                  <Skeleton className="h-32 rounded-md" />
                ) : (
                  <BarChart data={statusMix} emptyLabel="No applications in this range." />
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {/* ── Records ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { id: "emails", label: "Applications" },
            { id: "forms", label: "Form fills" },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id);
            setPage(0);
          }}
        />

        {tab === "emails" && (
          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput);
                setPage(0);
              }}
              className="relative"
            >
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search company, role, email"
                aria-label="Search applications"
                className="h-8 w-56 rounded-md border border-border bg-surface pl-7 pr-2 text-[12.5px] outline-none focus:border-[var(--accent)]"
              />
            </form>

            <div className="relative">
              <SlidersHorizontal
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                aria-label="Filter by status"
                className="h-8 rounded-md border border-border bg-surface pl-7 pr-2 text-[12.5px] outline-none"
              >
                <option value="">All statuses</option>
                {["applied", "interview", "offer", "rejected", "ghosted", "failed"].map((s) => (
                  <option key={s} value={s}>
                    {statusMeta(s).label}
                  </option>
                ))}
              </select>
            </div>

            {filtered && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setStatusFilter("");
                  setPage(0);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3">
          <ErrorNote action={<Button size="sm" variant="ghost" onClick={loadRows}>Retry</Button>}>
            {error}
          </ErrorNote>
        </div>
      )}

      {loading && rows === 0 ? (
        <Card>
          <SkeletonTable rows={6} columns="2fr 1.5fr 2fr 1fr 110px" />
        </Card>
      ) : rows === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={18} />}
            title={
              tab === "emails"
                ? filtered
                  ? "Nothing matches those filters"
                  : "No applications yet"
                : "No form fills yet"
            }
            body={
              tab === "emails"
                ? filtered
                  ? "Try a different search or clear the status filter."
                  : "Head to Apply to send your first cover email."
                : "Use the Chrome extension on a Google Form and sessions will appear here."
            }
          />
        </Card>
      ) : tab === "emails" ? (
        <ApplicationsTable
          applications={apps}
          loading={loading}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(0);
          }}
          onOpen={setOpenApp}
          onDelete={setPendingDelete}
          onBulkStatus={handleBulkStatus}
        />
      ) : (
        <Card>
          <div className="divide-y divide-[var(--border)]">
            {forms.map((session) => (
              <button
                key={session.preview_id}
                onClick={() => setOpenForm(session)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">
                    {session.company || "Unknown company"}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {session.role || session.form_title || "Untitled form"} ·{" "}
                    {session.filled_at ? longDate(session.filled_at.slice(0, 10)) : "—"}
                  </span>
                </span>
                <StatusBadge status={session.status} />
              </button>
            ))}
          </div>
        </Card>
      )}

      {rows > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted tabular-nums">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <span className="px-2 text-[12px] text-muted tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ApplicationDialog
        application={openApp}
        onClose={() => setOpenApp(null)}
        onStatusChange={handleStatus}
      />
      <FormSessionDialog session={openForm} onClose={() => setOpenForm(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this application?"
        body={
          <>
            The record for <strong>{pendingDelete?.company_name || "this application"}</strong>
            {pendingDelete?.role ? ` (${pendingDelete.role})` : ""} will be removed from your
            history. The email that was already sent is unaffected.
          </>
        }
      />
    </div>
  );
}
