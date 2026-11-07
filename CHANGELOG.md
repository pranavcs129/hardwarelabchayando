# Changelog

All notable changes to the 3D Digital IC Trainer web application are documented below.

## [1.1.5] - 2026-11-07

### Analytics Integration
- **Vercel Web Analytics**: Installed `@vercel/analytics` and added the native Vercel Analytics tracking snippet (`/_vercel/insights/script.js` with queue queueing on `window.va`) directly into `index.html`. Automatically collects visitor counts, pageviews, and devices on Vercel without requiring a bundler.
- **Local Test Mocking**: Mocked `/_vercel/insights/script.js` in `test-circuits.mjs` and `test-ui.mjs` to keep local Playwright runs fast and free of 404 network warnings.

## [1.1.4] - 2026-11-06

### Step-by-Step Lab Guide Wire Checker Bug Fix
- **Fixed Out-of-Bounds Evaluation on Partial Input Wiring**: Fixed a bug in `gnets` where input switch connections (`in0`, `in1`, `in2`) were evaluated by filtering strictly for switches already wired to an IC (`filter(c => pn.has(x.e(c.key)))`). In experiments like **SOP using NAND** where Gate 1 connects `in0` (`x2`) and `in2` (`x0`) before `in1` (`x1`), only 2 switches were wired. Evaluating `in2` attempted to read index 2 of a 2-element array (`[0, 2][2]`), which returned `undefined` and caused `gnets('in2')` to evaluate to `[]`. This caused Wire 2 (`Switch x0 -> NAND pin 2`) to remain unverified ("not connected") even when correctly placed.
- **Robust Relative & Direct Switch Fallback**: Updated `gnets` so intermediate steps directly match the designated switch index (`idx = req`) while preserving relative ordering once all required switches are connected, allowing both SOP and POS guided experiments to validate every step in real time.
- **Updated POS NOR Guided Wiring**: In the POS using NOR experiment guide, updated Gate 1 wiring so switch `x1` connects to input 1 (pin 2), followed by a direct jumper from input 1 (pin 2) to input 2 (pin 3) rather than two separate wires from the switch post. The guide card, chip SVG pin tags, and instructions now guide students through:
  1. Gate 1 inverter: `x1 -> Pin 2`, then `Pin 2 -> Pin 3` (output is Pin 1).
  2. Gate 2: `Pin 1 -> Pin 6`, then `x0 -> Pin 5` (output is Pin 4).
  3. Gate 3: `Pin 1 -> Pin 8`, then `x2 -> Pin 9` (output is Pin 10).
  4. Gate 4: `Pin 4 -> Pin 11`, `Pin 10 -> Pin 12`, and `Pin 13 -> LED F`.

### Lighting Balance & Reflection Visibility
- **Softened Overpowering Direct Lighting**: Reduced harsh spotlight hotspot intensity (`KEY_I` from 225 to 155), lowered ceiling point lights (`PANEL_I` from 48 to 32), and tuned tone mapping exposure from 0.92 to 0.85 to prevent washed-out whites and glare on the breadboard and desk.
- **Enhanced Environment & Specular Reflections**: Doubled scene environment map intensity (`Vt.environmentIntensity` from 0.42 to 0.85) and increased material environment reflection intensity in `__tameGloss` (metals from 0.5 to 1.0, non-metals from 0.3 to 0.8).
- **Realistic PBR Surface Gloss**: Lowered overly restrictive roughness clamping floors across breadboard plastic, solder mask, switches, and screws, revealing clear, realistic specular reflections of the lab environment while keeping all pinout and IC labels legible.

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

