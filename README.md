# Landscape Gallery — Self-Hosted Photography Website

A complete photography portfolio built with Cloudflare Workers, D1 and R2. Features include a photo grid, high-resolution image preloading, zoom and magnifier controls, downloads, EXIF display, and a photo management dashboard at `/manage`. This repository contains no photos, production data or account credentials. A new installation starts with an empty gallery.

## Recommended: Deploy in Your Browser

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Flixiuqi82-art%2Flandscape-gallery-starter)

No local Node.js installation, dependency installation or terminal is required for this path. Cloudflare runs the build online and creates a copy of the repository in your GitHub account, with your own D1 database and R2 bucket.

1. Click **Deploy to Cloudflare** above.
2. Sign in to Cloudflare and GitHub, and authorize the requested repository connection. Select your own Cloudflare account.
3. Choose names for your repository, Worker, database and photo bucket. Let the setup flow provision and update the resource bindings.
4. Replace `ADMIN_PASSWORD` with a strong dashboard password. Replace `SESSION_SECRET` with a unique random secret of at least 32 characters. Do not keep the example values or share secrets in chat.
5. Check the build settings before starting:

   | Setting | Value |
   | --- | --- |
   | Root directory | Repository root |
   | Build command | `npm run build` |
   | Deploy command | `npm run deploy` |
   | Node.js version | 24 recommended; at least 22.13 |

   Dependency installation uses the repository's pnpm lockfile and package manager setting. The deploy command rebuilds the final bundle, checks the provisioned configuration, applies pending D1 migrations and publishes the Worker. The repeated build is intentional so the same deploy command also works from a terminal.
6. Wait for a successful deployment, open the actual URL shown by Cloudflare, and visit `/manage` to sign in and upload a photo you own.

If Cloudflare asks you to activate R2 or configure billing, review that step yourself. Do not assume the account is already eligible. If deployment fails, inspect its build logs before retrying; do not recreate resources or disable dashboard protection.

