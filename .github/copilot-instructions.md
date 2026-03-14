# Copilot Instructions – bigapc/homework

## Project overview
This repository is a Week 6 homework project: a self-contained interactive web page ("Looking") where a cartoon face's eyes track the mouse cursor. It is a vanilla HTML/CSS/JavaScript single-page app with no build tools or dependencies.

## Repository structure
- `index.html` – page markup (face, eye sockets, smile, hint label)
- `style.css` – all layout and visual styles
- `script.js` – mouse/touch tracking logic using `Math.atan2`
- `Week6-Student-Resources.zip` – original Tumult Hype project and docs
- `.github/workflows/deploy.yml` – GitHub Pages deployment workflow

## Coding conventions
- Vanilla ES5-compatible JavaScript (no transpiler, no bundler)
- IIFEs with `"use strict"` and `DOMContentLoaded` guards
- 2-space indentation (enforced by `.vscode/settings.json`)
- CSS class names use BEM-style lowercase-hyphen naming
- No external libraries or frameworks

## Key implementation notes
- Eye tracking: `Math.atan2(my - eyeCY, mx - eyeCX) * (180 / Math.PI)` gives the rotation angle
- The pupil is offset from the eyeball centre via `position: absolute; top: 8px` so that rotation produces a visible gaze direction
- Touch support: listen on `touchmove` with `{ passive: true }` and guard `event.touches.length > 0`

## Style guide
- Keep all styles in `style.css`; do not use inline styles except for the dynamic `transform` applied by `script.js`
- Colour palette: dark navy background (`#1a1a2e → #0f3460`), yellow-to-orange head (`#fffb00 → #ff9300`), white eye sockets, black pupils
- Prefer CSS variables for any new colour additions
