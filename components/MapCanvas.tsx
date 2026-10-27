"use client";

import type {
  AirQualitySnapshot,
  Coordinates,
  Place,
  Route,
  SupportedLocale,
} from "@astian-maps/contracts";
import {
  BatteryCharging,
  Buildings,
  Cloud,
  Compass,
  CornersOut,
  Crosshair,
  Leaf,
  Minus,
  Mountains,
  Plus,
  Ruler,
  Stack,
  TrafficSignal,
  X,
} from "@phosphor-icons/react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  ScaleControl,
  getVersion,
  setWorkerUrl,
  type ErrorEvent as MapLibreErrorEvent,
  type GeoJSONSource,
  type GeoJSONSourceSpecification,
  type MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { classifyUsAqi } from "../lib/air-quality";
import {
  MAP_BASE_LAYERS,
  runtimeMapLayerAvailability,
  sanitizeMapLayerSelection,
  type MapLayerSelection,
} from "../lib/map-layers";
import {
  createMapStyle,
  resolveStyleAssetUrls,
  runtimeEvaluationMapLayerSources,
  type MapTheme,
} from "../lib/map-style";
import { configuredMapStart } from "../lib/map-start";
import { trafficTileTemplate } from "../lib/api";
import { onStyleReady } from "../lib/style-ready";
import { decodePolyline } from "../lib/polyline";
import { CommunityIncidents } from "./CommunityIncidents";

interface MapCanvasProps {
  theme: MapTheme;
  locale: SupportedLocale;
  styleUrl?: string;
  layerSelection: MapLayerSelection;
  lowDataMode: boolean;
  airQuality?: AirQualitySnapshot;
  airQualityStatus: "idle" | "loading" | "success" | "error";
  places: Place[];
  selectedPlace?: Place;
  routes: Route[];
  selectedRouteId?: string;
  contextPanelOpen: boolean;
  liveTrafficEnabled: boolean;
  incidentsEnabled?: boolean;
  waypointOrder?: {
    originId?: string;
    destinationId?: string;
    stopIds: string[];
  };
  selectionHint?: string;
  labels: {
    loading: string;
    error: string;
    retry: string;
    zoomIn: string;
    zoomOut: string;
    locate: string;
    layers: string;
    road: string;
    satellite: string;
    terrain: string;
    cycling: string;
    airQuality: string;
    airQualityModeledCenter: string;
    airQualityLoading: string;
    airQualityError: string;
    airQualityRetry: string;
    airQualityUsAqi: string;
    airQualityPm25: string;
    airQualityNoData: string;
    airQualityObserved: string;
    airQualitySource: string;
    airQualityLevels: {
      good: string;
      moderate: string;
      sensitive: string;
      unhealthy: string;
      veryUnhealthy: string;
      hazardous: string;
      unknown: string;
    };
    evChargers: string;
    buildings3d: string;
    traffic: string;
    trafficHint: string;
    trafficFree: string;
    trafficSlow: string;
    evaluation: string;
    unavailable: string;
    measure: string;
    clearMeasure: string;
    fullscreen: string;
    resetNorth: string;
    lowDataActive: string;
  };
  onPlaceSelect: (place: Place) => void;
  onMapSelect: (coordinates: Coordinates) => void;
  onViewChange: (coordinates: Coordinates) => void;
  onLocate: () => void;
  onLayerSelectionChange: (selection: MapLayerSelection) => void;
  onAirQualityRetry: () => void;
}

const ROUTE_SOURCE_PREFIX = "astian-route-source";
const ROUTE_LAYER_PREFIX = "astian-route-layer";
const ROUTE_LABEL_SOURCE = "astian-route-labels";
const ROUTE_LABEL_LAYER = "astian-route-labels-layer";
const TERRAIN_SOURCE_ID = "astian-terrain-dem";
const TERRAIN_LAYER_ID = "astian-terrain-hillshade";
const CYCLING_SOURCE_ID = "astian-cycling";
const CYCLING_LAYER_ID = "astian-cycling-overlay";
const BUILDINGS_LAYER_ID = "astian-buildings-3d";
const TRAFFIC_SOURCE_ID = "astian-live-traffic";
const TRAFFIC_LAYER_ID = "astian-live-traffic-layer";
const MEASURE_SOURCE_ID = "astian-measure-source";
const MEASURE_LINE_LAYER_ID = "astian-measure-line";
const MEASURE_POINT_LAYER_ID = "astian-measure-points";
const LOW_DATA_LAYER_SELECTION: MapLayerSelection = {
  base: "road",
  overlays: {
    cycling: false,
    airQuality: false,
    evChargers: false,
    buildings3d: false,
    traffic: false,
  },
};

