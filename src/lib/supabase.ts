import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type PickupStatus =
  | "pending"
  | "accepted"
  | "driving"
  | "nearby"
  | "arrived"
  | "completed"
  | "cancelled";

export interface SavedLocation {
  id: string;
  user_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PickupRequest {
  id: string;
  requester_id: string;
  driver_id: string | null;
  status: PickupStatus;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  driver_lat: number | null;
  driver_lng: number | null;
  eta_minutes: number | null;
  created_at: string;
  updated_at: string;
}
