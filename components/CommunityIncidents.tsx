"use client";

import type { Incident, IncidentType, SupportedLocale } from "@astian-maps/contracts";
import { X } from "@phosphor-icons/react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Box,
  INCIDENT_COLORS,
  INCIDENTS_MIN_ZOOM,
  boxContains,
  clampBox,
  followIncidents,
  incidentCopy,
  incidentGlyphIsDark,
  incidentIcon,
  isExpired,
  listIncidents,
  minutesSince,
} from "../lib/incidents";

interface CommunityIncidentsProps {
  map: MapLibreMap | null;
  locale: SupportedLocale;
}

/** How long an incident that arrived live keeps its pulse. */
const FRESH_MS = 12_000;

/**
 * Community reports on the web map, read only: the active ones in view, kept current by the
 * API's event stream, and a card with a report's details. Reports are made and confirmed in the
 * mobile app; the web has no way to send one.
 */
export function CommunityIncidents({ map, locale }: CommunityIncidentsProps) {
  const copy = incidentCopy(locale);
  const [items, setItems] = useState<Map<string, Incident>>(() => new Map());
  const [fresh, setFresh] = useState<Map<string, number>>(() => new Map());
  const [selectedId, setSelectedId] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const markers = useRef(new Map<string, Marker>());
  const followBox = useRef<Box | undefined>(undefined);
  const stopFollow = useRef<(() => void) | undefined>(undefined);

  const upsert = useCallback((incident: Incident, live = false) => {
    if (isExpired(incident)) return;
    setItems((previous) => new Map(previous).set(incident.id, incident));
    if (live) setFresh((previous) => new Map(previous).set(incident.id, Date.now()));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
    setSelectedId((current) => (current === id ? undefined : current));
  }, []);

  // The list for the view on every settle, and a live stream over a box half again as large,
  // reopened only when the view leaves it.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let timer: number | undefined;
    const refresh = async () => {
      if (map.getZoom() < INCIDENTS_MIN_ZOOM) {
        setItems(new Map());
        stopFollow.current?.();
        stopFollow.current = undefined;
        followBox.current = undefined;
        return;
      }
      const bounds = map.getBounds();
      const view = clampBox([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
      try {
        const list = await listIncidents(view);
        if (cancelled) return;
        setItems(new Map(list.items.map((incident) => [incident.id, incident])));
      } catch {
        // The layer keeps what it had; the next settle or the stream catches up.
      }
      if (!followBox.current || !boxContains(followBox.current, view)) {
        stopFollow.current?.();
        const box = clampBox(view, 0.5);
        followBox.current = box;
        stopFollow.current = followIncidents(
          box,
          (incident) => upsert(incident, true),
          (incident) => remove(incident.id),
        );
      }
    };
    const onMoveEnd = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 350);
    };
    void refresh();
    map.on("moveend", onMoveEnd);
    const safety = window.setInterval(refresh, 90_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(safety);
      map.off("moveend", onMoveEnd);
      stopFollow.current?.();
      stopFollow.current = undefined;
      followBox.current = undefined;
    };
  }, [map, remove, upsert]);

  // Ages, expiry and the end of each pulse.
  useEffect(() => {
    const tick = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      setItems((previous) => {
        const kept = [...previous.values()].filter((incident) => !isExpired(incident, at));
        return kept.length === previous.size ? previous : new Map(kept.map((i) => [i.id, i]));
      });
      setFresh((previous) => {
        const kept = [...previous].filter(([, since]) => at - since < FRESH_MS);
        return kept.length === previous.size ? previous : new Map(kept);
      });
    }, 4_000);
    return () => window.clearInterval(tick);
  }, []);

  // One HTML marker per incident, updated in place.
  useEffect(() => {
    if (!map) return;
    const current = markers.current;
    for (const [id, marker] of current) {
      if (!items.has(id)) {
        marker.remove();
        current.delete(id);
      }
    }
    for (const incident of items.values()) {
      let marker = current.get(incident.id);
      if (!marker) {
        const element = document.createElement("button");
        element.type = "button";
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          setSelectedId(incident.id);
        });
        marker = new Marker({ element, anchor: "bottom" })
          .setLngLat([incident.coordinates.longitude, incident.coordinates.latitude])
          .addTo(map);
        current.set(incident.id, marker);
      } else {
        // A report moved onto its road arrives as an update with new coordinates.
        marker.setLngLat([incident.coordinates.longitude, incident.coordinates.latitude]);
      }
      paintMarker(marker.getElement() as HTMLButtonElement, incident, {
        label: copy.types[incident.type],
        selected: incident.id === selectedId,
        fresh: fresh.has(incident.id),
      });
    }
  }, [copy, fresh, items, map, selectedId]);

  useEffect(() => {
    const current = markers.current;
    return () => {
      current.forEach((marker) => marker.remove());
      current.clear();
    };
  }, [map]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = selectedId ? items.get(selectedId) : undefined;

  return (
    <>
      {selected && (
        <section className="incident-card" aria-label={copy.types[selected.type]}>
          <IncidentFace type={selected.type} size={56} />
          <div className="incident-card-body">
            <strong>
              {copy.types[selected.type]}
              {selected.subtype ? ` · ${copy.subtypes[selected.subtype] ?? selected.subtype}` : ""}
            </strong>
            <span>
              {copy.ago(minutesSince(selected.createdAt, now))} · {copy.confirmations(selected.confirmations)}
            </span>
            <small>{copy.readOnly}</small>
          </div>
          <button
            type="button"
            className="incident-icon-button incident-card-close"
            aria-label={copy.close}
            onClick={() => setSelectedId(undefined)}
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </section>
      )}
    </>
  );
}

function IncidentFace({ type, size }: { type: IncidentType; size: number }) {
  const [from, to] = INCIDENT_COLORS[type];
  return (
    <span
      className={`incident-face ${incidentGlyphIsDark(type) ? "is-dark" : ""}`}
      style={{ width: size, height: size, background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      <img src={incidentIcon(type)} alt="" />
    </span>
  );
}

function paintMarker(
  element: HTMLButtonElement,
  incident: Incident,
  state: { label: string; selected: boolean; fresh: boolean },
) {
  const [from, to] = INCIDENT_COLORS[incident.type];
  element.className = [
    "incident-pin",
    incidentGlyphIsDark(incident.type) ? "is-dark" : "",
    state.selected ? "is-selected" : "",
    state.fresh ? "is-fresh" : "",
  ]
    .filter(Boolean)
    .join(" ");
  element.style.setProperty("--incident-from", from);
  element.style.setProperty("--incident-to", to);
  element.style.setProperty("--incident-opacity", String(0.55 + 0.45 * incident.confidence));
  element.setAttribute("aria-label", state.label);
  element.title = state.label;
  const badge = incident.confirmations > 0 ? `<b>${Math.min(incident.confirmations, 99)}</b>` : "";
  const html = `<span class="incident-pin-face"><img src="${incidentIcon(incident.type)}" alt=""></span>${badge}`;
  if (element.innerHTML !== html) element.innerHTML = html;
}
