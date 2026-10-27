import type { Metadata } from "next";
import { MapExplorer } from "../../components/MapExplorer";

export const metadata: Metadata = {
  title: "Ruta compartida · Astian Maps",
  description: "Abre y continúa una ruta compartida de Astian Maps.",
};

export default function SharedRoutePage() {
  return <MapExplorer />;
}
