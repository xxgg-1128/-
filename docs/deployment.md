# Deployment Guide

## Option 1: Fast Static Demo

Use this when you want a public link quickly.

Before deploying, run:

```bash
npm run check
```

### GitHub Pages

This repository includes `.github/workflows/pages.yml`.

After pushing to `main`, GitHub Actions can publish the static demo to:

```text
https://xxgg-1128.github.io/-/
```

If the first run asks for Pages setup:

1. Open the GitHub repository.
2. Go to Settings -> Pages.
3. Set Source to GitHub Actions.
4. Re-run the workflow named `Deploy Static Demo To GitHub Pages`.

### Vercel

1. Push this folder to a GitHub repository.
2. Import the repository in Vercel.
3. Use these settings:
   - Framework Preset: Other
   - Build Command: empty
   - Output Directory: `.`
4. Deploy.

`vercel.json` is included so refreshes route back to `index.html`.

### Netlify

1. Push this folder to a GitHub repository.
2. Import the repository in Netlify.
3. Use these settings:
   - Build Command: empty
   - Publish Directory: `.`
4. Deploy.

`netlify.toml` is included for static publishing and fallback routing.

### Cloudflare Pages

1. Push this folder to a GitHub repository.
2. Create a Pages project from the repository.
3. Use these settings:
   - Framework Preset: None
   - Build Command: empty
   - Output Directory: `.`
4. Deploy.

## What Works In Static Demo Mode

- Image upload
- Drag-and-drop upload
- Simulated AI analysis
- Search and filters
- Prompt generation and management
- Browser-local persistence

## What Static Demo Mode Does Not Solve

- User accounts
- Cross-device sync
- Cloud file storage
- Team sharing
- Real AI analysis

## Production Hosting Recommendation

For the first real product version:

- Frontend: Vercel or Cloudflare Pages
- Auth: Supabase Auth
- Database: Supabase Postgres
- Image Storage: Supabase Storage
- AI endpoints: Vercel Functions, Cloudflare Workers, or a small Node/FastAPI service

## Real AI On Vercel

This project includes a Vercel Function:

```text
POST /api/analyze-image
```

The browser sends an uploaded image as a data URL. The function calls the OpenAI Responses API with image input and asks for structured JSON analysis. If the endpoint is unavailable or not configured, the frontend keeps using the built-in simulated analysis so the app remains usable.

Set these Vercel environment variables:

```text
OPENAI_API_KEY=sk-...
OPENAI_ANALYSIS_MODEL=gpt-5-mini
```

`OPENAI_API_KEY` must only be set in Vercel or another server-side runtime. Never put it in browser JavaScript.

After setting variables, redeploy the Vercel project and upload a new screenshot. Successful real analysis will show the image status as:

```text
AI 分析成功
```

If the status is:

```text
模拟分析成功
```

the app has fallen back to local simulated analysis. Check the Vercel Function logs for the concrete API error.
