// Chart primitives, drawn against the design tokens.
//
// There is no charting library here on purpose: the whole set is four forms
// and a figure, all of which read the same tokens as the rest of the app, and
// a dependency would have arrived with its own palette, its own type scale and
// its own dark mode to fight with.
//
// The palette obeys one rule, inherited from lib/status.ts: --signal means a
// human replied, and it appears on no other mark. Everything else is the
// de-emphasis series colour. That makes every chart here an *emphasis* chart
// rather than a categorical one — there is no categorical palette in this
// product, because no chart in it plots more than one thing at a time.

export { AreaChart, SeriesTable } from "./AreaChart";
export type { AreaPoint, AreaSeries } from "./AreaChart";

export { BarChart } from "./BarChart";
export type { BarDatum } from "./BarChart";

export { FunnelChart } from "./FunnelChart";
export type { FunnelDatum } from "./FunnelChart";

export { Sparkline } from "./Sparkline";
export { StatTile } from "./StatTile";

export { bucket } from "./scale";
