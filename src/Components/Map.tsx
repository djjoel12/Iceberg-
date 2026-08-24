"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

const defaultPosition: [number, number] = [
  5.3364,
  -4.0267,
];

const markerIcon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function Map() {
  return (
    <MapContainer
      center={defaultPosition}
      zoom={12}
      scrollWheelZoom={true}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "400px",
        borderRadius: "16px",
      }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker
        position={defaultPosition}
        icon={markerIcon}
      >
        <Popup>
          📍 Abidjan
        </Popup>
      </Marker>
    </MapContainer>
  );
}
