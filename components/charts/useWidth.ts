"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The rendered width of an element, tracked as it changes.
 *
 * The charts draw at real pixel size rather than scaling a fixed `viewBox`,
 * because a scaled viewBox stretches the strokes with it — a 2px line becomes
 * 3.4px on a wide screen and 1.1px in a sidebar, and the whole point of the
 * mark specs is that they are the same everywhere.
 *
 * Returns 0 until the first measurement, which is the caller's cue that there
 * is nothing sensible to draw yet.
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setWidth(el.getBoundingClientRect().width);

    // Absent in jsdom, and in a few older mobile browsers. Falling back to the
    // one-off measurement above beats crashing the page it is decorating.
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
