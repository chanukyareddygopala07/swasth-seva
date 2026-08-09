"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface NearbyHospital {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  distance_km: number;
  eta_minutes?: number | null;
  rating?: number | null;
  occupancy_pct?: number | null;
}

export default function NearbyPage() {
  const [lat, setLat] = useState("17.3850");
  const [lng, setLng] = useState("78.4867");
  const [locating, setLocating] = useState(false);

  const { data: hospitals, isLoading, refetch } = useQuery<NearbyHospital[]>({
    queryKey: ["nearby-hospitals", lat, lng],
    queryFn: () => api<NearbyHospital[]>(`/maps/nearby-hospitals?lat=${lat}&lng=${lng}&radius_km=25`),
    enabled: false,
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLng(pos.coords.longitude.toFixed(4));
        setLocating(false);
        refetch();
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Nearby hospitals</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-primary" /> Search near a location
          </CardTitle>
          <CardDescription>Find hospitals sorted by distance and ETA.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="lat" className="text-xs font-medium text-muted-foreground">Latitude</label>
            <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} className="w-32" />
          </div>
          <div className="space-y-1">
            <label htmlFor="lng" className="text-xs font-medium text-muted-foreground">Longitude</label>
            <Input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} className="w-32" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} disabled={isLoading}>Search</Button>
            <Button variant="outline" onClick={useMyLocation} disabled={locating}>
              <LocateFixed className="size-4" /> {locating ? "Locating…" : "Use my location"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36" /> <Skeleton className="h-36" />
        </div>
      ) : hospitals ? (
        <div className="grid gap-4 md:grid-cols-2">
          {hospitals.map((h) => (
            <Card key={h.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{h.name}</CardTitle>
                    <CardDescription>{h.address ?? h.city ?? "—"}</CardDescription>
                  </div>
                  <Badge variant="info">{h.distance_km} km</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-xs">
                {h.eta_minutes != null && <Badge variant="outline">🚗 {h.eta_minutes} min ETA</Badge>}
                {h.rating != null && <Badge variant="success">★ {h.rating}</Badge>}
                {h.occupancy_pct != null && <Badge variant="warning">{h.occupancy_pct}% occupied</Badge>}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  asChild
                >
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${h.name} ${h.address ?? ""}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="size-3.5" /> Navigate
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Enter coordinates or use your location to find nearby hospitals.</p>
      )}
    </div>
  );
}
