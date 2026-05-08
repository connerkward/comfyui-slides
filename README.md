# slides

Slide decks served at `slides.ward.run`. Built with [Slidev](https://sli.dev), deployed via GitHub Pages on every push to `main`.

## Decks

| Path | Folder | Title |
|------|--------|-------|
| `/comfyone/` | `comfyone-outpaint/` | ComfyUI Masterclass — Outpainting |
| `/comfytwo/` | `comfytwo-v2v/` | ComfyUI Masterclass — Hybrid Video Pursuit |

## Local dev

```bash
cd comfytwo-v2v   # or comfyone-outpaint
npm install
npm run dev       # if a script exists, otherwise: npx slidev slides.md
```

## Adding a deck

1. Create a new folder at the repo root (e.g. `comfythree-foo/`).
2. Drop a Slidev project in it (`slides.md`, `package.json`, `public/`, etc.).
3. Add a build step to `.github/workflows/deploy.yml`:
   ```yaml
   - name: Build comfythree
     working-directory: comfythree-foo
     run: |
       npm install
       npx slidev build --base /comfythree/ --out ../dist/comfythree slides.md
   ```
4. Add a row to the landing page in the same workflow.
5. Push.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds each deck and publishes to the `gh-pages` environment.

DNS: `slides.ward.run` → `connerkward.github.io.` (CNAME at Cloudflare).
