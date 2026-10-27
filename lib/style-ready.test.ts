import { describe, expect, it, vi } from "vitest";
import { onStyleReady, type StyleReadyTarget } from "./style-ready";

function fakeMap(initiallyLoaded: boolean) {
  let loaded = initiallyLoaded;
  const listeners = new Set<() => void>();
  const map: StyleReadyTarget = {
    getStyle: () => (loaded ? {} : undefined),
    on: (_type, listener) => listeners.add(listener),
    off: (_type, listener) => listeners.delete(listener),
  };
  return {
    map,
    listeners,
    finishLoading() {
      loaded = true;
      [...listeners].forEach((listener) => listener());
    },
  };
}

describe("onStyleReady", () => {
  it("runs at once when the style is loaded, even while sources still fetch tiles", () => {
    const { map, listeners } = fakeMap(true);
    const task = vi.fn();
    onStyleReady(map, task);
    expect(task).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it("waits for the style and then runs exactly once", () => {
    const { map, listeners, finishLoading } = fakeMap(false);
    const task = vi.fn();
    onStyleReady(map, task);
    expect(task).not.toHaveBeenCalled();
    finishLoading();
    finishLoading();
    expect(task).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it("retries a task that throws and stops listening on cleanup", () => {
    const { map, listeners, finishLoading } = fakeMap(true);
    const task = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("not done loading");
      })
      .mockImplementation(() => undefined);
    const cleanup = onStyleReady(map, task);
    expect(listeners.size).toBe(1);
    finishLoading();
    expect(task).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(0);

    const pending = fakeMap(false);
    const stop = onStyleReady(pending.map, vi.fn());
    stop();
    expect(pending.listeners.size).toBe(0);
    cleanup();
  });
});
