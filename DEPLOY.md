# Deploy notes

How `slides.ward.run` is wired up. Snapshot of the work done on 2026-05-07.

## Topology

```
github.com/connerkward/slides   (this repo)
        │
        │  push to main
        ▼
.github/workflows/deploy.yml    (builds every deck, publishes to Pages)
        │
        ▼
GitHub Pages (gh-pages environment)
        │
        ▼
slides.ward.run                 (CNAME at Cloudflare)
   ├── /                  → landing page
   ├── /comfyone/         → comfyone-outpaint deck
   └── /comfytwo/         → comfytwo-v2v deck
```

## Repo layout

```
slides/
├── .github/workflows/deploy.yml    build + deploy
├── comfyone-outpaint/              one Slidev project
│   ├── slides.md
│   ├── package.json
│   ├── public/                     deck-local assets
│   └── style.css
├── comfytwo-v2v/                   another Slidev project
│   ├── slides.md
│   ├── package.json
│   ├── public/
│   ├── setup/main.ts               three.js wireframe scenes
│   └── style.css
├── README.md
└── DEPLOY.md                       this file
```

Each deck is a self-contained Slidev project. They don't share `node_modules`, themes, or assets — drop one in and it works.

## What the workflow does

`.github/workflows/deploy.yml` runs on push to `main`:

1. Checks out the repo
2. Sets up Node 20
3. For each deck folder, runs `npm install` and `npx slidev build --base /<deck>/ --out ../dist/<deck> slides.md`
   - `--base` is critical: without it, asset URLs in the built HTML are absolute `/assets/...` and break under a subpath
4. Generates `dist/index.html` — the landing page that lists each deck
5. Writes `dist/CNAME` = `slides.ward.run`
6. Uploads `dist/` as a Pages artifact and deploys it

Build time: ~50 s for two decks. Reasonable.

## DNS

Cloudflare zone `ward.run`:

| Type | Name | Target | Proxy | Why |
|------|------|--------|-------|-----|
| CNAME | `slides` | `connerkward.github.io` | DNS only at first → Proxied later | GitHub needs to validate the domain to issue Let's Encrypt; the proxy hides the origin and breaks validation. After the cert is live, Cloudflare proxy is fine |

`ward.run` apex is left untouched — reserved for other infrastructure later.

## Adding a new deck

1. Create a folder at the repo root, e.g. `comfythree-foo/`. Standard Slidev project (`slides.md`, `package.json` with `@slidev/cli`, `public/`, etc.).
2. In `.github/workflows/deploy.yml`, add a build step:
   ```yaml
   - name: Build comfythree
     working-directory: comfythree-foo
     run: |
       npm install
       npx slidev build --base /comfythree/ --out ../dist/comfythree slides.md
   ```
3. Add a `<li>` to the landing page block in the same workflow:
   ```html
   <li><a href="/comfythree/"><span class="num">03</span><span class="title">COMFYTHREE · …</span><span class="meta">DECK 03</span></a></li>
   ```
4. Push.

## Local dev

```bash
cd comfytwo-v2v
npm install
npx slidev slides.md
```

Each deck runs its own dev server on its own port (Slidev auto-falls-through 3030 → 3031 → 3032 if a port is taken). Editing the deck's files hot-reloads in the browser. The Pages build only runs on push, so local changes don't deploy until committed.

## Verifying a deploy

```bash
# Did the action succeed?
gh run list --repo connerkward/slides --limit 1

# Did Pages pick up the deploy?
gh api repos/connerkward/slides/pages --jq '{cname,status,https_enforced,protected_domain_state}'

# Does DNS resolve?
dig +short CNAME slides.ward.run

# Does the cert work?
curl -sI https://slides.ward.run/ | head -3
```

`protected_domain_state` should be `verified` once the cert is live. If it's `pending` or `unverified`, give it 5–15 min after DNS propagates.

## Gotchas hit during setup

