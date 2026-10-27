<div align="center">

<img src="docs/logo.svg" width="120" alt="Astian Maps logo">

# Astian Maps Web

An open web map and route planner. Search, nearby places, routes with stops, map layers, live community reports and a hand-off to the Android app.

[Astian Maps Android](https://github.com/goastian/astian-maps-android) · [Web repository](https://github.com/goastian/astian-maps-web)

</div>

A Next.js 15 and React 19 client rendered with MapLibre GL, on OpenStreetMap data and the
OpenMapTiles schema. It has no Google Maps or Mapbox runtime SDK. It is part of the Astian Maps
monorepo and shares contracts, translations, styles and design tokens with the FastAPI gateway
(`services/api`) and the native Android client.

![Astian Maps web map with community reports](docs/screenshots/web-map.png)

## What it does

- **Vector map** with light, dark and navigation themes, and an interface in English, Spanish,
  French and German.
- **Search** for addresses and places, plus nearby categories: restaurants, cafes, groceries,
  shops, pharmacies, hotels, fuel and chargers.
- **Place page** with address, opening hours, phone, coordinates, reviews and the open-data
  attribution.
- **Routes** by car, bike or on foot, with intermediate stops, alternatives, options to avoid
  tolls, highways and ferries, and step-by-step directions.
- **Community reports** live on the map: traffic, police, crashes, hazards, potholes,
  roadworks, closures, weather and cameras.
- **Layers**: road, satellite, terrain, cycling routes, EV chargers, live traffic, 3D buildings
  and air quality. Evaluation layers are off in production.
- **Share and continue on Android**: a canonical v1 URL carries the whole plan (origin,
  destination, stops, mode, preferences and layers) and opens it in the app.
- **Low-data mode**, saved places, distance measuring and fullscreen.
- **Responsive**: a side panel on desktop and a bottom bar on mobile.

## Community reports

The web shows the active reports in view and keeps them current from the API's event stream
(`/v1/incidents/stream`). Each type has its own color, a report fades while nobody has
confirmed it, and zoomed out they gather into counted circles. A jam paints its stretch of road
amber to dark red by level, a closure is striped red and white, and roadworks orange and white.

Reports are **read-only on the web**. They are made and confirmed in
[Astian Maps Android](https://github.com/goastian/astian-maps-android) and show up on the web
map as soon as they are sent. There is no account and no IP address is stored: the server keeps
only a salted hash of a random key that the client replaces every day.

![A community report card on the web map](docs/screenshots/web-incident.png)

Report types: traffic, police, crash, hazard, pothole, roadworks, closure, weather and camera.

## Web screenshots

All screenshots use test data in Davis, California.

| Category search | Place page |
| :---: | :---: |
| ![Nearby restaurant results](docs/screenshots/web-search.png) | ![A place page with hours and contact details](docs/screenshots/web-place.png) |

| Route with directions | Map layers |
| :---: | :---: |
| ![A car route between two places](docs/screenshots/web-route.png) | ![The layer picker](docs/screenshots/web-layers.png) |

### On mobile

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/web-mobile-map.png" width="280" alt="Web map on a phone screen"></td>
    <td align="center"><img src="docs/screenshots/web-mobile-incident.png" width="280" alt="A community report on a phone screen"></td>
  </tr>
  <tr>
    <td align="center">Map with reports and bottom bar</td>
    <td align="center">Report details</td>
  </tr>
</table>

## Astian Maps Android

The same map, routes and reports in a native app: Kotlin, Jetpack Compose and MapLibre Native,
with no Google SDK and no Play Services. It adds turn-by-turn navigation with lane guidance and
on-device voice, offline regions (map, search and routing), public transit, Android Auto and the
button to **make and confirm reports** while you drive.

Repository: **[goastian/astian-maps-android](https://github.com/goastian/astian-maps-android)**
(package `org.astian.suite.maps`).

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/android-community-map.png" width="220" alt="Android map with community reports"></td>
    <td align="center"><img src="docs/screenshots/android-community-report.png" width="220" alt="A report card on Android"></td>
    <td align="center"><img src="docs/screenshots/android-report-picker.png" width="220" alt="The report picker on Android"></td>
    <td align="center"><img src="docs/screenshots/android-community-dark.png" width="220" alt="Dark map showing every report type"></td>
  </tr>
  <tr>
    <td align="center">Reports on the map</td>
    <td align="center">Confirm a report</td>
    <td align="center">Make a report</td>
    <td align="center">Dark theme</td>
  </tr>
</table>

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/android-map.png" width="220" alt="The Android app map"></td>
    <td align="center"><img src="docs/screenshots/android-place.png" width="220" alt="A place page on Android"></td>
    <td align="center"><img src="docs/screenshots/android-drive-directions.png" width="220" alt="Drive directions on Android"></td>
    <td align="center"><img src="docs/screenshots/android-navigation-alert.png" width="220" alt="Turn-by-turn navigation with a report ahead"></td>
  </tr>
  <tr>
    <td align="center">Map</td>
    <td align="center">Place</td>
    <td align="center">Directions</td>
    <td align="center">Navigation with an alert</td>
  </tr>
</table>

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/android-layers.png" width="220" alt="The layers panel on Android"></td>
    <td align="center"><img src="docs/screenshots/android-transit.png" width="220" alt="A transit route on Android"></td>
    <td align="center"><img src="docs/screenshots/android-map-light.png" width="220" alt="The light map on Android"></td>
  </tr>
  <tr>
    <td align="center">Map types and layers</td>
    <td align="center">Public transit</td>
    <td align="center">Light theme</td>
  </tr>
</table>

### From the web to Android

The planner's **Continue on Android** button opens the same plan in the app. The v1 URL uses
the same parameter names on the web and on Android, and the HTTPS link association is served at
`/.well-known/assetlinks.json`.

## Development

Requirements: Node.js 22+ and pnpm 10+. This package depends on monorepo packages
(`@astian-maps/contracts`, `i18n`, `design-tokens` and `@astian/map-style`), so it runs from
inside the monorepo.

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm --filter @astian-maps/web dev      # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server. Builds and syncs the styles, the MapLibre worker and the calibration first. |
| `pnpm build` | Production build. |
| `pnpm start` | Serves the production build. |
| `pnpm typecheck` | Type check with `tsc --noEmit`. |
| `pnpm test` | Tests with Vitest. |

### Configuration

Every variable is documented in [`.env.example`](.env.example). The main ones:

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The Astian Maps API (`http://localhost:8000/v1` locally). Serves search, routing and reports. |
| `NEXT_PUBLIC_MAPS_WEB_URL` | Public origin for HTTPS links and shared routes. |
| `ASTIAN_TILE_SERVER_URL` | Martin origin used by the `/tiles` proxy. |
| `ASTIAN_ANDROID_SHA256_CERT_FINGERPRINTS` | Release certificate fingerprints for App Links. Empty locally. |
| `NEXT_PUBLIC_MAP_START` | Initial camera as `latitude,longitude,zoom`. |

`.env.local` stays out of the repository. The evaluation layers (satellite, terrain and cycling
routes) and the community tiles are for development only, and a process with
`NODE_ENV=production` rejects them.

### Try community reports locally

With the local API running (`services/api`), create a test report:

```bash
curl -X POST http://localhost:8000/v1/incidents \
  -H 'content-type: application/json' \
  -d '{"type":"police","subtype":"hidden","coordinates":{"latitude":38.543,"longitude":-121.739},"reporterKey":"local-dev-reporter-key","source":"android"}'
```

It appears on the web map within seconds. To try it from a phone over USB, the monorepo's
`scripts/dev-phone.sh` forwards ports 8000 and 3000 with `adb reverse`.

## Layout

```text
app/          Next.js routes: map, planner, tile proxy and App Links
components/   MapExplorer, MapCanvas, PlaceDetail and CommunityIncidents
lib/          API client, shareable routes, layers, styles, incidents and tests
public/       Styles, sprites, glyphs, icons and the SVG for each report type
scripts/      Style sync, MapLibre worker and calibration
docs/         Logo and the screenshots in this README
```

## Attribution and license

Data from [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL) and
[OpenMapTiles](https://openmaptiles.org/) tiles. Licensed under Apache-2.0. The Android app is a
derivative of Vela and is distributed under GPL-3.0; see its
[`NOTICE.md`](https://github.com/goastian/astian-maps-android/blob/main/NOTICE.md).
