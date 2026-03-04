# Husjek 🚗

**Husband + Gojek = Husjek** — A personal pickup service app for couples.

## How it works

1. **She** opens the app, taps "Call for pickup" with her current location or a saved spot
2. **He** gets a notification, accepts with an ETA
3. When he leaves, he taps "I'm leaving now" — she gets notified
4. She can live-track his location as he drives to her
5. She gets a notification when he's nearby (< 500m)

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a free project.

### 2. Run the database schema

Copy the contents of `supabase-schema.sql` and run it in your Supabase SQL Editor.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase URL and anon key from your project settings.

### 4. Install and run

```bash
npm install
npm run dev
```

### 5. Install as PWA

Open the app on both phones. In your browser menu, tap "Add to Home Screen" to install it as an app.

## Tech stack

- **Next.js** — React framework
- **Supabase** — Real-time database & subscriptions
- **Tailwind CSS** — Styling
- **Geolocation API** — Live location tracking
- **Web Notifications** — Push alerts
- **PWA** — Installable on mobile
