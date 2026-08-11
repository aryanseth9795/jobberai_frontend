import Link from "next/link";

/**
 * Sign-in and registration.
 *
 * A split panel rather than a centred card on a blank page: the right half is
 * the only chance to say what the product does before someone commits an email
 * address to it, and it collapses away entirely on mobile where the form is
 * the only thing that matters.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md font-display text-[14px] font-bold"
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              aria-hidden="true"
            >
              J
            </span>
            <span className="font-display text-[16px] font-semibold tracking-tight">Jobber</span>
          </Link>
          {children}
        </div>
      </div>

      <aside
        className="hidden flex-col justify-center border-l border-border px-12 lg:flex"
        style={{ background: "var(--surface)" }}
      >
        <p className="label mb-4">What it does</p>
        <h2 className="mb-4 font-display text-[26px] font-semibold leading-tight tracking-tight">
          One posting in.
          <br />
          A letter worth sending out.
        </h2>
        <p className="mb-8 max-w-sm text-[13.5px] leading-relaxed text-muted">
          Jobber reads a job posting, writes the cover email from your own
          résumé and in your own words, and waits for you to approve it before
          anything is sent. Then it keeps track of who replied.
        </p>

        <dl className="space-y-3 border-t border-border pt-6">
          {[
            ["Drafts you approve", "Nothing leaves without you reading it first."],
            ["Your keys, your data", "Your Gemini and Resend keys, encrypted, used only for you."],
            ["The part nobody enjoys", "Who you applied to, when, and who came back."],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="text-[13px] font-medium">{term}</dt>
              <dd className="text-[12.5px] text-muted">{detail}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
