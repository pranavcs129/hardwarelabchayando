# Changelog

All notable changes to the 3D Digital IC Trainer web application are documented below.

## [1.1.2] - 2026-11-06

### Visual Quality & Motion Smoothness
- **Smooth Orbit Controls (Damping)**: Enabled inertia damping on OrbitControls (`enableDamping: true`, `dampingFactor: 0.08`), eliminating jittery, step-by-step camera jumps during mouse and trackpad rotation.
- **Fixed Adaptive Resolution Trap**: Fixed a bug where a 60 Hz VSync display (16.67ms frame time) could never satisfy the hardcoded `avg < 15ms` recovery condition once downscaled, permanently trapping rendering at degraded 0.70x resolution. Raised recovery threshold to `avg <= 20ms` and stability check to `avg > 30ms`.
- **Permanent WebGL Context Antialiasing**: Ensured the WebGL context is initialized with antialiasing enabled (`antialias: true`), avoiding permanent loss of antialiasing when switching quality profiles.
- **Natural Quality Cycle & Feedback**: Fixed quality cycle order to High → Medium → Low → High (preventing an instant drop from High to Low on first click), raised Low profile pixel ratio floor to 0.85, and added detailed toast notifications explaining the active resolution and shadow settings.

## [1.1.1] - 2026-11-06

### Responsive Dock & Layout Improvements
- **Centered Floating Dock**: Updated the bottom toolbar dock (`#bar`) on laptops and wide desktop screens to shrink-wrap its contents (`width: max-content; max-width: calc(100vw - 16px)`) and horizontally center at `left: 50%; transform: translateX(-50%)`.
- **Removed Excess Unused Space**: Replaced full-width edge-to-edge spanning (`left: 10px; right: 10px`) with content-based sizing (`#bxchips` with `flex: 0 1 auto; min-width: 0`), eliminating ~578px of unused empty space to the right of the IC buttons on laptop displays.
- **Drawer Animation Compatibility**: Updated drawer toggle styling so `body.bxon #bar` translates smoothly downwards off-screen using `translate(-50%, 120%)`.
- **Automated Dock Testing**: Added automated assertions to `test-ui.mjs` verifying that the dock is centered and free of dead space on desktop and mobile viewports.

## [1.1.0] - 2026-11-06

### Performance & Asset Optimization (Vercel Deployment)
- **Extracted 3D GLB Model**: Moved the 12.8 MB base64 GLB payload out of `index.html` into a standalone binary file at `/assets/model.glb` (9.6 MB binary).
- **Reduced Initial HTML Payload**: Reduced `index.html` file size from ~13.6 MB down to ~849 KB (a >93% reduction), enabling fast HTTP transfer and gzip/brotli compression on Vercel.
- **Asynchronous GLB Streaming & Loading Bar**: Added a dark-themed progress overlay with a gradient progress bar and percentage indicator that streams `assets/model.glb` via the Fetch API / ReadableStream and parses it with Three.js `GLTFLoader`.
- **Vercel Static Configuration**: Added `vercel.json` with `cleanUrls: true` and immutable long-term caching (`Cache-Control: public, max-age=31536000, immutable`) for all `/assets/*` and static models/images.

### Graphics Quality Controls
- **Quality Setting (Low / Medium / High)**: Added a dynamic Quality toggle button to the top status bar.
  - **High** (Desktop default): Adaptive pixel ratio up to 1.5, 1536×1536 directional shadow maps, antialiasing enabled.
  - **Medium** (Mobile default): Adaptive pixel ratio up to 1.0, 1024×1024 shadow maps, antialiasing enabled.
  - **Low**: Pixel ratio capped at 0.75, directional shadows disabled for maximum frame rate on low-end devices, antialiasing disabled.
- **Persistence**: Saved quality preference in `localStorage.getItem('trainer_quality')` and restored automatically on subsequent visits.
- **Immediate Feedback**: Switching quality updates the Three.js renderer pixel ratio, shadow maps, and on-demand render loop immediately with a confirmation toast.

### Toolbar Help & User Guidance
- **Help Modal**: Added a top-bar `Help` button that opens a clean, single-screen guide modal explaining every toolbar control:
  - Wire Tool (`Wire`)
  - Logic IC placement (`7400` – `7486`)
  - Component Storage drawer (`Storage`)
  - Remove / Delete Tool (`Remove`)
  - Undo Wire (`Undo wire`)
  - Clear All (`Clear all`)
  - Guided Lab Mode (`🧪 Lab`)

### SEO, PWA & Branding
- **Meta Tags**: Added semantic page metadata (`description`, `theme-color: #1b1d1f`).
- **Open Graph Metadata**: Added `og:title`, `og:description`, `og:type`, and `og:image` pointing to `/assets/og-image.png`.
- **Branded Icons**: Created SVG favicon (`/assets/favicon.svg`) with standard fallback (`/favicon.ico`), plus 192×192 and 512×512 PWA icons.
- **PWA Manifest**: Added `manifest.json` for home-screen installation and standalone mobile display.

### Automated Testing & Verification
- **Automated Circuit Verification Script (`test-circuits.mjs`)**: Self-contained Playwright test suite with a local static HTTP server. Programmatically places 7400 / 7402 ICs, routes all input/output wires, powers the board, and verifies both:
  - SOP using NAND: $F = x_1' + x_2 \cdot x_0$ (2 NAND gates on 7400)
  - POS using NOR: $F = (x_2 + x_1')(x_1' + x_0)$ (4 NOR gates on 7402)
  - Asserts that all 8 truth-table rows match and zero browser console errors occur.
- **UI & Feature Test Suite (`test-ui.mjs`)**: Verifies Quality cycling, LocalStorage persistence, Help modal triggers, mobile viewport layout (400×800), and metadata tags.

