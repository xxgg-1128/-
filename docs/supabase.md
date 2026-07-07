# Supabase Setup Guide

## 1. Create Project

Create a new Supabase project and save:

- Project URL
- Anon public key
- Service role key, server-side only

Copy `.env.example` to `.env` when you migrate the frontend:

```bash
cp .env.example .env
```

## 2. Run Schema

Open Supabase SQL Editor and run:

```sql
-- See supabase/schema.sql
```

The schema creates:

- `profiles`
- `images`
- `prompts`
- `image_prompts`
- `image_events`

It also enables Row Level Security so each user can only access their own records.

## 3. Create Storage Bucket

Create a private bucket:

```text
designref-images
```

Recommended path format:

```text
{user_id}/{image_id}/original.webp
{user_id}/{image_id}/thumb.webp
```

## 4. Frontend Migration Plan

Replace `localStorage` calls in `app.js` with a small data adapter:

```text
loadState() -> fetch images and prompts from Supabase
saveState() -> upsert changed records
handleFiles() -> upload files to Storage, then insert image records
generatePrompt() -> call server endpoint or Supabase Edge Function
```

## 5. AI Integration Plan

Do not call AI providers directly from the browser.

Use a server-side endpoint:

```text
POST /api/analyze-image
POST /api/generate-prompt
```

The server should:

- Read the authenticated user.
- Load the image from private storage.
- Call the AI model.
- Validate the JSON result.
- Save analysis and prompt records to Supabase.

