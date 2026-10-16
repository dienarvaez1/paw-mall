# Google Places: "Ver horario" at no cost

Place pages without confirmed hours show **Ver horario**. When a user taps it, the API asks Google
for the place's hours, phone and website, shows them for that visit only, and credits Google Maps.
Everything is designed to stay within Google's free monthly allowances. The design is Ferre Mall's,
in a **Google Cloud project of Pet Helper's own** (owner's decision, 2026-10-05), so the two apps
never share an allowance.

## How it stays free

| Step                                                                    | Google product (SKU)              | Free per month | Our limit                        |
| ----------------------------------------------------------------------- | --------------------------------- | -------------- | -------------------------------- |
| Find the place's Google listing (once per place; the place id is saved) | Text Search Essentials (IDs Only) | Unlimited      | —                                |
| Hours, phone, website, name and location                                | Place Details Enterprise          | 1,000          | **950** (`GOOGLE_MONTHLY_LIMIT`) |

- **Monthly ceiling.** The API counts detail requests per month (Pacific time, like Google's
  billing) in `google_usage` and stops at 950. After that the app says hours are unavailable until
  next month.
- **Per-user limit.** 5 lookups per day (`GOOGLE_DAILY_LOOKUPS`), keyed by a hash of the IP and the
  day (`google_lookups`, kept 2 days). The IP itself is never stored.
- **Only when needed.** Places with confirmed hours, unnamed places and places Google has no
  listing for never call Google. Urgencias and lists never call Google on their own; only a tap on
  "Ver horario" does.
- **Match check.** The free search only returns an id, so the paid answer is checked (within 150 m,
  similar name) before it's shown. A mismatch is remembered and never paid for again.
- **Nothing else stored.** Google's terms allow keeping place ids only; hours, phone and website are
  never saved, and they never count as "confirmed" hours for "Abierto ahora".
- Prices as of October 2026: <https://developers.google.com/maps/billing-and-pricing/pricing>.

## Setup (a new Google Cloud project for Pet Helper)

1. Create a project at <https://console.cloud.google.com> named **Pet Helper**, then attach a
   **billing account**. Google requires one even when usage stays within the free allowance.
2. **APIs & Services → Library:** enable **Places API (New)**.
3. **APIs & Services → Credentials → Create credentials → API key.** Edit it:
   - **Name:** "Pet Helper API (server)".
   - **API restrictions:** restrict the key to **Places API (New)** only.
   - Application restrictions: none; the key is only used by the API server, never in the app.
4. **APIs & Services → Places API (New) → Quotas:** a second safety net in case of a bug on our
   side.
   - Place Details requests per day: **30**
   - Text Search requests per day: **300**
5. **Billing → Budgets & alerts:** create a budget of **$1** for the project, with email alerts at
   50% and 100%.
6. Locally: copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and paste the key after
   `GOOGLE_PLACES_API_KEY=` **in your editor** (never in chat or in a commit; `.dev.vars` is
   gitignored). Restart `pnpm --filter api dev`.

Without a key, everything else works and "Ver horario" says hours aren't available.

In production (only when the owner decides to deploy) the key would be a Worker secret:
`wrangler secret put GOOGLE_PLACES_API_KEY` from `apps/api`.

## Checking usage

```sql
SELECT * FROM google_usage ORDER BY month DESC;              -- requests per month and SKU
SELECT google_match_status, count(*) FROM places GROUP BY 1; -- matched / no_match / never looked up
```

## Android map key (development builds)

Expo Go's own Google Maps key is refused on recent Android emulators ("Authorization failure"), so
Android runs as a **development build** with Pet Helper's own key, in the same Google Cloud project.
iOS keeps Apple Maps and Expo Go.

1. **APIs & Services → Library:** enable **Maps SDK for Android**.
2. **APIs & Services → Credentials → Create credentials → API key.** Edit it:
   - **Name:** "Pet Helper Android maps (dev)".
   - **Application restrictions:** Android apps → add package **`dev.pethelper.app`** with the debug
     signing SHA-1 **`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`** (the React
     Native template's debug keystore, `android/app/debug.keystore` after a prebuild).
   - **API restrictions:** Maps SDK for Android only.
3. Put it in `apps/mobile/.env.local` (git-ignored) as `GOOGLE_MAPS_ANDROID_KEY=…` (see
   `apps/mobile/.env.example`). Never commit or print it.
4. Build and run on the emulator or a USB phone: `pnpm --filter mobile android:dev`. It needs
   **JDK 17**: Android Studio's bundled JDK (25) fails in the native CMake step ("A restricted
   method in java.lang.System has been called"). Gradle's own copy works:
   `JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/jdk-17.0.20.1+1/Contents/Home`, with
   `ANDROID_HOME=~/Library/Android/sdk`. After a key change, rebuild
   (`npx expo prebuild --platform android --clean`, then `android:dev`).

The emulator doesn't read the Mac's location: `pnpm --filter mobile emulator:location` sets it
(precise with `brew install --cask corelocationcli`, else approximate from the IP), or pass a
latitude and longitude. Then tap the app's location button.

`pnpm --filter mobile start` keeps opening Expo Go (`--go`), for iPhones and quick checks.
`dev.pethelper.app` is a development package name only, not the store ID (still an open decision).
