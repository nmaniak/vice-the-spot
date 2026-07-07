/* =======================================
   PAGE SWITCHING
======================================= */
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

/* =======================================
   MENU FILTER
======================================= */
function filterMenu(btn) {
  const filter = btn.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.menu-section').forEach(section => {
    section.classList.toggle('hidden', filter !== 'all' && section.dataset.category !== filter);
  });
}

/* =======================================
   LIGHTBOX
======================================= */
function openLightbox(imgEl) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('.lightbox-img');
  lightboxImg.src = imgEl.src;
  lightboxImg.alt = imgEl.alt;
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-close')) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });
});

/* =======================================
   STICKY HEADER HEIGHT SYNC
   Keeps the filter bar's sticky offset pixel-exact
   with the real rendered height of the drip header,
   avoiding a seam between the two sticky bars.
======================================= */
function syncStripeHeight() {
  const stripe = document.querySelector('.site-stripe');
  if (stripe) document.documentElement.style.setProperty('--stripe-height', stripe.offsetHeight + 'px');
}
window.addEventListener('load', syncStripeHeight);
window.addEventListener('resize', syncStripeHeight);

/* =======================================
   INTERSECTION OBSERVER - fade-in on scroll
======================================= */
document.addEventListener('DOMContentLoaded', () => {
  syncStripeHeight();
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

  document.querySelectorAll('.menu-section, .rating-summary, .review-card, .write-review').forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
  });
});

/* =======================================
   TODO: Google Places API (future)
   -------------------------------------
   When you have Place ID + API Key:
   1. Add here:
        const GOOGLE_PLACE_ID = 'ChIJ...';
        const GOOGLE_API_KEY  = 'AIzaSy...';
   2. Enable "Places API (New)" in Google Cloud Console
   3. Reviews will load automatically and the button
      will open the write-review dialog directly:
        https://search.google.com/local/writereview?placeid=PLACE_ID
======================================= */
