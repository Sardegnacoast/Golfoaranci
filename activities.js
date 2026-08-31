/* ═══════════════════════════════════════════════════════════
   Welcome Golfo Aranci — Attività dinamiche da Supabase
   Collega l'app al pannello wga-admin: tutto quello che viene
   aggiunto/modificato/cancellato da wga-admin appare/scompare
   qui automaticamente, organizzato per categoria.
   Le spiagge (categoria "spiagge") includono anche quelle
   storiche dell'app, migrate su Supabase per essere gestibili
   da wga-admin. Gli alloggi (categoria "alloggio") appaiono in
   Dormire, e qualsiasi attività con "in_evidenza" attivo appare
   nella sezione "In evidenza" della Home.
   ═══════════════════════════════════════════════════════════ */

const WGA_SUPABASE_URL = 'https://camubqubjqdcuwwhbfry.supabase.co';
const WGA_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbXVicXVianFkY3V3d2hiZnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTExODQsImV4cCI6MjA5MTkyNzE4NH0.KcgHdWMVJSWAmPNPBZb_ZohAAIays-dqHaLKLvwE5Vk';

const WGA_CAT_META = {
  food:              { icon: '🍽️', label: 'Food' },
  spiagge:           { icon: '🏖️', label: 'Spiagge' },
  attrazioni:        { icon: '⭐', label: 'Attrazioni' },
  bar:               { icon: '🍹', label: 'Bar' },
  gelateria:         { icon: '🍦', label: 'Gelateria' },
  noleggio:          { icon: '🚤', label: 'Noleggio' },
  escursioni:        { icon: '🥾', label: 'Escursioni' },
  servizi_spiaggia:  { icon: '🏖️', label: 'Servizi Spiaggia' },
  negozio:           { icon: '🛍️', label: 'Negozio' },
  eventi:            { icon: '🎉', label: 'Eventi' },
  locali_notturni:   { icon: '🌙', label: 'Locali Notturni' },
  salute:            { icon: '❤️', label: 'Salute' },
  sport:             { icon: '⚽', label: 'Sport' },
  pet:               { icon: '🐾', label: 'Pet' },
  alloggio:          { icon: '🏠', label: 'Alloggio' }
};

/* Ordine di visualizzazione delle sezioni nella schermata Servizi
   (spiagge e alloggio non compaiono qui: vanno in Spiagge / Dormire) */
const WGA_CAT_ORDER = ['eventi','food','bar','gelateria','attrazioni','escursioni','noleggio','locali_notturni','negozio','servizi_spiaggia','salute','sport','pet'];

const WGA_BEACH_BG = ['bi-1', 'bi-2', 'bi-3', 'bi-4'];

function wgaEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

async function wgaFetchActivities() {
  try {
    const res = await fetch(WGA_SUPABASE_URL + '/rest/v1/activities?select=*&order=created_at.desc', {
      headers: {
        'apikey': WGA_SUPABASE_KEY,
        'Authorization': 'Bearer ' + WGA_SUPABASE_KEY
      }
    });
    if (!res.ok) return null; // errore di rete/server: distinto da "nessuna attività"
    return await res.json();
  } catch (e) {
    return null;
  }
}

/* Card per una spiaggia (sia quelle storiche migrate, sia quelle nuove da wga-admin) */
function wgaBuildBeachCard(act, index) {
  const card = document.createElement('div');
  card.className = 'beach-card';
  const desc = act.descrizione || act.indirizzo || '';
  const hasCoords = act.lat != null && act.lng != null && !isNaN(parseFloat(act.lat)) && !isNaN(parseFloat(act.lng));
  if (hasCoords) {
    card.setAttribute('data-lat', act.lat);
    card.setAttribute('data-lng', act.lng);
  }
  const bg = WGA_BEACH_BG[index % WGA_BEACH_BG.length];
  card.innerHTML =
    '<div class="beach-img ' + bg + '" style="font-size:38px;">🏖️</div>' +
    '<div class="beach-info">' +
      '<div class="beach-name">' + wgaEsc(act.nome) + '</div>' +
      '<div class="beach-desc">' + wgaEsc(desc) + '</div>' +
      '<div class="beach-actions">' +
        '<span class="beach-dist">📍 --</span>' +
        '<button type="button" class="beach-share-btn" aria-label="Condividi ' + wgaEsc(act.nome) + '">↗</button>' +
      '</div>' +
    '</div>';
  card.querySelector('.beach-share-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    shareItem(act.nome, desc, act.google_maps_url || '');
  });
  card.addEventListener('click', function () { wgaOpenDetail(act); });
  return card;
}

