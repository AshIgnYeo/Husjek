-- Husjek Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Pickup requests table
create table if not exists pickup_requests (
  id uuid default gen_random_uuid() primary key,
  requester_id text,
  driver_id text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'driving', 'nearby', 'arrived', 'completed', 'cancelled')),
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  driver_lat double precision,
  driver_lng double precision,
  eta_minutes integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Saved locations table
create table if not exists saved_locations (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

-- Enable real-time for pickup_requests
alter publication supabase_realtime add table pickup_requests;

-- Allow all operations (since this is a private couples app, we keep it simple)
-- In production you'd want proper RLS policies with auth
alter table pickup_requests enable row level security;
alter table saved_locations enable row level security;

create policy "Allow all on pickup_requests" on pickup_requests
  for all using (true) with check (true);

create policy "Allow all on saved_locations" on saved_locations
  for all using (true) with check (true);
