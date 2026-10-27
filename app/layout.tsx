import type { Metadata, Viewport } from "next";
import "@goastian/astian-ui/tokens.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./ui.css";
import "./globals.css";
import "./incidents.css";

export const metadata: Metadata = {
  title: "Astian Maps",
  description: "Mapas y rutas abiertos basados en OpenStreetMap.",
  applicationName: "Astian Maps",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#202124" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
