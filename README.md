# Homework — Week 6: GitHub Hosting with Hype

An interactive web animation hosted on **GitHub Pages**.

The project is a smiley-face character whose eyes follow your mouse cursor around the screen. Hover over the face to see a surprised reaction!

## Live Demo

👉 **[View the animation](https://bigapc.github.io/homework/)**

## About

Built as part of Week 6 coursework on using [Tumult Hype](https://tumult.com/hype/) to create web animations and deploying them to GitHub Pages.

### How it works

- The face is made from HTML `<div>` elements styled with CSS (gradients, border-radius)
- Two eye elements (`#lefty`, `#righty`) are rotated with JavaScript using `Math.atan2()` so they always point toward the cursor
- A smile SVG path and a hidden "Whoa!" mouth swap on hover
- Deployed automatically via GitHub Actions whenever code is pushed to `main`

## Source Files

| File | Description |
|------|-------------|
| `index.html` | Main animation page (self-contained HTML/CSS/JS) |
| `Week6-Student-Resources.zip` | Original `.hype` source project and assignment guides |
| `.github/workflows/pages.yml` | GitHub Actions deployment to GitHub Pages |
