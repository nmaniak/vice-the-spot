# Vice KZN – The Spot

Static website για το **Vice KZN** cafe-bar στην Κοζάνη, ready for GitHub Pages.

## Δομή Project

```
vice-the-spot/
├── index.html          # Όλη η εφαρμογή (single-page)
├── styles.css          # Όλα τα styles
├── script.js           # Όλη η λογική
├── assets/
│   └── images/         # Φωτογραφίες μαγαζιού (βάλε εδώ τα αρχεία)
└── README.md
```

## Local Development

Δεν χρειάζεται build step. Άνοιξε απλά το `index.html` στο browser:

```bash
open index.html          # macOS
start index.html         # Windows
```

Ή χρησιμοποίησε live server (VS Code extension) για auto-reload.

## GitHub Pages Deployment

```bash
git init
git add .
git commit -m "Initial commit: Vice KZN website"
git remote add origin https://github.com/YOUR_USERNAME/vice-kzn.git
git push -u origin main
```

Μετά στο GitHub repo:
**Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**

Το site θα είναι live στο:
`https://YOUR_USERNAME.github.io/vice-kzn/`

## Προσθήκη Φωτογραφιών (Gallery)

1. Βάλε τις φωτογραφίες στο `assets/images/` (π.χ. `bar.jpg`, `vibes.jpg` κ.λπ.)
2. Στο `index.html`, βρες τα gallery items και αντικατέστησε:

```html
<!-- Πριν (placeholder) -->
<div class="gallery-placeholder">🍹</div>

<!-- Μετά (πραγματική εικόνα) -->
<img src="assets/images/bar.jpg" alt="The Bar" loading="lazy">
```

## Brand Colors

| Variable            | Hex       | Χρήση                       |
|---------------------|-----------|-----------------------------|
| `--vice-pink`       | `#E8215A` | Primary brand color         |
| `--vice-dark-pink`  | `#C01848` | Hover states, shadows, text |
| `--vice-bg`         | `#F5F5F5` | Page background             |
| `--vice-text`       | `#1a1a1a` | Body text                   |

## Social Links

- **Facebook**: https://www.facebook.com/p/Vicekzn-61571378348129/
- **Instagram**: https://www.instagram.com/vice.kzn/