- **Repo rename**: `comfyui-slides` → `slides`. Local remote URL needs `git remote set-url origin https://github.com/connerkward/slides`. GitHub auto-redirects pushes to old URL but it's better to be explicit.
- **No user-page repo needed**: I originally thought `slides.ward.run/comfytwo` required a `connerkward.github.io` user-page repo to anchor the apex. It doesn't — putting the CNAME directly on the project repo works fine, and the subpaths come from the directory structure inside `dist/`.
- **`--base` flag**: Must end with `/`. Slidev's docs are quiet about this; without it the deck loads but the iframe content is broken because asset URLs go to the wrong root.
- **`https_enforced`**: The Pages API rejects `--field https_enforced=true` (treats it as a string); use `--raw-field cname=...` and let GitHub flip `https_enforced` automatically once the cert is issued.
- **Cloudflare proxy**: Has to start as DNS-only. With the orange cloud on, GitHub's `_well-known/acme-challenge` lookup hits Cloudflare's edge instead of the origin and fails validation.

## Old comfyui-slides URL

The repo was renamed from `comfyui-slides` to `slides`. GitHub redirects `https://github.com/connerkward/comfyui-slides` → `https://github.com/connerkward/slides` automatically. Anyone who had bookmarked the old URL will get there.

## Post-launch fixes (2026-05-07)

After the initial setup landed but before everything was live, three issues had to be solved.

### 1. Cloudflare DNS record creation without an API token

`slides.ward.run` couldn't be added through the local CLI — no API token in the shell, no `wrangler` installed, and the Cloudflare MCP tool exposes accounts/D1/KV/R2/Workers but **not DNS records**. Workaround: drive Chrome via `claude-in-chrome` (the user's authenticated browser session), navigate to `dash.cloudflare.com`, and call the dashboard's same-origin API from page context. This avoids CORS:

```js
// From the Cloudflare dashboard tab — uses the user's session cookies.
const z = await fetch('/api/v4/zones?name=ward.run', {credentials:'include'}).then(r=>r.json());
const zoneId = z.result[0].id;
await fetch(`/api/v4/zones/${zoneId}/dns_records`, {
  method: 'POST',
  credentials: 'include',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({
    type: 'CNAME',
    name: 'slides',
    content: 'connerkward.github.io',
    ttl: 1,
    proxied: false
  })
});
```

DNS propagated to public resolvers in ~5–7 minutes.

### 2. GLB models 404 under the `/comfytwo/` base path

The Three.js scene presets referenced models with hard-coded absolute paths:

```ts
{ src: '/police-car.glb', ... }
```

Locally that resolves to `localhost:3030/police-car.glb` — fine. On Pages with `--base /comfytwo/`, the page is served at `slides.ward.run/comfytwo/` but the GLB requests still went to `slides.ward.run/police-car.glb` (404). Vite rewrites `/foo.png` references in HTML/CSS but **does not rewrite string literals inside JS modules**.

Fix in `comfytwo-v2v/setup/main.ts`:

```ts
function resolveAssetUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src
  const base = (import.meta as any).env?.BASE_URL ?? '/'
  return base.replace(/\/$/, '') + (src.startsWith('/') ? src : '/' + src)
}
```

Wrap GLB loads (and any other JS-string asset paths) in this. `import.meta.env.BASE_URL` is set by Vite to whatever `--base` was passed at build time.

### 3. wrangler installed for next time

`npm install -g wrangler` so future Cloudflare automation has a CLI alternative to the dashboard-API trick. Wrangler still doesn't manage DNS records directly, but it's useful for Pages, Workers, KV, etc.

## Quick reference

- Live: https://slides.ward.run/
- Repo: https://github.com/connerkward/slides
- Pages config: `gh api repos/connerkward/slides/pages`
- Workflow runs: `gh run list --repo connerkward/slides`
- DNS record: dashboard → ward.run → DNS → Records → `slides` (CNAME → connerkward.github.io, DNS only)
