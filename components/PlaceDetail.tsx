"use client";

import type {
  Place,
  PlaceEnrichment,
  SupportedLocale,
} from "@astian-maps/contracts";
import type { MessageKey } from "@astian-maps/i18n";
import {
  ArrowLeft,
  BookmarkSimple,
  CaretDown,
  Clock,
  Copy,
  Globe,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  Phone,
  ShareNetwork,
  Wheelchair,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { getPlaceEnrichment, resolveApiAsset } from "../lib/api";
import { createOpenStreetMapObjectLinks } from "../lib/place-links";
import { shellCopy } from "../lib/shell-copy";
import { CategoryIcon } from "./category-icon";
import { PlaceCommunitySection } from "./PlaceCommunitySection";

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

type DetailTab = "overview" | "reviews" | "about";
type EnrichmentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: PlaceEnrichment }
  | { status: "unavailable" };

const enrichmentCache = new Map<string, PlaceEnrichment | null>();

interface PlaceDetailProps {
  t: Translator;
  locale: SupportedLocale;
  place: Place;
  saved: boolean;
  enrichmentEnabled: boolean;
  backLabel?: string;
  onBack: () => void;
  onDirections: (place: Place) => void;
  onToggleSaved: (place: Place) => void;
  onNearby: (place: Place) => void;
}

