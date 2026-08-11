"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/cn";
import { NAV } from "./nav";

/**
 * The product mark.
 *
 * Deliberately not the signal colour: `--signal` means "a human replied", and
 * spending it on a logo that is on screen permanently would make the one piece
 * of colour that carries information indistinguishable from branding.
 */
function Mark({ compact }: { compact: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden px-3 py-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-[13px] font-bold"
        style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
        aria-hidden="true"
      >
        J
      </span>
      {!compact && (
        <span className="truncate font-display text-[14px] font-semibold tracking-tight">Jobber</span>
      )}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** Called after any nav click. The mobile drawer uses it to close itself;
   *  the desktop rail passes nothing. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex h-full flex-col border-r border-border"
      style={{ background: "var(--surface)" }}
    >
      <Mark compact={collapsed} />

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {NAV.map((group, index) => (
          <div key={group.name} className={cn(index > 0 && "mt-1 border-t border-border pt-1")}>
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  // The label is the accessible name when expanded. Collapsed,
                  // it is gone from the DOM, so `title` carries it for both the
                  // tooltip and assistive tech.
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    collapsed && "justify-center px-0",
                    active ? "font-medium text-text" : "text-muted hover:text-text hover:bg-surface-2"
                  )}
                  style={active ? { background: "var(--accent-soft)" } : undefined}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "m-2 hidden items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-text lg:flex",
          collapsed && "justify-center px-0"
        )}
      >
        {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </nav>
  );
}
