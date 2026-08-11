import {
  BarChart3,
  FileText,
  Columns3,
  Radar,
  RotateCcw,
  Send,
  Settings,
  User,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  /** One line, shown in the command palette and the collapsed-rail tooltip.
   *  Written as what the page lets you do, not what it contains. */
  hint: string;
}

export interface NavGroup {
  /** Groups are unlabelled in the sidebar — the separator carries the break.
   *  The name exists for the command palette, which needs to say where a
   *  result came from. */
  name: string;
  items: NavItem[];
}

/**
 * The navigation, defined once.
 *
 * Both the sidebar and the command palette read this, so a page cannot exist
 * in one and be missing from the other — which is exactly what happened to
 * /scraping and /forms under the old per-page inline headers, where each of
 * the six pages listed a different subset of the other five.
 *
 * Ordered by the work, not alphabetically: you draft, you follow up, you
 * track. Setup lives at the bottom because it is done once.
 */
export const NAV: NavGroup[] = [
  {
    name: "Apply",
    items: [
      { href: "/", label: "Draft", icon: Send, hint: "Turn a job posting into a cover email" },
      { href: "/reapply", label: "Follow up", icon: RotateCcw, hint: "Re-draft to companies you already applied to" },
      { href: "/forms", label: "Forms", icon: FileText, hint: "Fill an application form from your profile" },
      { href: "/scraping", label: "Find jobs", icon: Radar, hint: "Search job boards for new postings" },
    ],
  },
  {
    name: "Track",
    items: [
      { href: "/dashboard", label: "Overview", icon: BarChart3, hint: "Applications, responses and rates" },
      { href: "/pipeline", label: "Pipeline", icon: Columns3, hint: "Move applications through their stages" },
    ],
  },
  {
    name: "Account",
    items: [
      { href: "/profile", label: "Documents", icon: User, hint: "Your résumé and the documents the AI writes from" },
      { href: "/settings", label: "Settings", icon: Settings, hint: "API keys, identity and email delivery" },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((group) => group.items);

/** The active item for a pathname. Exact match only, except that every route
 *  is a child of nothing — a `startsWith` test would light up "Draft" (href
 *  "/") on every single page. */
export function activeItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.href === pathname);
}
