import { supabase, PickupRequest, SavedLocation } from "./supabase";

// ---- Pickup Requests ----

export async function createPickupRequest(
  pickup_address: string,
  pickup_lat: number,
  pickup_lng: number
): Promise<PickupRequest> {
  const { data, error } = await supabase
    .from("pickup_requests")
    .insert({
      pickup_address,
      pickup_lat,
      pickup_lng,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getActivePickup(): Promise<PickupRequest | null> {
  const { data, error } = await supabase
    .from("pickup_requests")
    .select()
    .in("status", ["pending", "accepted", "driving", "nearby"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePickupStatus(
  id: string,
  status: string,
  extra?: Partial<PickupRequest>
): Promise<PickupRequest> {
  const { data, error } = await supabase
    .from("pickup_requests")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDriverLocation(
  id: string,
  driver_lat: number,
  driver_lng: number
): Promise<void> {
  const { error } = await supabase
    .from("pickup_requests")
    .update({ driver_lat, driver_lng, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export function subscribeToPickup(
  onUpdate: (pickup: PickupRequest) => void
) {
  return supabase
    .channel("pickup-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "pickup_requests",
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as PickupRequest);
        }
      }
    )
    .subscribe();
}

// ---- Saved Locations ----

export async function getSavedLocations(): Promise<SavedLocation[]> {
  const { data, error } = await supabase
    .from("saved_locations")
    .select()
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function addSavedLocation(
  name: string,
  address: string,
  lat: number,
  lng: number
): Promise<SavedLocation> {
  const { data, error } = await supabase
    .from("saved_locations")
    .insert({ name, address, lat, lng })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSavedLocation(id: string): Promise<void> {
  const { error } = await supabase.from("saved_locations").delete().eq("id", id);
  if (error) throw error;
}
