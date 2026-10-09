// Clock access lives outside React render paths. Use these functions only in request handlers.
export function beginRunClock() {
  return { id: Date.now(), started: performance.now() };
}

export function elapsedRunSeconds(started: number) {
  return Math.max(0, (performance.now() - started) / 1000);
}