export function MapCanvas({
  theme,
  locale,
  styleUrl,
  layerSelection,
  lowDataMode,
  airQuality,
  airQualityStatus,
  places,
  selectedPlace,
  routes,
  selectedRouteId,
  contextPanelOpen,
  liveTrafficEnabled,
  incidentsEnabled = false,
  waypointOrder,
  selectionHint,
  labels,
  onPlaceSelect,
  onMapSelect,
  onViewChange,
  onLocate,
  onLayerSelectionChange,
  onAirQualityRetry,
}: MapCanvasProps) {
  const sanitizedSelection = sanitizeMapLayerSelection(
    lowDataMode ? LOW_DATA_LAYER_SELECTION : layerSelection,
  );
  const activeLayerSelection: MapLayerSelection = {
    ...sanitizedSelection,
    overlays: {
      ...sanitizedSelection.overlays,
      traffic: liveTrafficEnabled && sanitizedSelection.overlays.traffic,
    },
  };
  const layerSelectionKey = JSON.stringify(activeLayerSelection);
  const frameRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onMapSelectRef = useRef(onMapSelect);
  const routesRef = useRef(routes);
  const onViewChangeRef = useRef(onViewChange);
  const measuringRef = useRef(false);
  const measurePointsRef = useRef<Array<[number, number]>>([]);
  const cameraRef = useRef({
    center: (configuredMapStart
      ? [configuredMapStart.longitude, configuredMapStart.latitude]
      : [0, 20]) as [number, number],
    zoom: configuredMapStart?.zoom ?? 2.35,
    bearing: 0,
    pitch: 0,
  });
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mapGeneration, setMapGeneration] = useState(0);
  const [layersOpen, setLayersOpen] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Array<[number, number]>>([]);

  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  useEffect(() => {
    onMapSelectRef.current = onMapSelect;
    onViewChangeRef.current = onViewChange;
  }, [onMapSelect, onViewChange]);

  useEffect(() => {
    measuringRef.current = measuring;
    measurePointsRef.current = measurePoints;
  }, [measurePoints, measuring]);

  useEffect(() => {
    if (!containerRef.current) return;

    setWorkerUrl(`/map-assets/maplibre-gl-worker.mjs?v=${getVersion()}`);
    const map = new MapLibreMap({
      container: containerRef.current,
      style: createMapStyle(theme, styleUrl, activeLayerSelection.base),
      transformStyle: (_previous, next) =>
        resolveStyleAssetUrls(next, window.location.origin),
      center: cameraRef.current.center,
      zoom: cameraRef.current.zoom,
      bearing: cameraRef.current.bearing,
      pitch: cameraRef.current.pitch,
      minZoom: 2,
      maxZoom: 19,
      pitchWithRotate: true,
      attributionControl: false,
      refreshExpiredTiles: !lowDataMode,
      maxTileCacheSize: lowDataMode ? 24 : null,
      maxTileCacheZoomLevels: lowDataMode ? 1 : 5,
      fadeDuration: lowDataMode ? 0 : 300,
    });
    mapRef.current = map;
    setMapInstance(map);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __astianMap?: MapLibreMap }).__astianMap = map;
    }
    map.addControl(
      new AttributionControl({ compact: false, customAttribution: "Astian Maps" }),
      "bottom-right",
    );
    map.addControl(new ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

    const handleLoad = () => {
      setMapStatus("ready");
      map.getCanvas().setAttribute("aria-label", "Mapa interactivo de Astian Maps");
      const center = map.getCenter();
      onViewChangeRef.current({ latitude: center.lat, longitude: center.lng });
    };
    const handleError = (event: MapLibreErrorEvent) => {
      const message = event.error?.message ?? "";
      if (message.includes("glyph") || message.includes("sprite")) return;
      const failedSource = (event as { sourceId?: string }).sourceId;
      const failedTile = (event as { tile?: unknown }).tile;
      // A tile that does not arrive, or an optional overlay that answers with an
      // error, leaves the map usable. Only the style or the base map source is fatal.
      if (failedTile || (failedSource && failedSource !== "openmaptiles")) return;
      if (!map.loaded()) setMapStatus("error");
    };
    const handleIdle = () => {
      if (map.loaded()) {
        setMapStatus("ready");
      }
    };
    map.on("load", handleLoad);
    map.on("error", handleError);
    map.on("idle", handleIdle);
    const handleMapClick = (event: MapMouseEvent) => {
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest(".map-marker, .incident-pin")) return;
      if (measuringRef.current) {
        const next = [
          ...measurePointsRef.current,
          [event.lngLat.lng, event.lngLat.lat] as [number, number],
        ];
        measurePointsRef.current = next;
        setMeasurePoints(next);
        return;
      }
      onMapSelectRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };
    const handleMoveEnd = () => {
      const center = map.getCenter();
      onViewChangeRef.current({ latitude: center.lat, longitude: center.lng });
    };
    map.on("click", handleMapClick);
    map.on("moveend", handleMoveEnd);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    const panel = document.querySelector<HTMLElement>(".map-panel");
    if (panel) resizeObserver.observe(panel);

    return () => {
      const center = map.getCenter();
      cameraRef.current = {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.off("idle", handleIdle);
      map.off("click", handleMapClick);
      map.off("moveend", handleMoveEnd);
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, [lowDataMode, mapGeneration]);

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = selectionHint || measuring ? "crosshair" : "";
  }, [measuring, selectionHint]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => mapRef.current?.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [contextPanelOpen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setMapStatus("loading");
    map.setStyle(createMapStyle(theme, styleUrl, activeLayerSelection.base));
    map.once("style.load", () => setMapStatus("ready"));
  }, [activeLayerSelection.base, styleUrl, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return onStyleReady(map, () =>
      installPresentationLayers(map, activeLayerSelection, theme),
    );
    // The selection is rebuilt on every render; its content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerSelectionKey, styleUrl, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return onStyleReady(map, () =>
      installMeasurementLayers(map, measurePoints, theme),
    );
  }, [activeLayerSelection.base, measurePoints, styleUrl, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());

    markersRef.current = places.map((place, index) => {
      const waypoint = getWaypointMarker(place.id, waypointOrder);
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = [
        "map-marker",
        waypoint ? `map-marker-${waypoint.kind}` : "map-marker-place",
        place.id === selectedPlace?.id ? "map-marker-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      markerButton.textContent = waypoint?.label ?? String(index + 1);
      markerButton.setAttribute("aria-label", place.name);
      markerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onPlaceSelect(place);
      });

      return new Marker({ element: markerButton, anchor: "bottom" })
        .setLngLat([place.coordinates.longitude, place.coordinates.latitude])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [onPlaceSelect, places, selectedPlace?.id, waypointOrder]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace || routesRef.current.length > 0) return;
    map.flyTo({
      center: [
        selectedPlace.coordinates.longitude,
        selectedPlace.coordinates.latitude,
      ],
      zoom: Math.max(map.getZoom(), 14),
      duration: lowDataMode ? 0 : 700,
      essential: true,
      padding: getAdaptiveMapPadding(),
    });
  }, [contextPanelOpen, lowDataMode, selectedPlace]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return onStyleReady(map, () => drawRouteLayers(map, routes, selectedRouteId, theme));
  }, [activeLayerSelection.base, routes, selectedRouteId, styleUrl, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || routes.length === 0) return;
    const selected =
      routes.find((route) => route.id === selectedRouteId) ?? routes[0];
    const fit = () => {
      map.resize();
      // flyTo leaves its padding on the map, and fitBounds adds its own on top; the
      // sum stops fitting in a phone's sliver of map and the camera never moves.
      map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
      map.fitBounds(
        [
          [selected.bounds.southWest.longitude, selected.bounds.southWest.latitude],
          [selected.bounds.northEast.longitude, selected.bounds.northEast.latitude],
        ],
        {
          padding: getAdaptiveMapPadding(true),
          duration: lowDataMode ? 0 : 900,
          maxZoom: 16,
          essential: true,
        },
      );
    };
    // On phones the sheet is still sliding to its resting height when the routes
    // arrive; padding measured mid-animation would frame the route under it.
    if (window.innerWidth > 860) {
      fit();
      return;
    }
    const timeout = window.setTimeout(fit, 320);
    return () => window.clearTimeout(timeout);
  }, [contextPanelOpen, lowDataMode, routes, selectedRouteId]);

  const airQualityLevel = airQuality ? classifyUsAqi(airQuality.usAqi) : undefined;
  const airQualityHint = !activeLayerSelection.overlays.airQuality
    ? labels.airQualityModeledCenter
    : airQualityStatus === "error"
      ? labels.airQualityError
      : airQuality && airQualityLevel
        ? `${airQuality.usAqi === undefined ? labels.airQualityNoData : Math.round(airQuality.usAqi)} · ${labels.airQualityLevels[airQualityLevel.labelKey]}`
        : labels.airQualityLoading;

  const retry = () => {
    setMapStatus("loading");
    setMapGeneration((generation) => generation + 1);
  };

  const toggleMeasure = () => {
    if (selectionHint) return;
    setMeasuring((current) => {
      const next = !current;
      if (!next) setMeasurePoints([]);
      return next;
    });
    setLayersOpen(false);
  };

  const updateOverlay = (
    overlay: keyof MapLayerSelection["overlays"],
    enabled: boolean,
  ) => {
    onLayerSelectionChange(
      sanitizeMapLayerSelection({
        ...layerSelection,
        overlays: { ...layerSelection.overlays, [overlay]: enabled },
      }),
    );
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (frameRef.current?.requestFullscreen) {
      void frameRef.current.requestFullscreen();
    }
  };

  return (
    <div ref={frameRef} className="map-frame" id="map-content" tabIndex={-1}>
      <div ref={containerRef} className="map-canvas" />

      {incidentsEnabled && <CommunityIncidents map={mapInstance} locale={locale} />}

      {selectionHint && (
        <div className="map-selection-hint" role="status" aria-live="polite">
          <Crosshair size={18} weight="bold" aria-hidden="true" />
          {selectionHint}
        </div>
      )}

      {measuring && (
        <div className="measure-status" role="status" aria-live="polite">
          <Ruler size={18} weight="bold" aria-hidden="true" />
          <span>
            {measurePoints.length < 2
              ? labels.measure
              : formatDistance(measureLineDistance(measurePoints))}
          </span>
          <button
            type="button"
            onClick={() => setMeasurePoints([])}
            aria-label={labels.clearMeasure}
            title={labels.clearMeasure}
          >
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>
      )}

      {mapStatus === "loading" && (
        <div className="map-state" role="status" aria-live="polite">
          <span className="map-loading-bar" />
          <span>{labels.loading}</span>
        </div>
      )}

      {mapStatus === "error" && (
        <div className="map-state map-state-error" role="alert">
          <strong>{labels.error}</strong>
          <button type="button" className="button-secondary" onClick={retry}>
            {labels.retry}
          </button>
        </div>
      )}

      {activeLayerSelection.overlays.airQuality && (
        <AirQualityCard
          snapshot={airQuality}
          status={airQualityStatus}
          locale={locale}
          labels={labels}
          compact={routes.length > 0}
          onRetry={onAirQualityRetry}
        />
      )}

      <div className="am-map-tools" aria-label="Controles del mapa">
        <div className="am-ctrl-group am-ctrl-extra">
          <button
            type="button"
            aria-label={labels.resetNorth}
            title={labels.resetNorth}
            onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 450 })}
          >
            <Compass size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={measuring ? "is-active" : ""}
            aria-label={labels.measure}
            title={labels.measure}
            aria-pressed={measuring}
            disabled={Boolean(selectionHint)}
            onClick={toggleMeasure}
          >
            <Ruler size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={labels.fullscreen}
            title={labels.fullscreen}
            onClick={toggleFullscreen}
          >
            <CornersOut size={22} aria-hidden="true" />
          </button>
        </div>
        {liveTrafficEnabled && (
          <div className="am-ctrl-group am-ctrl-traffic">
            <button
              type="button"
              className={activeLayerSelection.overlays.traffic ? "is-active" : ""}
              aria-label={labels.traffic}
              title={labels.traffic}
              aria-pressed={activeLayerSelection.overlays.traffic}
              disabled={lowDataMode}
              onClick={() =>
                updateOverlay("traffic", !activeLayerSelection.overlays.traffic)
              }
            >
              <TrafficSignal
                size={22}
                weight={activeLayerSelection.overlays.traffic ? "fill" : "regular"}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
        <div className="am-ctrl-group am-ctrl-locate">
          <button
            type="button"
            aria-label={labels.locate}
            title={labels.locate}
            onClick={onLocate}
          >
            <Crosshair size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="am-ctrl-group am-ctrl-zoom">
          <button
            type="button"
            aria-label={labels.zoomIn}
            title={labels.zoomIn}
            onClick={() => mapRef.current?.zoomIn()}
          >
            <Plus size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={labels.zoomOut}
            title={labels.zoomOut}
            onClick={() => mapRef.current?.zoomOut()}
          >
            <Minus size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`am-layers-tile is-${activeLayerSelection.base} ${layersOpen ? "is-active" : ""}`}
        aria-label={labels.layers}
        title={labels.layers}
        aria-expanded={layersOpen}
        onClick={() => setLayersOpen((current) => !current)}
      >
        <span className="am-layers-thumb" aria-hidden="true" />
        <Stack size={22} weight="fill" aria-hidden="true" />
        <span className="am-layers-label">{labels.layers}</span>
      </button>

      {activeLayerSelection.overlays.traffic && (
        <div className="am-traffic-legend" role="status" aria-label={labels.traffic}>
          <strong>{labels.traffic}</strong>
          <span>{labels.trafficFree}</span>
          <i aria-hidden="true" />
          <span>{labels.trafficSlow}</span>
        </div>
      )}

      {layersOpen && (
        <section className="layer-switcher" aria-label={labels.layers}>
          <header>
            <div>
              <span>{labels.layers}</span>
              <strong>{labels[activeLayerSelection.base]}</strong>
            </div>
            <button
              type="button"
              onClick={() => setLayersOpen(false)}
              aria-label="Cerrar"
            >
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </header>

          {lowDataMode && (
            <p className="layer-low-data-note" role="status">
              {labels.lowDataActive}
            </p>
          )}

          <div className="base-layer-grid" role="radiogroup" aria-label={labels.layers}>
            {MAP_BASE_LAYERS.filter(
              (layer) => runtimeMapLayerAvailability.base[layer],
            ).map((layer) => {
              const Icon = layer === "road"
                ? Stack
                : layer === "satellite"
                  ? Cloud
                  : Mountains;
              return (
              <button
                key={layer}
                type="button"
                role="radio"
                aria-checked={activeLayerSelection.base === layer}
                className={activeLayerSelection.base === layer ? "is-active" : ""}
                disabled={lowDataMode}
                onClick={() =>
                  onLayerSelectionChange(
                    sanitizeMapLayerSelection({ ...layerSelection, base: layer }),
                  )
                }
              >
                <Icon size={21} weight={activeLayerSelection.base === layer ? "fill" : "regular"} aria-hidden="true" />
                <span>{labels[layer]}</span>
                {layer !== "road" && <small>{labels.evaluation}</small>}
              </button>
              );
            })}
          </div>

          <div className="overlay-list">
            {runtimeMapLayerAvailability.overlays.cycling && (
              <LayerToggle
                icon={Leaf}
                label={labels.cycling}
                hint={labels.evaluation}
                checked={activeLayerSelection.overlays.cycling}
                disabled={lowDataMode}
                onChange={(checked) => updateOverlay("cycling", checked)}
              />
            )}
            <LayerToggle
              icon={BatteryCharging}
              label={labels.evChargers}
              checked={activeLayerSelection.overlays.evChargers}
              disabled={lowDataMode}
              onChange={(checked) => updateOverlay("evChargers", checked)}
            />
            {liveTrafficEnabled && (
              <LayerToggle
                icon={TrafficSignal}
                label={labels.traffic}
                hint={labels.trafficHint}
                checked={activeLayerSelection.overlays.traffic}
                disabled={lowDataMode}
                onChange={(checked) => updateOverlay("traffic", checked)}
              />
            )}
            <LayerToggle
              icon={Buildings}
              label={labels.buildings3d}
              checked={activeLayerSelection.overlays.buildings3d}
              disabled={lowDataMode || activeLayerSelection.base === "satellite"}
              onChange={(checked) => updateOverlay("buildings3d", checked)}
            />
            {runtimeMapLayerAvailability.overlays.airQuality && (
              <LayerToggle
                icon={Cloud}
                label={labels.airQuality}
                hint={airQualityHint}
                checked={activeLayerSelection.overlays.airQuality}
                disabled={lowDataMode}
                onChange={(checked) => updateOverlay("airQuality", checked)}
              />
            )}
            {activeLayerSelection.overlays.airQuality && airQualityStatus === "error" && (
              <button type="button" className="air-quality-retry is-inline" onClick={onAirQualityRetry}>
                {labels.airQualityRetry}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

interface AirQualityCardProps {
  snapshot?: AirQualitySnapshot;
  status: "idle" | "loading" | "success" | "error";
  locale: SupportedLocale;
  labels: MapCanvasProps["labels"];
  compact: boolean;
  onRetry: () => void;
}

function AirQualityCard({
  snapshot,
  status,
  locale,
  labels,
  compact,
  onRetry,
}: AirQualityCardProps) {
  if (compact) {
    const level = snapshot ? classifyUsAqi(snapshot.usAqi) : undefined;
    return (
      <section
        className="air-quality-card is-compact"
        data-tone={level?.tone}
        role="status"
        aria-live="polite"
      >
        <Cloud size={18} weight="duotone" aria-hidden="true" />
        {status === "error" ? (
          <button type="button" onClick={onRetry}>
            {labels.airQualityRetry}
          </button>
        ) : snapshot && level ? (
          <>
            <strong>
              {snapshot.usAqi === undefined ? labels.airQualityNoData : Math.round(snapshot.usAqi)}
            </strong>
            <span>{labels.airQualityLevels[level.labelKey]}</span>
          </>
        ) : (
          <span>{labels.airQualityLoading}</span>
        )}
      </section>
    );
  }
  if (status === "loading" || status === "idle") {
    return (
      <section className="air-quality-card is-loading" role="status" aria-live="polite">
        <Cloud size={21} weight="duotone" aria-hidden="true" />
        <div>
          <strong>{labels.airQuality}</strong>
          <span>{labels.airQualityLoading}</span>
          <small>{labels.airQualityModeledCenter}</small>
        </div>
      </section>
    );
  }

  if (status === "error" || !snapshot) {
    return (
      <section className="air-quality-card is-error" role="alert">
        <Cloud size={21} weight="duotone" aria-hidden="true" />
        <div>
          <strong>{labels.airQuality}</strong>
          <span>{labels.airQualityError}</span>
          <button type="button" className="air-quality-retry" onClick={onRetry}>
            {labels.airQualityRetry}
          </button>
        </div>
      </section>
    );
  }

  const level = classifyUsAqi(snapshot.usAqi);
  const observedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(snapshot.observedAt));

  return (
    <section
      className="air-quality-card has-reading"
      data-tone={level.tone}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <header>
        <div>
          <Cloud size={21} weight="duotone" aria-hidden="true" />
          <span>
            <strong>{labels.airQuality}</strong>
            <small>{labels.airQualityModeledCenter}</small>
          </span>
        </div>
        <em>{labels.airQualityLevels[level.labelKey]}</em>
      </header>
      <div className="air-quality-values">
        <span>
          <small>{labels.airQualityUsAqi}</small>
          <strong>{snapshot.usAqi === undefined ? labels.airQualityNoData : Math.round(snapshot.usAqi)}</strong>
        </span>
        <span>
          <small>{labels.airQualityPm25}</small>
          <strong>
            {snapshot.pm25 === undefined
              ? labels.airQualityNoData
              : `${snapshot.pm25.toFixed(1)} µg/m³`}
          </strong>
        </span>
      </div>
      <footer>
        <span>
          {labels.airQualityObserved}: <time dateTime={snapshot.observedAt}>{observedAt}</time>
        </span>
        <span aria-label={labels.airQualitySource}>
          {snapshot.attribution.map((attribution, index) => (
            <span key={`${attribution.label}-${attribution.url}`}>
              {index > 0 && " · "}
              <a href={attribution.url} target="_blank" rel="noreferrer">
                {attribution.label}
              </a>
            </span>
          ))}
        </span>
      </footer>
    </section>
  );
}

interface LayerToggleProps {
  icon: typeof Stack;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function LayerToggle({ icon: Icon, label, hint, checked, disabled, onChange }: LayerToggleProps) {
  return (
    <label className={disabled ? "is-disabled" : ""}>
      <Icon size={19} aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function formatRouteDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

function drawRouteLayers(
  map: MapLibreMap,
  routes: Route[],
  selectedRouteId: string | undefined,
  theme: MapTheme,
) {
  removeRouteLayers(map);
  if (routes.length === 0) return;
  const selectedId = selectedRouteId ?? routes[0].id;
  const labels: Array<{
    type: "Feature";
    properties: { label: string; selected: number };
    geometry: { type: "Point"; coordinates: [number, number] };
  }> = [];

  const ordered = [...routes].sort(
    (left, right) => Number(left.id === selectedId) - Number(right.id === selectedId),
  );
  ordered.forEach((route, index) => {
    const points = decodePolyline(route.geometry.encoded, route.geometry.precision);
    if (points.length < 2) return;
    const selected = route.id === selectedId;
    const sourceId = `${ROUTE_SOURCE_PREFIX}-${index}`;
    const coordinates = points.map(
      (point) => [point.longitude, point.latitude] as [number, number],
    );
    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: { routeId: route.id },
        geometry: { type: "LineString", coordinates },
      },
    });
    map.addLayer({
      id: `${ROUTE_LAYER_PREFIX}-casing-${index}`,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": theme === "dark" ? "#0f1722" : "#ffffff",
        "line-width": selected ? 11 : 8,
        "line-opacity": selected ? 1 : 0.85,
      },
    });
    map.addLayer({
      id: `${ROUTE_LAYER_PREFIX}-${index}`,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": selected
          ? theme === "dark" ? "#8ab4f8" : "#1a5fd0"
          : theme === "dark" ? "#7d8794" : "#8c97a6",
        "line-width": selected ? 7 : 5,
      },
    });
    const middle = coordinates[Math.floor(coordinates.length / 2)];
    labels.push({
      type: "Feature",
      properties: { label: formatRouteDuration(route.durationSeconds), selected: selected ? 1 : 0 },
      geometry: { type: "Point", coordinates: middle },
    });
  });

  map.addSource(ROUTE_LABEL_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: labels },
  });
  map.addLayer({
    id: ROUTE_LABEL_LAYER,
    type: "symbol",
    source: ROUTE_LABEL_SOURCE,
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 13,
      "text-padding": 6,
      "text-allow-overlap": true,
      "symbol-sort-key": ["get", "selected"],
    },
    paint: {
      "text-color": [
        "case",
        ["==", ["get", "selected"], 1],
        theme === "dark" ? "#0b1b36" : "#ffffff",
        theme === "dark" ? "#e8eaed" : "#3c4043",
      ],
      "text-halo-color": [
        "case",
        ["==", ["get", "selected"], 1],
        theme === "dark" ? "#8ab4f8" : "#1a5fd0",
        theme === "dark" ? "#303134" : "#ffffff",
      ],
      "text-halo-width": 5,
    },
  });
}

