/**
 * Simple stage timer for latency_ms — Owner: Builder 2
 * Later: feed eval/latency script for P50/P70/P100.
 */

export function createTimer() {
  const marks = {};
  const started = Date.now();

  return {
    mark(name) {
      marks[name] = Date.now();
    },
    duration(startName, endName) {
      const a = marks[startName];
      const b = marks[endName];
      if (a == null || b == null) return 0;
      return Math.max(0, b - a);
    },
    total() {
      return Date.now() - started;
    },
  };
}
