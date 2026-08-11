/**
 * The wizard renders outside the app shell — no sidebar, no topbar, no way
 * out. That is the whole point: all four steps are required, and offering
 * navigation would be offering an exit that the backend is going to refuse
 * anyway (403 from every route that does anything, until setup is done).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--bg)" }}>{children}</div>;
}