function installPresentationLayers(
  map: MapLibreMap,
  selection: MapLayerSelection,
  theme: MapTheme,
) {

  map.setTerrain(null);
  removeLayerAndSource(map, TERRAIN_LAYER_ID, TERRAIN_SOURCE_ID);
  removeLayerAndSource(map, CYCLING_LAYER_ID, CYCLING_SOURCE_ID);
  removeLayerAndSource(map, TRAFFIC_LAYER_ID, TRAFFIC_SOURCE_ID);
  if (map.getLayer(BUILDINGS_LAYER_ID)) map.removeLayer(BUILDINGS_LAYER_ID);

  const firstSymbolLayer = map
    .getStyle()
    .layers?.find((layer) => layer.type === "symbol")?.id;

  if (
    selection.base === "terrain" &&
    runtimeEvaluationMapLayerSources.terrainDemTileUrl
  ) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      tiles: [runtimeEvaluationMapLayerSources.terrainDemTileUrl],
      tileSize: 256,
      maxzoom: 15,
      encoding: "terrarium",
      attribution:
        '<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles on AWS</a>',
    });
    map.addLayer(
      {
        id: TERRAIN_LAYER_ID,
        type: "hillshade",
        source: TERRAIN_SOURCE_ID,
        paint: {
          "hillshade-shadow-color": theme === "dark" ? "#08110e" : "#4d574f",
          "hillshade-highlight-color": theme === "dark" ? "#8da99b" : "#f8f4e9",
          "hillshade-accent-color": theme === "dark" ? "#27483a" : "#7c917f",
          "hillshade-exaggeration": 0.42,
        },
      },
      firstSymbolLayer,
    );
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.08 });
  }

  if (
    selection.overlays.cycling &&
    runtimeEvaluationMapLayerSources.cyclingTileUrl
  ) {
    map.addSource(CYCLING_SOURCE_ID, {
      type: "raster",
      tiles: [runtimeEvaluationMapLayerSources.cyclingTileUrl],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 18,
      attribution:
        '<a href="https://cycling.waymarkedtrails.org/">Waymarked Trails</a> · © OpenStreetMap contributors',
    });
    map.addLayer(
      {
        id: CYCLING_LAYER_ID,
        type: "raster",
        source: CYCLING_SOURCE_ID,
        paint: { "raster-opacity": 0.88, "raster-fade-duration": 120 },
      },
      firstSymbolLayer,
    );
  }

  if (selection.overlays.traffic) {
    map.addSource(TRAFFIC_SOURCE_ID, {
      type: "raster",
      tiles: [trafficTileTemplate()],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 16,
      attribution: "Traffic © Google",
    });
    map.addLayer(
      {
        id: TRAFFIC_LAYER_ID,
        type: "raster",
        source: TRAFFIC_SOURCE_ID,
        paint: { "raster-opacity": 0.85, "raster-fade-duration": 600 },
      },
      firstSymbolLayer,
    );
  }

  if (
    selection.overlays.buildings3d &&
    selection.base !== "satellite" &&
    map.getSource("openmaptiles")
  ) {
    map.addLayer(
      {
        id: BUILDINGS_LAYER_ID,
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": theme === "dark" ? "#5d7168" : "#c7d0ca",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            15,
            ["coalesce", ["get", "render_height"], 8],
          ],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.82,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbolLayer,
    );
  }

  const targetPitch = selection.overlays.buildings3d
    ? 48
    : selection.base === "terrain"
      ? 34
      : 0;
  map.easeTo({
    pitch: targetPitch,
    bearing: targetPitch > 0 ? -16 : map.getBearing(),
    duration: 520,
    essential: true,
  });
}

