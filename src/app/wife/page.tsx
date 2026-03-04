"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  createPickupRequest,
  getActivePickup,
  getSavedLocations,
  addSavedLocation,
  deleteSavedLocation,
  subscribeToPickup,
  updatePickupStatus,
} from "@/lib/store";
import { getCurrentPosition, reverseGeocode, formatDistance, getDistanceMeters } from "@/lib/geo";
import { requestNotificationPermission, sendNotification } from "@/lib/notifications";
import type { PickupRequest, SavedLocation } from "@/lib/supabase";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

type View = "idle" | "picking-location" | "waiting" | "tracking";

export default function WifePage() {
  const [view, setView] = useState<View>("idle");
  const [pickup, setPickup] = useState<PickupRequest | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLocName, setNewLocName] = useState("");
  const [showAddLoc, setShowAddLoc] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  // Load active pickup on mount
  useEffect(() => {
    requestNotificationPermission();
    getActivePickup().then((p) => {
      if (p) {
        setPickup(p);
        prevStatusRef.current = p.status;
        if (p.status === "pending") setView("waiting");
        else if (["accepted", "driving", "nearby"].includes(p.status)) setView("tracking");
      }
    }).catch(() => {});
    getSavedLocations().then(setSavedLocations).catch(() => {});
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = subscribeToPickup((updated) => {
      if (pickup && updated.id === pickup.id) {
        const prev = prevStatusRef.current;
        setPickup(updated);
        prevStatusRef.current = updated.status;

        if (prev !== updated.status) {
          if (updated.status === "accepted") {
            sendNotification("Pickup Accepted!", `Your driver is getting ready. ETA: ${updated.eta_minutes || "?"} min`);
            setView("tracking");
          } else if (updated.status === "driving") {
            sendNotification("Driver is on the way!", "Your driver has left and is heading to you.");
          } else if (updated.status === "nearby") {
            sendNotification("Driver is nearby!", "Almost there! Get ready.");
          } else if (updated.status === "arrived") {
            sendNotification("Driver has arrived!", "Your ride is here!");
            setView("idle");
            setPickup(null);
          } else if (updated.status === "cancelled") {
            setView("idle");
            setPickup(null);
          }
        }
      } else if (!pickup && ["pending", "accepted", "driving", "nearby"].includes(updated.status)) {
        setPickup(updated);
        prevStatusRef.current = updated.status;
        if (updated.status === "pending") setView("waiting");
        else setView("tracking");
      }
    });
    return () => { channel.unsubscribe(); };
  }, [pickup]);

  const requestPickup = useCallback(
    async (address: string, lat: number, lng: number) => {
      setLoading(true);
      setError(null);
      try {
        const p = await createPickupRequest(address, lat, lng);
        setPickup(p);
        prevStatusRef.current = p.status;
        setView("waiting");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to request pickup");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const useCurrentLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      await requestPickup(address, pos.coords.latitude, pos.coords.longitude);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not get location");
    } finally {
      setLoading(false);
    }
  }, [requestPickup]);

  const saveCurrentLocation = useCallback(async () => {
    if (!newLocName.trim()) return;
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      const loc = await addSavedLocation(newLocName.trim(), address, pos.coords.latitude, pos.coords.longitude);
      setSavedLocations((prev) => [...prev, loc]);
      setNewLocName("");
      setShowAddLoc(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save location");
    } finally {
      setLoading(false);
    }
  }, [newLocName]);

  const cancelPickup = useCallback(async () => {
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
          <span className="text-2xl">👸</span>
          <h1 className="text-xl font-bold">Husjek</h1>
        </div>
        <button
          onClick={() => {
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
        {/* IDLE - Call for pickup */}
        {view === "idle" && (
          <div className="w-full max-w-sm space-y-6 bounce-in">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🚗</div>
              <h2 className="text-2xl font-bold">Need a ride?</h2>
              <p className="text-gray-400 mt-1">Call your personal driver</p>
            </div>

            <button
              onClick={useCurrentLocation}
              disabled={loading}
              className="w-full py-5 bg-pink-600 hover:bg-pink-500 disabled:bg-pink-800 rounded-2xl text-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <span>📍</span> Use current location
                </>
              )}
            </button>

            {savedLocations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400 px-1">Saved locations</p>
                {savedLocations.map((loc) => (
                  <div key={loc.id} className="flex gap-2">
                    <button
                      onClick={() => requestPickup(loc.address, loc.lat, loc.lng)}
                      disabled={loading}
                      className="flex-1 py-4 px-5 bg-[#16213e] hover:bg-[#1a2744] rounded-xl text-left transition-all active:scale-[0.98]"
                    >
                      <div className="font-medium">{loc.name}</div>
                      <div className="text-sm text-gray-400 truncate">{loc.address}</div>
                    </button>
                    <button
                      onClick={async () => {
                        await deleteSavedLocation(loc.id);
                        setSavedLocations((prev) => prev.filter((l) => l.id !== loc.id));
                      }}
                      className="px-3 text-gray-600 hover:text-red-400 transition-colors"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!showAddLoc ? (
              <button
                onClick={() => setShowAddLoc(true)}
                className="w-full py-3 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                + Save current location
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Location name (e.g. Office)"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  className="flex-1 px-4 py-3 bg-[#16213e] rounded-xl outline-none focus:ring-2 focus:ring-pink-500"
                  autoFocus
                />
                <button
                  onClick={saveCurrentLocation}
                  disabled={!newLocName.trim() || loading}
                  className="px-5 py-3 bg-pink-600 rounded-xl font-medium disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}

        {/* WAITING for driver to accept */}
        {view === "waiting" && pickup && (
          <div className="text-center space-y-6 bounce-in">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-full bg-pink-600/20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-pink-600/20 pulse-ring" />
                <span className="text-5xl">📱</span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Calling your driver...</h2>
              <p className="text-gray-400 mt-2">Waiting for him to accept</p>
              <p className="text-sm text-gray-500 mt-4 max-w-[280px] truncate">
                📍 {pickup.pickup_address}
              </p>
            </div>
            <button
              onClick={cancelPickup}
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {/* TRACKING driver */}
        {view === "tracking" && pickup && (
          <div className="w-full max-w-sm space-y-6 slide-up">
            <div className="text-center">
              <div className="car-bounce text-5xl mb-4">
                {pickup.status === "accepted" ? "🏠" : pickup.status === "nearby" ? "🚗💨" : "🚗"}
              </div>
              <h2 className="text-2xl font-bold">
                {pickup.status === "accepted" && "Driver is getting ready"}
                {pickup.status === "driving" && "On the way!"}
                {pickup.status === "nearby" && "Almost there!"}
              </h2>
              {pickup.eta_minutes && pickup.status === "accepted" && (
                <p className="text-gray-400 mt-1">
                  Leaving in ~{pickup.eta_minutes} min
                </p>
              )}
            </div>

            {/* Live map */}
            {["driving", "nearby"].includes(pickup.status) && (
              <LiveMap
                pickupLat={pickup.pickup_lat}
                pickupLng={pickup.pickup_lng}
                driverLat={pickup.driver_lat}
                driverLng={pickup.driver_lng}
              />
            )}

            {/* Distance indicator */}
            {distance !== null && ["driving", "nearby"].includes(pickup.status) && (
              <div className="bg-[#16213e] rounded-2xl p-5 text-center">
                <div className="text-3xl font-bold text-emerald-400">
                  {formatDistance(distance)}
                </div>
                <p className="text-gray-400 text-sm mt-1">away from you</p>
              </div>
            )}

            {/* Status timeline */}
            <div className="bg-[#16213e] rounded-2xl p-5 space-y-4">
              <StatusStep
                done={["accepted", "driving", "nearby"].includes(pickup.status)}
                active={pickup.status === "accepted"}
                label="Pickup accepted"
              />
              <StatusStep
                done={["driving", "nearby"].includes(pickup.status)}
                active={pickup.status === "driving"}
                label="Driver has left"
              />
              <StatusStep
                done={pickup.status === "nearby"}
                active={pickup.status === "nearby"}
                label="Driver is nearby"
              />
            </div>

            <p className="text-sm text-gray-500 text-center truncate">
              📍 Pickup: {pickup.pickup_address}
            </p>

            <button
              onClick={cancelPickup}
              className="w-full py-3 text-gray-500 hover:text-red-400 transition-colors text-sm"
            >
              Cancel ride
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusStep({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          done
            ? "bg-emerald-500 text-white"
            : "bg-gray-700 text-gray-400"
        } ${active ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#16213e]" : ""}`}
      >
        {done ? "✓" : "·"}
      </div>
      <span className={done ? "text-white" : "text-gray-500"}>{label}</span>
    </div>
  );
}
