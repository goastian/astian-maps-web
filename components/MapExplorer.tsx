"use client";

import type {
  AirQualitySnapshot,
  Coordinates,
  Place,
  Route,
  RouteAvoidance,
  RouteProfile,
  SupportedLocale,
} from "@astian-maps/contracts";
import { translate, type MessageKey } from "@astian-maps/i18n";
import {
  ArrowClockwise,
  ArrowRight,
  ArrowsDownUp,
  Bicycle,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  Car,
  Check,
  Clock,
  Compass,
  Crosshair,
  GlobeHemisphereWest,
  Gauge,
  List,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  Moon,
  NavigationArrow,
  PersonSimpleWalk,
  Plus,
  ShareNetwork,
  Sun,
  WarningCircle,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  calculateRoutes,
  getAirQuality,
  getConfig,
  isConnectivityError,
  nearbyPlaces,
  reverseGeocode,
  searchPlaces,
  type DataSource,
  type SearchFocus,
} from "../lib/api";
import type { MapTheme } from "../lib/map-style";
import {
  contextPanelReducer,
  initialContextPanelState,
  type ContextPanelView,
} from "../lib/context-panel";
import {
  defaultMapLayerSelection,
  parseStoredLayerSelection,
  type MapLayerSelection,
} from "../lib/map-layers";
import {
  createMobileRouteUrl,
  createRoutePlan,
  createWebRouteUrl,
  parseRoutePlan,
} from "../lib/route-links";
import {
  deserializeSavedPlaces,
  getSavedPlaceIds,
  removeSavedPlace,
  SAVED_PLACES_STORAGE_KEY,
  serializeSavedPlaces,
  upsertSavedPlace,
} from "../lib/saved-places";
import { configuredMapStart } from "../lib/map-start";
import { shellCopy } from "../lib/shell-copy";
import { CategoryIcon } from "./category-icon";
import { PlaceDetail } from "./PlaceDetail";

const MapCanvas = dynamic(
  () => import("./MapCanvas").then((module) => module.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="map-skeleton" role="status" aria-label="Cargando el mapa">
        <span />
      </div>
    ),
  },
);

type AsyncStatus = "idle" | "loading" | "success" | "error";
type ConnectionStatus = "online" | "offline" | "degraded" | "checking";
type SheetState = "compact" | "medium" | "expanded";
type WaypointTarget =
  | { kind: "origin" }
  | { kind: "destination" }
  | { kind: "stop"; index: number };
type SavedFeedback = {
  action: "saved" | "removed";
  place: Place;
};

const LOW_DATA_STORAGE_KEY = "astian-map-low-data";

const localeNames: Record<SupportedLocale, string> = {
  es: "ES",
  en: "EN",
  fr: "FR",
  de: "DE",
};

const quickCategories: Record<
  SupportedLocale,
  readonly { label: string; category: string }[]
> = {
  es: [
    { label: "Restaurantes", category: "restaurant" },
    { label: "Cafés", category: "cafe" },
    { label: "Supermercados", category: "groceries" },
    { label: "Tiendas", category: "shop" },
    { label: "Farmacias", category: "pharmacy" },
    { label: "Hoteles", category: "hotel" },
    { label: "Combustible", category: "fuel" },
    { label: "Cargadores", category: "charging_station" },
  ],
  en: [
    { label: "Restaurants", category: "restaurant" },
    { label: "Cafés", category: "cafe" },
    { label: "Groceries", category: "groceries" },
    { label: "Shops", category: "shop" },
    { label: "Pharmacies", category: "pharmacy" },
    { label: "Hotels", category: "hotel" },
    { label: "Fuel", category: "fuel" },
    { label: "Chargers", category: "charging_station" },
  ],
  fr: [
    { label: "Restaurants", category: "restaurant" },
    { label: "Cafés", category: "cafe" },
    { label: "Supermarchés", category: "groceries" },
    { label: "Commerces", category: "shop" },
    { label: "Pharmacies", category: "pharmacy" },
    { label: "Hôtels", category: "hotel" },
    { label: "Carburant", category: "fuel" },
    { label: "Bornes", category: "charging_station" },
  ],
  de: [
    { label: "Restaurants", category: "restaurant" },
    { label: "Cafés", category: "cafe" },
    { label: "Supermärkte", category: "groceries" },
    { label: "Geschäfte", category: "shop" },
    { label: "Apotheken", category: "pharmacy" },
    { label: "Hotels", category: "hotel" },
    { label: "Tankstellen", category: "fuel" },
    { label: "Ladestationen", category: "charging_station" },
  ],
};

const mapUiCopy: Record<SupportedLocale, {
  menu: string;
  road: string;
  satellite: string;
  terrain: string;
  cycling: string;
  airQuality: string;
  evChargers: string;
  buildings3d: string;
  evaluation: string;
  unavailable: string;
  measure: string;
  clearMeasure: string;
  fullscreen: string;
  resetNorth: string;
  contribute: string;
  mapData: string;
}> = {
  es: { menu: "Menú", road: "Carretera", satellite: "Satélite abierto", terrain: "Terreno", cycling: "Rutas ciclistas", airQuality: "Calidad del aire", evChargers: "Cargadores eléctricos", buildings3d: "Edificios 3D", evaluation: "Evaluación local", unavailable: "Preparando datos", measure: "Medir distancia", clearMeasure: "Borrar medición", fullscreen: "Pantalla completa", resetNorth: "Restablecer norte", contribute: "Contribuir a OpenStreetMap", mapData: "Datos y atribuciones" },
  en: { menu: "Menu", road: "Road", satellite: "Open satellite", terrain: "Terrain", cycling: "Cycling routes", airQuality: "Air quality", evChargers: "EV chargers", buildings3d: "3D buildings", evaluation: "Local evaluation", unavailable: "Data pipeline pending", measure: "Measure distance", clearMeasure: "Clear measurement", fullscreen: "Fullscreen", resetNorth: "Reset north", contribute: "Contribute to OpenStreetMap", mapData: "Data and attributions" },
  fr: { menu: "Menu", road: "Route", satellite: "Satellite ouverte", terrain: "Relief", cycling: "Itinéraires cyclables", airQuality: "Qualité de l’air", evChargers: "Bornes électriques", buildings3d: "Bâtiments 3D", evaluation: "Évaluation locale", unavailable: "Données en préparation", measure: "Mesurer une distance", clearMeasure: "Effacer la mesure", fullscreen: "Plein écran", resetNorth: "Réinitialiser le nord", contribute: "Contribuer à OpenStreetMap", mapData: "Données et attributions" },
  de: { menu: "Menü", road: "Straße", satellite: "Offenes Satellit", terrain: "Gelände", cycling: "Fahrradrouten", airQuality: "Luftqualität", evChargers: "E-Ladestationen", buildings3d: "3D-Gebäude", evaluation: "Lokale Erprobung", unavailable: "Daten werden vorbereitet", measure: "Entfernung messen", clearMeasure: "Messung löschen", fullscreen: "Vollbild", resetNorth: "Norden zurücksetzen", contribute: "Zu OpenStreetMap beitragen", mapData: "Daten und Quellen" },
};

const airQualityCopy: Record<SupportedLocale, {
  modeledCenter: string;
  loading: string;
  error: string;
  usAqi: string;
  pm25: string;
  noData: string;
  observed: string;
  source: string;
  levels: {
    good: string;
    moderate: string;
    sensitive: string;
    unhealthy: string;
    veryUnhealthy: string;
    hazardous: string;
    unknown: string;
  };
}> = {
  es: {
    modeledCenter: "Lectura modelada en el centro del mapa",
    loading: "Consultando calidad del aire…",
    error: "No se pudo obtener una lectura para este punto.",
    usAqi: "US AQI",
    pm25: "PM2.5",
    noData: "Sin dato",
    observed: "Modelo actualizado",
    source: "Fuente y modelo",
    levels: { good: "Buena", moderate: "Moderada", sensitive: "Riesgo para grupos sensibles", unhealthy: "Insalubre", veryUnhealthy: "Muy insalubre", hazardous: "Peligrosa", unknown: "Estado no disponible" },
  },
  en: {
    modeledCenter: "Modelled reading at the map centre",
    loading: "Checking air quality…",
    error: "A reading is not available for this point.",
    usAqi: "US AQI",
    pm25: "PM2.5",
    noData: "No data",
    observed: "Model updated",
    source: "Source and model",
    levels: { good: "Good", moderate: "Moderate", sensitive: "Risk for sensitive groups", unhealthy: "Unhealthy", veryUnhealthy: "Very unhealthy", hazardous: "Hazardous", unknown: "Status unavailable" },
  },
  fr: {
    modeledCenter: "Lecture modélisée au centre de la carte",
    loading: "Consultation de la qualité de l’air…",
    error: "Aucune lecture n’est disponible pour ce point.",
    usAqi: "US AQI",
    pm25: "PM2.5",
    noData: "Aucune donnée",
    observed: "Modèle actualisé",
    source: "Source et modèle",
    levels: { good: "Bonne", moderate: "Modérée", sensitive: "Risque pour les groupes sensibles", unhealthy: "Mauvaise", veryUnhealthy: "Très mauvaise", hazardous: "Dangereuse", unknown: "État indisponible" },
  },
  de: {
    modeledCenter: "Modellierter Messwert in der Kartenmitte",
    loading: "Luftqualität wird abgerufen…",
    error: "Für diesen Punkt ist kein Messwert verfügbar.",
    usAqi: "US AQI",
    pm25: "PM2.5",
    noData: "Keine Daten",
    observed: "Modell aktualisiert",
    source: "Quelle und Modell",
    levels: { good: "Gut", moderate: "Mäßig", sensitive: "Risiko für empfindliche Gruppen", unhealthy: "Ungesund", veryUnhealthy: "Sehr ungesund", hazardous: "Gefährlich", unknown: "Status nicht verfügbar" },
  },
};

