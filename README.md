# DesignRef / 竞品灵感库

DesignRef is a local-first MVP for collecting competitor screenshots, generating simulated UI analysis, and saving reusable prompts.

## Current Version

This repository currently ships as a static browser app:

- No build step is required.
- Data is stored in browser `localStorage`.
- AI analysis is simulated in `app-core.js`.
- Uploads stay in the user's browser as data URLs.

## Run Locally

```bash
npm test
npm run serve
```

Then open:

```text
http://localhost:4173/
```

## Deploy As A Static Demo

The app can be deployed directly to GitHub Pages, Vercel, Netlify, or Cloudflare Pages.

Use these settings:

- Framework preset: Other / Static
- Build command: leave empty
- Output directory: `.`
- Install command: leave empty or `npm install`

Before deploying, follow `DEPLOY_CHECKLIST.md`.

For GitHub Pages, this repository includes `.github/workflows/pages.yml`.

## Production Upgrade Path

The recommended production path is:

1. Deploy the static demo.
2. Create a Supabase project.
3. Run `supabase/schema.sql`.
4. Create a private Storage bucket named `designref-images`.
5. Replace local storage persistence with Supabase Auth, Database, and Storage.
6. Add server-side AI analysis and prompt generation.

See `docs/deployment.md` and `docs/supabase.md`.

## Important Limitations

- Current data does not sync across devices.
- Browser storage can run out for many or large images.
- API keys must not be added to frontend code.
- Real AI integration should run through a server-side endpoint.