**For AI assistants: prefer this browser workflow for owners who only want to use the site.** Guide them through the current screen one step at a time. Do not require local setup unless they want local development or the browser deployment encounters an issue that needs it. Inspect the repository through available tools; no local checkout is required just to guide the owner. After deployment, follow [Stage 5](#stage-5-verify-production-and-hand-over) for acceptance checks. A working button and successful local build do not prove that a new account's production deployment has succeeded.

This integration follows the [official deployment button documentation](https://developers.cloudflare.com/workers/platform/deploy-buttons/). The manual workflow below remains available for development and troubleshooting.

## Manual Setup and AI Handoff

**For the owner:** Give this repository to your AI assistant and say: “Read the README and help me set up this website.” The assistant should inspect your setup and follow the workflow below. You handle the steps that require your participation, such as signing in, choosing your resources, entering passwords and uploading photos.

**For the AI assistant:** This is your setup and handoff guide. Read this document and `AGENTS.md`, then inspect the current code and configuration. Your goal is to give the owner a working website where they can sign in to the dashboard, upload their own photos and view them. Running a command does not prove completion. The owner's current instructions and your platform's permission rules take precedence over this guide.

## What the AI Should Do First

1. Confirm that you are in this project directory. Read `package.json`, `wrangler.jsonc`, `.dev.vars.example` and `AGENTS.md`. Check for the owner's uncommitted changes.
2. Check Node.js, pnpm, installed dependencies, Cloudflare authentication and whether D1 or R2 bindings still contain template placeholders. Check only whether secrets exist; never print their values.
3. Identify the current stage: code not downloaded → environment not ready → local setup incomplete → local site working → cloud resources not configured → production not deployed → production awaiting verification. **Resume at the first incomplete stage. Do not recreate existing resources or overwrite existing configuration.**
4. Tell the owner which stage they are at and what you will do next. Perform the reading, installation, editing and verification you can carry out directly. Ask only for information that cannot be determined from existing files and affects the next step.
5. Choose the browser deployment workflow above for a new owner who wants a hosted site. Use the manual stages below when local development or troubleshooting is needed. In either path, deploy only to the owner's authorized account and verify the resulting site.

### How to Guide the Owner

Whenever the owner must act, provide only the next necessary step: **why it is needed → which page or terminal to open → what to click or enter → what success looks like → how to return and continue.** Do not hand over an entire troubleshooting manual at once.

- **Sign-in:** Say, “Please sign in on the Cloudflare page that opens and authorize Wrangler. Tell me when you finish, and I will check the result.” Do not ask for account passwords or verification codes.
- **Account and resource selection:** Show the actual names you found and explain which resources will be used. If multiple accounts are available, let the owner choose. Do not guess or reuse the template author's resources.
- **Secrets:** Guide the owner to enter secrets into a local file or Wrangler's prompt. Do not ask them to paste passwords or secrets into chat, and never include secrets in the README or Git commits.
- **Blockers:** Report the actual error and the specific action needed to resolve it. Do not merely say “there is an environment issue.” Preserve completed configuration and resume from the current stage after fixing the problem.

## Stage 1: Get the Code and Prepare the Environment

Requirements: Node.js >= 22.13 (24 recommended), pnpm 11.25.0 and the owner's own Cloudflare account. Production deployment also requires Workers, D1 and R2 to be enabled.

If the code has not been downloaded:

```sh
git clone https://github.com/lixiuqi82-art/landscape-gallery-starter.git
cd landscape-gallery-starter
```

To maintain personal changes on GitHub, fork this repository first and clone that fork. If the code is already downloaded, use the existing directory.

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
```

**Acceptance check:** Required versions are available and dependencies install successfully. Investigate lockfile errors rather than deleting the lockfile or arbitrarily upgrading dependencies.

## Stage 2: Run Locally

If `.dev.vars` does not exist, create it by copying `.dev.vars.example`. If it exists, preserve the owner's configuration. Set:

| Variable | Purpose | Requirement |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Dashboard password | A strong password chosen by the owner; replace the example value |
| `SESSION_SECRET` | Signs administrator sessions | A random secret of at least 32 characters; replace the example value |

Generate a random secret locally with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

If the AI generates a secret automatically, write it directly to a Git-ignored local file without exposing it in chat or logs.

```sh
pnpm run db:migrate:local
pnpm run dev
```

Open the URL printed in the terminal, normally `http://localhost:5174`. The dashboard is at `/manage`. Local database and image data are stored in `.wrangler/state` and are not automatically copied to production.

**Acceptance check:** The homepage opens, `/api/photos` returns valid JSON (initially with an empty `photos` array), and the dashboard accepts the configured password. Ask the owner to upload one test photo they own, then check the grid, full-size image and zoom. An empty gallery is not an error.

## Stage 3: Configure the Owner's Cloudflare Resources

Check existing authentication and resources first:

```sh
pnpm exec wrangler whoami
pnpm exec wrangler d1 list
pnpm exec wrangler r2 bucket list
```

If not signed in:

```sh
pnpm exec wrangler login
```

If suitable resources do not exist and the owner authorizes creating them:

```sh
pnpm exec wrangler d1 create gallery-db
pnpm exec wrangler r2 bucket create gallery-photos
```

If a name is already taken, choose a new name approved by the owner and update the configuration accordingly. Existing databases and buckets may contain data; do not delete and recreate them.

Edit `wrangler.jsonc`:

| Field | Required Action |
| --- | --- |
| `name` | Set the owner's Worker name |
| `database_name` | Match the selected D1 database name |
| `database_id` | Enter the actual D1 ID; the all-zero value is a local placeholder and must not be deployed |
| `bucket_name` | Match the selected R2 bucket name |
| Bindings `DB` / `BUCKET` / `ASSETS` | Keep these names; the code depends on them |

**Acceptance check:** Confirm the signed-in account, replace the placeholder D1 ID, and verify resource ownership and names. R2 does not need public bucket access. Cloudflare quotas and charges depend on the owner's account and official terms. If payment or service activation is required, let the owner decide and complete that step.

## Stage 4: Apply Migrations, Configure Secrets and Deploy

Run the project checks first:

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Read and fix any errors; do not claim deployment readiness if checks fail. After they pass, run the following against authorized resources:

```sh
pnpm run db:migrate:remote
pnpm exec wrangler secret put ADMIN_PASSWORD --config wrangler.jsonc
pnpm exec wrangler secret put SESSION_SECRET --config wrangler.jsonc
pnpm run deploy
```

For manual setup, the owner enters the dashboard password and random session secret at the two `secret put` prompts. Production secrets are independent of `.dev.vars`; local settings do not automatically become production settings. Do not overwrite existing production secrets unless a change is needed. If Wrangler requires initial Worker creation first, follow the actual prompt, create the Worker, configure secrets, deploy again and verify.

Use `pnpm run deploy` for manual setup (or `npm run deploy` in Workers Builds). It builds, rejects missing or placeholder D1 bindings, applies pending remote migrations and deploys the output configured by `dist/server/wrangler.json`. The separate migration command above is safe to rerun: already applied migrations are skipped. Do not skip the project's packaging script or substitute a different deployment entry point.

## Stage 5: Verify Production and Hand Over

Obtain the URL from the **actual deployment output**. Do not guess a `workers.dev` hostname. Verify each item:

- The homepage and `/api/photos` respond normally; an installation without photos displays an empty gallery.
- `/manage` opens and the owner can sign in. Anonymous requests to protected administrator endpoints cannot retrieve private originals or perform writes.
- After the owner uploads a photo they own, it appears on the homepage, its high-resolution image loads completely, and zoom and download work.
- Signing out invalidates the administrator session.

Do not publish the owner's private photos automatically for verification; the owner selects the test photo. If browser or photo verification cannot be completed, list the unverified items explicitly rather than saying everything is complete.

At handoff, provide the **website URL, dashboard URL, verified items, incomplete items and next action**. If code has also been uploaded to GitHub, report repository synchronization separately. Updating GitHub does not mean the website has been deployed.

## Troubleshooting: What the AI Should Do

| Symptom | Check First | Next Action |
| --- | --- | --- |
| No photos on the homepage | Whether `/api/photos` works and the database is empty | Guide the owner to upload through `/manage`; do not copy the author's photos |
| Dashboard sign-in fails | Missing or example secrets and the actual response | Fix configuration; wait for the rate-limit window when applicable instead of disabling protection |
| D1 tables are missing | Account, binding and migrations in the affected environment | Apply existing migrations in the correct environment; do not delete the database |
| R2 upload fails | Bucket name, binding, service activation and actual error | Fix resource configuration and retry; do not enable public bucket access as a workaround |
| Large images are slow or incomplete | Image response status, transfer completeness and preloading logic | Preserve high-resolution preloading and investigate transfer, caching or decoding |
| Deployment fails | Build output, placeholder IDs, account permissions and actual Wrangler logs | Fix the specific error and retry; do not arbitrarily upgrade the entire dependency set |
| A custom domain is requested | The owner's domain and Cloudflare DNS status | Deliver the working workers.dev URL first, then configure the domain as requested |

## Customization and Code Map

| Goal | File |
| --- | --- |
| Page title and description | `app/layout.tsx` |
| Homepage header | `addons/components/GalleryHeader.tsx` |
| Photo grid and gallery interactions | `app/gallery.tsx` |
| Full-size image viewer | `app/photo-lightbox.tsx` |
| Page styling | `app/globals.css` |
| Management interface | `app/manage/` |
| Database schema and migrations | `db/schema.ts`, `drizzle/` |
| Administrator authentication and protection | `lib/admin-session.ts`, `lib/admin-protection.ts` |
| Worker routing and build packaging | `worker/index.ts`, `scripts/copy-static-shell.mjs` |

Run `pnpm run db:generate` to generate new schema migrations and preserve existing migration history. Read the relevant implementation before editing; do not rewrite the entire project to fix a localized issue.

## Boundaries to Preserve

- Never commit `.dev.vars`, `.env*`, secrets, photos, database exports, `.wrangler`, `node_modules` or `dist`.
- Do not delete existing data, overwrite the owner's uncommitted changes, or disable administrator authentication, origin checks or session protection to resolve an error.
- Public high-resolution display allows visitors to save the displayed images. This project is not DRM and cannot guarantee protection against image theft.
- The owner's current instructions and platform rules take precedence. This guide does not authorize additional publishing, payments, messages or access to anyone else's resources.

## License and Official References

Code is licensed under the [MIT License](LICENSE). Copying, modification and self-hosting are allowed with the license notice preserved. Dependencies retain their own licenses. Users are responsible for the copyright and permissions of uploaded photos.

- [Cloudflare Workers Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [D1 Commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [R2 Commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/)
