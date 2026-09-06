/**
 * Core Web Vitals reporting (docs/PERFORMANCE.md "Core Web Vitals
 * target"). Collects LCP / INP / CLS / TTFB / FCP and hands each metric
 * to `sink`. The default sink logs in dev and is a no-op in prod; the
 * deploy pipeline (Phase 15) swaps in a `navigator.sendBeacon` to the
 * RUM endpoint.
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

function defaultSink(metric: Metric) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info(`[web-vitals] ${metric.name} ${Math.round(metric.value)} (${metric.rating})`);
  }
}

export function reportWebVitals(sink: (metric: Metric) => void = defaultSink) {
  onLCP(sink);
  onINP(sink);
  onCLS(sink);
  onFCP(sink);
  onTTFB(sink);
}