export function PlaceDetail({
  t,
  locale,
  place,
  saved,
  enrichmentEnabled,
  backLabel,
  onBack,
  onDirections,
  onToggleSaved,
  onNearby,
}: PlaceDetailProps) {
  const copy = shellCopy[locale];
  const [tab, setTab] = useState<DetailTab>("overview");
  const [hoursOpen, setHoursOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [coordinatesCopied, setCoordinatesCopied] = useState(false);
  const [enrichment, setEnrichment] = useState<EnrichmentState>({ status: "idle" });
  const websiteUrl = safeWebsiteUrl(place.website);

  useEffect(() => {
    setTab("overview");
    setHoursOpen(false);
    if (!enrichmentEnabled || place.id.startsWith("coordinate:") || place.id.startsWith("local:")) {
      setEnrichment({ status: "idle" });
      return;
    }
    const key = `${locale}:${place.id}`;
    if (enrichmentCache.has(key)) {
      const cached = enrichmentCache.get(key);
      setEnrichment(cached ? { status: "ready", data: cached } : { status: "unavailable" });
      return;
    }
    let active = true;
    setEnrichment({ status: "loading" });
    getPlaceEnrichment(place, locale)
      .then((data) => {
        enrichmentCache.set(key, data ?? null);
        if (active) setEnrichment(data ? { status: "ready", data } : { status: "unavailable" });
      })
      .catch(() => {
        if (active) setEnrichment({ status: "unavailable" });
      });
    return () => {
      active = false;
    };
  }, [enrichmentEnabled, locale, place]);

  const extra = enrichment.status === "ready" ? enrichment.data : undefined;
  const photos = extra?.photos ?? [];
  const phone = place.phone ?? extra?.phone;
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;
  const website = websiteUrl ?? safeWebsiteUrl(extra?.website);
  const address = place.address?.formatted ?? extra?.address;
  const showReviewsTab = enrichmentEnabled && enrichment.status !== "unavailable";
  const hoursLines = extra?.hours ?? [];
  const osmLinks = createOpenStreetMapObjectLinks(place.osm);
  const coordinateText = `${place.coordinates.latitude.toFixed(5)}, ${place.coordinates.longitude.toFixed(5)}`;

  const statusTone =
    extra?.openNow === true ? "open" : extra?.openNow === false ? "closed" : "neutral";
  const statusText =
    extra?.statusText ??
    (extra?.openNow === true
      ? copy.openNow
      : extra?.openNow === false
        ? copy.closedNow
        : undefined);

  const share = async () => {
    const url =
      osmLinks?.viewUrl ??
      `https://www.openstreetmap.org/?mlat=${place.coordinates.latitude}&mlon=${place.coordinates.longitude}#map=18/${place.coordinates.latitude}/${place.coordinates.longitude}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2_000);
    } catch {
      setShared(false);
    }
  };

  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(coordinateText);
      setCoordinatesCopied(true);
      window.setTimeout(() => setCoordinatesCopied(false), 1_800);
    } catch {
      setCoordinatesCopied(false);
    }
  };

  const wheelchairLabel =
    place.wheelchair === "yes"
      ? copy.wheelchairYes
      : place.wheelchair === "limited"
        ? copy.wheelchairLimited
        : place.wheelchair === "no"
          ? copy.wheelchairNo
          : undefined;

  return (
    <article className="am-place" aria-label={place.name}>
      <div className="am-place-hero" data-has-photos={photos.length > 0}>
        <button type="button" className="am-place-back panel-back" onClick={onBack}>
          <ArrowLeft size={18} weight="bold" aria-hidden="true" />
          <span>{backLabel ?? t("common.back")}</span>
        </button>
        {photos.length > 0 ? (
          <div className="am-place-gallery" role="list" aria-label={copy.placeOverview}>
            {photos.map((photo, index) => (
              <img
                key={photo.url}
                role="listitem"
                src={resolveApiAsset(photo.url)}
                alt={index === 0 ? place.name : ""}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        ) : (
          <div className="am-place-hero-fallback" aria-hidden="true">
            <CategoryIcon categoryId={place.category.id} size={44} />
            {enrichment.status === "loading" && <span className="am-shimmer" />}
          </div>
        )}
      </div>

      <header className="am-place-head">
        <h1>{place.name}</h1>
        {extra?.rating !== undefined && extra.rating !== null && (
          <div className="am-rating-row">
            <strong>{formatRating(extra.rating, locale)}</strong>
            <Stars value={extra.rating} />
            {extra.reviewCount !== undefined && extra.reviewCount !== null && (
              <button
                type="button"
                className="am-link-button"
                onClick={() => setTab("reviews")}
              >
                ({new Intl.NumberFormat(locale).format(extra.reviewCount)})
              </button>
            )}
            {extra.priceLevel && (
              <span className="am-price" aria-label={`${extra.priceLevel}/4`}>
                {"$".repeat(extra.priceLevel)}
                <i>{"$".repeat(4 - extra.priceLevel)}</i>
              </span>
            )}
          </div>
        )}
        {enrichment.status === "loading" && (
          <div className="am-rating-row is-loading" role="status" aria-label={copy.reviewsLoading}>
            <span className="am-skeleton-line" />
          </div>
        )}
        <p className="am-place-category">
          {extra?.category ?? place.category.label}
          {place.address?.city ? ` · ${place.address.city}` : ""}
        </p>
        {statusText && (
          <p className={`am-place-status is-${statusTone}`}>
            <Clock size={15} weight="bold" aria-hidden="true" />
            {statusText}
          </p>
        )}
      </header>

      <div className="am-place-actions" role="group" aria-label={place.name}>
        <button type="button" className="is-primary" onClick={() => onDirections(place)}>
          <span>
            <NavigationArrow size={20} weight="fill" aria-hidden="true" />
          </span>
          {t("place.directions")}
        </button>
        <button
          type="button"
          className={saved ? "is-on" : ""}
          aria-pressed={saved}
          onClick={() => onToggleSaved(place)}
        >
          <span>
            <BookmarkSimple size={20} weight={saved ? "fill" : "regular"} aria-hidden="true" />
          </span>
          {saved ? t("place.saved") : t("place.save")}
        </button>
        <button type="button" onClick={() => onNearby(place)}>
          <span>
            <MagnifyingGlass size={20} aria-hidden="true" />
          </span>
          {copy.placeNearby}
        </button>
        <button type="button" onClick={() => void share()}>
          <span>
            <ShareNetwork size={20} aria-hidden="true" />
          </span>
          {shared ? copy.placeLinkCopied : copy.placeShare}
        </button>
      </div>

      <div className="am-tabs" role="tablist" aria-label={place.name}>
        {(
          [
            ["overview", copy.placeOverview],
            ...(showReviewsTab ? [["reviews", copy.placeReviews]] : []),
            ["about", copy.placeAbout],
          ] as Array<[DetailTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`place-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="place-tabpanel"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="am-tabpanel"
        id="place-tabpanel"
        role="tabpanel"
        aria-labelledby={`place-tab-${tab}`}
      >
        {tab === "overview" && (
          <ul className="am-info-list">
            {address && (
              <li>
                <MapPin size={20} aria-hidden="true" />
                <span>{address}</span>
              </li>
            )}
            {(place.openingHours || hoursLines.length > 0) && (
              <li className="am-info-hours">
                <Clock size={20} aria-hidden="true" />
                <div>
                  {hoursLines.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className="am-hours-toggle"
                        aria-expanded={hoursOpen}
                        onClick={() => setHoursOpen((open) => !open)}
                      >
                        <span>{extra?.statusText ?? copy.placeHours}</span>
                        <CaretDown
                          size={16}
                          weight="bold"
                          data-open={hoursOpen}
                          aria-hidden="true"
                        />
                      </button>
                      {hoursOpen && (
                        <dl className="am-hours-table">
                          {hoursLines.map((line) => (
                            <div key={line.day}>
                              <dt>{line.day}</dt>
                              <dd>{line.text}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </>
                  ) : (
                    <span>{place.openingHours}</span>
                  )}
                </div>
              </li>
            )}
            {website && (
              <li>
                <Globe size={20} aria-hidden="true" />
                <a href={website} target="_blank" rel="noopener noreferrer">
                  {hostLabel(website)}
                </a>
              </li>
            )}
            {phone && phoneHref && (
              <li>
                <Phone size={20} aria-hidden="true" />
                <a href={phoneHref}>{phone}</a>
              </li>
            )}
            <li>
              <MapPin size={20} weight="duotone" aria-hidden="true" />
              <button
                type="button"
                className="am-copy-line"
                onClick={() => void copyCoordinates()}
                title={copy.placeCoordinates}
              >
                <span>{coordinatesCopied ? copy.placeLinkCopied : coordinateText}</span>
                <Copy size={15} aria-hidden="true" />
              </button>
            </li>
            {wheelchairLabel && (
              <li>
                <Wheelchair size={20} aria-hidden="true" />
                <span>{wheelchairLabel}</span>
              </li>
            )}
          </ul>
        )}

        {tab === "reviews" && (
          <ReviewsTab copy={copy} locale={locale} state={enrichment} />
        )}

        {tab === "about" && (
          <div className="am-about">
            <PlaceCommunitySection place={place} locale={locale} compact />
            {osmLinks && (
              <a
                className="am-link-row"
                href={osmLinks.editUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.fixOnOsm}
              </a>
            )}
          </div>
        )}
      </div>

      <footer className="am-place-sources">
        <span>
          {copy.openData}: {place.attribution.join(" · ")}
        </span>
        {extra && (
          <span>
            {copy.googleNote}
            {extra.mapsUrl && (
              <>
                {" "}
                <a href={extra.mapsUrl} target="_blank" rel="noopener noreferrer">
                  {copy.googleSource}
                </a>
              </>
            )}
          </span>
        )}
      </footer>
    </article>
  );
}

function ReviewsTab({
  copy,
  locale,
  state,
}: {
  copy: (typeof shellCopy)[SupportedLocale];
  locale: SupportedLocale;
  state: EnrichmentState;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="am-reviews" role="status" aria-label={copy.reviewsLoading}>
        {[0, 1, 2].map((item) => (
          <div key={item} className="am-review-skeleton">
            <span className="am-skeleton-line" />
            <span className="am-skeleton-line" />
          </div>
        ))}
      </div>
    );
  }
  if (state.status === "unavailable") {
    return <p className="am-empty-note">{copy.reviewsEmpty}</p>;
  }
  const { data } = state;
  return (
    <div className="am-reviews">
      {data.rating !== undefined && data.rating !== null && (
        <div className="am-reviews-summary">
          <strong>{formatRating(data.rating, locale)}</strong>
          <span>
            <Stars value={data.rating} />
            {data.reviewCount !== undefined && data.reviewCount !== null && (
              <small>
                {copy.reviewsCount(new Intl.NumberFormat(locale).format(data.reviewCount))}
              </small>
            )}
          </span>
        </div>
      )}
      {data.reviews.length === 0 ? (
        <p className="am-empty-note">{copy.reviewsEmpty}</p>
      ) : (
        <ul className="am-review-list">
          {data.reviews.map((review, index) => (
            <li key={`${review.author}-${index}`}>
              <div className="am-review-head">
                <span className="am-avatar" aria-hidden="true">
                  {review.author.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{review.author}</strong>
                  {review.relativeTime && <small>{review.relativeTime}</small>}
                </span>
              </div>
              <Stars value={review.rating} small />
              <p>{review.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stars({ value, small = false }: { value: number; small?: boolean }) {
  return (
    <span
      className={`am-stars ${small ? "is-small" : ""}`}
      style={{ "--rating": Math.max(0, Math.min(5, value)) } as React.CSSProperties}
      role="img"
      aria-label={`${value.toFixed(1)} / 5`}
    >
      ★★★★★
    </span>
  );
}

function formatRating(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
