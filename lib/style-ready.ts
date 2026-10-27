export interface StyleReadyTarget {
  getStyle(): unknown;
  on(type: "styledata", listener: () => void): unknown;
  off(type: "styledata", listener: () => void): unknown;
}

/**
 * Runs [task] as soon as the style can take sources and layers, and returns the
 * cleanup. `isStyleLoaded()` is not that test: it also turns false while any
 * source is still fetching tiles, and a task parked on `style.load` then waits
 * for an event that never comes again, so a route computed while an overlay is
 * loading was never drawn. `getStyle()` is undefined exactly while the style is
 * loading, and a task that throws is retried on the next `styledata`.
 */
export function onStyleReady(map: StyleReadyTarget, task: () => void): () => void {
  const attempt = () => {
    if (!map.getStyle()) return false;
    try {
      task();
      return true;
    } catch {
      return false;
    }
  };
  if (attempt()) return () => undefined;
  const handler = () => {
    if (attempt()) map.off("styledata", handler);
  };
  map.on("styledata", handler);
  return () => {
    map.off("styledata", handler);
  };
}