/* Card generica per le altre categorie (mostrata nella schermata Servizi) */
function wgaBuildActivityCard(act) {
  const meta = WGA_CAT_META[act.categoria] || { icon: '📍', label: act.categoria };
  const card = document.createElement('div');
  card.className = 'wga-act-card';
  const desc = act.descrizione || act.indirizzo || '';
  const ratingHtml = act.rating ? '<div class="wga-act-rating">★ ' + wgaEsc(act.rating) + '</div>' : '';
  card.innerHTML =
    '<div class="wga-act-img">' + meta.icon + '</div>' +
    '<div class="wga-act-info">' +
      '<div class="wga-act-name">' + wgaEsc(act.nome) + '</div>' +
      '<div class="wga-act-desc">' + wgaEsc(desc) + '</div>' +
      ratingHtml +
      '<div class="wga-act-actions">' +
        (act.google_maps_url ? '<a class="wga-act-map-link" target="_blank" rel="noopener" href="' + wgaEsc(act.google_maps_url) + '">📍 Mappa</a>' : '<span></span>') +
        '<button type="button" class="wga-act-share-btn" aria-label="Condividi ' + wgaEsc(act.nome) + '">↗</button>' +
      '</div>' +
    '</div>';
  card.querySelector('.wga-act-share-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    shareItem(act.nome, desc, act.google_maps_url || '');
  });
  const mapLink = card.querySelector('.wga-act-map-link');
  if (mapLink) mapLink.addEventListener('click', function (e) { e.stopPropagation(); });
  card.addEventListener('click', function () { wgaOpenDetail(act); });
  return card;
}

/* Card per la sezione "In evidenza" della Home */
function wgaBuildFeaturedCard(act, index) {
  const meta = WGA_CAT_META[act.categoria] || { icon: '📍', label: act.categoria };
  const card = document.createElement('div');
  card.className = 'feat-card';
  const bg = WGA_BEACH_BG[index % WGA_BEACH_BG.length];
  const badgeHtml = act.rating ? '<div class="feat-badge">★ ' + wgaEsc(act.rating) + '</div>' : '';
  card.innerHTML =
    '<div class="feat-img ' + bg + '" style="font-size:34px;">' + meta.icon +
      '<div class="feat-img-overlay"></div>' + badgeHtml +
    '</div>' +
    '<div class="feat-info">' +
      '<div class="feat-name">' + wgaEsc(act.nome) + '</div>' +
      '<div class="feat-cat">' + wgaEsc(meta.label) + '</div>' +
    '</div>';
  card.addEventListener('click', function () { wgaOpenDetail(act); });
  return card;
}

/* Card per un alloggio (mostrata nella schermata Dormire) */
function wgaBuildAlloggioCard(act) {
  const card = document.createElement('div');
  card.className = 'wga-act-card';
  const desc = act.descrizione || act.indirizzo || '';
  const ratingHtml = act.rating ? '<div class="wga-act-rating">★ ' + wgaEsc(act.rating) + '</div>' : '';
  card.innerHTML =
    '<div class="wga-act-img">🏠</div>' +
    '<div class="wga-act-info">' +
      '<div class="wga-act-name">' + wgaEsc(act.nome) + '</div>' +
      '<div class="wga-act-desc">' + wgaEsc(desc) + '</div>' +
      ratingHtml +
      '<div class="wga-act-actions">' +
        (act.google_maps_url ? '<a class="wga-act-map-link" target="_blank" rel="noopener" href="' + wgaEsc(act.google_maps_url) + '">📍 Mappa</a>' : '<span></span>') +
        '<button type="button" class="wga-act-share-btn" aria-label="Condividi ' + wgaEsc(act.nome) + '">↗</button>' +
      '</div>' +
    '</div>';
  card.querySelector('.wga-act-share-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    shareItem(act.nome, desc, act.google_maps_url || '');
  });
  const mapLink = card.querySelector('.wga-act-map-link');
  if (mapLink) mapLink.addEventListener('click', function (e) { e.stopPropagation(); });
  card.addEventListener('click', function () { wgaOpenDetail(act); });
  return card;
}

function wgaBuildCategorySection(catKey, items) {
  const meta = WGA_CAT_META[catKey] || { icon: '📍', label: catKey };
  const section = document.createElement('div');
  section.className = 'wga-cat-section';
  const label = document.createElement('div');
  label.className = 'section-label';
  label.style.padding = '0 20px';
  label.style.marginBottom = '14px';
  label.textContent = meta.icon + ' ' + meta.label;
  const scroll = document.createElement('div');
  scroll.className = 'wga-act-scroll';
  items.forEach(function (act) { scroll.appendChild(wgaBuildActivityCard(act)); });
  section.appendChild(label);
  section.appendChild(scroll);
  return section;
}

