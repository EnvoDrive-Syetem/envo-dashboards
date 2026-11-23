# ENVO dashboards (GitHub Pages version)

A static website with the CEO, COO, Sales, Supply chain and Productivity dashboards.

**How it works:** a scheduled GitHub Actions job (`.github/workflows/update.yml`) runs every hour from 7am to 7pm Vancouver time. Each run:

1. Fetches every data set from Zoho Analytics (`scripts/fetch-data.ts`, queries in `lib/queries.ts`).
2. Builds the site.
3. Publishes it to GitHub Pages.

The pages read those files, so they open instantly.

**The site is public:** anyone with the link can see it. Search engines are asked not to index it. Open-card titles and customer names are never published.

## Setup

1. In the repo, go to **Settings → Secrets and variables → Actions** and add:
   - `ZOHO_CLIENT_ID`
   - `ZOHO_CLIENT_SECRET`
   - `ZOHO_REFRESH_TOKEN`

   These come from the Zoho Self Client, with scope `ZohoAnalytics.data.read`.
2. Go to **Settings → Pages → Source** and choose **GitHub Actions**.
3. Go to **Actions → Update dashboards → Run workflow**.

When it finishes, the site is at `https://<your-github-name>.github.io/<repo-name>/`.

## Local preview

```bash
npm install && npm run data:sample && npm run build
```

The site goes to `out/`. Use `npm run data` instead of `data:sample` to load real numbers; it needs the three `ZOHO_*` values as environment variables.

## Notes

- The numbers are up to an hour old. To update straight away, go to Actions and click **Run workflow**.
- GitHub pauses scheduled jobs after 60 days with no activity in the repo. Re-enable it from the Actions tab.
- Profit by channel offers preset periods only, because each period's file is built ahead of time.
- Productivity filters by one employee or one board at a time.
