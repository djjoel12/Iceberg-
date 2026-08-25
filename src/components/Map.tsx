"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const startIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const endIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

type Point = {
  lat: number;
  lng: number;
  name?: string;
};

type Props = {
  start: Point | null;
  end: Point | null;
  routeGeometry?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
};

function ClickHandler({
  onMapClick,
}: {
  onMapClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ start, end }: { start: Point | null; end: Point | null }) {
  const map = useMap();

  useEffect(() => {
    if (start && end) {
      map.fitBounds(
        [
          [start.lat, start.lng],
          [end.lat, end.lng],
        ],
        { padding: [50, 50] }
      );
    } else if (start) {
      map.setView([start.lat, start.lng], 14);
    } else if (end) {
      map.setView([end.lat, end.lng], 14);
    }
  }, [start, end, map]);

  return null;
}

export default function Map({ start, end, routeGeometry, onMapClick }: Props) {
  return (
    <MapContainer
      center={[5.3364, -4.0267]}
      zoom={12}
      scrollWheelZoom
      style={{ width: "100%", height: "400px" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <ClickHandler onMapClick={onMapClick} />
      <FitBounds start={start} end={end} />

      {start && (
        <Marker position={[start.lat, start.lng]} icon={startIcon}>
          <Popup>
            <strong>Départ</strong>
            <br />
            {start.name || "Point de départ"}
          </Popup>
        </Marker>
      )}

      {end && (
        <Marker position={[end.lat, end.lng]} icon={endIcon}>
          <Popup>
            <strong>Arrivée</strong>
            <br />
            {end.name || "Destination"}
          </Popup>
        </Marker>
      )}

      {routeGeometry && routeGeometry.length > 1 && (
        <Polyline positions={routeGeometry} color="#111827" weight={5} opacity={0.85} />
      )}
    </MapContainer>
  );
}
