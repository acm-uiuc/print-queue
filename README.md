# ACM@UIUC Print Queue

Astro application deployed as a Cloudflare Worker. The browser authenticates
with Microsoft Entra ID and sends print jobs to the configured print-service
API.

## Local development

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy `.dev.vars.example` to `.dev.vars` and fill in the Entra application
   values. Register the same redirect URLs in Entra.

3. Start Astro in the Cloudflare Workers runtime:

   ```bash
   bun run dev
   ```

The app is available at `http://localhost:4321`.

## Verification

```bash
bun run check
bun run test
bun run build
bunx wrangler deploy --dry-run
```

## Deployment

Configure the variables listed in `.dev.vars.example` in the Cloudflare Worker
environment, then run:

```bash
bun run deploy
```

`ENABLE_DEMO_ROUTES` defaults to `false`; set it to `true` only in development
to expose the simulated queue.