function installMeasurementLayers(
  map: MapLibreMap,
  points: Array<[number, number]>,
  theme: MapTheme,
) {
  if (map.getLayer(MEASURE_POINT_LAYER_ID)) map.removeLayer(MEASURE_POINT_LAYER_ID);
  if (map.getLayer(MEASURE_LINE_LAYER_ID)) map.removeLayer(MEASURE_LINE_LAYER_ID);
  if (map.getSource(MEASURE_SOURCE_ID)) map.removeSource(MEASURE_SOURCE_ID);
  if (points.length === 0) return;

  const features = [
    {
      type: "Feature",
      properties: {},
      geometry: { type: "MultiPoint", coordinates: points },
    },
  ] as Array<{
    type: "Feature";
    properties: Record<string, never>;
    geometry:
      | { type: "MultiPoint"; coordinates: Array<[number, number]> }
      | { type: "LineString"; coordinates: Array<[number, number]> };
  }>;
  if (points.length > 1) {
    features.unshift({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: points },
    });
  }
  map.addSource(MEASURE_SOURCE_ID, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features,
    } as GeoJSONSourceSpecification["data"],
  });
  map.addLayer({
    id: MEASURE_LINE_LAYER_ID,
    type: "line",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": theme === "dark" ? "#8ab4f8" : "#2866d3",
      "line-width": 4,
      "line-dasharray": [1.5, 1.2],
    },
  });
  map.addLayer({
    id: MEASURE_POINT_LAYER_ID,
    type: "circle",
    source: MEASURE_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 6,
      "circle-color": theme === "dark" ? "#8ab4f8" : "#2866d3",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}

function removeLayerAndSource(map: MapLibreMap, layerId: string, sourceId: string) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function measureLineDistance(points: Array<[number, number]>): number {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index]!;
    const latitude1 = (previous[1] * Math.PI) / 180;
    const latitude2 = (point[1] * Math.PI) / 180;
    const latitudeDelta = ((point[1] - previous[1]) * Math.PI) / 180;
    const longitudeDelta = ((point[0] - previous[0]) * Math.PI) / 180;
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
    return total + 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);
}

