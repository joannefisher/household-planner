# Fisher-Oakley household planner

A web app for the kitchen iPad and our iPhones: the next 7 days, dinners, and a live shopping list.

Built with Next.js, hosted on Vercel, with Supabase for the database, sign-in and live sync. Runs on free tiers.

## Running it

| Setting (Vercel → Project → Settings → Environment Variables) | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://szibrbkxvezqvumyjhdn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key from Supabase → Project Settings → API Keys |

Locally: copy `.env.example` to `.env.local`, then `npm install` and `npm run dev`.

## Supabase settings

- **Authentication → URL Configuration:** Site URL is `https://household-planner-liard.vercel.app`, and `https://household-planner-liard.vercel.app/auth/callback` is in Redirect URLs.
- Sign-in is email and password. The first time, each adult picks "Create your password" and opens the confirmation email once.
- Only the emails on the household's member list can create a password. Anyone else is refused by a database rule.
- Forgotten password: request the reset in Safari and open the email link on the same device, because Home Screen apps keep their sign-in separate from Safari.

## On the iPad

1. Open the site in Safari, sign in, then Share → Add to Home Screen.
2. Settings → Display & Brightness → Auto-Lock → Never.
3. Settings → Accessibility → Guided Access → on. Open the planner and triple-click the top button to lock the iPad to it.

The screen dims itself from 22:00 to 06:30; tap it to wake it for two minutes.

## Code map

- `src/components/Planner.tsx`: the screen; the kitchen layout appears at 900px wide and up
- `src/components/Week.tsx`: 7 day columns with events and dinners
- `src/components/ShoppingList.tsx`: the list, usuals and edit sheet
- `src/lib/useShoppingList.ts`: live sync, plus a queue that saves changes made without signal
- `src/lib/parse.ts`: splits "eggs, bread and 2 tins of tomatoes" into items and guesses aisles
- `src/lib/weather.ts`: Open-Meteo forecast (free, no key)
