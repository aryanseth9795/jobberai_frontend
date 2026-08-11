import { AppShell } from "@/components/shell/AppShell";

/**
 * Every signed-in page renders inside the shell.
 *
 * `(app)` is a route group, so this adds no path segment — `/dashboard` is
 * still `/dashboard`. It exists so the shell wraps exactly the pages that
 * should have navigation, and neither the auth screens nor the onboarding
 * wizard (which must not offer a way out) inherit it.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