function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.round(meters)} m`;
  if (meters < 10_000) return `${(meters / 1_000).toFixed(2)} km`;
  return `${Math.round(meters / 1_000)} km`;
}

function getWaypointMarker(
  placeId: string,
  waypointOrder: MapCanvasProps["waypointOrder"],
): { kind: "origin" | "destination" | "stop"; label: string } | undefined {
  if (placeId === waypointOrder?.originId) return { kind: "origin", label: "A" };
  if (placeId === waypointOrder?.destinationId) {
    return { kind: "destination", label: "B" };
  }
  const stopIndex = waypointOrder?.stopIds.indexOf(placeId) ?? -1;
  return stopIndex >= 0
    ? { kind: "stop", label: String(stopIndex + 1) }
    : undefined;
}

function getAdaptiveMapPadding(forRoute = false) {
  if (typeof window === "undefined") {
    return { left: 440, right: 64, top: 64, bottom: 80 };
  }

  const panel = document.querySelector<HTMLElement>(
    '.map-panel[data-state="open"]',
  );
  const panelBounds = panel?.getBoundingClientRect();
  const isCompactLayout = window.innerWidth <= 860;

  if (isCompactLayout) {
    const visiblePanelHeight = panelBounds?.height;
    return {
      left: 28,
      right: 28,
      top: forRoute ? 64 : 88,
      bottom: visiblePanelHeight
        ? Math.min(
            Math.round(visiblePanelHeight + 92),
            Math.round(window.innerHeight * 0.72),
          )
        : 92,
    };
  }

  return {
    left: panelBounds ? Math.round(panelBounds.right + 32) : 64,
    right: 64,
    top: 56,
    bottom: forRoute ? 96 : 72,
  };
}

function removeRouteLayers(map: MapLibreMap) {
  const style = map.getStyle();
  style.layers
    ?.filter(
      (layer) =>
        layer.id.startsWith(ROUTE_LAYER_PREFIX) || layer.id === ROUTE_LABEL_LAYER,
    )
    .forEach((layer) => {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    });

  Object.keys(style.sources)
    .filter(
      (sourceId) =>
        sourceId.startsWith(ROUTE_SOURCE_PREFIX) || sourceId === ROUTE_LABEL_SOURCE,
    )
    .forEach((sourceId) => {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });
}
