# Public web deployment

This document covers the deployable public website for 綠伴 Elder Tree.

## Recommended first deployment: Vercel

The repository now includes a root `vercel.json` for the monorepo public web app.

When importing the project in Vercel:

1. Select this repository.
2. Keep the project root at the repository root.
3. Use the detected settings from `vercel.json`.
4. Add environment variables as needed.
5. Deploy.

Required or useful environment variables:

| Key | Purpose | Required for public web |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Public API base URL, for example `https://api.example.com/api/v1` | Optional for static showcase, required for live route/radar data |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Email used by partnership/contact links | Optional |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre/OpenFreeMap style URL | Optional |

If `NEXT_PUBLIC_API_URL` is not set, the public web currently falls back to built-in showcase data when the local API is unavailable. That is acceptable for a first visual demo, but a public production site should point to a hosted API.

## Netlify alternative

The repository also includes `netlify.toml`.

When importing the project in Netlify:

1. Select this repository.
2. Keep the base directory at the repository root.
3. Use the command and publish directory from `netlify.toml`.
4. Add the same environment variables listed above.
5. Deploy.

The Netlify config uses the official Next.js plugin entry so the Next build can be served correctly.

## OpenAI Sites note

OpenAI Sites is still useful for hosted prototypes, but the current public web is a standard Next.js app. The Sites packaging flow expects a Cloudflare Worker-compatible `dist/server/index.js` output. Because this repository currently produces `.next`, do not try to deploy the public web to Sites until we add a dedicated Worker/OpenNext/Vinext build target.

Suggested order:

1. Deploy public web first with Vercel or Netlify.
2. Deploy the API separately with its Neon/Firebase/Gemini/LINE secrets.
3. Set `NEXT_PUBLIC_API_URL` on the public web to the hosted API URL.
4. Re-deploy the public web.

## Preflight checks

Run these before deploying:

```bash
npm run typecheck -w @elder-tree/public-web
npm run build -w @elder-tree/contracts
npm run build -w @elder-tree/public-web
```

For a full repository verification:

```bash
npm run typecheck
npm run build
npm test
```
