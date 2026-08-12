"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Download, Trash2 } from "lucide-react";

import type { JobApplication, JobSortField } from "@/lib/api";
import { cn } from "@/lib/cn";
import { downloadCsv, toCsv } from "@/lib/csv";
import { longDate } from "@/lib/format";
import { PIPELINE_STATUSES, statusMeta } from "@/lib/status";
import { Badge, Button, StatusBadge } from "@/components/ui";

export interface SortState {
  field: JobSortField;
  dir: 1 | -1;
}

type ColumnId = "company" | "role" | "hr_email" | "applied_at" | "status";

const COLUMNS: { id: ColumnId; label: string; sortBy?: JobSortField; width: string }[] = [
  { id: "company", label: "Company", sortBy: "company_name", width: "minmax(140px,2fr)" },
  { id: "role", label: "Role", sortBy: "role", width: "minmax(120px,1.6fr)" },
  { id: "hr_email", label: "Recruiter", width: "minmax(150px,2fr)" },
  { id: "applied_at", label: "Applied", sortBy: "applied_at", width: "120px" },
  { id: "status", label: "Status", sortBy: "status", width: "110px" },
];

function cell(app: JobApplication, id: ColumnId): string {
  switch (id) {
    case "company":
      return app.company_name || "—";
    case "role":
      return app.role || "—";
    case "hr_email":
      return app.hr_email || "—";
    case "applied_at":
      return app.applied_at ? longDate(app.applied_at.slice(0, 10)) : "—";
    case "status":
      return statusMeta(app.status).label;
  }
}

export function ApplicationsTable({
  applications,
  loading,
  sort,
  onSortChange,
  onOpen,
  onDelete,
  onBulkStatus,
}: {
  applications: JobApplication[];
  loading: boolean;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onOpen: (app: JobApplication) => void;
  onDelete: (app: JobApplication) => void;
  onBulkStatus: (ids: string[], status: string) => void;
}) {
  const [hidden, setHidden] = useState<Set<ColumnId>>(new Set());
  const [rawSelection, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Rows that left the page under a filter change or a sort must not stay
  // selected — a bulk action would otherwise hit records the user can no
  // longer see. Narrowed at read time rather than corrected in an effect, so
  // there is never a render in which the stale selection is live.
  const selected = useMemo(() => {
    const visible = new Set(applications.map((a) => a._id));
    return new Set([...rawSelection].filter((id) => visible.has(id)));
  }, [applications, rawSelection]);

  const columns = COLUMNS.filter((c) => !hidden.has(c.id));
  const template = `36px ${columns.map((c) => c.width).join(" ")} 40px`;

  const allSelected = applications.length > 0 && selected.size === applications.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(applications.map((a) => a._id)));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportRows = (rows: JobApplication[]) => {
    downloadCsv(
      `applications-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows, [
        { header: "Company", value: (r) => r.company_name },
        { header: "Role", value: (r) => r.role },
        { header: "Recruiter email", value: (r) => r.hr_email },
        { header: "Status", value: (r) => statusMeta(r.status).label },
        { header: "Applied", value: (r) => r.applied_at?.slice(0, 10) },
        { header: "Location", value: (r) => r.location },
      ])
    );
  };

  const chosen = applications.filter((a) => selected.has(a._id));

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <>
              <Badge tone="accent">{selected.size} selected</Badge>
              <label className="sr-only" htmlFor="bulk-status">
                Set status for selected
              </label>
              <select
                id="bulk-status"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  onBulkStatus([...selected], e.target.value);
                  setSelected(new Set());
                }}
                className="h-7 rounded-md border border-border bg-surface px-2 text-[12px]"
              >
                <option value="">Mark as…</option>
                {PIPELINE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusMeta(s).label}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </>
          ) : (
            <p className="text-[12px] text-muted">
              {applications.length} {applications.length === 1 ? "row" : "rows"} on this page
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={<Download size={13} />}
            onClick={() => exportRows(chosen.length > 0 ? chosen : applications)}
            disabled={applications.length === 0}
          >
            {chosen.length > 0 ? `Export ${chosen.length}` : "Export page"}
          </Button>

          <ColumnPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            hidden={hidden}
            onToggle={(id) =>
              setHidden((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                // The last visible column cannot be hidden — an empty grid
                // reads as a broken page rather than as a chosen view.
                else if (prev.size < COLUMNS.length - 1) next.add(id);
                return next;
              })
            }
          />
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-surface",
          // Refetching holds the previous render rather than flashing a
          // skeleton, so the table does not jump on every filter change.
          loading && applications.length > 0 && "opacity-60 transition-opacity"
        )}
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: 720 }}>
            <div
              className="grid items-center gap-3 border-b border-border px-3 py-2"
              style={{ gridTemplateColumns: template, background: "var(--surface-2)" }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all rows on this page"
                className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
              />
              {columns.map((c) => (
                <HeaderCell key={c.id} column={c} sort={sort} onSortChange={onSortChange} />
              ))}
              <span />
            </div>

            {applications.map((app) => (
              <div
                key={app._id}
                className="grid cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-surface-2"
                style={{ gridTemplateColumns: template }}
                onClick={() => onOpen(app)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(app._id)}
                  onChange={() => toggle(app._id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${app.company_name || "application"}`}
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
                />

                {columns.map((c) => (
                  <span
                    key={c.id}
                    className={cn(
                      "min-w-0 truncate text-[12.5px]",
                      c.id === "company" && "font-medium",
                      c.id === "hr_email" && "font-mono text-[11.5px] text-muted",
                      (c.id === "role" || c.id === "applied_at") && "text-muted"
                    )}
                    title={cell(app, c.id)}
                  >
                    {c.id === "status" ? <StatusBadge status={app.status} /> : cell(app, c.id)}
                  </span>
                ))}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(app);
                  }}
                  aria-label={`Delete the ${app.company_name || "untitled"} application`}
                  className="rounded p-1 text-faint transition-colors hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  column,
  sort,
  onSortChange,
}: {
  column: (typeof COLUMNS)[number];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}) {
  if (!column.sortBy) {
    return <span className="label">{column.label}</span>;
  }

  const active = sort.field === column.sortBy;
  const Icon = !active ? ChevronsUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;

  return (
    <button
      onClick={() =>
        onSortChange({
          field: column.sortBy!,
          // A fresh column starts descending for dates (newest first, which is
          // what anyone means by "sort by date") and ascending for text.
          dir: active ? ((sort.dir * -1) as 1 | -1) : column.sortBy === "applied_at" ? -1 : 1,
        })
      }
      className={cn(
        "label flex items-center gap-1 transition-colors hover:text-text",
        active && "text-text"
      )}
      // Not `aria-sort`: this is a grid of divs, so there is no columnheader
      // for that attribute to sit on, and putting it on the button is invalid.
      // The label carries the same information instead.
      aria-label={
        active
          ? `${column.label}, sorted ${sort.dir === 1 ? "ascending" : "descending"}. Activate to reverse.`
          : `${column.label}, not sorted. Activate to sort.`
      }
    >
      {column.label}
      <Icon size={11} className={active ? "" : "opacity-40"} />
    </button>
  );
}

function ColumnPicker({
  open,
  onOpenChange,
  hidden,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hidden: Set<ColumnId>;
  onToggle: (id: ColumnId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        variant="ghost"
        icon={<Columns3 size={13} />}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Columns
      </Button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-surface p-1"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          {COLUMNS.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12.5px] hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={!hidden.has(c.id)}
                onChange={() => onToggle(c.id)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
