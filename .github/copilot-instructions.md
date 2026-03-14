# Copilot Instructions for This Repository

## Project Overview
This is a web animation project built with [Tumult Hype](https://tumult.com/hype/). The project (`looking.hype`) creates an interactive smiley-face animation where the eyes follow the user's mouse cursor. The goal of Week 6 is to export the animation and host it on **GitHub Pages**.

## Repository Structure
- `index.html` — The exported/hand-crafted HTML page for GitHub Pages, faithfully recreating the Hype animation
- `Week6-Student-Resources.zip` — Original resources including the `.hype` source file and assignment guides
- `.github/workflows/pages.yml` — GitHub Actions workflow that deploys `index.html` to GitHub Pages

## Key Implementation Details
- The animation runs at 640 × 360 px and scales to fill the browser window
- The face has two eye elements with `id="lefty"` and `id="righty"`; JavaScript rotates them toward the cursor
- The head has a yellow-to-orange gradient with a hover effect that reveals a surprised mouth ("Whoa!")
- No external JavaScript frameworks are used — pure HTML, CSS, and vanilla JS

## Coding Guidelines
- Keep all styles inline or in a `<style>` block in `index.html` to stay self-contained
- Use JavaScript to dynamically set `transform: rotate()` inline styles for eye rotation based on mouse position (`element.style.transform`)
- Preserve the original color palette: background `#FFFBE6`, head gradient `#FFFB00 → #FF9300`
- Do not modify `blank.yml`; the deployment pipeline lives in `pages.yml`
