"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LiveMapProps {
  pickupLat: number;
  pickupLng: number;
  driverLat: number | null;
  driverLng: number | null;
}

export default function LiveMap({ pickupLat, pickupLng, driverLat, driverLng }: LiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([pickupLat, pickupLng], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Pickup marker (her location)
    const pickupIcon = L.divIcon({
      html: '<div style="font-size:28px;text-align:center;line-height:1">📍</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      className: "",
    });
    pickupMarkerRef.current = L.marker([pickupLat, pickupLng], { icon: pickupIcon })
      .addTo(map)
      .bindTooltip("Pickup", { permanent: true, direction: "top", offset: [0, -30] });

    // Driver marker
    const driverIcon = L.divIcon({
      html: '<div style="font-size:28px;text-align:center;line-height:1">🚗</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      className: "",
    });
    driverMarkerRef.current = L.marker(
      [driverLat ?? pickupLat, driverLng ?? pickupLng],
      { icon: driverIcon }
    ).addTo(map);

    if (driverLat && driverLng) {
      map.fitBounds(
        L.latLngBounds([pickupLat, pickupLng], [driverLat, driverLng]),
        { padding: [50, 50] }
      );
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update driver marker position
  useEffect(() => {
    if (!driverMarkerRef.current || !mapRef.current || !driverLat || !driverLng) return;

    driverMarkerRef.current.setLatLng([driverLat, driverLng]);

    // Fit both markers in view
    mapRef.current.fitBounds(
      L.latLngBounds([pickupLat, pickupLng], [driverLat, driverLng]),
      { padding: [50, 50], maxZoom: 16, animate: true }
    );
  }, [driverLat, driverLng, pickupLat, pickupLng]);

  return (
    <div
      ref={containerRef}
      className="w-full h-56 rounded-2xl overflow-hidden border border-gray-700/50"
    />
  );
}
