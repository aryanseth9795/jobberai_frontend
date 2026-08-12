"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, RefreshCw } from "lucide-react";

import { getJobs, updateJobStatus, type JobApplication } from "@/lib/api";
import { longDate } from "@/lib/format";
import { PIPELINE_STATUSES, statusMeta, statusStyle, type PipelineStatus } from "@/lib/status";
import { ApplicationDialog } from "@/components/dashboard/ApplicationDialog";
import { Button, Card, EmptyState, ErrorNote, Skeleton, useToast } from "@/components/ui";

// The board loads one page rather than every application ever sent. A Kanban
// with 400 cards is not a working surface, and the API caps a page at 100
// anyway; the banner below says so rather than silently showing a slice.
const BOARD_LIMIT = 100;

export default function PipelinePage() {
  const toast = useToast();

  const [apps, setApps] = useState<JobApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<PipelineStatus | null>(null);
  const [open, setOpen] = useState<JobApplication | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getJobs({ limit: BOARD_LIMIT, sortBy: "applied_at", sortDir: -1 });
      setApps(res.applications);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the board.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { columns, unplaced } = useMemo(() => {
    const grouped = new Map<PipelineStatus, JobApplication[]>(
      PIPELINE_STATUSES.map((s) => [s, [] as JobApplication[]])
    );
    let unplaced = 0;

    for (const app of apps) {
      const bucket = grouped.get((app.status || "").toLowerCase() as PipelineStatus);
      if (bucket) bucket.push(app);
      // `failed` has no column, because it is not a stage — it means the email
      // never left. Filing it under "Applied" would have the board claim you
      // applied somewhere you did not, so it is counted out loud instead.
      else unplaced += 1;
    }

    return { columns: grouped, unplaced };
  }, [apps]);

  /**
   * Move a card, assuming it works, and put it back if it did not.
   *
   * The optimistic write is what makes the board feel like a board. The
   * rollback is what stops it from lying: without it a failed request leaves
   * the card in its new column until a reload, and the user believes a status
   * that was never stored.
   */
  const move = async (app: JobApplication, status: PipelineStatus) => {
    if ((app.status || "").toLowerCase() === status) return;

    const previous = app.status;
    setApps((prev) => prev.map((a) => (a._id === app._id ? { ...a, status } : a)));

    try {
      await updateJobStatus(app._id, status);
    } catch (e) {
      setApps((prev) => prev.map((a) => (a._id === app._id ? { ...a, status: previous } : a)));
      toast.error(
        e instanceof Error ? e.message : `Could not move ${app.company_name || "the application"}.`
      );
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold">Pipeline</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Drag a card to move it, or use the menu on the card.
          </p>
        </div>
        <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={load}>
          Refresh
        </Button>
      </header>

      {error && (
        <div className="mb-4">
          <ErrorNote action={<Button size="sm" variant="ghost" onClick={load}>Retry</Button>}>
            {error}
          </ErrorNote>
        </div>
      )}

      {(total > BOARD_LIMIT || unplaced > 0) && (
        <p className="mb-3 text-[12px] text-muted">
          {total > BOARD_LIMIT && `Showing the ${BOARD_LIMIT} most recent of ${total} applications. `}
          {unplaced > 0 &&
            `${unplaced} ${unplaced === 1 ? "send that failed is" : "sends that failed are"} not on the board — those emails never went out. `}
          <a href="/dashboard" className="text-accent hover:underline">
            See the dashboard
          </a>
          .
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {PIPELINE_STATUSES.map((s) => (
            <Skeleton key={s} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Columns3 size={18} />}
            title="Nothing in the pipeline"
            body="Applications appear here as soon as you send one, and you can drag them between stages as you hear back."
            action={
              <Button variant="primary" onClick={() => (window.location.href = "/")}>
                Send an application
              </Button>
            }
          />
        </Card>
      ) : (
        // `items-start` so each column is as tall as its own contents. Without
        // it the grid stretches every column to match the longest, and a board
        // with 15 cards under "Applied" renders four columns of empty box.
        <div className="grid items-start gap-3 md:grid-cols-3 xl:grid-cols-5">
          {PIPELINE_STATUSES.map((status) => {
            const cards = columns.get(status) ?? [];
            const meta = statusMeta(status);

            return (
              <section
                key={status}
                onDragOver={(e) => {
                  // Without preventDefault the browser refuses the drop and
                  // the card springs back with no explanation.
                  e.preventDefault();
                  setOver(status);
                }}
                onDragLeave={() => setOver((prev) => (prev === status ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("text/plain") || dragging;
                  const app = apps.find((a) => a._id === id);
                  if (app) move(app, status);
                }}
                className="rounded-lg border transition-colors"
                style={{
                  borderColor: over === status ? "var(--accent)" : "var(--border)",
                  background: over === status ? "var(--accent-soft)" : "var(--surface-2)",
                }}
              >
                <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span
                    className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium"
                    style={statusStyle(status)}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[11.5px] text-faint tabular-nums">{cards.length}</span>
                </header>

                <div className="flex min-h-[120px] flex-col gap-2 px-2 pb-2">
                  {cards.map((app) => (
                    <article
                      key={app._id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", app._id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(app._id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onClick={() => setOpen(app)}
                      className="cursor-grab rounded-md border border-border bg-surface p-2.5 transition-shadow hover:shadow-sm active:cursor-grabbing"
                      style={{ opacity: dragging === app._id ? 0.4 : 1 }}
                    >
                      <p className="truncate text-[12.5px] font-medium" title={app.company_name}>
                        {app.company_name || "Unknown company"}
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted" title={app.role}>
                        {app.role || "Untitled role"}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-faint tabular-nums">
                          {app.applied_at ? longDate(app.applied_at.slice(0, 10)) : "—"}
                        </span>

                        {/* Drag-and-drop is a pointer gesture and nothing
                            else. This is the same action for anyone using a
                            keyboard, a screen reader, or a phone. */}
                        <select
                          value={status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            move(app, e.target.value as PipelineStatus);
                          }}
                          aria-label={`Move ${app.company_name || "application"} to another stage`}
                          className="h-6 rounded border border-border bg-surface px-1 text-[11px] text-muted"
                        >
                          {PIPELINE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {statusMeta(s).label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ApplicationDialog
        application={open}
        onClose={() => setOpen(null)}
        onStatusChange={(id, status) =>
          setApps((prev) => prev.map((a) => (a._id === id ? { ...a, status } : a)))
        }
      />
    </div>
  );
}
