export type ContextPanelView = "explore" | "route" | "saved";

export interface ContextPanelState {
  view: ContextPanelView;
  open: boolean;
}

export type ContextPanelAction =
  | { type: "open-explore" }
  | { type: "open-route" }
  | { type: "open-saved" }
  | { type: "collapse" }
  | { type: "reset" };

export const initialContextPanelState: ContextPanelState = {
  view: "explore",
  open: false,
};

export function contextPanelReducer(
  state: ContextPanelState,
  action: ContextPanelAction,
): ContextPanelState {
  switch (action.type) {
    case "open-explore":
      return { view: "explore", open: true };
    case "open-route":
      return { view: "route", open: true };
    case "open-saved":
      return { view: "saved", open: true };
    case "collapse":
      return { ...state, open: false };
    case "reset":
      return initialContextPanelState;
  }
}
