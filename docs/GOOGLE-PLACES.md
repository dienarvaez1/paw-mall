# Google Places: "Ver horario" at no cost

Place pages without confirmed hours show **Ver horario**. When a user taps it, the API asks Google
for the place's hours, phone and website, shows them for that visit only, and credits Google Maps.
Everything is designed to stay within Google's free monthly allowances. The design is Ferre Mall's,
in a **Google Cloud project of Paw Mall's own** (owner's decision, 2026-10-05), so the two apps
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

## Setup (a new Google Cloud project for Paw Mall)

1. Create a project at <https://console.cloud.google.com> named **Paw Mall**, then attach a
   **billing account**. Google requires one even when usage stays within the free allowance.
2. **APIs & Services → Library:** enable **Places API (New)**.
3. **APIs & Services → Credentials → Create credentials → API key.** Edit it:
   - **Name:** "Paw Mall API (server)".
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
