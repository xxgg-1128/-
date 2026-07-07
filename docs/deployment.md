# Deployment Guide

## Option 1: Fast Static Demo

Use this when you want a public link quickly.

Before deploying, run:

```bash
npm run check
```

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
