# DesignRef Local Prototype Design

## Goal

Build a runnable local prototype for DesignRef / 竞品灵感库 that validates the core loop:

1. Upload competitor or inspiration screenshots.
2. Automatically produce simulated AI classification, tags, and design analysis.
3. Let users search, filter, favorite, edit tags, and add notes.
4. Generate, edit, copy, save, and manage reusable prompts from each image.

This prototype prioritizes product flow and interaction quality over production backend architecture.

## Scope

### Included

- Local single-page application.
- Image upload through click and drag-and-drop.
- Batch image upload with validation for PNG, JPG, JPEG, and WEBP.
- Image gallery with search, tag filters, favorites, prompt status, and deletion.
- Image detail view with preview, metadata, simulated AI analysis, editable tags, and notes.
- Prompt generation for four types:
  - UI generation
  - Image generation
  - Component recreation
  - Design analysis
- Prompt library with search, type filtering, edit, copy, favorite, and delete.
- Local persistence through browser storage.

### Excluded

- Real AI model integration.
- User accounts.
- Cloud upload or server-side file storage.
- Browser extension capture.
- Figma plugin import.
- Team collaboration and permissions.

## Product Structure

The first screen is the working app, not a landing page.

- Left navigation: Image Library, Prompt Library, Tags.
- Top utility area: search, upload action, library stats.
- Main image library: responsive grid of image cards.
- Right-side or modal detail panel: selected image preview and analysis.
- Prompt workspace: generator inside image detail, saved prompts in Prompt Library.

## Data Model

### Image Item

- `id`
- `name`
- `dataUrl`
- `uploadTime`
- `status`
- `pageType`
- `industry`
- `deviceType`
- `styleTags`
- `componentTags`
- `userTags`
- `aiSummary`
- `designHighlights`
- `reusableSuggestions`
- `note`
- `isFavorite`

### Prompt Item

- `id`
- `title`
- `type`
- `content`
- `sourceImageId`
- `tags`
- `createTime`
- `updateTime`
- `isFavorite`

## Simulated AI Behavior

After upload, each image enters an analyzing state briefly, then receives generated metadata. The simulator uses file name hints when possible and falls back to sensible UI-design defaults.

Examples:

- Page type: homepage, dashboard, form page, product detail, login page.
- Industry: SaaS, ecommerce, logistics, finance, AI tool.
- Device type: Web, App, H5, mini program.
- Style tags: minimal, card-based, dark mode, bento grid, blue primary color.
- Component tags: navigation, cards, search box, table, filters, modal.

The simulator must be isolated behind a function so it can later be replaced by a real multimodal AI API.

## Prompt Generation

Prompt output is generated from the selected image's analysis fields and tags.

Each generated prompt includes:

- Title
- Type
- Editable content
- Source image relation
- Inherited tags

Prompt tone should be practical and directly usable in tools such as v0, Lovable, Midjourney, DALL-E, Figma AI, or Cursor.

## Persistence

Use `localStorage` for prototype persistence:

- Image metadata and image `dataUrl` values.
- Saved prompts.
- UI preferences such as selected filter where useful.

If local storage is full, the app should show a clear error and keep the current session state where possible.

## Error And Empty States

- Empty image library: invite the user to upload the first competitor screenshot.
- Empty prompt library: guide the user to select an image and generate a prompt.
- Unsupported image format: show accepted formats.
- Oversized image: show the size limit.
- AI analysis failure in simulator: allow retry and manual tag editing.
- Copy failure: keep content selectable and show a small error message.

## Design Direction

The app should feel like a focused design asset workspace:

- Dense but readable information layout.
- Quiet professional visual style.
- Strong thumbnail previews.
- Clear tag chips and prompt status indicators.
- No marketing hero page.
- No decorative-only visual sections.
- Controls should be discoverable and efficient for repeated use.

## Verification

Before delivery:

- Start the local app.
- Verify upload, drag-and-drop, gallery display, detail view, tag editing, note editing, prompt generation, prompt saving, prompt search/filter, copy, favorite, and delete.
- Check desktop and mobile layouts for readable text and non-overlapping controls.

