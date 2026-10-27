import { describe, expect, it } from "vitest";
import {
  contextPanelReducer,
  initialContextPanelState,
} from "./context-panel";

describe("contextPanelReducer", () => {
  it("starts with a map-only canvas", () => {
    expect(initialContextPanelState).toEqual({ view: "explore", open: false });
  });

  it("opens the appropriate context for search and directions", () => {
    expect(
      contextPanelReducer(initialContextPanelState, { type: "open-explore" }),
    ).toEqual({ view: "explore", open: true });
    expect(
      contextPanelReducer(initialContextPanelState, { type: "open-route" }),
    ).toEqual({ view: "route", open: true });
    expect(
      contextPanelReducer(initialContextPanelState, { type: "open-saved" }),
    ).toEqual({ view: "saved", open: true });
  });

  it("collapses without losing the active workflow", () => {
    expect(
      contextPanelReducer(
        { view: "route", open: true },
        { type: "collapse" },
      ),
    ).toEqual({ view: "route", open: false });
  });

  it("resets a closed or open workflow to the clean map", () => {
    expect(
      contextPanelReducer({ view: "route", open: true }, { type: "reset" }),
    ).toEqual(initialContextPanelState);
  });
});
