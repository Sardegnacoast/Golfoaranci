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

/* Tracciamento click sulle card (per il report settimanale via email) - scrittura
   silenziosa e non bloccante: eventuali errori di rete non impediscono l'apertura
   della card (29 Sett 2026). */
function wgaTrackClick(nome, categoria) {
  try {
    fetch(WGA_SUPABASE_URL + '/rest/v1/activity_clicks', {
      method: 'POST',
      headers: {
        'apikey': WGA_SUPABASE_KEY,
        'Authorization': 'Bearer ' + WGA_SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ nome: nome, categoria: categoria || 'altro' })
    }).catch(function () {});
  } catch (e) {}
}

const WGA_CAT_META = {
  food:              { icon: '🍽️', label: 'Food' },
  spiagge:           { icon: '🏖️', label: 'Spiagge' },
  attrazioni:        { icon: '⭐', label: 'Attrazioni' },
  bar:               { icon: '🍹', label: 'Bar' },
  gelateria:         { icon: '🍦', label: 'Gelateria' },
  noleggio:          { icon: '🚗', label: 'Noleggio' },
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

/* Cache delle attività dinamiche raggruppate per categoria, popolata da
   wgaLoadDynamicActivities e usata da wgaOpenCategoria per costruire la
   schermata dedicata di una categoria al tap sull'icona in Servizi. */
let WGA_ACTIVITIES_BY_CATEGORY = {};

function wgaEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* Accetta come link solo indirizzi http/https: i campi "Mappa"/"Sito web"
   arrivano da wga-admin (senza login) e potrebbero in teoria contenere
   qualsiasi valore, quindi non ci si può fidare dello schema (es.
   "javascript:...") anche se il testo è già stato reso sicuro con wgaEsc
   (30 Sett 2026). */
function wgaSafeUrl(u) {
  if (!u) return '';
  return /^https?:\/\//i.test(String(u).trim()) ? u : '';
}

/* Costruisce in sicurezza lo style inline per una foto di sfondo (act.foto):
   valida lo schema come wgaSafeUrl() e mette l'indirizzo tra virgolette in
   modo che non possa "rompere" l'attributo style="" circostante (30 Sett 2026). */
function wgaSafeBgStyle(url) {
  const safe = wgaSafeUrl(url);
  return safe ? "background-image:url('" + wgaEsc(safe) + "');background-size:cover;background-position:center;" : '';
}

/* Converte un URL di Google Maps nell'equivalente Apple Maps: l'app deve sempre
   offrire anche la mappa nativa iOS, non solo Google Maps (richiesto da Apple,
   Guideline 4 - Design, respinta 29 Ott 2026). Riconosce i pattern usati nei
   dati (daddr=lat,lng oppure ?q=nome); se non riconosciuto restituisce '' e il
   pulsante Apple Maps resta semplicemente nascosto, senza regressioni. */
function wgaAppleMapsUrl(googleUrl) {
  const safe = wgaSafeUrl(googleUrl);
  if (!safe) return '';
  let m = safe.match(/[?&]daddr=([^&]+)/i);
  if (m) return 'https://maps.apple.com/?daddr=' + m[1];
  m = safe.match(/[?&]q=([^&]+)/i);
  if (m) return 'https://maps.apple.com/?q=' + m[1];
  return '';
}

/* Costruisce SEMPRE la coppia di link Google Maps + Apple Maps per un'attivita',
   in ordine di affidabilita': coordinate lat/lng → link maps con daddr/q →
   ricerca per nome + indirizzo + "Golfo Aranci". Cosi' nessuna scheda resta
   con solo Google Maps (prima, se il link non aveva un pattern riconosciuto,
   Apple Maps spariva — es. Driver in Cravatta, 30 Ott 2026). */
function wgaMapsUrls(act) {
  const lat = parseFloat(act.lat), lng = parseFloat(act.lng);
  if (!isNaN(lat) && !isNaN(lng)) {
    const ll = lat + ',' + lng;
    return { google: 'https://maps.google.com/maps?daddr=' + ll, apple: 'https://maps.apple.com/?daddr=' + ll };
  }
  const g = wgaSafeUrl(act.link || act.google_maps_url || '');
  const isMapsLink = g && /google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(g);
  const appleFromG = isMapsLink ? wgaAppleMapsUrl(g) : '';
  if (isMapsLink && appleFromG) return { google: g, apple: appleFromG };
  const q = [act.nome, act.indirizzo, 'Golfo Aranci'].filter(Boolean).join(', ');
  if (!act.nome) return { google: '', apple: '' };
  const qe = encodeURIComponent(q);
  return {
    google: isMapsLink ? g : 'https://maps.google.com/?q=' + qe,
    apple: 'https://maps.apple.com/?q=' + qe
  };
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
/* Le spiagge ufficiali di Golfo Aranci: contenuto statico e stabile (nomi e foto
   dal sito del Comune), non gestito da wga-admin. Eventuali spiagge aggiunte
   in Supabase (categoria "spiagge") vengono mostrate in coda a queste. */
const WGA_SPIAGGE_UFFICIALI = [
  { nome: 'Cala Moresca', descrizione: 'Incontaminata · Snorkeling', dettaglio: "Piccola baia incontaminata con pineta. Acque verde smeraldo, ideale per lo snorkeling. Di fronte si trovano i Baracconi e l'isolotto di Figarolo. Meta di appassionati di immersioni.", tags: ['Pineta', 'Snorkeling', 'Parcheggio', 'Bar'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/11d5e509ce8c2e8f2c25a179f0e77210d08ef847/750/-1/', link: 'https://maps.google.com/maps?daddr=40.9798981,9.6679688', categoria: 'spiagge' },
  { nome: 'Terrata', descrizione: 'Sabbia fine · Acque turchesi', dettaglio: "Piccola baia di sabbia bianca e fine, circondata da vegetazione mediterranea. Con il suo mare turchese e poco profondo, è ideale per famiglie e bambini. La spiaggia ha un fondale misto di sabbia e rocce con accesso comodo tramite sentiero. È libera e senza limitazioni d'ingresso.", tags: ['Libera', 'Sentiero di accesso', 'Fondale basso', 'Ideale famiglie'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/49da1e1818fbb4e02c2ed569f075b167f8b2ad32/750/-1/', link: 'https://maps.google.com/maps?daddr=40.9776489,9.582638', categoria: 'spiagge' },
  { nome: 'Cala Sassari', descrizione: '500m · Sabbia dorata', dettaglio: 'Lunga circa 500 metri, sabbia dorata circondata dalla macchia mediterranea. Il mare offre riflessi verde smeraldo e turchesi. Fondale basso e sabbioso, ideale per famiglie. Ben riparata dai venti, offre vari servizi.', tags: ['Parcheggio', 'Bar / Ristorante', 'Noleggio sdraio', 'Accessibile disabili'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/94bdc4d5bed196f7588600d336d2e8355d4bd814/750/-1/', link: 'https://maps.google.com/maps?daddr=40.9877,9.5847', categoria: 'spiagge' },
  { nome: 'Spiaggia Bianca', descrizione: 'Acque turchesi · Molto vivace', dettaglio: 'Forma ad arco con acque turchesi e sabbia bianchissima. Fondale basso, molto popolare anche la sera in estate. Servita da parcheggio, punto ristoro e noleggio attrezzature.', tags: ['Parcheggio', 'Bar / Ristorante', 'Noleggio ombrelloni', 'Passerella disabili'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/4b048383def57dddfc5effda958b061f87bd4b1d/750/-1/', link: 'https://maps.google.com/maps?daddr=40.9908,9.5914', categoria: 'spiagge' },
  { nome: 'Cala Sabina', descrizione: '300m · Ginepri · Caraibica', dettaglio: 'Circa 300m di sabbia fine circondata da ginepri centenari. Acque smeraldo con fondale basso. Raggiungibile anche in treno da Golfo Aranci. Considerata una delle più belle della Gallura.', tags: ['Treno diretto', 'Parcheggio', 'Bar', 'Snorkeling'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/8b846a209d03b0cc5d5a11d30bf0427234f5dc33/750/-1/', link: 'https://maps.google.com/maps?daddr=41.0103,9.5856', categoria: 'spiagge' },
  { nome: '4a e 5a Spiaggia', descrizione: 'Ideale famiglie · Servizi completi', dettaglio: 'Due baie adiacenti con fondale basso e sabbioso, perfette per famiglie con bambini. Circondate dalla macchia mediterranea, offrono stabilimenti balneari e servizi completi.', tags: ['Stabilimento balneare', 'Parcheggio', 'Bar', 'Fondale basso'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/9fa6b0b1684af49c32c544268639e1906525c5c7/750/-1/', link: 'https://maps.google.com/maps?daddr=41.0017,9.6086', categoria: 'spiagge' },
  { nome: '3a Spiaggia', descrizione: 'La più bella del centro', dettaglio: 'La più bella delle cinque spiagge cittadine. Sabbia bianca e morbida, acque verde-azzurre con fondale sabbioso e basso. La più visitata di Golfo Aranci in alta stagione.', tags: ['Stabilimento balneare', 'Bar / Ristorante', 'Doccia', 'Parcheggio'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/f81de27820106c8d91c76857c98f3b629e57a42a/750/-1/', link: 'https://maps.google.com/maps?daddr=41.0038,9.6130', categoria: 'spiagge' },
  { nome: '1a e 2a Spiaggia', descrizione: 'Centro città · Lungomare', dettaglio: 'Le spiagge del centro abitato, animate e con tutti i servizi. Facilmente raggiungibili a piedi dal Lungomare. Molto frequentate in alta stagione con stabilimenti e ristoranti.', tags: ['A piedi dal centro', 'Stabilimento', 'Bar / Ristorante', 'Accessibile'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/444ec283b58ed09a7ea19b0127128a8e5ec2a6aa/750/-1/', link: 'https://maps.google.com/maps?daddr=41.0023,9.6199', categoria: 'spiagge' },
  { nome: 'Figarolo', descrizione: 'Isolotto · Solo in barca', dettaglio: 'Isolotto di fronte alla costa di Golfo Aranci, raggiungibile solo in barca. Sede del Centro Immersioni Figarolo. Natura incontaminata, fondali spettacolari e panorama su Capo Figari.', tags: ['Solo in barca', 'Centro immersioni', 'Natura incontaminata', 'Panorama Capo Figari'], foto: 'https://cmsphoto.ww-cdn.com/resizeapi/9eace40e15479307f8fc7fd1e83c3e1739f5c9dc/750/-1/', link: 'https://maps.google.com/maps?daddr=40.9837,9.6397', categoria: 'spiagge' }
];

/* Le strutture ricettive ufficiali di Golfo Aranci (hotel + case vacanza):
   contenuto statico e stabile, non gestito da wga-admin. Eventuali strutture
   aggiunte in Supabase (categoria "alloggio") vengono mostrate in coda a queste. */
const WGA_STRUTTURE_UFFICIALI = [
  { nome: 'Gabbiano Azzurro Hotel & Suites', descrizione: 'Hotel 4 stelle · 512 recensioni', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/hotel_gabbiano.jpg', link: 'https://maps.google.com/?q=Gabbiano+Azzurro+Hotel+Suites+Golfo+Aranci', google_maps_url: 'https://maps.google.com/?q=Gabbiano+Azzurro+Hotel+Suites+Golfo+Aranci', tag: '★ 4.6', categoria: 'alloggio' },
  { nome: 'Hotel Villa Margherita', descrizione: 'Hotel 4 stelle · 407 recensioni', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/hotel_margherita.jpg', link: 'https://maps.google.com/?q=Hotel+Villa+Margherita+Golfo+Aranci', google_maps_url: 'https://maps.google.com/?q=Hotel+Villa+Margherita+Golfo+Aranci', tag: '★ 4.8', categoria: 'alloggio' },
  { nome: 'Baia Caddinas Hotel Resort & SPA', descrizione: 'Hotel 4 stelle · 760 recensioni', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/hotel_caddinas.jpg', link: 'https://maps.google.com/?q=Baia+Caddinas+Hotel+Resort+SPA+Golfo+Aranci', google_maps_url: 'https://maps.google.com/?q=Baia+Caddinas+Hotel+Resort+SPA+Golfo+Aranci', tag: '★ 4.4', categoria: 'alloggio' },
  { nome: 'Hotel Castello', descrizione: 'Hotel 3 stelle · 325 recensioni', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/hotel_castello.jpg', link: 'https://maps.google.com/?q=Hotel+Castello+Golfo+Aranci', google_maps_url: 'https://maps.google.com/?q=Hotel+Castello+Golfo+Aranci', tag: '★ 4.2', categoria: 'alloggio' },
  { nome: 'Hotel Maria Golfo Aranci', descrizione: 'Hotel 3 stelle · 162 recensioni', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/hotel_maria.jpg', link: 'https://maps.google.com/?q=Hotel+Maria+Golfo+Aranci', google_maps_url: 'https://maps.google.com/?q=Hotel+Maria+Golfo+Aranci', tag: '★ 4.7', categoria: 'alloggio' },
  { nome: 'Bilo Oasi Cala Moresca', descrizione: 'Appartamento · Golfo Aranci', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/airbnb_bilo.jpg', link: 'https://www.airbnb.it/rooms/1481187274322485792', tag: '🏠 Airbnb', categoria: 'alloggio' },
  { nome: 'C. Moresca Paradiso Golfo Aranci', descrizione: 'Appartamento · Golfo Aranci', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/airbnb_paradiso.jpg', link: 'https://www.airbnb.it/rooms/1453056328777721995', tag: '🏠 Airbnb', categoria: 'alloggio' },
  { nome: 'Cala Moresca Relax Golfo Aranci', descrizione: 'Appartamento · Golfo Aranci', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/airbnb_relax.jpg', link: 'https://www.airbnb.it/rooms/1452945281089631279', tag: '🏠 Airbnb', categoria: 'alloggio' },
  { nome: 'Perlacea Paradiso Golfo Aranci', descrizione: 'Appartamento · Golfo Aranci', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/airbnb_perlacea_relax.jpg', link: 'https://www.airbnb.it/rooms/1452914556825708588', tag: '🏠 Airbnb', categoria: 'alloggio' },
  { nome: 'Perlacea Relax Golfo Aranci', descrizione: 'Appartamento · Golfo Aranci', foto: 'https://raw.githubusercontent.com/sardegnacoast/Golfoaranci/main/airbnb_perlacea_relax.jpg', link: 'https://www.airbnb.it/rooms/1452844220307828303', tag: '🏠 Airbnb', categoria: 'alloggio' }
];

/* Card foto per una struttura ricettiva (stesso stile visivo delle card Spiagge) — solo la
   struttura con la sua foto, nome e descrizione naturale: nessuna etichetta/distinzione
   di tipologia separata, come richiesto dal cliente. */
function wgaBuildStrutturaCard(item, index) {
  const card = document.createElement('div');
  card.className = 'beach-card';
  const bg = WGA_BEACH_BG[index % WGA_BEACH_BG.length];
  const link = wgaSafeUrl(item.link || item.google_maps_url || item.sito_web || '');
  const imgStyle = wgaSafeBgStyle(item.foto);
  const imgContent = imgStyle ? '' : '🏠';
  const tag = item.tag || (item.rating ? '★ ' + item.rating : '');
  card.innerHTML =
    '<div class="beach-img ' + bg + '" style="font-size:38px;' + imgStyle + '">' + imgContent + '</div>' +
    '<div class="beach-info">' +
      '<div class="beach-name">' + wgaEsc(item.nome) + '</div>' +
      '<div class="beach-desc">' + wgaEsc(item.descrizione || '') + '</div>' +
      '<div class="beach-actions">' +
        '<span class="beach-dist">' + wgaEsc(tag) + '</span>' +
        '<button type="button" class="beach-share-btn" aria-label="Condividi ' + wgaEsc(item.nome) + '">↗</button>' +
      '</div>' +
    '</div>';
  card.querySelector('.beach-share-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    shareItem(item.nome, item.descrizione || '', link);
  });
  if (link && !item.google_maps_url) {
    card.addEventListener('click', function () { wgaTrackClick(item.nome, item.categoria); window.open(link, '_blank', 'noopener'); });
  } else {
    /* Se l'elemento ha un link mappa (es. hotel verso Google Maps), si passa dal
       dettaglio che offre anche Apple Maps, invece di aprire Google Maps da solo
       (richiesto da Apple, Guideline 4 - Design, respinta 29 Ott 2026) */
    card.addEventListener('click', function () { wgaTrackClick(item.nome, item.categoria); wgaOpenDetail(item); });
  }
  return card;
}

function wgaRenderStaticStrutture() {
  const strutturaScroll = document.getElementById('wga-dynamic-alloggio');
  if (!strutturaScroll) return;
  strutturaScroll.innerHTML = '';
  WGA_STRUTTURE_UFFICIALI.forEach(function (item, i) { strutturaScroll.appendChild(wgaBuildStrutturaCard(item, i)); });
}

function wgaBuildBeachCard(act, index) {
  const card = document.createElement('div');
  card.className = 'beach-card';
  const desc = act.descrizione || act.indirizzo || '';
  const hasCoords = act.lat != null && act.lng != null && !isNaN(parseFloat(act.lat)) && !isNaN(parseFloat(act.lng));
  if (hasCoords) {
    card.setAttribute('data-lat', act.lat);
    card.setAttribute('data-lng', act.lng);
  }
  const link = wgaSafeUrl(act.link || act.google_maps_url || '');
  const bg = WGA_BEACH_BG[index % WGA_BEACH_BG.length];
  const imgStyle = wgaSafeBgStyle(act.foto);
  const imgContent = imgStyle ? '' : '🏖️';
  card.innerHTML =
    '<div class="beach-img ' + bg + '" style="font-size:38px;' + imgStyle + '">' + imgContent + '</div>' +
    '<div class="beach-info">' +
      '<div class="beach-name">' + wgaEsc(act.nome) + '</div>' +
      '<div class="beach-desc">' + wgaEsc(desc) + '</div>' +
      '<div class="beach-actions">' +
        '<span class="beach-dist">📍 Vedi dettagli</span>' +
        '<button type="button" class="beach-share-btn" aria-label="Condividi ' + wgaEsc(act.nome) + '">↗</button>' +
      '</div>' +
    '</div>';
  card.querySelector('.beach-share-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    shareItem(act.nome, desc, link);
  });
  card.addEventListener('click', function () { wgaTrackClick(act.nome, act.categoria); wgaOpenDetail(act); });
  return card;
}

/* Card generica per le altre categorie (mostrata nella schermata Servizi) — stesso
   stile foto a tutta larghezza delle card Spiagge/Dormire (28 Ott 2026) */
function wgaBuildActivityCard(act, index) {
  const meta = WGA_CAT_META[act.categoria] || { icon: '📍', label: act.categoria };
  const card = document.createElement('div');
  card.className = 'beach-card';
  const desc = act.descrizione || act.indirizzo || '';
  const bg = WGA_BEACH_BG[(index || 0) % WGA_BEACH_BG.length];
  const imgStyle = wgaSafeBgStyle(act.foto);
  const imgContent = imgStyle ? '' : meta.icon;
  const tag = act.rating ? '★ ' + act.rating : '📍 Vedi dettagli';
  card.innerHTML =
    '<div class="beach-img ' + bg + '" style="font-size:38px;' + imgStyle + '">' + imgContent + '</div>' +
    '<div class="beach-info">' +
      '<div class="beach-name">' + wgaEsc(act.nome) + '</div>' +
      '<div class="beach-desc">' + wgaEsc(desc) + '</div>' +
      '<div class="beach-actions">' +
        '<span class="beach-dist">' + wgaEsc(tag) + '</span>' +
        '<button type="button" class="beach-share-btn" aria-label="Condividi ' + wgaEsc(act.nome) + '">↗</button>' +
      '</div>' +
    '</div>';
  card.querySelector('.beach-share-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    shareItem(act.nome, desc, act.google_maps_url || '');
  });
  /* Il click sulla card apre la schermata di dettaglio, che offre sia Google Maps
     sia Apple Maps: prima si saltava dritti su Google Maps senza alternativa
     (richiesto da Apple, Guideline 4 - Design, respinta 29 Ott 2026) */
  card.addEventListener('click', function () {
    wgaTrackClick(act.nome, act.categoria);
    wgaOpenDetail(act);
  });
  return card;
}

/* Card per la sezione "In evidenza" della Home */
function wgaBuildFeaturedCard(act, index) {
  const meta = WGA_CAT_META[act.categoria] || { icon: '📍', label: act.categoria };
  const card = document.createElement('div');
  card.className = 'feat-card';
  const bg = WGA_BEACH_BG[index % WGA_BEACH_BG.length];
  const badgeHtml = act.rating ? '<div class="feat-badge">★ ' + wgaEsc(act.rating) + '</div>' : '';
  const imgStyle = wgaSafeBgStyle(act.foto);
  const imgContent = imgStyle ? '' : meta.icon;
  card.innerHTML =
    '<div class="feat-img ' + bg + '" style="font-size:34px;' + imgStyle + '">' + imgContent +
      '<div class="feat-img-overlay"></div>' + badgeHtml +
    '</div>' +
    '<div class="feat-info">' +
      '<div class="feat-name">' + wgaEsc(act.nome) + '</div>' +
      '<div class="feat-cat">' + wgaEsc(meta.label) + '</div>' +
    '</div>';
  /* Il click sulla card apre sempre la schermata di dettaglio, che offre sia
     Google Maps sia Apple Maps (richiesto da Apple, Guideline 4 - Design,
     respinta 29 Ott 2026) */
  card.addEventListener('click', function () {
    wgaTrackClick(act.nome, act.categoria);
    wgaOpenDetail(act);
  });
  return card;
}

/* Card per un alloggio (mostrata nella schermata Dormire) — stesso stile foto a
   tutta larghezza delle card Spiagge (28 Ott 2026) */
function wgaBuildAlloggioCard(act, index) {
  const card = document.createElement('div');
  card.className = 'beach-card';
  const desc = act.descrizione || act.indirizzo || '';
  const bg = WGA_BEACH_BG[(index || 0) % WGA_BEACH_BG.length];
  const imgStyle = wgaSafeBgStyle(act.foto);
  const imgContent = imgStyle ? '' : '🏠';
  const tag = act.rating ? '★ ' + act.rating : '📍 Vedi dettagli';
  card.innerHTML =
    '<div class="beach-img ' + bg + '" style="font-size:38px;' + imgStyle + '">' + imgContent + '</div>' +
    '<div class="beach-info">' +
      '<div class="beach-name">' + wgaEsc(act.nome) + '</div>' +
      '<div class="beach-desc">' + wgaEsc(desc) + '</div>' +
      '<div class="beach-actions">' +
        '<span class="beach-dist">' + wgaEsc(tag) + '</span>' +
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

function wgaBuildCategorySection(catKey, items) {
  const meta = WGA_CAT_META[catKey] || { icon: '📍', label: catKey };
  const section = document.createElement('div');
  section.className = 'wga-cat-section';
  section.id = 'wga-cat-' + catKey;
  const label = document.createElement('div');
  label.className = 'section-label';
  label.style.padding = '0 20px';
  label.style.marginBottom = '14px';
  label.textContent = meta.icon + ' ' + meta.label;
  const scroll = document.createElement('div');
  scroll.className = 'beach-scroll';
  items.forEach(function (act, i) { scroll.appendChild(wgaBuildActivityCard(act, i)); });
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
  scroll.className = 'beach-scroll';
  items.forEach(function (act, i) { scroll.appendChild(wgaBuildAlloggioCard(act, i)); });
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

  const heroEl = document.getElementById('wga-detail-hero');
  const iconEl = document.getElementById('wga-detail-icon');
  const heroFoto = wgaSafeUrl(act.foto);
  if (heroFoto) {
    heroEl.style.backgroundImage = "url('" + heroFoto + "')";
    iconEl.style.display = 'none';
  } else {
    heroEl.style.backgroundImage = '';
    iconEl.style.display = '';
  }
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

  /* Descrizione (il campo "dettaglio", quando presente, è il testo esteso mostrato
     solo qui nel dettaglio; "descrizione" resta il tag breve mostrato nella card) */
  document.getElementById('wga-detail-desc').textContent = act.dettaglio || act.descrizione || 'Nessuna descrizione disponibile al momento.';

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
  if (act.indirizzo) {
    /* Riga indirizzo: su iPhone/iPad apre Apple Maps (mappa nativa), altrove Google Maps */
    const addrMaps = wgaMapsUrls(act);
    const isIOS = (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios') || /iPhone|iPad|iPod/.test(navigator.userAgent);
    const addrHref = isIOS ? addrMaps.apple : addrMaps.google;
    if (addrHref) contactsHtml += wgaContactRowHtml('rgba(100,150,255,0.2)', WGA_SVG_MAP_PIN, 'Indirizzo', act.indirizzo, addrHref);
  }
  contacts.innerHTML = contactsHtml;
  contactsWrap.style.display = contactsHtml ? '' : 'none';

  /* CTA sito web */
  const ctaWrap = document.getElementById('wga-detail-cta-wrap');
  const ctaLink = document.getElementById('wga-detail-cta-link');
  const ctaSitoWeb = wgaSafeUrl(act.sito_web);
  if (ctaSitoWeb) {
    ctaLink.href = ctaSitoWeb;
    ctaWrap.style.display = '';
  } else {
    ctaWrap.style.display = 'none';
  }

  /* CTA apri in maps: Google Maps + Apple Maps (quest'ultimo richiesto da Apple,
     Guideline 4 - Design, respinta 29 Ott 2026 — l'app deve offrire sempre anche
     la mappa nativa iOS, non solo una di terze parti) */
  const mapsWrap = document.getElementById('wga-detail-maps-wrap');
  const mapsLink = document.getElementById('wga-detail-maps-link');
  const appleMapsWrap = document.getElementById('wga-detail-maps-apple-wrap');
  const appleMapsLink = document.getElementById('wga-detail-maps-apple-link');
  const maps = wgaMapsUrls(act);
  /* Google e Apple Maps vanno sempre in coppia: se c'e' l'uno c'e' anche l'altro
     (Apple, Guideline 4 — mai solo Google Maps). */
  if (maps.google && maps.apple) {
    mapsLink.href = maps.google;
    appleMapsLink.href = maps.apple;
    mapsWrap.style.display = '';
    appleMapsWrap.style.display = '';
  } else {
    mapsWrap.style.display = 'none';
    appleMapsWrap.style.display = 'none';
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
    /* Errore di rete: le 9 spiagge ufficiali (statiche) restano visibili comunque,
       non blocca il resto dell'app */
    /* Anche senza connessione al database, la sezione "In evidenza" mostra
       comunque gli slot promozionali invece di restare vuota */
    const featuredSectionErr = document.getElementById('wga-featured-section');
    const featuredScrollErr = document.getElementById('wga-featured-scroll');
    if (featuredSectionErr && featuredScrollErr) {
      featuredScrollErr.innerHTML = '';
      featuredScrollErr.appendChild(wgaBuildPromoSlotCard('Inserisci la tua attività', 'Visibilità esclusiva per migliaia di turisti'));
      featuredScrollErr.appendChild(wgaBuildSponsorAdCard('Schmukler Real Estate', 'Immobili e investimenti a Golfo Aranci', 'https://www.schmukler-realestate.com'));
      featuredSectionErr.style.display = '';
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

  /* Spiagge → schermata Spiagge: le 9 spiagge ufficiali statiche restano sempre visibili
     (renderizzate da wgaRenderStaticBeaches all'avvio); qui si aggiungono in coda solo
     eventuali spiagge extra caricate da Supabase, senza mai svuotare la lista statica. */
  if (beachScroll) {
    /* Escludi le righe Supabase che duplicano una spiaggia ufficiale statica (stesso
       nome): prima Cala Moresca e Cala Sabina comparivano due volte, la seconda
       senza foto (30 Ott 2026). */
    const norm = function (t) { return String(t || '').trim().toLowerCase(); };
    const ufficiali = WGA_SPIAGGE_UFFICIALI.map(function (b) { return norm(b.nome); });
    const beaches = (byCategory.spiagge || []).filter(function (b) { return ufficiali.indexOf(norm(b.nome)) === -1; });
    if (beaches.length) {
      const startIndex = WGA_SPIAGGE_UFFICIALI.length;
      beaches.forEach(function (act, i) { beachScroll.appendChild(wgaBuildBeachCard(act, startIndex + i)); });
    }
  }

  /* Tutte le altre categorie (tranne alloggio) → tenute in cache, mostrate solo
     quando l'utente tocca l'icona corrispondente nella griglia Servizi (schermata
     dedicata #screen-categoria, vedi wgaOpenCategoria). La griglia Servizi mostra
     ora solo le icone, non più le liste in linea. */
  WGA_ACTIVITIES_BY_CATEGORY = byCategory;

  /* Alloggio → schermata Dormire: le strutture ufficiali statiche restano sempre
     visibili (renderizzate da wgaRenderStaticStrutture all'avvio); qui si aggiungono
     in coda solo eventuali strutture extra caricate da Supabase, come card foto
     coerenti con lo stesso stile, senza mai svuotare la lista statica. */
  const alloggioContainer = document.getElementById('wga-dynamic-alloggio');
  if (alloggioContainer) {
    const alloggi = byCategory.alloggio || [];
    if (alloggi.length) {
      const startIndex = WGA_STRUTTURE_UFFICIALI.length;
      alloggi.forEach(function (act, i) { alloggioContainer.appendChild(wgaBuildStrutturaCard(act, startIndex + i)); });
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
    } else {
      featuredScroll.appendChild(wgaBuildPromoSlotCard('Inserisci la tua attività', 'Visibilità esclusiva per migliaia di turisti'));
      featuredScroll.appendChild(wgaBuildSponsorAdCard('Schmukler Real Estate', 'Immobili e investimenti a Golfo Aranci', 'https://www.schmukler-realestate.com'));
    }
    featuredSection.style.display = '';
  }
}

/* Card "Slot Premium" (box pubblicitaria prioritaria) mostrata in Home quando non ci sono
   attività in evidenza: deve risultare subito accattivante e riconoscibile come spazio
   pubblicitario acquistabile, non come una card normale (richiesta Enrico 18 Ott 2026) */
function wgaBuildPromoSlotCard(title, subtitle) {
  const card = document.createElement('div');
  card.className = 'sponsor-slot';
  card.innerHTML =
    '<div class="sponsor-inner">' +
      '<div class="sponsor-star">⭐</div>' +
      '<div class="sponsor-title">' + wgaEsc(title) + '</div>' +
      '<div class="sponsor-sub">' + wgaEsc(subtitle) + '</div>' +
      '<button type="button" class="sponsor-badge">✦ Slot Premium</button>' +
    '</div>';
  const openPromoContact = function (e) {
    if (e) e.stopPropagation();
    const subject = encodeURIComponent('Richiesta Slot Premium - In Evidenza');
    const body = encodeURIComponent('Ciao, vorrei informazioni per uno slot premium "In evidenza" nella app Welcome Golfo Aranci.\n\nNome attività:\nTelefono:\n');
    window.open('mailto:welcomegolfoaranci@gmail.com?subject=' + subject + '&body=' + body, '_self');
  };
  card.querySelector('.sponsor-badge').addEventListener('click', openPromoContact);
  card.addEventListener('click', openPromoContact);
  return card;
}

/* Card sponsor "reale" (stesso stile visivo dello Slot Premium) che punta a un sito
   esterno invece di aprire il contatto per comprare lo slot — usata quando uno slot
   pubblicitario e' gia' stato venduto a un'attivita' reale (es. Schmukler Real Estate). */
function wgaBuildSponsorAdCard(title, subtitle, url) {
  /* Link vero (<a href target=_blank>) e non window.open(): dentro l'app
     nativa (Capacitor/WKWebView) window.open da un listener JS puo' essere
     ignorato, mentre un anchor esterno viene sempre aperto nel browser di
     sistema — stesso meccanismo dei pulsanti "Apri in Google/Apple Maps". */
  const card = document.createElement('a');
  card.className = 'sponsor-slot';
  card.href = wgaSafeUrl(url) || '#';
  card.target = '_blank';
  card.rel = 'noopener';
  card.style.textDecoration = 'none';
  card.style.color = 'inherit';
  card.innerHTML =
    '<div class="sponsor-inner">' +
      '<div class="sponsor-star">⭐</div>' +
      '<div class="sponsor-title">' + wgaEsc(title) + '</div>' +
      '<div class="sponsor-sub">' + wgaEsc(subtitle) + '</div>' +
      '<span class="sponsor-badge">Scopri di più</span>' +
    '</div>';
  card.addEventListener('click', function () { wgaTrackClick(title, 'sponsor'); });
  return card;
}

/* ===== Tap su un'icona categoria nella schermata Servizi =====
   Scorre fino alla sezione di quella categoria (se ci sono attivita'
   caricate da Supabase), oppure mostra un avviso se e' vuota. */
function wgaShowToast(msg) {
  let toast = document.getElementById('wga-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'wga-toast';
    toast.style.cssText = 'position:fixed;left:20px;right:20px;bottom:96px;z-index:999;' +
      'background:var(--glass-bg);backdrop-filter:blur(20px);border:1px solid var(--glass-border);' +
      'border-radius:16px;padding:14px 18px;font-size:13px;font-weight:700;color:white;' +
      'text-align:center;opacity:0;transition:opacity .25s ease;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(wgaShowToast._t);
  wgaShowToast._t = setTimeout(function () { toast.style.opacity = '0'; }, 2200);
}

/* Tap su un'icona categoria nella schermata Servizi: apre la schermata dedicata
   #screen-categoria con le card di quella categoria (24 Sett 2026 — prima
   scorreva alla sezione in linea, ora la griglia Servizi mostra solo le icone). */
function wgaOpenCategoria(catKey) {
  /* "Ristorante" e "Pizzeria" non sono categorie reali su Supabase (restano entrambe
     'food'): qui si dividono lato client per nome, su richiesta di Michele (30 Ott 2026)
     - Pizzeria mostra solo La Pecora Viziosa, Ristorante mostra il resto di 'food'. */
  const WGA_PIZZERIA_NOMI = ['la pecora viziosa'];
  let items, label;
  if (catKey === 'ristorante' || catKey === 'pizzeria') {
    const foodItems = WGA_ACTIVITIES_BY_CATEGORY['food'] || [];
    if (catKey === 'pizzeria') {
      items = foodItems.filter(function (a) { return WGA_PIZZERIA_NOMI.indexOf((a.nome || '').trim().toLowerCase()) !== -1; });
      label = 'Pizzeria';
    } else {
      items = foodItems.filter(function (a) { return WGA_PIZZERIA_NOMI.indexOf((a.nome || '').trim().toLowerCase()) === -1; });
      label = 'Ristorante';
    }
  } else {
    items = WGA_ACTIVITIES_BY_CATEGORY[catKey] || [];
    const meta = WGA_CAT_META[catKey];
    label = meta ? meta.label : catKey;
  }
  if (!items.length) {
    wgaShowToast('Nessuna attivita\' “' + label + '” disponibile al momento.');
    return;
  }
  const content = document.getElementById('wga-categoria-content');
  content.innerHTML = '';
  content.appendChild(wgaBuildCategorySection(catKey, items));
  goTo('categoria');
}

function wgaRenderStaticBeaches() {
  const beachScroll = document.getElementById('beach-scroll') || document.querySelector('#screen-spiagge .beach-scroll');
  if (!beachScroll) return;
  beachScroll.innerHTML = '';
  WGA_SPIAGGE_UFFICIALI.forEach(function (act, i) { beachScroll.appendChild(wgaBuildBeachCard(act, i)); });
}

document.addEventListener('DOMContentLoaded', function () {
  wgaRenderStaticBeaches();
  wgaRenderStaticStrutture();
  wgaLoadDynamicActivities();
});
