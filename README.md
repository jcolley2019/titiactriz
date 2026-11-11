# TitiActriz

The website of Cristyna "Titi" Polentino, actress, streamer and entrepreneur —
titiactriz.com. Spanish-first, with English at parity.

- **Working rules:** `CLAUDE.md` (laws, gates, report format).
- **Design:** `DESIGN.md`. **Product:** `PRODUCT.md`.

## Run it

```sh
npm install
npm run dev        # http://localhost:8080
```

## Check it

```sh
npm run typecheck
npm run guard
npx impeccable detect src --json
npx playwright test          # one worker, by config
```

## Ship it

Vercel deploys the site to titiactriz.com. The backend is Supabase; `npm run drift`
compares the deployed edge functions with `supabase/functions/deploy-ledger.json`.
Everything under `public/` is published as-is.