const connectivityCopy: Record<SupportedLocale, {
  lowData: string;
  lowDataHint: string;
  lowDataActive: string;
  offlineTitle: string;
  offlineHint: string;
  degradedTitle: string;
  degradedHint: string;
  checking: string;
  retry: string;
  recovered: string;
  openAndroid: string;
  mobileHint: string;
}> = {
  es: {
    lowData: "Ahorro de datos",
    lowDataHint: "Menos resultados, capas opcionales pausadas y una sola alternativa.",
    lowDataActive: "Ahorro de datos activo: las capas opcionales están pausadas.",
    offlineTitle: "Estás sin conexión",
    offlineHint: "Tu plan permanece visible. Reconecta y vuelve a intentar para actualizarlo.",
    degradedTitle: "No pudimos conectar con el servicio de mapas",
    degradedHint: "Comprueba la red o reintenta; no descartamos tu ruta.",
    checking: "Comprobando conexión…",
    retry: "Reintentar",
    recovered: "Conexión recuperada",
    openAndroid: "Continuar en Android",
    mobileHint: "Abre el mismo plan, paradas y preferencias en la app.",
  },
  en: {
    lowData: "Data saver",
    lowDataHint: "Fewer results, paused optional layers and one route alternative.",
    lowDataActive: "Data saver is active: optional layers are paused.",
    offlineTitle: "You are offline",
    offlineHint: "Your plan stays visible. Reconnect and retry to refresh it.",
    degradedTitle: "We could not reach the maps service",
    degradedHint: "Check your network or retry; your route has not been discarded.",
    checking: "Checking connection…",
    retry: "Retry",
    recovered: "Connection restored",
    openAndroid: "Continue on Android",
    mobileHint: "Open the same plan, stops and preferences in the app.",
  },
  fr: {
    lowData: "Économie de données",
    lowDataHint: "Moins de résultats, calques facultatifs en pause et un seul trajet.",
    lowDataActive: "Économie de données active : les calques facultatifs sont en pause.",
    offlineTitle: "Vous êtes hors connexion",
    offlineHint: "Votre trajet reste visible. Reconnectez-vous puis réessayez.",
    degradedTitle: "Le service cartographique est inaccessible",
    degradedHint: "Vérifiez le réseau ou réessayez ; votre trajet est conservé.",
    checking: "Vérification de la connexion…",
    retry: "Réessayer",
    recovered: "Connexion rétablie",
    openAndroid: "Continuer sur Android",
    mobileHint: "Ouvrez le même trajet, les étapes et les préférences dans l’application.",
  },
  de: {
    lowData: "Datensparmodus",
    lowDataHint: "Weniger Ergebnisse, pausierte Zusatzebenen und eine Routenalternative.",
    lowDataActive: "Datensparmodus aktiv: Zusatzebenen sind pausiert.",
    offlineTitle: "Sie sind offline",
    offlineHint: "Ihre Route bleibt sichtbar. Verbinden Sie sich und versuchen Sie es erneut.",
    degradedTitle: "Der Kartendienst ist nicht erreichbar",
    degradedHint: "Prüfen Sie das Netzwerk oder versuchen Sie es erneut; Ihre Route bleibt erhalten.",
    checking: "Verbindung wird geprüft…",
    retry: "Erneut versuchen",
    recovered: "Verbindung wiederhergestellt",
    openAndroid: "Auf Android fortsetzen",
    mobileHint: "Öffnet denselben Plan mit Zwischenstopps und Einstellungen in der App.",
  },
};

const profileIcons = {
  driving: Car,
  cycling: Bicycle,
  walking: PersonSimpleWalk,
} as const;

