export type GeoResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (!query || query.trim().length < 3) return [];

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: `${query}, Abidjan, Côte d'Ivoire`,
      format: "json",
      addressdetails: "1",
      limit: "5",
      countrycodes: "ci",
    });

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Iceberg-VTC-Comparator/1.0 (contact@iceberg.local)",
    },
  });

  if (!res.ok) return [];

  const data = await res.json();

  return data.map((item: any) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
  }));
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string> {
  const url =
    "https://nominatim.openstreetmap.org/reverse?" +
    new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
    });

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Iceberg-VTC-Comparator/1.0 (contact@iceberg.local)",
    },
  });

  if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const data = await res.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
