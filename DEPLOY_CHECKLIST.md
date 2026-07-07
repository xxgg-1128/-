# DesignRef Deployment Checklist

## Static Demo

- [ ] Run `npm run check`.
- [ ] Confirm `index.html`, `app.js`, `app-core.js`, and `styles.css` are in the repository root.
- [ ] Push the project to GitHub.
- [ ] For GitHub Pages, enable Settings -> Pages -> Source -> GitHub Actions.
- [ ] Import the repository into Vercel, Netlify, or Cloudflare Pages.
- [ ] Use an empty build command.
- [ ] Use `.` as the output / publish directory.
- [ ] Open the deployed URL and upload one test image.
- [ ] Generate, save, edit, copy, and delete one Prompt.
- [ ] Confirm a browser refresh keeps local demo data.

## Product Version

- [ ] Create a Supabase project.
- [ ] Run `supabase/schema.sql`.
- [ ] Create a private Storage bucket named `designref-images`.
- [ ] Enable Supabase Auth providers.
- [ ] Move image persistence from `localStorage` to Supabase Storage.
- [ ] Move image and Prompt metadata from `localStorage` to Supabase Database.
- [ ] Add server-side AI endpoints.
- [ ] Keep AI provider keys server-side only.
- [ ] Add usage logging through `image_events`.

## Launch Notes

- Static demo data is browser-local and does not sync across devices.
- Do not use the static demo for private production data.
- The first real product release should require login before upload.
