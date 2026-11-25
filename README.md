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

## More features (Family → More)

- **Calendar on your iPhone**: make a link per person (or the whole family) and tap "Add to this iPhone", or paste it in Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar. Read-only: add events in the planner. "New link" stops an old link working.
- **Bring events over from Cozi**: paste the Cozi shared calendar link (or pick a .ics file), check the count, then import. Running it again skips events already here.
- **Lists**: to-do lists on phones (third tab) and on the kitchen screen (Shopping / Lists switch).
- **Gift ideas**: wishlists under the phone Lists tab, for signed-in adults only. They never show on the kitchen screen (900px and wider).
- **Dinners and recipes**: tap the 📖 by a dinner, or Family → Dinners and recipes. Paste a recipe link to save it, plan it for a day, then add its ingredients (scaled, staples left off, merged with the list) to the shopping list.
- **Week / Month**: switch at the top of the calendar. The month shows each day's events as bars in each person's colour (titles on the kitchen screen); tap a day to open its week.
- **Reminders**: 1 hour, 1 day, 1 week or 1 month before. They show as cards on screen, and as alerts on iPhones subscribed to the calendar if Remove Alerts is off for that calendar.
- **Daily to-dos**: under each day. Unticked ones carry over to today until done. "Regular jobs" repeat daily, weekly, fortnightly or monthly; if one isn't ticked, it carries over instead of piling up (tables `day_todos`, `day_todo_repeats`).
- **Editing text**: tap the words of a shopping item or list item to change them; "⋯" opens the rest.
- **Siri shortcuts**: each adult makes their own key in Family → Siri shortcuts and follows the steps there to build "Add to shopping" and "What's for dinner" in the Shortcuts app.

Routes that work without signing in check a secret token in the database instead: `/api/calendar/[token]` (`calendar_feed()`), `/api/siri/add` (`add_shopping_items()`) and `/api/siri/dinner` (`dinner_tonight()`). New styles live in `src/app/features.css`.
