# DesignRef Local Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable local DesignRef prototype for uploading screenshots, simulating AI analysis, managing tags, and generating reusable prompts.

**Architecture:** The app is a dependency-free browser SPA. Pure business logic lives in `app-core.js` and is covered by Node tests; DOM behavior lives in `app.js`; layout and visual system live in `styles.css`; `index.html` wires the app together.

**Tech Stack:** HTML, CSS, modern JavaScript ES modules, browser `localStorage`, Node built-in test runner.

## Global Constraints

- The first screen is the working app, not a landing page.
- Real AI model integration is excluded.
- User accounts, cloud upload, server-side file storage, browser extension capture, Figma plugin import, team collaboration, and permissions are excluded.
- Supported upload formats are PNG, JPG, JPEG, and WEBP.
- Local persistence uses browser storage.
- The UI must be dense, readable, professional, and avoid decorative-only sections.

---

### Task 1: Core Logic And Tests

**Files:**
- Create: `package.json`
- Create: `app-core.js`
- Create: `tests/app-core.test.mjs`

**Interfaces:**
- Produces: `SUPPORTED_IMAGE_TYPES`, `MAX_IMAGE_SIZE`, `analyzeImage(fileName)`, `createImageRecord({ name, dataUrl, size, type, now })`, `generatePrompt(image, type, now)`, `filterImages(images, { query, activeTag, view })`, `filterPrompts(prompts, { query, type })`, `uniqueTags(images, prompts)`.

- [ ] **Step 1: Write tests for validation, analysis, prompt generation, and filtering.**
- [ ] **Step 2: Run `node --test tests/app-core.test.mjs` and verify the tests fail because `app-core.js` is missing.**
- [ ] **Step 3: Implement the exported pure functions in `app-core.js`.**
- [ ] **Step 4: Run `node --test tests/app-core.test.mjs` and verify the tests pass.**

### Task 2: Static App Shell And Styling

**Files:**
- Create: `index.html`
- Create: `styles.css`

**Interfaces:**
- Consumes: `app.js` as an ES module entrypoint.
- Produces: Semantic containers and controls for image library, prompt library, tag view, detail panel, upload input, filters, prompt editor, and notifications.

- [ ] **Step 1: Create the HTML app shell with accessible controls and empty state containers.**
- [ ] **Step 2: Create responsive CSS for desktop and mobile layouts.**
- [ ] **Step 3: Run `python3 -m http.server 4173` and verify the page loads.**

### Task 3: Browser Interaction And Persistence

**Files:**
- Create: `app.js`

**Interfaces:**
- Consumes: exports from `app-core.js` and DOM ids/classes from `index.html`.
- Produces: Upload handling, drag-and-drop, local storage persistence, image gallery rendering, detail editing, prompt generation, prompt library management, copy, favorite, delete, and retry analysis actions.

- [ ] **Step 1: Implement state loading and saving through `localStorage`.**
- [ ] **Step 2: Implement click upload, drag-and-drop upload, file validation, data URL conversion, and simulated analyzing state.**
- [ ] **Step 3: Implement image gallery rendering, search, filters, favorites, deletion, and detail panel selection.**
- [ ] **Step 4: Implement tag editing, note editing, prompt generation, prompt saving, prompt editing, copy, favorite, and deletion.**
- [ ] **Step 5: Run `node --test tests/app-core.test.mjs` again to protect core behavior.**

### Task 4: Final Verification

**Files:**
- Read: all created app files.

**Interfaces:**
- Consumes: the completed local prototype.
- Produces: verified delivery details and local URL.

- [ ] **Step 1: Start a local server on an available port.**
- [ ] **Step 2: Verify the app shell responds over HTTP.**
- [ ] **Step 3: Run the Node test suite.**
- [ ] **Step 4: Inspect created files and report any limitations.**

