import type { SupportedLocale } from "@astian-maps/contracts";

export interface ShellCopy {
  railExplore: string;
  railRoutes: string;
  railSaved: string;
  railMenu: string;
  railSettings: string;
  exploreTitle: string;
  exploreHint: string;
  categories: string;
  moreCategories: string;
  resultsFor: (label: string) => string;
  resultsCount: (count: number) => string;
  openNow: string;
  closedNow: string;
  placeOverview: string;
  placeReviews: string;
  placeAbout: string;
  placeNearby: string;
  placeShare: string;
  placeLinkCopied: string;
  placeAddress: string;
  placeHours: string;
  placeWebsite: string;
  placePhone: string;
  placeCoordinates: string;
  placeAccessibility: string;
  wheelchairYes: string;
  wheelchairLimited: string;
  wheelchairNo: string;
  noPhoto: string;
  reviewsCount: (count: string) => string;
  reviewsEmpty: string;
  reviewsLoading: string;
  googleNote: string;
  googleSource: string;
  openData: string;
  routeFastest: string;
  routeDetails: string;
  routeStepsHeading: string;
  routeVia: (road: string) => string;
  routeArrive: (time: string) => string;
  routeAlternativesHeading: string;
  routeSelectHint: string;
  addStop: string;
  layerDetails: string;
  mapTools: string;
  savedHint: string;
  backToResults: string;
  fixOnOsm: string;
  traffic: string;
  trafficHint: string;
  trafficFree: string;
  trafficSlow: string;
  trafficSource: string;
}

