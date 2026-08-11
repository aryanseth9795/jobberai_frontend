// What an application's status *means*, and therefore how it looks.
//
// The palette in globals.css encodes one rule: saturation means a human came
// back to you. This module is where that rule is decided, once, so the badge
// in a table, the column header on the pipeline board, and the series in a
// chart cannot drift into disagreeing about whether "ghosted" is bad news or
// merely no news.
//
// Three registers, and the distinction is real rather than aesthetic:
//
//   waiting  you sent it and nothing has happened. No information yet, so no
//            colour — greyscale.
//   live     someone replied and the conversation is open. The only saturated
//            colour in the product.
//   closed   someone replied and the answer was no. Answered, so not grey;
//            over, so recessive rather than a signal.
//   failed   it never left the building. Your problem to fix, not theirs.

export type StatusRegister = "waiting" | "live" | "closed" | "failed";

export interface StatusMeta {
  /** What the user sees. Sentence case — these are states, not shouting. */
  label: string;
  register: StatusRegister;
  /** True when this status means a human responded, whatever the answer.
   *  Matches the backend's RESPONDED_STATUSES so the response rate on the
   *  dashboard and the colours next to it are computed off the same idea. */
  responded: boolean;
}

export const STATUS_META: Record<string, StatusMeta> = {
  applied:   { label: "Applied",   register: "waiting", responded: false },
  sent:      { label: "Sent",      register: "waiting", responded: false },
  ghosted:   { label: "No reply",  register: "waiting", responded: false },
  interview: { label: "Interview", register: "live",    responded: true },
  offer:     { label: "Offer",     register: "live",    responded: true },
  rejected:  { label: "Rejected",  register: "closed",  responded: true },
  failed:    { label: "Send failed", register: "failed", responded: false },
};

/** Never throws on an unrecognised status — the backend accepts any string on
 *  PATCH /jobs/{id}/status, so the UI has to render whatever comes back rather
 *  than blanking a row it does not have a case for. */
export function statusMeta(status: string): StatusMeta {
  const key = (status || "").toLowerCase();
  return (
    STATUS_META[key] ?? {
      label: status || "Unknown",
      register: "waiting",
      responded: false,
    }
  );
}

/** Inline styles for a status chip, straight off the tokens. Returned as a
 *  style object rather than a class name because the three registers differ in
 *  all three of background, text and border, and enumerating nine utility
 *  classes to say that is harder to read than the values themselves. */
export function statusStyle(status: string): React.CSSProperties {
  switch (statusMeta(status).register) {
    case "live":
      return {
        background: "var(--signal-soft)",
        color: "var(--signal)",
        borderColor: "var(--signal-line)",
      };
    case "closed":
      return {
        background: "var(--closed-soft)",
        color: "var(--closed)",
        borderColor: "var(--closed-line)",
      };
    case "failed":
      return {
        background: "var(--warning-soft)",
        color: "var(--warning)",
        borderColor: "var(--warning-line)",
      };
    default:
      return {
        background: "var(--surface-2)",
        color: "var(--text-muted)",
        borderColor: "var(--border)",
      };
  }
}

/** The statuses a user can move an application to, in pipeline order. Mirrors
 *  the backend's funnel (`_FUNNEL_IMPLIED_BY` in shared/mongodb.py) plus the
 *  two terminal states, and drives both the detail-view picker and the
 *  pipeline board's columns. `failed` is absent on purpose: it describes a
 *  send that errored, which is not something a user sets by hand. */
export const PIPELINE_STATUSES = [
  "applied",
  "interview",
  "offer",
  "rejected",
  "ghosted",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];
