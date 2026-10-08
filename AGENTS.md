# Project guidelines

- This is a self-hosted Cloudflare photography gallery. Read README.md before deployment.
- Keep the bindings DB, BUCKET and ASSETS. Use worker/index.ts and wrangler.jsonc.
- Never commit credentials, .dev.vars, .env files, photos, database exports, .wrangler, node_modules or dist.
- Keep server-side authentication and origin checks for administration and writes.
- Append database migrations; do not rewrite applied migrations.
- Use pnpm and preserve pnpm-lock.yaml.
- Validate changes with pnpm run typecheck, pnpm run lint, pnpm run test and pnpm run build.
- Deploy only to explicitly authorized resources.
