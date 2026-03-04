"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getActivePickup,
  subscribeToPickup,
  updatePickupStatus,
  updateDriverLocation,
} from "@/lib/store";
import { getCurrentPosition, formatDistance, getDistanceMeters, isNearby } from "@/lib/geo";
import { requestNotificationPermission, sendNotification } from "@/lib/notifications";
import type { PickupRequest } from "@/lib/supabase";

type View = "idle" | "incoming" | "accepted" | "driving";

export default function HusbandPage() {
  const [view, setView] = useState<View>("idle");
  const [pickup, setPickup] = useState<PickupRequest | null>(null);
  const [etaInput, setEtaInput] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const notifiedNearbyRef = useRef(false);

  // Load active pickup on mount
  useEffect(() => {
    requestNotificationPermission();
    getActivePickup().then((p) => {
      if (p) {
        setPickup(p);
        if (p.status === "pending") setView("incoming");
        else if (p.status === "accepted") setView("accepted");
        else if (p.status === "driving" || p.status === "nearby") {
          setView("driving");
          startLocationTracking(p.id, p.pickup_lat, p.pickup_lng);
        }
      }
    }).catch(() => {});
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = subscribeToPickup((updated) => {
      if (updated.status === "pending" && view === "idle") {
        setPickup(updated);
        setView("incoming");
        sendNotification("Pickup Request!", `She needs a ride from ${updated.pickup_address}`);
      } else if (pickup && updated.id === pickup.id) {
        setPickup(updated);
        if (updated.status === "cancelled") {
          stopLocationTracking();
          setView("idle");
          setPickup(null);
          sendNotification("Ride Cancelled", "The pickup was cancelled.");
        }
      }
    });
    return () => { channel.unsubscribe(); };
  }, [pickup, view]);

  const startLocationTracking = useCallback(
    (pickupId: string, destLat: number, destLng: number) => {
      if (!navigator.geolocation) return;
      notifiedNearbyRef.current = false;

      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          await updateDriverLocation(pickupId, latitude, longitude);

          if (isNearby(latitude, longitude, destLat, destLng) && !notifiedNearbyRef.current) {
            notifiedNearbyRef.current = true;
            await updatePickupStatus(pickupId, "nearby");
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
      watchIdRef.current = id;
    },
    []
  );

  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const acceptPickup = useCallback(async () => {
    if (!pickup) return;
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      const eta = parseInt(etaInput) || 5;
      await updatePickupStatus(pickup.id, "accepted", {
        driver_lat: pos.coords.latitude,
        driver_lng: pos.coords.longitude,
        eta_minutes: eta,
      });
      setPickup((prev) =>
        prev ? { ...prev, status: "accepted", eta_minutes: eta, driver_lat: pos.coords.latitude, driver_lng: pos.coords.longitude } : prev
      );
      setView("accepted");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setLoading(false);
    }
  }, [pickup, etaInput]);

  const leaveNow = useCallback(async () => {
    if (!pickup) return;
    setLoading(true);
    try {
      await updatePickupStatus(pickup.id, "driving");
      setPickup((prev) => (prev ? { ...prev, status: "driving" } : prev));
      setView("driving");
      startLocationTracking(pickup.id, pickup.pickup_lat, pickup.pickup_lng);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }, [pickup, startLocationTracking]);

  const arrived = useCallback(async () => {
    if (!pickup) return;
    stopLocationTracking();
    try {
      await updatePickupStatus(pickup.id, "arrived");
      setPickup(null);
      setView("idle");
    } catch {}
  }, [pickup, stopLocationTracking]);

  const declinePickup = useCallback(async () => {
    if (!pickup) return;
    try {
      await updatePickupStatus(pickup.id, "cancelled");
      setPickup(null);
      setView("idle");
    } catch {}
  }, [pickup]);

  const distance =
    pickup?.driver_lat && pickup?.driver_lng
      ? getDistanceMeters(pickup.pickup_lat, pickup.pickup_lng, pickup.driver_lat, pickup.driver_lng)
      : null;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏎️</span>
          <h1 className="text-xl font-bold">Husjek Driver</h1>
        </div>
        <button
          onClick={() => {
            stopLocationTracking();
            localStorage.removeItem("husjek-role");
            window.location.href = "/";
          }}
          className="text-gray-500 text-sm"
        >
          Switch
        </button>
      </header>

      {error && (
        <div className="mx-5 mb-4 p-3 bg-red-900/50 border border-red-700 rounded-xl text-sm text-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8">
        {/* IDLE - Waiting for requests */}
        {view === "idle" && (
          <div className="text-center bounce-in">
            <div className="text-6xl mb-6">🛋️</div>
            <h2 className="text-2xl font-bold">All clear</h2>
            <p className="text-gray-400 mt-2">No pickup requests yet</p>
            <p className="text-gray-600 text-sm mt-6">
              You&apos;ll be notified when she needs a ride
            </p>
          </div>
        )}

        {/* INCOMING request */}
        {view === "incoming" && pickup && (
          <div className="w-full max-w-sm space-y-6 bounce-in">
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-28 h-28 rounded-full bg-pink-600/20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-pink-600/20 pulse-ring" />
                  <span className="text-5xl">👸</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold mt-4">Pickup Request!</h2>
              <p className="text-gray-400 mt-2 text-sm max-w-[280px] mx-auto">
                📍 {pickup.pickup_address}
              </p>
            </div>

            <div className="bg-[#16213e] rounded-2xl p-5">
              <label className="text-sm text-gray-400 block mb-2">
                How many minutes before you leave?
              </label>
              <div className="flex gap-2">
                {["2", "5", "10", "15"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setEtaInput(m)}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      etaInput === m
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={acceptPickup}
              disabled={loading}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 rounded-2xl text-xl font-semibold transition-all active:scale-95"
            >
              {loading ? "⏳" : "Accept Pickup"}
            </button>

            <button
              onClick={declinePickup}
              className="w-full py-3 text-gray-500 hover:text-red-400 transition-colors text-sm"
            >
              Can&apos;t right now
            </button>
          </div>
        )}

        {/* ACCEPTED - Getting ready */}
        {view === "accepted" && pickup && (
          <div className="w-full max-w-sm space-y-6 slide-up">
            <div className="text-center">
              <div className="text-5xl mb-4">🏠</div>
              <h2 className="text-2xl font-bold">Getting ready</h2>
              <p className="text-gray-400 mt-1">
                ETA: {pickup.eta_minutes} min before leaving
              </p>
            </div>

            <div className="bg-[#16213e] rounded-2xl p-5 text-center">
              <p className="text-sm text-gray-400 mb-1">Picking up at</p>
              <p className="text-sm truncate">{pickup.pickup_address}</p>
            </div>

            <button
              onClick={leaveNow}
              disabled={loading}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? "⏳" : <><span>🚗</span> I&apos;m leaving now!</>}
            </button>

            <button
              onClick={declinePickup}
              className="w-full py-3 text-gray-500 hover:text-red-400 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* DRIVING - On the way */}
        {view === "driving" && pickup && (
          <div className="w-full max-w-sm space-y-6 slide-up">
            <div className="text-center">
              <div className="car-bounce text-5xl mb-4">🚗💨</div>
              <h2 className="text-2xl font-bold">
                {pickup.status === "nearby" ? "You're almost there!" : "On your way!"}
              </h2>
              <p className="text-gray-400 mt-1">Drive safe!</p>
            </div>

            {distance !== null && (
              <div className="bg-[#16213e] rounded-2xl p-5 text-center">
                <div className="text-3xl font-bold text-emerald-400">
                  {formatDistance(distance)}
                </div>
                <p className="text-gray-400 text-sm mt-1">to destination</p>
              </div>
            )}

            <div className="bg-[#16213e] rounded-2xl p-5 text-center">
              <p className="text-sm text-gray-400 mb-1">Heading to</p>
              <p className="text-sm truncate">{pickup.pickup_address}</p>
            </div>

            <button
              onClick={arrived}
              className="w-full py-5 bg-pink-600 hover:bg-pink-500 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>🎉</span> I&apos;ve arrived!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
