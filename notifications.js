/* ==========================================================================
   Welcome Golfo Aranci — Notifiche Locali
   Da includere in index.html con: <script src="notifications.js"></script>
   Richiede che il service worker (sw.js) sia già registrato.
   ========================================================================== */

const WGA_NOTIF_STORAGE_KEY = 'wga_notif_settings';

// ---- Configurazione eventi (in futuro può leggere da Supabase invece che da qui) ----
const WGA_EVENTS = [
  { title: "Welcome Golfo Aranci App", date: "2026-06-06", desc: "Stay Tuned — novità in arrivo!" }
  // Aggiungi qui altri eventi: { title: "...", date: "YYYY-MM-DD", desc: "..." }
];

// ---- Messaggi per la notifica giornaliera (uno a rotazione casuale) ----
const WGA_DAILY_MESSAGES = [
  "🌊 Buongiorno! Scopri le spiagge più belle di Golfo Aranci oggi.",
  "☀️ Oggi è una bella giornata per un aperitivo sul mare. Guarda i bar consigliati!",
  "🍕 Hai già scelto dove pranzare oggi? Dai un'occhiata ai ristoranti in evidenza.",
  "🐬 Sapevi che puoi avvistare i delfini con un tour in barca? Scopri le escursioni.",
  "📍 Nuovi luoghi da esplorare ti aspettano nella sezione Attrazioni."
];

/**
 * Richiede il permesso per le notifiche.
 * Va chiamata da un'azione utente (es. click su un bottone), mai in automatico al caricamento.
 */
async function wgaRequestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Le notifiche non sono supportate su questo dispositivo/browser.');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Mostra una notifica locale tramite il service worker (necessario su mobile/PWA installata).
 */
function wgaShowNotification(title, options = {}) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => {
    registration.showNotification(title, {
      icon: 'icon-192.png',
      badge: 'icon-72.png',
      ...options
    });
  });
}

/**
 * Restituisce/inizializza le impostazioni utente salvate in localStorage.
 */
function wgaGetNotifSettings() {
  const raw = localStorage.getItem(WGA_NOTIF_STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fallback sotto */ }
  }
  return {
    dailyEnabled: false,
    lastDailyShown: null,   // data (YYYY-MM-DD) dell'ultima notifica giornaliera mostrata
    eventsNotified: []      // elenco title+date già notificati, per non ripetere
  };
}

function wgaSaveNotifSettings(settings) {
  localStorage.setItem(WGA_NOTIF_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Attiva la notifica giornaliera (da collegare a un toggle nella pagina Profilo).
 */
async function wgaEnableDailyNotification() {
  const granted = await wgaRequestNotificationPermission();
  if (!granted) {
    alert('Per ricevere aggiornamenti giornalieri, abilita le notifiche per questa app nelle impostazioni del dispositivo.');
    return false;
  }
  const settings = wgaGetNotifSettings();
  settings.dailyEnabled = true;
  wgaSaveNotifSettings(settings);
  wgaCheckDailyNotification(); // mostra subito se non ancora mostrata oggi
  return true;
}

function wgaDisableDailyNotification() {
  const settings = wgaGetNotifSettings();
  settings.dailyEnabled = false;
  wgaSaveNotifSettings(settings);
}

/**
 * Controlla se è già stata mostrata la notifica giornaliera oggi; se no, la mostra.
 * Va chiamata ad ogni apertura dell'app (es. in fondo al DOMContentLoaded).
 */
function wgaCheckDailyNotification() {
  const settings = wgaGetNotifSettings();
  if (!settings.dailyEnabled) return;
  if (Notification.permission !== 'granted') return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (settings.lastDailyShown === today) return; // già mostrata oggi

  const msg = WGA_DAILY_MESSAGES[Math.floor(Math.random() * WGA_DAILY_MESSAGES.length)];
  wgaShowNotification('Welcome Golfo Aranci', {
    body: msg,
    tag: 'wga-daily'
  });

  settings.lastDailyShown = today;
  wgaSaveNotifSettings(settings);
}

/**
 * Controlla se ci sono eventi imminenti (entro 2 giorni) non ancora notificati.
 * Va chiamata ad ogni apertura dell'app.
 */
function wgaCheckUpcomingEvents() {
  if (Notification.permission !== 'granted') return;

  const settings = wgaGetNotifSettings();
  const now = new Date();
  const in2days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  WGA_EVENTS.forEach((event) => {
    const eventDate = new Date(event.date + 'T00:00:00');
    const alreadyNotified = settings.eventsNotified.includes(event.title + event.date);

    if (!alreadyNotified && eventDate >= now && eventDate <= in2days) {
      wgaShowNotification(`🎉 ${event.title}`, {
        body: event.desc,
        tag: 'wga-event-' + event.date
      });
      settings.eventsNotified.push(event.title + event.date);
    }
  });

  wgaSaveNotifSettings(settings);
}

/**
 * Da chiamare una volta al caricamento dell'app (es. in fondo al body o dopo DOMContentLoaded).
 */
function wgaInitNotifications() {
  document.addEventListener('DOMContentLoaded', () => {
    if (Notification.permission === 'granted') {
      wgaCheckDailyNotification();
      wgaCheckUpcomingEvents();
    }
  });
}

wgaInitNotifications();