export function MapExplorer() {
  const [locale, setLocale] = useState<SupportedLocale>("es");
  const [theme, setTheme] = useState<MapTheme>("light");
  const [layerSelection, setLayerSelection] = useState<MapLayerSelection>(
    defaultMapLayerSelection,
  );
  const [contextPanel, dispatchContextPanel] = useReducer(
    contextPanelReducer,
    initialContextPanelState,
  );
  const { view, open: panelOpen } = contextPanel;
  const [sheetState, setSheetState] = useState<SheetState>("medium");
  const [menuOpen, setMenuOpen] = useState(false);
  const [markPointMode, setMarkPointMode] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<{
    label: string;
    category: string;
  }>();
  const [results, setResults] = useState<Place[]>([]);
  const [chargerPlaces, setChargerPlaces] = useState<Place[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualitySnapshot>();
  const [airQualityStatus, setAirQualityStatus] =
    useState<AsyncStatus>("idle");
  const [selectedPlace, setSelectedPlace] = useState<Place>();
  const [searchStatus, setSearchStatus] = useState<AsyncStatus>("idle");
  const [routeStatus, setRouteStatus] = useState<AsyncStatus>("idle");
  const [reverseStatus, setReverseStatus] = useState<AsyncStatus>("idle");
  const [dataSource, setDataSource] = useState<DataSource>("live");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("online");
  const [connectionRecovered, setConnectionRecovered] = useState(false);
  const [lowDataMode, setLowDataMode] = useState(false);
  const [urlStateReady, setUrlStateReady] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [unresolvedLegacySavedIds, setUnresolvedLegacySavedIds] = useState<
    string[]
  >([]);
  const [savedFeedback, setSavedFeedback] = useState<SavedFeedback>();
  const [origin, setOrigin] = useState<Place>();
  const [destination, setDestination] = useState<Place>();
  const [stops, setStops] = useState<Array<Place | undefined>>([]);
  const [mapSelectionTarget, setMapSelectionTarget] =
    useState<WaypointTarget>();
  const [mapFocus, setMapFocus] = useState<SearchFocus>({
    latitude: configuredMapStart?.latitude ?? 20,
    longitude: configuredMapStart?.longitude ?? 0,
  });
  const [profile, setProfile] = useState<RouteProfile>("driving");
  const [avoid, setAvoid] = useState<RouteAvoidance>({});
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>();
  const [shareStatus, setShareStatus] = useState<"idle" | "shared">("idle");
  const [locationError, setLocationError] = useState(false);
  const [enrichmentEnabled, setEnrichmentEnabled] = useState(false);
  const [liveTrafficEnabled, setLiveTrafficEnabled] = useState(false);
  const [incidentsEnabled, setIncidentsEnabled] = useState(false);
  const [runtimeMap, setRuntimeMap] = useState<{
    styleUrl: string;
    dataUpdatedAt: string;
  }>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const panelContentRef = useRef<HTMLDivElement>(null);
  const panelScrollPositionRef = useRef(0);
  const searchSequenceRef = useRef(0);
  const airQualitySequenceRef = useRef(0);
  const [airQualityRetryTick, setAirQualityRetryTick] = useState(0);
  const reverseSequenceRef = useRef(0);
  const routeSequenceRef = useRef(0);
  const networkRetryRef = useRef<(() => void | Promise<void>) | undefined>(undefined);
  const routeEntryPlaceRef = useRef<Place | undefined>(undefined);
  const routeEntryViewRef = useRef<ContextPanelView>("explore");

  const t = useCallback(
    (key: MessageKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale],
  );

  const selectedRoute =
    routes.find((route) => route.id === selectedRouteId) ?? routes[0];
  const shareableRoutePlan = useMemo(() => {
    if (!origin || !destination) return undefined;
    return createRoutePlan({
      origin,
      destination,
      stops,
      profile,
      avoid,
      preferences: {
        locale,
        theme,
        layerSelection,
        lowData: lowDataMode,
      },
    });
  }, [avoid, destination, layerSelection, locale, lowDataMode, origin, profile, stops, theme]);
  const mobileRouteUrl = useMemo(
    () => shareableRoutePlan ? createMobileRouteUrl(shareableRoutePlan) : undefined,
    [shareableRoutePlan],
  );
  const savedIds = useMemo(
    () =>
      getSavedPlaceIds({
        places: savedPlaces,
        unresolvedLegacyIds: unresolvedLegacySavedIds,
      }),
    [savedPlaces, unresolvedLegacySavedIds],
  );
  const contextualPlaces =
    view === "route"
      ? [origin, ...stops, destination].filter(
          (place): place is Place => place !== undefined,
        )
      : results;
  const mapPlaces = dedupePlaces([
    ...contextualPlaces,
    ...(!lowDataMode && layerSelection.overlays.evChargers ? chargerPlaces : []),
  ]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("astian-map-theme");
    const savedLocale = window.localStorage.getItem("astian-map-locale");
    const storedLayers = parseStoredLayerSelection(
      window.localStorage.getItem("astian-map-layers"),
    );
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const storedLowData = window.localStorage.getItem(LOW_DATA_STORAGE_KEY);
    const sharedPlan = parseRoutePlan(window.location.search);

    setLayerSelection(sharedPlan?.preferences.layerSelection ?? storedLayers);
    setTheme(
      sharedPlan?.preferences.theme ??
        (savedTheme === "light" || savedTheme === "dark"
          ? savedTheme
          : prefersDark
            ? "dark"
            : "light"),
    );
    setLocale(
      sharedPlan?.preferences.locale ??
        (["es", "en", "fr", "de"].includes(savedLocale ?? "")
          ? (savedLocale as SupportedLocale)
          : "es"),
    );
    setLowDataMode(
      sharedPlan?.preferences.lowData ??
        (storedLowData === "1" || (storedLowData === null && connection?.saveData === true)),
    );
    setConnectionStatus(navigator.onLine ? "online" : "offline");

    if (sharedPlan) {
      setOrigin(sharedPlan.origin);
      setDestination(sharedPlan.destination);
      setStops(sharedPlan.stops);
      setSelectedPlace(sharedPlan.destination);
      setMapFocus(sharedPlan.destination.coordinates);
      setProfile(sharedPlan.profile);
      setAvoid(sharedPlan.avoid);
      dispatchContextPanel({ type: "open-route" });
    }
    setUrlStateReady(true);
  }, []);

  useEffect(() => {
    if (!urlStateReady) return;
    window.localStorage.setItem("astian-map-layers", JSON.stringify(layerSelection));
    window.localStorage.setItem("astian-map-theme", theme);
    window.localStorage.setItem("astian-map-locale", locale);
    window.localStorage.setItem(LOW_DATA_STORAGE_KEY, lowDataMode ? "1" : "0");
  }, [layerSelection, locale, lowDataMode, theme, urlStateReady]);

  useEffect(() => {
    if (!urlStateReady) return;
    if (!shareableRoutePlan) {
      const current = new URL(window.location.href);
      if (current.pathname === "/route" && current.searchParams.has("from")) {
        window.history.replaceState(window.history.state, "", "/route");
      }
      return;
    }
    const routeUrl = new URL(
      createWebRouteUrl(shareableRoutePlan, window.location.origin),
    );
    const nextLocation = `${routeUrl.pathname}${routeUrl.search}`;
    if (`${window.location.pathname}${window.location.search}` !== nextLocation) {
      window.history.replaceState(window.history.state, "", nextLocation);
    }
  }, [shareableRoutePlan, urlStateReady]);

  useEffect(() => {
    if (lowDataMode || !layerSelection.overlays.evChargers) {
      setChargerPlaces([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      void nearbyPlaces("charging_station", locale, mapFocus)
        .then((response) => setChargerPlaces(response.data))
        .catch(() => setChargerPlaces([]));
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [
    layerSelection.overlays.evChargers,
    locale,
    lowDataMode,
    mapFocus.latitude,
    mapFocus.longitude,
  ]);

  useEffect(() => {
    const requestSequence = ++airQualitySequenceRef.current;
    if (lowDataMode || !layerSelection.overlays.airQuality) {
      setAirQuality(undefined);
      setAirQualityStatus("idle");
      return;
    }

    setAirQuality(undefined);
    setAirQualityStatus("loading");
    const timeout = window.setTimeout(() => {
      void getAirQuality(mapFocus)
        .then((response) => {
          if (requestSequence !== airQualitySequenceRef.current) return;
          setAirQuality(response.data);
          setAirQualityStatus("success");
        })
        .catch(() => {
          if (requestSequence !== airQualitySequenceRef.current) return;
          setAirQuality(undefined);
          setAirQualityStatus("error");
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    layerSelection.overlays.airQuality,
    lowDataMode,
    mapFocus.latitude,
    mapFocus.longitude,
    airQualityRetryTick,
  ]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const checkConnection = useCallback(async (announceRecovery = false) => {
    if (!navigator.onLine) {
      setConnectionStatus("offline");
      setDataSource("offline");
      return false;
    }
    setConnectionStatus("checking");
    try {
      const config = await getConfig();
      setRuntimeMap({
        styleUrl: config.map.styleUrl,
        dataUpdatedAt: config.map.dataUpdatedAt,
      });
      setEnrichmentEnabled(config.features.placeEnrichment === true);
      setLiveTrafficEnabled(config.features.liveTraffic === true);
      setIncidentsEnabled(config.features.incidents === true);
      setDataSource("live");
      setConnectionStatus("online");
      if (announceRecovery) setConnectionRecovered(true);
      return true;
    } catch {
      setDataSource("offline");
      setConnectionStatus(navigator.onLine ? "degraded" : "offline");
      return false;
    }
  }, []);

  useEffect(() => {
    void checkConnection(false);
  }, [checkConnection]);

  useEffect(() => {
    const handleOffline = () => {
      searchSequenceRef.current += 1;
      airQualitySequenceRef.current += 1;
      reverseSequenceRef.current += 1;
      routeSequenceRef.current += 1;
      setSearchStatus((status) => status === "loading" ? "error" : status);
      setRouteStatus((status) => status === "loading" ? "error" : status);
      setReverseStatus("idle");
      setAirQualityStatus((status) => status === "loading" ? "error" : status);
      setConnectionStatus("offline");
      setDataSource("offline");
    };
    const handleOnline = () => void checkConnection(true);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [checkConnection]);

  useEffect(() => {
    if (!connectionRecovered) return;
    const timeout = window.setTimeout(() => setConnectionRecovered(false), 3_000);
    return () => window.clearTimeout(timeout);
  }, [connectionRecovered]);

  const markRequestFailure = useCallback(() => {
    setDataSource("offline");
    setConnectionStatus(navigator.onLine ? "degraded" : "offline");
  }, []);

  const changeTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem("astian-map-theme", next);
  };

  const changeLocale = (next: SupportedLocale) => {
    setLocale(next);
    window.localStorage.setItem("astian-map-locale", next);
  };

  const runSearch = async (searchQuery = query) => {
    const requestSequence = ++searchSequenceRef.current;
    if (!searchQuery.trim()) {
      if (activeCategory) return;
      setResults([]);
      setSelectedPlace(undefined);
      setSearchStatus("idle");
      return;
    }
    dispatchContextPanel({ type: "open-explore" });
    setSheetState("medium");
    setActiveCategory(undefined);
    setSearchStatus("loading");
    try {
      const response = await searchPlaces(searchQuery.trim(), locale, mapFocus, {
        lowData: lowDataMode,
      });
      if (requestSequence !== searchSequenceRef.current) return;
      setDataSource(response.source);
      setConnectionStatus("online");
      setResults(response.data);
      setSelectedPlace(undefined);
      setSearchStatus("success");
      networkRetryRef.current = undefined;
    } catch (error) {
      if (requestSequence !== searchSequenceRef.current) return;
      setResults([]);
      if (isConnectivityError(error)) {
        markRequestFailure();
        networkRetryRef.current = () => runSearch(searchQuery);
      }
      setSearchStatus("error");
    }
  };

  const runNearby = async (category: { label: string; category: string }) => {
    const requestSequence = ++searchSequenceRef.current;
    dispatchContextPanel({ type: "open-explore" });
    setSheetState("medium");
    setActiveCategory(category);
    setSearchStatus("loading");
    try {
      const response = await nearbyPlaces(category.category, locale, mapFocus, {
        lowData: lowDataMode,
      });
      if (requestSequence !== searchSequenceRef.current) return;
      setDataSource(response.source);
      setConnectionStatus("online");
      setResults(response.data);
      setSelectedPlace(undefined);
      setSearchStatus("success");
      networkRetryRef.current = undefined;
    } catch (error) {
      if (requestSequence !== searchSequenceRef.current) return;
      setResults([]);
      setSelectedPlace(undefined);
      if (isConnectivityError(error)) {
        markRequestFailure();
        networkRetryRef.current = () => runNearby(category);
      }
      setSearchStatus("error");
    }
  };

  useEffect(() => {
    const normalizedQuery = query.trim();
    const minimumLength = lowDataMode ? 3 : 2;
    if (normalizedQuery.length < minimumLength) {
      if (!normalizedQuery && activeCategory) return;
      searchSequenceRef.current += 1;
      if (!normalizedQuery) {
        setResults([]);
        setSelectedPlace(undefined);
        setSearchStatus("idle");
      }
      return;
    }
    const timeout = window.setTimeout(
      () => void runSearch(normalizedQuery),
      lowDataMode ? 900 : 350,
    );
    return () => window.clearTimeout(timeout);
    // Search is deliberately driven by text and language, not every map movement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, locale, lowDataMode, query]);

  const selectPlace = useCallback(
    (place: Place) => {
      panelScrollPositionRef.current = panelContentRef.current?.scrollTop ?? 0;
      setSelectedPlace(place);
      dispatchContextPanel({
        type:
          view === "route"
            ? "open-route"
            : view === "saved"
              ? "open-saved"
              : "open-explore",
      });
      setSheetState(view === "route" ? "expanded" : "medium");
      window.setTimeout(() => {
        if (panelContentRef.current) panelContentRef.current.scrollTop = 0;
        panelContentRef.current
          ?.querySelector<HTMLButtonElement>(".panel-back")
          ?.focus();
      }, 0);
    },
    [view],
  );

  const returnFromPlace = useCallback(() => {
    const placeId = selectedPlace?.id;
    setSelectedPlace(undefined);
    window.setTimeout(() => {
      if (panelContentRef.current) {
        panelContentRef.current.scrollTop = panelScrollPositionRef.current;
      }
      const matchingButton = Array.from(
        panelContentRef.current?.querySelectorAll<HTMLButtonElement>(
          "[data-place-id]",
        ) ?? [],
      ).find((button) => button.dataset.placeId === placeId);
      (matchingButton ?? panelContentRef.current)?.focus();
    }, 0);
  }, [selectedPlace?.id]);

  const showDirections = (place: Place) => {
    routeEntryPlaceRef.current = place;
    routeEntryViewRef.current = view === "saved" ? "saved" : "explore";
    setDestination(place);
    if (!origin) setMapSelectionTarget({ kind: "origin" });
    dispatchContextPanel({ type: "open-route" });
    setSheetState("expanded");
    setRoutes([]);
    setRouteStatus("idle");
  };

  const assignWaypoint = useCallback((target: WaypointTarget, place: Place) => {
    if (target.kind === "origin") {
      setOrigin(place);
      setMapSelectionTarget({ kind: "destination" });
    } else if (target.kind === "destination") {
      setDestination(place);
      setMapSelectionTarget(undefined);
    } else {
      setStops((current) =>
        current.map((stop, index) => (index === target.index ? place : stop)),
      );
      setMapSelectionTarget(undefined);
    }
    setRoutes([]);
    setRouteStatus("idle");
  }, []);

  const selectPointOnMap = useCallback(
    async (coordinates: Coordinates) => {
      const requestSequence = ++reverseSequenceRef.current;
      const target =
        mapSelectionTarget ??
        (view === "route"
          ? !origin
            ? { kind: "origin" as const }
            : !destination
              ? { kind: "destination" as const }
              : undefined
          : undefined);
      if (view === "route" && !target) return;
      setReverseStatus("loading");
      let place: Place;
      try {
        const response = await reverseGeocode(
          coordinates.latitude,
          coordinates.longitude,
          locale,
        );
        if (requestSequence !== reverseSequenceRef.current) return;
        place = response.data;
        setDataSource(response.source);
        setConnectionStatus("online");
      } catch (error) {
        if (requestSequence !== reverseSequenceRef.current) return;
        place = createCoordinatePlace(coordinates, t("map.selectedPoint"));
        if (isConnectivityError(error)) markRequestFailure();
      }
      setReverseStatus("success");
      setMarkPointMode(false);
      setSelectedPlace(place);
      if (target) {
        assignWaypoint(target, place);
        dispatchContextPanel({ type: "open-route" });
        setSheetState("expanded");
      } else {
        setResults([place]);
        dispatchContextPanel({ type: "open-explore" });
        setSheetState("medium");
      }
    },
    [
      assignWaypoint,
      destination,
      locale,
      mapSelectionTarget,
      markRequestFailure,
      origin,
      t,
      view,
    ],
  );

  const selectionHint = mapSelectionTarget
    ? mapSelectionTarget.kind === "origin"
      ? t("route.selectOriginHint")
      : mapSelectionTarget.kind === "destination"
        ? t("route.selectDestinationHint")
        : t("route.selectStopHint")
    : markPointMode
      ? t("map.markPointHint")
      : view === "route" && !origin
      ? t("route.selectOriginHint")
      : view === "route" && !destination
        ? t("route.selectDestinationHint")
        : undefined;

  const applySavedSnapshot = useCallback(
    (snapshot: {
      places: Place[];
      unresolvedLegacyIds: string[];
    }) => {
      setSavedPlaces(snapshot.places);
      setUnresolvedLegacySavedIds(snapshot.unresolvedLegacyIds);
      window.localStorage.setItem(
        SAVED_PLACES_STORAGE_KEY,
        serializeSavedPlaces(snapshot),
      );
    },
    [],
  );

  const toggleSaved = useCallback(
    (place: Place) => {
      const snapshot = {
        places: savedPlaces,
        unresolvedLegacyIds: unresolvedLegacySavedIds,
      };
      const removing = savedIds.has(place.id);
      const next = removing
        ? removeSavedPlace(snapshot, place.id)
        : upsertSavedPlace(snapshot, place);
      applySavedSnapshot(next);
      setSavedFeedback({ action: removing ? "removed" : "saved", place });
    },
    [applySavedSnapshot, savedIds, savedPlaces, unresolvedLegacySavedIds],
  );

  const undoSavedChange = useCallback(() => {
    if (!savedFeedback) return;
    const snapshot = {
      places: savedPlaces,
      unresolvedLegacyIds: unresolvedLegacySavedIds,
    };
    const next =
      savedFeedback.action === "saved"
        ? removeSavedPlace(snapshot, savedFeedback.place.id)
        : upsertSavedPlace(snapshot, savedFeedback.place);
    applySavedSnapshot(next);
    setSavedFeedback(undefined);
  }, [
    applySavedSnapshot,
    savedFeedback,
    savedPlaces,
    unresolvedLegacySavedIds,
  ]);

  useEffect(() => {
    const saved = deserializeSavedPlaces(
      window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY),
    );
    setSavedPlaces(saved.places);
    setUnresolvedLegacySavedIds(saved.unresolvedLegacyIds);
  }, []);

  useEffect(() => {
    if (!savedFeedback) return;
    const timeout = window.setTimeout(() => setSavedFeedback(undefined), 5_000);
    return () => window.clearTimeout(timeout);
  }, [savedFeedback]);

  const runRoute = useCallback(async () => {
    if (!origin || !destination) {
      setRouteStatus("error");
      return;
    }
    const requestSequence = ++routeSequenceRef.current;
    setRouteStatus("loading");
    try {
      const response = await calculateRoutes({
        waypoints: [origin, ...stops, destination]
          .filter((place): place is Place => place !== undefined)
          .map((place) => ({
            coordinates: place.coordinates,
            label: place.name,
            placeId: place.id,
          })),
        profile,
        language: locale,
        alternatives: lowDataMode ? 1 : 3,
        avoid,
      });
      if (requestSequence !== routeSequenceRef.current) return;
      setDataSource(response.source);
      setConnectionStatus("online");
      setRoutes(response.data.routes);
      setSelectedRouteId(response.data.routes[0]?.id);
      setRouteStatus(response.data.routes.length > 0 ? "success" : "error");
      networkRetryRef.current = undefined;
    } catch (error) {
      if (requestSequence !== routeSequenceRef.current) return;
      if (isConnectivityError(error)) {
        markRequestFailure();
        networkRetryRef.current = () => runRoute();
      }
      setRouteStatus("error");
    }
  }, [
    avoid,
    destination,
    locale,
    lowDataMode,
    markRequestFailure,
    origin,
    profile,
    stops,
  ]);

  const hadRoutesRef = useRef(false);
  useEffect(() => {
    const hasRoutes = routes.length > 0;
    if (hasRoutes && !hadRoutesRef.current && window.innerWidth <= 860) {
      setSheetState("medium");
    }
    hadRoutesRef.current = hasRoutes;
  }, [routes]);

  useEffect(() => {
    if (
      lowDataMode ||
      connectionStatus !== "online" ||
      !origin ||
      !destination ||
      stops.some((stop) => !stop)
    ) return;
    const timeout = window.setTimeout(() => void runRoute(), 260);
    return () => {
      window.clearTimeout(timeout);
      routeSequenceRef.current += 1;
    };
  }, [connectionStatus, destination, lowDataMode, origin, runRoute, stops]);

  const retryAfterNetworkFailure = useCallback(async () => {
    const recovered = await checkConnection(true);
    if (!recovered) return;
    const retry = networkRetryRef.current;
    networkRetryRef.current = undefined;
    await retry?.();
  }, [checkConnection]);

  const locate = (stayInRoute = false) => {
    setLocationError(false);
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const currentLocation: Place = {
          id: "local:current-location",
          source: "openstreetmap",
          name: t("map.locate"),
          category: { id: "location", label: t("map.locate") },
          coordinates: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
          attribution: [],
        };
        setOrigin(currentLocation);
        setSelectedPlace(currentLocation);
        if (stayInRoute) {
          dispatchContextPanel({ type: "open-route" });
          setSheetState("expanded");
          setMapSelectionTarget(
            destination ? undefined : { kind: "destination" },
          );
          setRoutes([]);
          setSelectedRouteId(undefined);
          setRouteStatus("idle");
        } else {
          setResults((current) => [
            currentLocation,
            ...current.filter((place) => place.id !== currentLocation.id),
          ]);
          dispatchContextPanel({ type: "open-explore" });
          setSheetState("medium");
        }
      },
      () => setLocationError(true),
      {
        enableHighAccuracy: !lowDataMode,
        timeout: 8_000,
        maximumAge: lowDataMode ? 300_000 : 30_000,
      },
    );
  };

  const shareRoute = async () => {
    if (!shareableRoutePlan) return;
    const shareOrigin =
      process.env.NEXT_PUBLIC_MAPS_WEB_URL ?? window.location.origin;
    const url = new URL(createWebRouteUrl(shareableRoutePlan, shareOrigin));
    const localUrl = new URL(createWebRouteUrl(shareableRoutePlan, window.location.origin));
    window.history.replaceState(
      window.history.state,
      "",
      `${localUrl.pathname}${localUrl.search}`,
    );
    try {
      if (navigator.share) {
        await navigator.share({ title: t("route.title"), url: url.toString() });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url.toString());
      } else {
        throw new Error("Web Share and Clipboard APIs are unavailable");
      }
      setShareStatus("shared");
      window.setTimeout(() => setShareStatus("idle"), 2_000);
    } catch {
      setShareStatus("idle");
    }
  };

  const addStop = () => {
    if (stops.length >= 8) return;
    const index = stops.length;
    setStops((current) => [...current, undefined]);
    setMapSelectionTarget({ kind: "stop", index });
    setRoutes([]);
    setSelectedRouteId(undefined);
    setRouteStatus("idle");
  };

  const invalidateRoutes = useCallback(() => {
    setRoutes([]);
    setSelectedRouteId(undefined);
    setRouteStatus("idle");
  }, []);

  const resetContext = useCallback(() => {
    searchSequenceRef.current += 1;
    reverseSequenceRef.current += 1;
    routeSequenceRef.current += 1;
    routeEntryPlaceRef.current = undefined;
    routeEntryViewRef.current = "explore";
    setMarkPointMode(false);
    setQuery("");
    setActiveCategory(undefined);
    setResults([]);
    setSelectedPlace(undefined);
    setSearchStatus("idle");
    setReverseStatus("idle");
    setOrigin(undefined);
    setDestination(undefined);
    setStops([]);
    setMapSelectionTarget(undefined);
    setRoutes([]);
    setSelectedRouteId(undefined);
    setRouteStatus("idle");
    setShareStatus("idle");
    setSheetState("medium");
    dispatchContextPanel({ type: "reset" });

    const url = new URL(window.location.href);
    url.pathname = "/";
    url.search = "";
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const closeContext = useCallback(() => {
    reverseSequenceRef.current += 1;
    routeSequenceRef.current += 1;
    setReverseStatus("idle");
    const previousPlace = routeEntryPlaceRef.current;
    if (view !== "route" || !previousPlace) {
      resetContext();
      return;
    }

    setOrigin(undefined);
    setDestination(undefined);
    setStops([]);
    setMapSelectionTarget(undefined);
    setRoutes([]);
    setSelectedRouteId(undefined);
    setRouteStatus("idle");
    setSelectedPlace(previousPlace);
    setSheetState("medium");
    routeEntryPlaceRef.current = undefined;
    dispatchContextPanel({
      type:
        routeEntryViewRef.current === "saved" ? "open-saved" : "open-explore",
    });
    routeEntryViewRef.current = "explore";

    const url = new URL(window.location.href);
    url.pathname = "/";
    url.search = "";
    window.history.replaceState(window.history.state, "", url);
  }, [resetContext, view]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  }, []);

  const openSavedPlaces = useCallback(() => {
    setMenuOpen(false);
    setSelectedPlace(undefined);
    dispatchContextPanel({ type: "open-saved" });
    setSheetState("medium");
    window.setTimeout(() => panelContentRef.current?.focus(), 0);
  }, []);

  const toggleMarkPointMode = useCallback(() => {
    setMapSelectionTarget(undefined);
    reverseSequenceRef.current += 1;
    setReverseStatus("idle");
    setMarkPointMode((active) => !active);
    if (!markPointMode) dispatchContextPanel({ type: "collapse" });
  }, [markPointMode]);

  useEffect(() => {
    if (!menuOpen) return;
    const frame = window.requestAnimationFrame(() => {
      drawerRef.current
        ?.querySelector<HTMLElement>(
          'button:not(:disabled), a[href], select:not(:disabled)',
        )
        ?.focus();
    });
    const handleDrawerKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], select:not(:disabled)',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDrawerKeyboard);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleDrawerKeyboard);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menuOpen) return;
      if (markPointMode) {
        event.preventDefault();
        reverseSequenceRef.current += 1;
        setReverseStatus("idle");
        setMarkPointMode(false);
        return;
      }
      if (mapSelectionTarget) {
        event.preventDefault();
        reverseSequenceRef.current += 1;
        setReverseStatus("idle");
        setMapSelectionTarget(undefined);
        return;
      }
      if (panelOpen) {
        event.preventDefault();
        dispatchContextPanel({ type: "collapse" });
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mapSelectionTarget, markPointMode, menuOpen, panelOpen]);

  const copy = shellCopy[locale];

  const openExplore = useCallback(() => {
    setMenuOpen(false);
    dispatchContextPanel({ type: "open-explore" });
    setSheetState("medium");
  }, []);

  const openRoutePanel = (toggle: boolean) => {
    if (toggle && view === "route" && panelOpen) {
      dispatchContextPanel({ type: "collapse" });
      return;
    }
    const nextDestination =
      view !== "route" && selectedPlace && !destination
        ? selectedPlace
        : destination;
    if (view !== "route") {
      routeEntryPlaceRef.current = selectedPlace;
      routeEntryViewRef.current = view === "saved" ? "saved" : "explore";
    }
    if (nextDestination !== destination) setDestination(nextDestination);
    dispatchContextPanel({ type: "open-route" });
    setSheetState("expanded");
    if (!origin) setMapSelectionTarget({ kind: "origin" });
    else if (!nextDestination) {
      setMapSelectionTarget({ kind: "destination" });
    } else {
      setMapSelectionTarget(undefined);
    }
  };

  const exploreNear = useCallback(() => {
    searchSequenceRef.current += 1;
    setQuery("");
    setActiveCategory(undefined);
    setResults([]);
    setSelectedPlace(undefined);
    setSearchStatus("idle");
    dispatchContextPanel({ type: "open-explore" });
    setSheetState("medium");
  }, []);

  const hasRestorableContext =
    view === "route" ||
    view === "saved" ||
    Boolean(query || activeCategory || results.length || selectedPlace);
  const contextPanelLabel =
    view === "route"
      ? t("route.title")
      : view === "saved" && !selectedPlace
        ? t("saved.title")
        : selectedPlace?.name ?? activeCategory?.label ?? t("search.results");
  const connectionCopy = connectivityCopy[locale];
  const connectionTitle =
    connectionStatus === "checking"
      ? connectionCopy.checking
      : connectionStatus === "offline"
        ? connectionCopy.offlineTitle
        : connectionCopy.degradedTitle;
  const connectionHint =
    connectionStatus === "offline"
      ? connectionCopy.offlineHint
      : connectionCopy.degradedHint;

  return (
    <main
      className="astian-app"
      data-theme={theme}
      data-panel-open={panelOpen}
      data-menu-open={menuOpen}
      data-sheet={sheetState}
      data-view={view}
    >
      <a
        className="skip-link"
        href={panelOpen ? "#map-panel-content" : "#map-content"}
      >
        {t("common.skipToContent")}
      </a>
      <MapCanvas
        theme={theme}
        locale={locale}
        styleUrl={runtimeMap?.styleUrl}
        layerSelection={layerSelection}
        lowDataMode={lowDataMode}
        airQuality={airQuality}
        airQualityStatus={airQualityStatus}
        places={mapPlaces}
        selectedPlace={selectedPlace}
        routes={routes}
        selectedRouteId={selectedRoute?.id}
        waypointOrder={{
          originId: origin?.id,
          destinationId: destination?.id,
          stopIds: stops
            .filter((stop): stop is Place => stop !== undefined)
            .map((stop) => stop.id),
        }}
        selectionHint={
          reverseStatus === "loading" ? t("map.identifyingPoint") : selectionHint
        }
        contextPanelOpen={panelOpen}
        liveTrafficEnabled={liveTrafficEnabled}
        incidentsEnabled={incidentsEnabled}
        labels={{
          loading: t("map.loading"),
          error: t("map.error"),
          retry: t("map.retry"),
          zoomIn: t("map.zoomIn"),
          zoomOut: t("map.zoomOut"),
          locate: t("map.locate"),
          layers: t("map.layers"),
          road: mapUiCopy[locale].road,
          satellite: mapUiCopy[locale].satellite,
          terrain: mapUiCopy[locale].terrain,
          cycling: mapUiCopy[locale].cycling,
          airQuality: mapUiCopy[locale].airQuality,
          airQualityModeledCenter: airQualityCopy[locale].modeledCenter,
          airQualityLoading: airQualityCopy[locale].loading,
          airQualityError: airQualityCopy[locale].error,
          airQualityRetry: connectionCopy.retry,
          airQualityUsAqi: airQualityCopy[locale].usAqi,
          airQualityPm25: airQualityCopy[locale].pm25,
          airQualityNoData: airQualityCopy[locale].noData,
          airQualityObserved: airQualityCopy[locale].observed,
          airQualitySource: airQualityCopy[locale].source,
          airQualityLevels: airQualityCopy[locale].levels,
          evChargers: mapUiCopy[locale].evChargers,
          buildings3d: mapUiCopy[locale].buildings3d,
          traffic: copy.traffic,
          trafficHint: copy.trafficHint,
          trafficFree: copy.trafficFree,
          trafficSlow: copy.trafficSlow,
          evaluation: mapUiCopy[locale].evaluation,
          unavailable: mapUiCopy[locale].unavailable,
          measure: mapUiCopy[locale].measure,
          clearMeasure: mapUiCopy[locale].clearMeasure,
          fullscreen: mapUiCopy[locale].fullscreen,
          resetNorth: mapUiCopy[locale].resetNorth,
          lowDataActive: connectionCopy.lowDataActive,
        }}
        onPlaceSelect={selectPlace}
        onMapSelect={selectPointOnMap}
        onViewChange={(next) =>
          setMapFocus((current) =>
            current.latitude === next.latitude &&
            current.longitude === next.longitude
              ? current
              : next,
          )
        }
        onLocate={() => locate(view === "route")}
        onLayerSelectionChange={setLayerSelection}
        onAirQualityRetry={() => setAirQualityRetryTick((tick) => tick + 1)}
      />

      <nav className="am-rail" aria-label={t("menu.title")}>
        <button
          type="button"
          className="am-rail-logo"
          onClick={resetContext}
          aria-label={t("app.name")}
          title={t("app.name")}
        >
          <img src="/icons/astian-maps.svg" alt="" width={36} height={36} />
        </button>
        <button
          type="button"
          className={view === "explore" && panelOpen ? "is-active" : ""}
          aria-current={view === "explore" && panelOpen ? "page" : undefined}
          onClick={openExplore}
        >
          <span>
            <Compass size={22} weight={view === "explore" && panelOpen ? "fill" : "regular"} aria-hidden="true" />
          </span>
          {copy.railExplore}
        </button>
        <button
          type="button"
          className={view === "route" && panelOpen ? "is-active" : ""}
          aria-current={view === "route" && panelOpen ? "page" : undefined}
          onClick={() => openRoutePanel(false)}
        >
          <span>
            <NavigationArrow size={22} weight={view === "route" && panelOpen ? "fill" : "regular"} aria-hidden="true" />
          </span>
          {copy.railRoutes}
        </button>
        <button
          type="button"
          className={view === "saved" && panelOpen ? "is-active" : ""}
          aria-current={view === "saved" && panelOpen ? "page" : undefined}
          onClick={openSavedPlaces}
        >
          <span>
            <BookmarkSimple size={22} weight={view === "saved" && panelOpen ? "fill" : "regular"} aria-hidden="true" />
            {savedPlaces.length > 0 && <i className="am-badge">{savedPlaces.length}</i>}
          </span>
          {copy.railSaved}
        </button>
        <button
          ref={menuButtonRef}
          type="button"
          className="am-rail-menu"
          onClick={() => setMenuOpen(true)}
          aria-label={t("menu.title")}
          aria-controls="astian-map-drawer"
          aria-expanded={menuOpen}
        >
          <span>
            <List size={22} aria-hidden="true" />
          </span>
          {copy.railSettings}
        </button>
      </nav>

      <header className="map-command-bar" aria-label={t("search.label")}>
        <button
          type="button"
          className="command-menu-trigger"
          onClick={() => setMenuOpen(true)}
          aria-label={t("menu.title")}
          aria-controls="astian-map-drawer"
          aria-expanded={menuOpen}
        >
          <List size={22} aria-hidden="true" />
        </button>

        <form
          className="command-search"
          onSubmit={(event) => {
            event.preventDefault();
            dispatchContextPanel({ type: "open-explore" });
            setSheetState("medium");
            void runSearch();
          }}
        >
          <label htmlFor="map-search" className="sr-only">
            {t("search.label")}
          </label>
          <input
            ref={searchInputRef}
            id="map-search"
            type="search"
            value={query}
            onChange={(event) => {
              setActiveCategory(undefined);
              setQuery(event.target.value);
              if (event.target.value) {
                setSelectedPlace(undefined);
                dispatchContextPanel({ type: "open-explore" });
                setSheetState("medium");
              } else {
                setResults([]);
                setSelectedPlace(undefined);
                setSearchStatus("idle");
                dispatchContextPanel({ type: "reset" });
              }
            }}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            enterKeyHint="search"
          />
          {(query || activeCategory) && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                resetContext();
                searchInputRef.current?.focus();
              }}
              aria-label={t("search.clear")}
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            className="search-submit"
            aria-label={t("search.submit")}
            title={t("search.submit")}
            disabled={searchStatus === "loading"}
          >
            <MagnifyingGlass size={22} aria-hidden="true" />
          </button>
        </form>

        <button
          type="button"
          className={`command-directions ${view === "route" && panelOpen ? "is-active" : ""}`}
          onClick={() => openRoutePanel(true)}
          aria-pressed={view === "route"}
          aria-expanded={view === "route" && panelOpen}
          aria-label={t("place.directions")}
          title={t("place.directions")}
        >
          <NavigationArrow size={22} weight="fill" aria-hidden="true" />
        </button>
      </header>

      {connectionStatus !== "online" && (
        <section
          className={`network-recovery-banner is-${connectionStatus}`}
          role={connectionStatus === "checking" ? "status" : "alert"}
          aria-live="polite"
        >
          {connectionStatus === "checking" ? (
            <ArrowClockwise className="network-spinner" size={21} aria-hidden="true" />
          ) : (
            <WifiSlash size={21} aria-hidden="true" />
          )}
          <span>
            <strong>{connectionTitle}</strong>
            {connectionStatus !== "checking" && <small>{connectionHint}</small>}
          </span>
          <button
            type="button"
            disabled={connectionStatus === "checking"}
            onClick={() => void retryAfterNetworkFailure()}
          >
            <ArrowClockwise size={17} weight="bold" aria-hidden="true" />
            {connectionCopy.retry}
          </button>
        </section>
      )}

      <nav
        className="map-quick-categories"
        aria-label={t("search.nearbyCategories")}
      >
        {view !== "route" && (
          <button
            type="button"
            className={`am-chip mark-point-chip ${markPointMode ? "is-active" : ""}`}
            onClick={toggleMarkPointMode}
            aria-pressed={markPointMode}
          >
            <Crosshair size={18} weight="bold" aria-hidden="true" />
            {markPointMode ? t("map.cancelMarkPoint") : t("map.markPoint")}
          </button>
        )}
        {view !== "saved" &&
          view !== "route" &&
          quickCategories[locale].map((category) => (
            <button
              key={category.category}
              type="button"
              className={`am-chip ${
                activeCategory?.category === category.category ? "is-active" : ""
              }`}
              onClick={() => void runNearby(category)}
            >
              <CategoryIcon categoryId={category.category} size={16} />
              {category.label}
            </button>
          ))}
      </nav>

      {menuOpen && (
        <div className="app-drawer-layer">
          <button
            type="button"
            className="app-drawer-scrim"
            onClick={closeMenu}
            aria-label={t("common.close")}
            tabIndex={-1}
          />
          <aside
            ref={drawerRef}
            className="app-drawer"
            id="astian-map-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="astian-map-drawer-title"
          >
            <header>
              <div className="drawer-brand">
                <img
                  className="brand-mark"
                  src="/icons/astian-maps.svg"
                  alt=""
                  width={40}
                  height={40}
                />
                <span>
                  <strong id="astian-map-drawer-title">{t("app.name")}</strong>
                  <small>{t("app.tagline")}</small>
                </span>
              </div>
              <button
                type="button"
                className="drawer-close"
                onClick={closeMenu}
                aria-label={t("common.close")}
              >
                <X size={20} weight="bold" aria-hidden="true" />
              </button>
            </header>

            <nav aria-label={t("menu.title")}>
              <section aria-labelledby="drawer-places-heading">
                <h2 id="drawer-places-heading">{t("menu.yourPlaces")}</h2>
                <button type="button" onClick={openSavedPlaces}>
                  <BookmarkSimple size={21} aria-hidden="true" />
                  <span>
                    <strong>{t("saved.title")}</strong>
                    <small>
                      {savedPlaces.length > 0
                        ? String(savedPlaces.length)
                        : t("saved.empty")}
                    </small>
                  </span>
                  <CaretRight size={18} aria-hidden="true" />
                </button>
              </section>

              <section aria-labelledby="drawer-preferences-heading">
                <h2 id="drawer-preferences-heading">{t("menu.preferences")}</h2>
                <button type="button" onClick={changeTheme}>
                  {theme === "light" ? (
                    <Moon size={21} aria-hidden="true" />
                  ) : (
                    <Sun size={21} aria-hidden="true" />
                  )}
                  <span>
                    <strong>{t("map.theme")}</strong>
                  </span>
                </button>
                <button
                  type="button"
                  className="drawer-data-saver"
                  aria-pressed={lowDataMode}
                  onClick={() => setLowDataMode((enabled) => !enabled)}
                >
                  <Gauge size={21} weight={lowDataMode ? "fill" : "regular"} aria-hidden="true" />
                  <span>
                    <strong>{connectionCopy.lowData}</strong>
                    <small>{connectionCopy.lowDataHint}</small>
                  </span>
                  <i className="preference-switch" aria-hidden="true">
                    <i />
                  </i>
                </button>
                <label className="drawer-language">
                  <GlobeHemisphereWest size={21} aria-hidden="true" />
                  <span>
                    <strong>{t("language.label")}</strong>
                  </span>
                  <select
                    value={locale}
                    onChange={(event) =>
                      changeLocale(event.target.value as SupportedLocale)
                    }
                    aria-label={t("language.label")}
                  >
                    {Object.entries(localeNames).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section aria-labelledby="drawer-open-map-heading">
                <h2 id="drawer-open-map-heading">{t("menu.openMap")}</h2>
                <a
                  href={`https://www.openstreetmap.org/edit?editor=id#map=16/${mapFocus.latitude.toFixed(5)}/${mapFocus.longitude.toFixed(5)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={21} aria-hidden="true" />
                  <span>
                    <strong>{mapUiCopy[locale].contribute}</strong>
                  </span>
                </a>
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ListBullets size={21} aria-hidden="true" />
                  <span>
                    <strong>{mapUiCopy[locale].mapData}</strong>
                  </span>
                </a>
              </section>
            </nav>
          </aside>
        </div>
      )}

      {!panelOpen && hasRestorableContext && (
        <button
          type="button"
          className="context-panel-reopen"
          onClick={() => {
            dispatchContextPanel({
              type:
                view === "route"
                  ? "open-route"
                  : view === "saved"
                    ? "open-saved"
                    : "open-explore",
            });
            setSheetState(view === "route" ? "expanded" : "medium");
          }}
          aria-label={t("panel.expand")}
        >
          <CaretRight size={20} weight="bold" aria-hidden="true" />
          <span>{contextPanelLabel}</span>
        </button>
      )}

      <aside
        className={`map-panel sheet-${sheetState}`}
        data-state={panelOpen ? "open" : "closed"}
        aria-label={contextPanelLabel}
        aria-hidden={!panelOpen}
        inert={!panelOpen}
      >
        <button
          type="button"
          className="sheet-grabber"
          onClick={() =>
            setSheetState((current) =>
              current === "compact"
                ? "medium"
                : current === "medium"
                  ? "expanded"
                  : "compact",
            )
          }
          aria-label={
            sheetState === "expanded" ? t("panel.collapse") : t("panel.expand")
          }
          aria-expanded={sheetState === "expanded"}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          className="am-panel-handle"
          onClick={() => dispatchContextPanel({ type: "collapse" })}
          aria-label={t("panel.collapse")}
          title={t("panel.collapse")}
        >
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
        </button>
        <header className="context-panel-header">
          <strong>{contextPanelLabel}</strong>
          <button
            type="button"
            className="context-panel-close"
            onClick={closeContext}
            aria-label={t("common.close")}
          >
            <X size={19} weight="bold" aria-hidden="true" />
          </button>
        </header>

        <div
          ref={panelContentRef}
          className="panel-content"
          id="map-panel-content"
          tabIndex={-1}
        >
          {view === "route" ? (
            <RoutePanel
              t={t}
              locale={locale}
              focus={mapFocus}
              origin={origin}
              destination={destination}
              stops={stops}
              profile={profile}
              avoid={avoid}
              routes={routes}
              selectedRoute={selectedRoute}
              routeStatus={routeStatus}
              shareStatus={shareStatus}
              lowDataMode={lowDataMode}
              mobileRouteUrl={mobileRouteUrl}
              continuityCopy={connectionCopy}
              activeTarget={mapSelectionTarget}
              onUseCurrentLocation={() => locate(true)}
              onSetOrigin={(place) => {
                setOrigin(place);
                if (place) setSelectedPlace(place);
                invalidateRoutes();
                if (place && !destination) {
                  setMapSelectionTarget({ kind: "destination" });
                } else if (!place) {
                  setMapSelectionTarget({ kind: "origin" });
                } else {
                  setMapSelectionTarget(undefined);
                }
              }}
              onSetDestination={(place) => {
                setDestination(place);
                if (place) setSelectedPlace(place);
                invalidateRoutes();
                setMapSelectionTarget(
                  place ? undefined : { kind: "destination" },
                );
              }}
              onSelectOnMap={setMapSelectionTarget}
              onSwap={() => {
                setOrigin(destination);
                setDestination(origin);
                setMapSelectionTarget(
                  !destination
                    ? { kind: "origin" }
                    : !origin
                      ? { kind: "destination" }
                      : undefined,
                );
                invalidateRoutes();
              }}
              onAddStop={addStop}
              onChangeStop={(index, place) => {
                setStops((current) =>
                  current.map((stop, stopIndex) =>
                    stopIndex === index ? place : stop,
                  ),
                );
                if (place) setSelectedPlace(place);
                invalidateRoutes();
              }}
              onRemoveStop={(index) => {
                setStops((current) =>
                  current.filter((_, stopIndex) => stopIndex !== index),
                );
                invalidateRoutes();
                setMapSelectionTarget(undefined);
              }}
              onSetProfile={(next) => {
                setProfile(next);
                invalidateRoutes();
              }}
              onSetAvoid={(next) => {
                setAvoid(next);
                invalidateRoutes();
              }}
              onCalculate={() => void runRoute()}
              onSelectRoute={setSelectedRouteId}
              onShare={() => void shareRoute()}
            />
          ) : view === "saved" && !selectedPlace ? (
            <SavedPanel
              t={t}
              locale={locale}
              places={savedPlaces}
              onSelect={selectPlace}
            />
          ) : (
            <ExplorePanel
              t={t}
              locale={locale}
              query={query}
              activeCategory={activeCategory}
              results={results}
              selectedPlace={selectedPlace}
              savedIds={savedIds}
              searchStatus={searchStatus}
              dataSource={dataSource}
              enrichmentEnabled={enrichmentEnabled}
              quickCategoryValues={quickCategories[locale]}
              onQuickSearch={(value) => {
                setQuery("");
                void runNearby(value);
              }}
              onSelect={selectPlace}
              onBack={returnFromPlace}
              onDirections={showDirections}
              onToggleSaved={toggleSaved}
              onNearby={exploreNear}
              onRetry={() => void runSearch()}
            />
          )}
        </div>
      </aside>

      {(locationError || shareStatus === "shared" || savedFeedback || connectionRecovered) && (
        <div
          className={`toast ${savedFeedback ? "toast-with-action" : ""}`}
          role="status"
          aria-live="polite"
        >
          {savedFeedback ? (
            <>
              <BookmarkSimple size={20} weight="fill" aria-hidden="true" />
              <span>
                {savedFeedback.action === "saved"
                  ? t("saved.confirmed")
                  : t("saved.removed")}
              </span>
              <button type="button" onClick={undoSavedChange}>
                {t("saved.undo")}
              </button>
            </>
          ) : locationError ? (
            <>
              <WarningCircle size={20} aria-hidden="true" />
              {t("navigation.permission")}
            </>
          ) : connectionRecovered ? (
            <>
              <Check size={20} weight="bold" aria-hidden="true" />
              {connectionCopy.recovered}
            </>
          ) : (
            <>
              <Check size={20} weight="bold" aria-hidden="true" />
              {t("route.shared")}
            </>
          )}
        </div>
      )}

      <nav className="mobile-nav" aria-label={t("menu.title")}>
        <button
          type="button"
          className={view === "explore" && panelOpen ? "is-active" : ""}
          onClick={openExplore}
          aria-current={view === "explore" && panelOpen ? "page" : undefined}
        >
          <span>
            <Compass size={24} weight={view === "explore" && panelOpen ? "fill" : "regular"} aria-hidden="true" />
          </span>
          {copy.railExplore}
        </button>
        <button
          type="button"
          className={view === "route" && panelOpen ? "is-active" : ""}
          onClick={() => openRoutePanel(false)}
          aria-current={view === "route" && panelOpen ? "page" : undefined}
        >
          <span>
            <NavigationArrow size={24} weight={view === "route" && panelOpen ? "fill" : "regular"} aria-hidden="true" />
          </span>
          {t("tabs.route")}
        </button>
        <button
          type="button"
          className={view === "saved" && panelOpen ? "is-active" : ""}
          onClick={openSavedPlaces}
          aria-current={view === "saved" && panelOpen ? "page" : undefined}
        >
          <span>
            <BookmarkSimple size={24} weight={view === "saved" && panelOpen ? "fill" : "regular"} aria-hidden="true" />
          </span>
          {t("tabs.saved")}
        </button>
      </nav>
    </main>
  );
}

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

interface ExplorePanelProps {
  t: Translator;
  locale: SupportedLocale;
  query: string;
  activeCategory?: { label: string; category: string };
  results: Place[];
  selectedPlace?: Place;
  savedIds: Set<string>;
  searchStatus: AsyncStatus;
  dataSource: DataSource;
  enrichmentEnabled: boolean;
  quickCategoryValues: readonly { label: string; category: string }[];
  onQuickSearch: (category: { label: string; category: string }) => void;
  onSelect: (place: Place) => void;
  onBack: () => void;
  onDirections: (place: Place) => void;
  onToggleSaved: (place: Place) => void;
  onNearby: (place: Place) => void;
  onRetry: () => void;
}

function ExplorePanel({
  t,
  locale,
  query,
  activeCategory,
  results,
  selectedPlace,
  savedIds,
  searchStatus,
  dataSource,
  enrichmentEnabled,
  quickCategoryValues,
  onQuickSearch,
  onSelect,
  onBack,
  onDirections,
  onToggleSaved,
  onNearby,
  onRetry,
}: ExplorePanelProps) {
  const hasSearchContext = Boolean(query || activeCategory);
  const copy = shellCopy[locale];

  if (selectedPlace) {
    return (
      <section className="explore-panel place-view" aria-label={selectedPlace.name}>
        <PlaceDetail
          t={t}
          locale={locale}
          place={selectedPlace}
          saved={savedIds.has(selectedPlace.id)}
          enrichmentEnabled={enrichmentEnabled}
          backLabel={results.length > 1 ? copy.backToResults : undefined}
          onBack={onBack}
          onDirections={onDirections}
          onToggleSaved={onToggleSaved}
          onNearby={onNearby}
        />
      </section>
    );
  }

  return (
    <section className="explore-panel" aria-label={t("search.label")}>
      {searchStatus === "idle" && results.length === 0 && !hasSearchContext && (
        <div className="am-explore">
          <h1>{copy.exploreTitle}</h1>
          <p>{copy.exploreHint}</p>
          <div className="am-category-grid" aria-label={t("search.nearbyCategories")}>
            {quickCategoryValues.map((category) => (
              <button
                key={category.category}
                type="button"
                onClick={() => onQuickSearch(category)}
              >
                <CategoryIcon categoryId={category.category} size={24} />
                <span>{category.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {searchStatus === "loading" && (
        <div className="results-skeleton" role="status">
          <span className="sr-only">{t("search.loading")}</span>
          {[0, 1, 2, 3].map((item) => (
            <i key={item} />
          ))}
        </div>
      )}

      {(searchStatus === "success" || searchStatus === "error") &&
        hasSearchContext &&
        results.length === 0 && (
        <div className="empty-state">
          <MagnifyingGlass size={28} aria-hidden="true" />
          <strong>
            {searchStatus === "error" ? t("search.error") : t("search.empty")}
          </strong>
          {searchStatus === "error" && (
            <button type="button" className="button-secondary" onClick={onRetry}>
              <ArrowClockwise size={17} weight="bold" aria-hidden="true" />
              {t("map.retry")}
            </button>
          )}
        </div>
      )}

      {searchStatus !== "loading" && results.length > 0 && (
        <>
          <div className="section-heading" aria-live="polite">
            <h1>
              {hasSearchContext
                ? (activeCategory?.label ?? t("search.results"))
                : t("search.recent")}
            </h1>
            <span>{copy.resultsCount(results.length)}</span>
          </div>

          {dataSource === "offline" && hasSearchContext && (
            <p className="inline-notice">
              <WarningCircle size={18} aria-hidden="true" />
              {t("search.error")}
            </p>
          )}

          <ul className="am-result-list">
            {results.map((place, index) => (
              <li key={place.id}>
                <PlaceResult
                  place={place}
                  index={index}
                  saved={savedIds.has(place.id)}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PlaceResult({
  place,
  index,
  saved,
  onSelect,
}: {
  place: Place;
  index?: number;
  saved?: boolean;
  onSelect: (place: Place) => void;
}) {
  const detail = [
    place.address?.road ?? place.address?.city,
    place.distanceMeters !== undefined
      ? formatResultDistance(place.distanceMeters)
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      className="am-result"
      data-place-id={place.id}
      onClick={() => onSelect(place)}
    >
      <span className="am-result-body">
        <strong>{place.name}</strong>
        <span className="am-result-meta">
          {saved && <BookmarkSimple size={14} weight="fill" aria-hidden="true" />}
          {place.category.label}
        </span>
        {detail && <span className="am-result-sub">{detail}</span>}
        {place.openingHours && (
          <span className="am-result-hours">
            <Clock size={13} weight="bold" aria-hidden="true" />
            {place.openingHours}
          </span>
        )}
      </span>
      <span className="am-result-badge">
        <CategoryIcon categoryId={place.category.id} size={22} />
        {index !== undefined && <i>{index + 1}</i>}
      </span>
    </button>
  );
}

interface SavedPanelProps {
  t: Translator;
  locale: SupportedLocale;
  places: Place[];
  onSelect: (place: Place) => void;
}

function SavedPanel({ t, locale, places, onSelect }: SavedPanelProps) {
  if (places.length === 0) {
    return (
      <section className="saved-panel" aria-label={t("saved.title")}>
        <div className="empty-state saved-empty">
          <BookmarkSimple size={32} aria-hidden="true" />
          <strong>{t("saved.empty")}</strong>
          <span>{t("saved.emptyHint")}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="saved-panel" aria-label={t("saved.title")}>
      <div className="section-heading" aria-live="polite">
        <h1>{t("saved.title")}</h1>
        <span>{shellCopy[locale].resultsCount(places.length)}</span>
      </div>
      <ul className="am-result-list">
        {places.map((place) => (
          <li key={place.id}>
            <PlaceResult place={place} saved onSelect={onSelect} />
          </li>
        ))}
      </ul>
      <p className="am-footnote">{shellCopy[locale].savedHint}</p>
    </section>
  );
}

interface RoutePanelProps {
  t: Translator;
  locale: SupportedLocale;
  focus: SearchFocus;
  origin?: Place;
  destination?: Place;
  stops: Array<Place | undefined>;
  activeTarget?: WaypointTarget;
  profile: RouteProfile;
  avoid: RouteAvoidance;
  routes: Route[];
  selectedRoute?: Route;
  routeStatus: AsyncStatus;
  shareStatus: "idle" | "shared";
  lowDataMode: boolean;
  mobileRouteUrl?: string;
  continuityCopy: (typeof connectivityCopy)[SupportedLocale];
  onUseCurrentLocation: () => void;
  onSetOrigin: (place?: Place) => void;
  onSetDestination: (place?: Place) => void;
  onSwap: () => void;
  onAddStop: () => void;
  onChangeStop: (index: number, place?: Place) => void;
  onRemoveStop: (index: number) => void;
  onSelectOnMap: (target?: WaypointTarget) => void;
  onSetProfile: (profile: RouteProfile) => void;
  onSetAvoid: (avoid: RouteAvoidance) => void;
  onCalculate: () => void;
  onSelectRoute: (routeId: string) => void;
  onShare: () => void;
}

function RoutePanel({
  t,
  locale,
  focus,
  origin,
  destination,
  stops,
  activeTarget,
  profile,
  avoid,
  routes,
  selectedRoute,
  routeStatus,
  shareStatus,
  lowDataMode,
  mobileRouteUrl,
  continuityCopy,
  onUseCurrentLocation,
  onSetOrigin,
  onSetDestination,
  onSwap,
  onAddStop,
  onChangeStop,
  onRemoveStop,
  onSelectOnMap,
  onSetProfile,
  onSetAvoid,
  onCalculate,
  onSelectRoute,
  onShare,
}: RoutePanelProps) {
  const formatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );

  const copy = shellCopy[locale];
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }),
    [locale],
  );
  const ready = origin && destination && !stops.some((stop) => !stop);

  return (
    <section className="route-panel am-route" aria-label={t("route.title")}>
      <div className="am-modes" role="radiogroup" aria-label={t("route.title")}>
        {(["driving", "cycling", "walking"] as const).map((item) => {
          const Icon = profileIcons[item];
          return (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={profile === item}
              className={profile === item ? "is-active" : ""}
              onClick={() => onSetProfile(item)}
            >
              <Icon
                size={22}
                weight={profile === item ? "fill" : "regular"}
                aria-hidden="true"
              />
              <span>{t(`route.profile.${item}`)}</span>
            </button>
          );
        })}
      </div>

      <div className="waypoint-search-editor am-waypoints">
        <WaypointSearchField
          t={t}
          locale={locale}
          focus={focus}
          marker="A"
          label={t("route.origin")}
          value={origin}
          target={{ kind: "origin" }}
          activeTarget={activeTarget}
          lowDataMode={lowDataMode}
          onChange={onSetOrigin}
          onSelectOnMap={onSelectOnMap}
        />

        {stops.map((stop, index) => (
          <div className="stop-search-row" key={`stop-${index}`}>
            <WaypointSearchField
              t={t}
              locale={locale}
              focus={focus}
              marker={String(index + 1)}
              label={`${t("route.addStop")} ${index + 1}`}
              value={stop}
              target={{ kind: "stop", index }}
              activeTarget={activeTarget}
              lowDataMode={lowDataMode}
              onChange={(place) => onChangeStop(index, place)}
              onSelectOnMap={onSelectOnMap}
            />
            <button
              type="button"
              className="remove-stop-button"
              onClick={() => onRemoveStop(index)}
              aria-label={t("route.removeStop")}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        ))}

        <WaypointSearchField
          t={t}
          locale={locale}
          focus={focus}
          marker="B"
          label={t("route.destination")}
          value={destination}
          target={{ kind: "destination" }}
          activeTarget={activeTarget}
          lowDataMode={lowDataMode}
          onChange={onSetDestination}
          onSelectOnMap={onSelectOnMap}
        />

        <button
          type="button"
          className="swap-button waypoint-swap-button"
          onClick={onSwap}
          disabled={!origin && !destination}
          aria-label={t("route.swap")}
          title={t("route.swap")}
        >
          <ArrowsDownUp size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="route-point-actions">
        <button type="button" className="add-stop" onClick={onAddStop} disabled={stops.length >= 8}>
          <Plus size={17} weight="bold" aria-hidden="true" />
          {copy.addStop}
        </button>
        <button
          type="button"
          className="route-current-location"
          onClick={onUseCurrentLocation}
        >
          <Crosshair size={17} weight="bold" aria-hidden="true" />
          {t("route.useCurrentLocation")}
        </button>
      </div>

      <details className="route-options">
        <summary>
          <ListBullets size={18} aria-hidden="true" />
          {t("route.options")}
        </summary>
        <div>
          {([
            ["tolls", t("route.avoidTolls")],
            ["highways", t("route.avoidHighways")],
            ["ferries", t("route.avoidFerries")],
          ] as const).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(avoid[key])}
                onChange={(event) =>
                  onSetAvoid({ ...avoid, [key]: event.target.checked })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </details>

      {routeStatus === "loading" && (
        <div className="route-skeleton" role="status" aria-live="polite">
          <span className="sr-only">{t("route.loading")}</span>
          <span />
          <span />
        </div>
      )}

      {routeStatus === "error" && (
        <div className="empty-state route-error" role="alert">
          <WarningCircle size={28} aria-hidden="true" />
          <strong>{t("route.error")}</strong>
          {ready && (
            <button
              type="button"
              className="button-primary route-retry"
              onClick={onCalculate}
            >
              <NavigationArrow size={18} weight="fill" aria-hidden="true" />
              {t("route.calculate")}
            </button>
          )}
        </div>
      )}

      {routeStatus === "idle" && routes.length === 0 && !ready && (
        <p className="route-empty">{copy.routeSelectHint}</p>
      )}

      {lowDataMode && routeStatus === "idle" && routes.length === 0 && ready && (
        <button
          type="button"
          className="button-primary route-low-data-calculate"
          onClick={onCalculate}
        >
          <NavigationArrow size={18} weight="fill" aria-hidden="true" />
          {t("route.calculate")}
        </button>
      )}

      {routes.length > 0 && (
        <div className="route-results">
          <div className="section-heading">
            <h2>{copy.routeAlternativesHeading}</h2>
            <span>{routes.length}</span>
          </div>
          <ul className="am-route-list">
            {routes.map((route, index) => {
              const selected = route.id === selectedRoute?.id;
              const ModeIcon = profileIcons[route.profile];
              const via = routeViaName(route);
              const arrival = timeFormatter.format(
                new Date(Date.now() + route.durationSeconds * 1_000),
              );
              return (
                <li key={route.id} className={selected ? "is-selected" : ""}>
                  <button
                    type="button"
                    className="am-route-card"
                    onClick={() => onSelectRoute(route.id)}
                    aria-pressed={selected}
                  >
                    <ModeIcon size={22} aria-hidden="true" />
                    <span className="am-route-main">
                      <strong>{via ? copy.routeVia(via) : t(`route.profile.${route.profile}`)}</strong>
                      <small>
                        {index === 0 ? `${copy.routeFastest} · ` : ""}
                        {copy.routeArrive(arrival)}
                      </small>
                    </span>
                    <span className="am-route-time">
                      <b>{formatDuration(route.durationSeconds)}</b>
                      <small>{formatter.format(route.distanceMeters / 1_000)} km</small>
                    </span>
                  </button>
                  {selected && (
                    <details className="route-directions">
                      <summary>
                        <ListBullets size={18} aria-hidden="true" />
                        {copy.routeStepsHeading}
                      </summary>
                      <ol>
                        {route.legs.flatMap((leg) => leg.steps).map((step, stepIndex) => (
                          <li key={`${step.maneuver.type}-${stepIndex}`}>
                            <span>{stepIndex + 1}</span>
                            <div>
                              <strong>{step.instruction}</strong>
                              <small>{formatStepDistance(step.distanceMeters, formatter)}</small>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {ready && (
        <div className="route-continuity">
          <button type="button" className="button-secondary share-route" onClick={onShare}>
            {shareStatus === "shared" ? (
              <Check size={18} weight="bold" aria-hidden="true" />
            ) : (
              <ShareNetwork size={18} aria-hidden="true" />
            )}
            {shareStatus === "shared" ? t("route.shared") : t("route.share")}
          </button>
          {mobileRouteUrl && (
            <a className="button-secondary continue-android" href={mobileRouteUrl}>
              <NavigationArrow size={18} weight="fill" aria-hidden="true" />
              {continuityCopy.openAndroid}
            </a>
          )}
          <p className="mobile-note">{continuityCopy.mobileHint}</p>
        </div>
      )}
    </section>
  );
}

function routeViaName(route: Route): string | undefined {
  const distanceByRoad = new Map<string, number>();
  route.legs
    .flatMap((leg) => leg.steps)
    .forEach((step) => {
      if (!step.roadName) return;
      distanceByRoad.set(
        step.roadName,
        (distanceByRoad.get(step.roadName) ?? 0) + step.distanceMeters,
      );
    });
  return [...distanceByRoad.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

interface WaypointSearchFieldProps {
  t: Translator;
  locale: SupportedLocale;
  focus: SearchFocus;
  marker: string;
  label: string;
  value?: Place;
  target: WaypointTarget;
  activeTarget?: WaypointTarget;
  lowDataMode: boolean;
  onChange: (place?: Place) => void;
  onSelectOnMap: (target?: WaypointTarget) => void;
}

function WaypointSearchField({
  t,
  locale,
  focus,
  marker,
  label,
  value,
  target,
  activeTarget,
  lowDataMode,
  onChange,
  onSelectOnMap,
}: WaypointSearchFieldProps) {
  const listId = useId();
  const [text, setText] = useState(value?.name ?? "");
  const [options, setOptions] = useState<Place[]>([]);
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [open, setOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const sequenceRef = useRef(0);
  const clearedByTypingRef = useRef(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const selectionActive = sameWaypointTarget(target, activeTarget);

  useEffect(() => {
    if (value) {
      setText(value.name);
    } else if (clearedByTypingRef.current) {
      clearedByTypingRef.current = false;
    } else {
      setText("");
    }
  }, [value?.id, value?.name]);

  useEffect(() => {
    const query = text.trim();
    const minimumLength = lowDataMode ? 3 : 2;
    if (query.length < minimumLength || query === value?.name) {
      sequenceRef.current += 1;
      setOptions([]);
      setStatus("idle");
      setActiveOptionIndex(-1);
      return;
    }
    const sequence = ++sequenceRef.current;
    setStatus("loading");
    const timeout = window.setTimeout(() => {
      void searchPlaces(query, locale, focus, { lowData: lowDataMode })
        .then((response) => {
          if (sequence !== sequenceRef.current) return;
          setOptions(response.data);
          setStatus(response.data.length ? "success" : "error");
          setActiveOptionIndex(-1);
          setOpen(true);
        })
        .catch(() => {
          if (sequence !== sequenceRef.current) return;
          setOptions([]);
          setStatus("error");
          setActiveOptionIndex(-1);
          setOpen(true);
        });
    }, lowDataMode ? 900 : 300);
    return () => window.clearTimeout(timeout);
  }, [focus, locale, lowDataMode, text, value?.name]);

  return (
    <div
      ref={fieldRef}
      className={`waypoint-search-field ${selectionActive ? "is-map-selecting" : ""}`}
      data-waypoint={target.kind}
    >
      <span className="waypoint-token" aria-hidden="true">{marker}</span>
      <label>
        <span className="sr-only">{label}</span>
        <input
          value={text}
          placeholder={label}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && activeOptionIndex >= 0
              ? `${listId}-option-${activeOptionIndex}`
              : undefined
          }
          onFocus={() => options.length > 0 && setOpen(true)}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !fieldRef.current?.contains(nextTarget)) {
              setOpen(false);
              setActiveOptionIndex(-1);
            }
          }}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value !== value?.name) {
              clearedByTypingRef.current = true;
              onChange(undefined);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && options.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActiveOptionIndex((current) =>
                current < options.length - 1 ? current + 1 : 0,
              );
              return;
            }
            if (event.key === "ArrowUp" && options.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActiveOptionIndex((current) =>
                current > 0 ? current - 1 : options.length - 1,
              );
              return;
            }
            if (
              event.key === "Enter" &&
              open &&
              activeOptionIndex >= 0 &&
              options[activeOptionIndex]
            ) {
              event.preventDefault();
              const place = options[activeOptionIndex];
              setText(place.name);
              setOpen(false);
              setActiveOptionIndex(-1);
              onChange(place);
              return;
            }
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
              setActiveOptionIndex(-1);
            }
          }}
        />
      </label>
      {status === "loading" && <span className="waypoint-spinner" aria-label={t("search.loading")} />}
      {text && status !== "loading" && (
        <button
          type="button"
          className="waypoint-clear"
          onClick={() => {
            setText("");
            setOptions([]);
            setActiveOptionIndex(-1);
            onChange(undefined);
          }}
          aria-label={t("search.clear")}
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="waypoint-map-button"
        onClick={() => onSelectOnMap(selectionActive ? undefined : target)}
        aria-label={t("route.chooseOnMap")}
        title={t("route.chooseOnMap")}
        aria-pressed={selectionActive}
      >
        <Crosshair size={18} weight={selectionActive ? "bold" : "regular"} aria-hidden="true" />
      </button>

      {open && (
        <ul className="waypoint-suggestions" id={listId} role="listbox">
          {options.length > 0 ? (
            options.map((place, index) => (
              <li
                id={`${listId}-option-${index}`}
                key={place.id}
                role="option"
                aria-selected={activeOptionIndex === index}
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setText(place.name);
                    setOpen(false);
                    setActiveOptionIndex(-1);
                    onChange(place);
                  }}
                >
                  <MapPin size={17} aria-hidden="true" />
                  <span>
                    <strong>{place.name}</strong>
                    <small>{place.address?.formatted ?? place.category.label}</small>
                  </span>
                </button>
              </li>
            ))
          ) : (
            status === "error" && <li className="waypoint-no-results">{t("search.empty")}</li>
          )}
        </ul>
      )}
    </div>
  );
}

function sameWaypointTarget(left: WaypointTarget, right?: WaypointTarget): boolean {
  return (
    left.kind === right?.kind &&
    (left.kind !== "stop" || (right?.kind === "stop" && left.index === right.index))
  );
}

function formatStepDistance(
  meters: number,
  formatter: Intl.NumberFormat,
): string {
  return meters < 1_000
    ? `${Math.max(1, Math.round(meters))} m`
    : `${formatter.format(meters / 1_000)} km`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

function createCoordinatePlace(
  coordinates: Coordinates,
  label: string,
): Place {
  const latitude = Number(coordinates.latitude.toFixed(6));
  const longitude = Number(coordinates.longitude.toFixed(6));
  const formatted = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return {
    id: `coordinate:${latitude}:${longitude}`,
    source: "openstreetmap",
    name: formatted,
    category: { id: "selected-point", label },
    coordinates: { latitude, longitude },
    address: { formatted },
    attribution: ["© OpenStreetMap contributors"],
  };
}

function formatResultDistance(meters: number): string {
  if (meters < 1_000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

function safeWebsiteUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
        : undefined;
  } catch {
    return undefined;
  }
}

function dedupePlaces(places: Place[]): Place[] {
  const unique = new Map<string, Place>();
  places.forEach((place) => unique.set(place.id, place));
  return [...unique.values()];
}