/* Sezione Alloggi in Dormire (stesso stile delle sezioni di Servizi) */
function wgaBuildAlloggioSection(items) {
  const section = document.createElement('div');
  section.className = 'wga-cat-section';
  const label = document.createElement('div');
  label.className = 'section-label';
  label.style.padding = '0 20px';
  label.style.marginBottom = '14px';
  label.textContent = '🏠 Alloggi disponibili';
  const scroll = document.createElement('div');
  scroll.className = 'wga-act-scroll';
  items.forEach(function (act) { scroll.appendChild(wgaBuildAlloggioCard(act)); });
  section.appendChild(label);
  section.appendChild(scroll);
  return section;
}

/* ═══════════════════════════════════════════════════════════
   Schermata di dettaglio generica (#screen-ristorante)
   Popolata a runtime per QUALSIASI attività (non solo ristoranti)
   ═══════════════════════════════════════════════════════════ */

const WGA_SVG_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2" style="width:14px;height:14px;"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>';
const WGA_SVG_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const WGA_SVG_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.36 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
const WGA_SVG_MAP_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(140,170,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>';

function wgaPillHtml(svg, text) {
  return '<div style="flex-shrink:0;display:flex;align-items:center;gap:6px;background:var(--glass-bg);backdrop-filter:blur(16px);border:1px solid var(--glass-border);padding:7px 12px;border-radius:20px;">' +
    svg +
    '<span style="font-size:11px;font-weight:700;color:white;white-space:nowrap;">' + wgaEsc(text) + '</span></div>';
}

function wgaContactRowHtml(iconBg, iconSvg, label, value, href) {
  return '<a href="' + wgaEsc(href) + '" target="_blank" rel="noopener" style="text-decoration:none;display:flex;align-items:center;gap:14px;background:var(--glass-bg);backdrop-filter:blur(16px);border:1px solid var(--glass-border);border-radius:14px;padding:14px 16px;">' +
    '<div style="width:38px;height:38px;border-radius:12px;background:' + iconBg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + iconSvg + '</div>' +
    '<div><div style="font-size:12px;color:rgba(255,255,255,0.5);">' + wgaEsc(label) + '</div><div style="font-size:14px;font-weight:700;color:white;">' + wgaEsc(value) + '</div></div>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" style="width:16px;height:16px;margin-left:auto;"><polyline points="9 18 15 12 9 6"/></svg>' +
  '</a>';
}

function wgaOpenDetail(act) {
  if (!act) return;
  const meta = WGA_CAT_META[act.categoria] || { icon: '📍', label: act.categoria || 'Attività' };

  document.getElementById('wga-detail-icon').textContent = meta.icon;
  document.getElementById('wga-detail-eyebrow').textContent = meta.label;
  document.getElementById('wga-detail-name').textContent = act.nome || '';
  document.getElementById('wga-detail-cat-badge').textContent = meta.icon + ' ' + meta.label;

  const ratingBadge = document.getElementById('wga-detail-rating-badge');
  if (act.rating) {
    ratingBadge.textContent = '★ ' + act.rating;
    ratingBadge.style.display = '';
  } else {
    ratingBadge.style.display = 'none';
  }

  /* Pills: indirizzo, orario */
  const pills = document.getElementById('wga-detail-pills');
  let pillsHtml = '';
  if (act.indirizzo) pillsHtml += wgaPillHtml(WGA_SVG_PIN, act.indirizzo);
  if (act.orario) pillsHtml += wgaPillHtml(WGA_SVG_CLOCK, act.orario);
  pills.innerHTML = pillsHtml;
  pills.style.display = pillsHtml ? 'flex' : 'none';

  /* Descrizione */
  document.getElementById('wga-detail-desc').textContent = act.descrizione || 'Nessuna descrizione disponibile al momento.';

  /* Caratteristiche (tags) */
  const tagsWrap = document.getElementById('wga-detail-tags-wrap');
  const tagsEl = document.getElementById('wga-detail-tags');
  if (act.tags && act.tags.length) {
    tagsEl.innerHTML = act.tags.map(function (t) {
      return '<span style="background:var(--glass-bg);backdrop-filter:blur(16px);border:1px solid var(--glass-border);border-radius:20px;padding:8px 14px;font-size:12px;font-weight:700;color:white;">' + wgaEsc(t) + '</span>';
    }).join('');
    tagsWrap.style.display = '';
  } else {
    tagsEl.innerHTML = '';
    tagsWrap.style.display = 'none';
  }

  /* Contatti: telefono + indirizzo/mappa */
  const contactsWrap = document.getElementById('wga-detail-contacts-wrap');
  const contacts = document.getElementById('wga-detail-contacts');
  let contactsHtml = '';
  if (act.telefono) {
    contactsHtml += wgaContactRowHtml('rgba(45,212,191,0.2)', WGA_SVG_PHONE, 'Telefono', act.telefono, 'tel:' + String(act.telefono).replace(/[^0-9+]/g, ''));
  }
  if (act.indirizzo && act.google_maps_url) {
    contactsHtml += wgaContactRowHtml('rgba(100,150,255,0.2)', WGA_SVG_MAP_PIN, 'Indirizzo', act.indirizzo, act.google_maps_url);
  }
  contacts.innerHTML = contactsHtml;
  contactsWrap.style.display = contactsHtml ? '' : 'none';

  /* CTA sito web */
  const ctaWrap = document.getElementById('wga-detail-cta-wrap');
  const ctaLink = document.getElementById('wga-detail-cta-link');
  if (act.sito_web) {
    ctaLink.href = act.sito_web;
    ctaWrap.style.display = '';
  } else {
    ctaWrap.style.display = 'none';
  }

  /* Condividi */
  const shareBtn = document.getElementById('wga-detail-share-btn');
  shareBtn.onclick = function () {
    shareItem(act.nome, act.descrizione || '', act.sito_web || act.google_maps_url || '');
  };

  goTo('ristorante');
}

async function wgaLoadDynamicActivities() {
  const activities = await wgaFetchActivities();
  const beachScroll = document.getElementById('beach-scroll') || document.querySelector('#screen-spiagge .beach-scroll');

  if (activities === null) {
    /* Errore di rete: lascia il messaggio di caricamento ma lo aggiorna,
       non blocca il resto dell'app */
    if (beachScroll) {
      const note = beachScroll.querySelector('.wga-loading-note');
      if (note) note.textContent = 'Impossibile caricare le spiagge al momento.';
    }
    return;
  }

  /* Raggruppa per categoria */
  const byCategory = {};
  activities.forEach(function (act) {
    const key = act.categoria || 'altro';
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(act);
  });

  /* Spiagge → schermata Spiagge (sostituisce il messaggio "Caricamento…") */
  if (beachScroll) {
    beachScroll.innerHTML = '';
    const beaches = byCategory.spiagge || [];
    if (beaches.length) {
      beaches.forEach(function (act, i) { beachScroll.appendChild(wgaBuildBeachCard(act, i)); });
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:20px;font-size:12px;color:rgba(255,255,255,0.4);';
      empty.textContent = 'Nessuna spiaggia disponibile al momento.';
      beachScroll.appendChild(empty);
    }
  }

  /* Tutte le altre categorie (tranne alloggio) → schermata Servizi, una sezione per categoria */
  const container = document.getElementById('wga-dynamic-activities');
  if (container) {
    container.innerHTML = '';
    WGA_CAT_ORDER.forEach(function (catKey) {
      if (byCategory[catKey] && byCategory[catKey].length) {
        container.appendChild(wgaBuildCategorySection(catKey, byCategory[catKey]));
      }
    });
    /* Eventuali categorie non previste nell'ordine sopra (di sicurezza) */
    Object.keys(byCategory).forEach(function (catKey) {
      if (catKey !== 'spiagge' && catKey !== 'alloggio' && WGA_CAT_ORDER.indexOf(catKey) === -1) {
        container.appendChild(wgaBuildCategorySection(catKey, byCategory[catKey]));
      }
    });
  }

  /* Alloggio → schermata Dormire */
  const alloggioContainer = document.getElementById('wga-dynamic-alloggio');
  if (alloggioContainer) {
    alloggioContainer.innerHTML = '';
    const alloggi = byCategory.alloggio || [];
    if (alloggi.length) {
      alloggioContainer.appendChild(wgaBuildAlloggioSection(alloggi));
    }
  }

  /* In evidenza → schermata Home (qualsiasi categoria, se in_evidenza è attivo) */
  const featuredSection = document.getElementById('wga-featured-section');
  const featuredScroll = document.getElementById('wga-featured-scroll');
  if (featuredSection && featuredScroll) {
    const featured = activities.filter(function (act) { return act.in_evidenza === true; });
    featuredScroll.innerHTML = '';
    if (featured.length) {
      featured.forEach(function (act, i) { featuredScroll.appendChild(wgaBuildFeaturedCard(act, i)); });
      featuredSection.style.display = '';
    } else {
      featuredSection.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', function () {
  wgaLoadDynamicActivities();
});