export const shellCopy: Record<SupportedLocale, ShellCopy> = {
  es: {
    railExplore: "Explorar",
    railRoutes: "Rutas",
    railSaved: "Guardados",
    railMenu: "Menú",
    railSettings: "Ajustes",
    exploreTitle: "Explora cerca",
    exploreHint: "Elige una categoría o escribe un lugar en el buscador.",
    categories: "Categorías",
    moreCategories: "Más",
    resultsFor: (label) => label,
    resultsCount: (count) => (count === 1 ? "1 resultado" : `${count} resultados`),
    openNow: "Abierto",
    closedNow: "Cerrado",
    placeOverview: "Resumen",
    placeReviews: "Reseñas",
    placeAbout: "Datos",
    placeNearby: "Cerca",
    placeShare: "Compartir",
    placeLinkCopied: "Enlace copiado",
    placeAddress: "Dirección",
    placeHours: "Horario",
    placeWebsite: "Sitio web",
    placePhone: "Teléfono",
    placeCoordinates: "Coordenadas",
    placeAccessibility: "Accesibilidad",
    wheelchairYes: "Accesible para silla de ruedas",
    wheelchairLimited: "Accesibilidad parcial",
    wheelchairNo: "No accesible para silla de ruedas",
    noPhoto: "Sin foto",
    reviewsCount: (count) => `${count} reseñas`,
    reviewsEmpty: "Todavía no hay reseñas disponibles para este lugar.",
    reviewsLoading: "Buscando valoraciones…",
    googleNote: "Valoración, fotos y reseñas de Google, consultadas por Astian sin cuenta.",
    googleSource: "Google",
    openData: "Datos abiertos",
    routeFastest: "Más rápida",
    routeDetails: "Detalles",
    routeStepsHeading: "Indicaciones paso a paso",
    routeVia: (road) => `Por ${road}`,
    routeArrive: (time) => `Llegada ${time}`,
    routeAlternativesHeading: "Rutas sugeridas",
    routeSelectHint: "Elige un punto de partida y un destino.",
    addStop: "Añadir parada",
    layerDetails: "Detalles del mapa",
    mapTools: "Herramientas",
    savedHint: "Tus lugares viven en este navegador.",
    backToResults: "Volver a resultados",
    fixOnOsm: "Corregir en OpenStreetMap",
    traffic: "Tráfico en tiempo real",
    trafficHint: "Congestión actual en las vías",
    trafficFree: "Fluido",
    trafficSlow: "Lento",
    trafficSource: "Tráfico © Google",
  },
  en: {
    railExplore: "Explore",
    railRoutes: "Routes",
    railSaved: "Saved",
    railMenu: "Menu",
    railSettings: "Settings",
    exploreTitle: "Explore nearby",
    exploreHint: "Pick a category or type a place in the search box.",
    categories: "Categories",
    moreCategories: "More",
    resultsFor: (label) => label,
    resultsCount: (count) => (count === 1 ? "1 result" : `${count} results`),
    openNow: "Open",
    closedNow: "Closed",
    placeOverview: "Overview",
    placeReviews: "Reviews",
    placeAbout: "About",
    placeNearby: "Nearby",
    placeShare: "Share",
    placeLinkCopied: "Link copied",
    placeAddress: "Address",
    placeHours: "Hours",
    placeWebsite: "Website",
    placePhone: "Phone",
    placeCoordinates: "Coordinates",
    placeAccessibility: "Accessibility",
    wheelchairYes: "Wheelchair accessible",
    wheelchairLimited: "Partially accessible",
    wheelchairNo: "Not wheelchair accessible",
    noPhoto: "No photo",
    reviewsCount: (count) => `${count} reviews`,
    reviewsEmpty: "No reviews are available for this place yet.",
    reviewsLoading: "Looking up ratings…",
    googleNote: "Rating, photos and reviews from Google, fetched by Astian without an account.",
    googleSource: "Google",
    openData: "Open data",
    routeFastest: "Fastest",
    routeDetails: "Details",
    routeStepsHeading: "Step-by-step directions",
    routeVia: (road) => `Via ${road}`,
    routeArrive: (time) => `Arrive ${time}`,
    routeAlternativesHeading: "Suggested routes",
    routeSelectHint: "Choose a starting point and a destination.",
    addStop: "Add stop",
    layerDetails: "Map details",
    mapTools: "Tools",
    savedHint: "Your places live in this browser.",
    backToResults: "Back to results",
    fixOnOsm: "Fix on OpenStreetMap",
    traffic: "Live traffic",
    trafficHint: "Current congestion on roads",
    trafficFree: "Fast",
    trafficSlow: "Slow",
    trafficSource: "Traffic © Google",
  },
  fr: {
    railExplore: "Explorer",
    railRoutes: "Itinéraires",
    railSaved: "Enregistrés",
    railMenu: "Menu",
    railSettings: "Réglages",
    exploreTitle: "Explorer à proximité",
    exploreHint: "Choisissez une catégorie ou saisissez un lieu dans la recherche.",
    categories: "Catégories",
    moreCategories: "Plus",
    resultsFor: (label) => label,
    resultsCount: (count) => (count === 1 ? "1 résultat" : `${count} résultats`),
    openNow: "Ouvert",
    closedNow: "Fermé",
    placeOverview: "Aperçu",
    placeReviews: "Avis",
    placeAbout: "À propos",
    placeNearby: "À proximité",
    placeShare: "Partager",
    placeLinkCopied: "Lien copié",
    placeAddress: "Adresse",
    placeHours: "Horaires",
    placeWebsite: "Site web",
    placePhone: "Téléphone",
    placeCoordinates: "Coordonnées",
    placeAccessibility: "Accessibilité",
    wheelchairYes: "Accessible en fauteuil roulant",
    wheelchairLimited: "Accessibilité partielle",
    wheelchairNo: "Non accessible en fauteuil roulant",
    noPhoto: "Pas de photo",
    reviewsCount: (count) => `${count} avis`,
    reviewsEmpty: "Aucun avis disponible pour ce lieu pour le moment.",
    reviewsLoading: "Recherche des notes…",
    googleNote: "Note, photos et avis de Google, récupérés par Astian sans compte.",
    googleSource: "Google",
    openData: "Données ouvertes",
    routeFastest: "Plus rapide",
    routeDetails: "Détails",
    routeStepsHeading: "Itinéraire pas à pas",
    routeVia: (road) => `Via ${road}`,
    routeArrive: (time) => `Arrivée ${time}`,
    routeAlternativesHeading: "Itinéraires proposés",
    routeSelectHint: "Choisissez un départ et une destination.",
    addStop: "Ajouter une étape",
    layerDetails: "Détails de la carte",
    mapTools: "Outils",
    savedHint: "Vos lieux restent dans ce navigateur.",
    backToResults: "Retour aux résultats",
    fixOnOsm: "Corriger sur OpenStreetMap",
    traffic: "Trafic en temps réel",
    trafficHint: "Circulation actuelle sur les routes",
    trafficFree: "Fluide",
    trafficSlow: "Lent",
    trafficSource: "Trafic © Google",
  },
  de: {
    railExplore: "Entdecken",
    railRoutes: "Routen",
    railSaved: "Gespeichert",
    railMenu: "Menü",
    railSettings: "Einstellungen",
    exploreTitle: "In der Nähe entdecken",
    exploreHint: "Wählen Sie eine Kategorie oder geben Sie einen Ort ein.",
    categories: "Kategorien",
    moreCategories: "Mehr",
    resultsFor: (label) => label,
    resultsCount: (count) => (count === 1 ? "1 Ergebnis" : `${count} Ergebnisse`),
    openNow: "Geöffnet",
    closedNow: "Geschlossen",
    placeOverview: "Übersicht",
    placeReviews: "Rezensionen",
    placeAbout: "Info",
    placeNearby: "In der Nähe",
    placeShare: "Teilen",
    placeLinkCopied: "Link kopiert",
    placeAddress: "Adresse",
    placeHours: "Öffnungszeiten",
    placeWebsite: "Website",
    placePhone: "Telefon",
    placeCoordinates: "Koordinaten",
    placeAccessibility: "Barrierefreiheit",
    wheelchairYes: "Rollstuhlgerecht",
    wheelchairLimited: "Teilweise barrierefrei",
    wheelchairNo: "Nicht rollstuhlgerecht",
    noPhoto: "Kein Foto",
    reviewsCount: (count) => `${count} Rezensionen`,
    reviewsEmpty: "Für diesen Ort sind noch keine Rezensionen verfügbar.",
    reviewsLoading: "Bewertungen werden gesucht…",
    googleNote: "Bewertung, Fotos und Rezensionen von Google, von Astian ohne Konto abgerufen.",
    googleSource: "Google",
    openData: "Offene Daten",
    routeFastest: "Schnellste",
    routeDetails: "Details",
    routeStepsHeading: "Schritt-für-Schritt-Route",
    routeVia: (road) => `Über ${road}`,
    routeArrive: (time) => `Ankunft ${time}`,
    routeAlternativesHeading: "Routenvorschläge",
    routeSelectHint: "Wählen Sie Start und Ziel.",
    addStop: "Stopp hinzufügen",
    layerDetails: "Kartendetails",
    mapTools: "Werkzeuge",
    savedHint: "Ihre Orte bleiben in diesem Browser.",
    backToResults: "Zurück zu den Ergebnissen",
    fixOnOsm: "In OpenStreetMap korrigieren",
    traffic: "Echtzeit-Verkehr",
    trafficHint: "Aktuelle Staulage auf den Straßen",
    trafficFree: "Frei",
    trafficSlow: "Zäh",
    trafficSource: "Verkehr © Google",
  },
};
