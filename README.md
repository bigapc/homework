# Looking – Week 6 Homework

An interactive face animation where the eyes follow your mouse cursor (or finger on touch devices). Built as a standalone HTML/CSS/JavaScript page based on the Week 6 Tumult Hype student resources.

## Live Demo

> Hosted on GitHub Pages: **https://bigapc.github.io/homework/**

## How it works

- The face is drawn with pure CSS (yellow-to-orange gradient head, circular eye sockets, SVG smile).
- On every `mousemove` (or `touchmove`) event, JavaScript uses `Math.atan2` to compute the angle between each eye's centre and the cursor position, then applies that angle as a CSS `transform: rotate()` to the eyeball element.
- The pupil is offset from the eyeball's centre, so the rotation makes it appear to "look" toward the cursor.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page markup – face, eyes, smile, hint label |
| `style.css` | All layout and visual styles |
| `script.js` | Mouse / touch tracking logic |

## Running locally

Open `index.html` directly in any modern browser, or use the VS Code **Live Server** extension (already configured in `.vscode/settings.json`).

```bash
# Or with Python
python3 -m http.server 8080
# then open http://localhost:8080
```

## Week 6 Resources

The original Hype project file (`looking.hype`) and participation document are in `Week6-Student-Resources.zip`.
