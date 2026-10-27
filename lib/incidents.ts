import type { Incident, IncidentListResponse, IncidentType, SupportedLocale } from "@astian-maps/contracts";
import { INCIDENT_SUBTYPES, INCIDENT_TYPES, isProblemDetails } from "@astian-maps/contracts";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/v1";

/** Below this zoom the area is too wide to list; the layer stays empty. */
export const INCIDENTS_MIN_ZOOM = 9;
/** The server refuses a box larger than this on a side. */
export const MAX_BOX_SPAN = 3;

export type Box = [west: number, south: number, east: number, north: number];

export const INCIDENT_COLORS: Record<IncidentType, [string, string]> = {
  congestion: ["#FF8787", "#E03131"],
  police: ["#5C7CFA", "#3B5BDB"],
  collision: ["#F06595", "#C2255C"],
  hazard: ["#FFD43B", "#F59F00"],
  pothole: ["#B08968", "#7F5539"],
  roadworks: ["#FFA94D", "#E8590C"],
  closure: ["#5C636A", "#212529"],
  weather: ["#3BC9DB", "#1C7ED6"],
  camera: ["#9775FA", "#6741D9"],
};

/** The hazard tile is light, so its glyph is drawn dark. */
export function incidentGlyphIsDark(type: IncidentType): boolean {
  return type === "hazard";
}

export function incidentIcon(type: IncidentType): string {
  return `/incidents/${type}.svg`;
}

type Copy = {
  types: Record<IncidentType, string>;
  subtypes: Record<string, string>;
  close: string;
  confirmations: (count: number) => string;
  ago: (minutes: number) => string;
  readOnly: string;
};

const es: Copy = {
  types: {
    congestion: "Tráfico",
    police: "Policía",
    collision: "Accidente",
    hazard: "Peligro",
    pothole: "Hueco",
    roadworks: "Obras",
    closure: "Vía cerrada",
    weather: "Clima",
    camera: "Cámara",
  },
  subtypes: {
    moderate: "Moderado",
    heavy: "Denso",
    standstill: "Detenido",
    visible: "Visible",
    hidden: "Escondida",
    checkpoint: "Retén",
    minor: "Leve",
    major: "Grave",
    opposite_side: "Carril contrario",
    object: "Objeto en la vía",
    stopped_vehicle: "Vehículo detenido",
    animal: "Animal",
    lane_closed: "Carril cerrado",
    slow: "Paso lento",
    rain: "Lluvia fuerte",
    fog: "Niebla",
    flood: "Inundación",
    speed: "Velocidad",
    red_light: "Semáforo",
    mobile: "Móvil",
  },
  close: "Cerrar",
  confirmations: (count) =>
    count === 0 ? "Sin confirmar" : count === 1 ? "1 confirmación" : `${count} confirmaciones`,
  ago: (minutes) =>
    minutes < 1 ? "Ahora" : minutes < 60 ? `Hace ${minutes} min` : `Hace ${Math.floor(minutes / 60)} h`,
  readOnly: "Los reportes se hacen y se confirman desde la app móvil.",
};

const en: Copy = {
  types: {
    congestion: "Traffic",
    police: "Police",
    collision: "Crash",
    hazard: "Hazard",
    pothole: "Pothole",
    roadworks: "Roadworks",
    closure: "Closure",
    weather: "Weather",
    camera: "Camera",
  },
  subtypes: {
    moderate: "Moderate",
    heavy: "Heavy",
    standstill: "Standstill",
    visible: "Visible",
    hidden: "Hidden",
    checkpoint: "Checkpoint",
    minor: "Minor",
    major: "Major",
    opposite_side: "Other side",
    object: "Object on road",
    stopped_vehicle: "Stopped vehicle",
    animal: "Animal",
    lane_closed: "Lane closed",
    slow: "Slow",
    rain: "Heavy rain",
    fog: "Fog",
    flood: "Flooding",
    speed: "Speed",
    red_light: "Red light",
    mobile: "Mobile",
  },
  close: "Close",
  confirmations: (count) =>
    count === 0 ? "Unconfirmed" : count === 1 ? "1 confirmation" : `${count} confirmations`,
  ago: (minutes) =>
    minutes < 1 ? "Now" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`,
  readOnly: "Reports are made and confirmed in the mobile app.",
};

const fr: Copy = {
  ...en,
  types: {
    congestion: "Bouchon",
    police: "Police",
    collision: "Accident",
    hazard: "Danger",
    pothole: "Nid-de-poule",
    roadworks: "Travaux",
    closure: "Route fermée",
    weather: "Météo",
    camera: "Radar",
  },
  close: "Fermer",
};

const de: Copy = {
  ...en,
  types: {
    congestion: "Stau",
    police: "Polizei",
    collision: "Unfall",
    hazard: "Gefahr",
    pothole: "Schlagloch",
    roadworks: "Baustelle",
    closure: "Sperrung",
    weather: "Wetter",
    camera: "Blitzer",
  },
  close: "Schließen",
};

const COPY: Record<SupportedLocale, Copy> = { es, en, fr, de };

export function incidentCopy(locale: SupportedLocale): Copy {
  return COPY[locale] ?? en;
}

export { INCIDENT_SUBTYPES, INCIDENT_TYPES };

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

export function isExpired(incident: Pick<Incident, "expiresAt">, now = Date.now()): boolean {
  return Date.parse(incident.expiresAt) <= now;
}

/** The map's view as a box the server accepts: clipped to MAX_BOX_SPAN around its center. */
export function clampBox([west, south, east, north]: Box, grow = 0): Box {
  const cx = (west + east) / 2;
  const cy = (south + north) / 2;
  const halfW = Math.min(MAX_BOX_SPAN, (east - west) * (1 + grow)) / 2;
  const halfH = Math.min(MAX_BOX_SPAN, (north - south) * (1 + grow)) / 2;
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  return [
    clamp(cx - halfW, 180),
    clamp(cy - halfH, 85),
    clamp(cx + halfW, 180),
    clamp(cy + halfH, 85),
  ];
}

export function boxContains(outer: Box, inner: Box): boolean {
  return outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
}

export class IncidentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    if (isProblemDetails(body)) throw new IncidentApiError(body.detail ?? body.title, body.status, body.code);
    throw new IncidentApiError(`HTTP ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export function listIncidents(box: Box): Promise<IncidentListResponse> {
  return call<IncidentListResponse>(`/incidents?bbox=${box.map((v) => v.toFixed(5)).join(",")}`);
}

/** Follows changes inside [box] until the returned function is called. */
export function followIncidents(
  box: Box,
  onChange: (incident: Incident) => void,
  onRemoved: (incident: Incident) => void,
): () => void {
  const source = new EventSource(`${apiBaseUrl}/incidents/stream?bbox=${box.map((v) => v.toFixed(5)).join(",")}`);
  const read = (handler: (incident: Incident) => void) => (event: MessageEvent) => {
    try {
      handler(JSON.parse(event.data) as Incident);
    } catch {
      // A malformed event is skipped; the next list refresh corrects the state.
    }
  };
  source.addEventListener("incident", read(onChange) as EventListener);
  source.addEventListener("removed", read(onRemoved) as EventListener);
  return () => source.close();
}
