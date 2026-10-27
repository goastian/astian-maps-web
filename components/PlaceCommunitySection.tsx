"use client";

import type {
  Place,
  SupportedLocale,
} from "@astian-maps/contracts";
import {
  CheckCircle,
  Clock,
  Eye,
  ImageSquare,
  PencilSimple,
} from "@phosphor-icons/react";
import { useId } from "react";
import {
  createOpenStreetMapObjectLinks,
  createPanoramaxMapUrl,
} from "../lib/place-links";

interface PlaceCommunitySectionProps {
  place: Place;
  locale: SupportedLocale;
  compact?: boolean;
}

interface PlaceCommunityCopy {
  openDataTitle: string;
  viewOnOpenStreetMap: string;
  editOnOpenStreetMap: string;
  viewOpenImages: string;
  openImagesHint: string;
  communityTitle: string;
  availableTitle: string;
  availableDetail: string;
  pendingTitle: string;
  pendingDetail: string;
}

const copyByLocale: Record<SupportedLocale, PlaceCommunityCopy> = {
  es: {
    openDataTitle: "Datos abiertos del lugar",
    viewOnOpenStreetMap: "Ver en OpenStreetMap",
    editOnOpenStreetMap: "Editar en OpenStreetMap",
    viewOpenImages: "Explorar imágenes abiertas",
    openImagesHint:
      "Panoramax abre centrado aquí. La cobertura depende de la zona.",
    communityTitle: "Estado de la comunidad",
    availableTitle: "Disponible ahora",
    availableDetail: "Direcciones y guardado local están activos.",
    pendingTitle: "Aún no sincronizado",
    pendingDetail:
      "Las reseñas y fotos todavía no se publican ni se sincronizan desde Astian Maps.",
  },
  en: {
    openDataTitle: "Open place data",
    viewOnOpenStreetMap: "View on OpenStreetMap",
    editOnOpenStreetMap: "Edit on OpenStreetMap",
    viewOpenImages: "Explore open imagery",
    openImagesHint:
      "Panoramax opens centered here. Coverage varies by area.",
    communityTitle: "Community status",
    availableTitle: "Available now",
    availableDetail: "Directions and local saves are active.",
    pendingTitle: "Not synced yet",
    pendingDetail:
      "Reviews and photos are not published or synced from Astian Maps yet.",
  },
  fr: {
    openDataTitle: "Données ouvertes du lieu",
    viewOnOpenStreetMap: "Voir sur OpenStreetMap",
    editOnOpenStreetMap: "Modifier sur OpenStreetMap",
    viewOpenImages: "Explorer les images ouvertes",
    openImagesHint:
      "Panoramax s’ouvre centré ici. La couverture varie selon la zone.",
    communityTitle: "État de la communauté",
    availableTitle: "Disponible maintenant",
    availableDetail:
      "Les itinéraires et les enregistrements locaux sont actifs.",
    pendingTitle: "Pas encore synchronisé",
    pendingDetail:
      "Les avis et photos ne sont pas encore publiés ni synchronisés depuis Astian Maps.",
  },
  de: {
    openDataTitle: "Offene Ortsdaten",
    viewOnOpenStreetMap: "In OpenStreetMap ansehen",
    editOnOpenStreetMap: "In OpenStreetMap bearbeiten",
    viewOpenImages: "Offene Bilder erkunden",
    openImagesHint:
      "Panoramax öffnet auf diesen Ort zentriert. Die Abdeckung ist regional unterschiedlich.",
    communityTitle: "Community-Status",
    availableTitle: "Jetzt verfügbar",
    availableDetail: "Routen und lokales Speichern sind aktiv.",
    pendingTitle: "Noch nicht synchronisiert",
    pendingDetail:
      "Bewertungen und Fotos werden von Astian Maps noch nicht veröffentlicht oder synchronisiert.",
  },
};

export function PlaceCommunitySection({
  place,
  locale,
  compact = false,
}: PlaceCommunitySectionProps) {
  const openDataHeadingId = useId();
  const communityHeadingId = useId();
  const copy = copyByLocale[locale];
  const openStreetMapLinks = createOpenStreetMapObjectLinks(place.osm);
  const panoramaxUrl = createPanoramaxMapUrl(place.coordinates);

  return (
    <div className="place-community-stack">
      {(openStreetMapLinks || panoramaxUrl) && (
        <section
          className="place-open-data"
          aria-labelledby={openDataHeadingId}
        >
          <strong id={openDataHeadingId} className="place-subheading">
            {copy.openDataTitle}
          </strong>
          <div className="place-resource-links">
            {openStreetMapLinks && (
              <>
                <a
                  className="place-resource-link"
                  href={openStreetMapLinks.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye size={17} aria-hidden="true" />
                  <span>{copy.viewOnOpenStreetMap}</span>
                </a>
                <a
                  className="place-resource-link"
                  href={openStreetMapLinks.editUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PencilSimple size={17} aria-hidden="true" />
                  <span>{copy.editOnOpenStreetMap}</span>
                </a>
              </>
            )}
            {panoramaxUrl && (
              <a
                className="place-resource-link"
                href={panoramaxUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ImageSquare size={17} aria-hidden="true" />
                <span>{copy.viewOpenImages}</span>
              </a>
            )}
          </div>
          {panoramaxUrl && (
            <small className="place-resource-hint">
              {copy.openImagesHint}
            </small>
          )}
        </section>
      )}

      {!compact && <section
        className="place-community-status"
        aria-labelledby={communityHeadingId}
      >
        <strong id={communityHeadingId} className="place-subheading">
          {copy.communityTitle}
        </strong>
        <div className="place-status-list" role="list">
          <div className="place-status-row is-active" role="listitem">
            <CheckCircle size={20} weight="fill" aria-hidden="true" />
            <span>
              <strong>{copy.availableTitle}</strong>
              <small>{copy.availableDetail}</small>
            </span>
          </div>
          <div className="place-status-row is-pending" role="listitem">
            <Clock size={20} weight="fill" aria-hidden="true" />
            <span>
              <strong>{copy.pendingTitle}</strong>
              <small>{copy.pendingDetail}</small>
            </span>
          </div>
        </div>
      </section>}
    </div>
  );
}
