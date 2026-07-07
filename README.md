# Vice KZN – The Spot

Static website για το **Vice KZN** cafe-bar στην Κοζάνη, ready for GitHub Pages.

## Δομή Project

```
vice-the-spot/
├── index.html          # Home — ίδιο περιεχόμενο με menu/index.html
├── menu/index.html     # vicethespot.gr/menu/ — σελίδα μενού
├── gallery/index.html  # vicethespot.gr/gallery/ — σελίδα "Ο Χώρος μας"
├── styles.css          # Όλα τα styles (shared)
├── script.js           # Όλη η λογική (shared)
├── images/
│   ├── branding/       # Λογότυπα, drips, graffiti
│   └── our-space/      # Φωτογραφίες μαγαζιού
└── README.md
```

Κάθε σελίδα είναι ένα ξεχωριστό στατικό HTML αρχείο (όχι SPA) ώστε το `/menu/` και το `/gallery/` να είναι πραγματικά URLs. Το `index.html` στο root έχει το ίδιο περιεχόμενο με το `menu/index.html` — αν αλλάξεις το menu, ενημέρωσε και τα δύο αρχεία.

## Local Development

Δεν χρειάζεται build step, αλλά επειδή το site έχει πραγματικά URLs (`/menu/`, `/gallery/`)
πρέπει να το τρέξεις μέσα από έναν τοπικό server — όχι απλά άνοιγμα του αρχείου (`file://`),
γιατί τότε τα `/menu/` κ.λπ. δεν βρίσκουν αυτόματα το `index.html` μέσα στον φάκελο.

```bash
python3 -m http.server 8000
# άνοιξε http://localhost:8000/
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

1. Βάλε τις φωτογραφίες στο `images/our-space/`
2. Στο `gallery/index.html`, πρόσθεσε ένα νέο `.gallery-item`:

```html
<div class="gallery-item">
  <img src="../images/our-space/bar.jpg" alt="The Bar" loading="lazy" onclick="openLightbox(this)"/>
</div>
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
