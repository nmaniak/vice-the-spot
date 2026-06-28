/* ═══════════════════════════════════════
   PAGE SWITCHING
═══════════════════════════════════════ */
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });

  const page = document.getElementById('page-' + pageId);
  const tab  = document.querySelector(`.nav-tab[data-page="${pageId}"]`);
  if (page) page.classList.add('active');
  if (tab)  { tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════
   MENU FILTER
═══════════════════════════════════════ */
function filterMenu(btn) {
  const filter = btn.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.menu-section').forEach(section => {
    section.classList.toggle('hidden', filter !== 'all' && section.dataset.category !== filter);
  });
}

/* ═══════════════════════════════════════
   INTERSECTION OBSERVER — fade-in on scroll
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    .reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.4s ease, transform 0.4s ease; }
    .reveal.visible { opacity: 1; transform: none; }
  `;
  document.head.appendChild(style);

  const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    }),
    { threshold: 0.08 }
  );

  document.querySelectorAll('.menu-section, .gallery-item, .rating-summary, .review-card, .write-review').forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
  });
});

/* ═══════════════════════════════════════
   TODO: Google Places API (μελλοντικά)
   ─────────────────────────────────────
   Όταν έχεις Place ID + API Key:
   1. Πρόσθεσε τα εδώ:
        const GOOGLE_PLACE_ID = 'ChIJ...';
        const GOOGLE_API_KEY  = 'AIzaSy...';
   2. Ενεργοποίησε "Places API (New)" στο Google Cloud Console
   3. Η αξιολόγηση θα τραβάει αυτόματα τα πραγματικά reviews
      και το κουμπί θα ανοίγει απευθείας το write-review dialog:
        https://search.google.com/local/writereview?placeid=PLACE_ID
═══════════════════════════════════════ */
