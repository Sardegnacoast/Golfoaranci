/* ═══════════════════════════════════════════════════════════
   Welcome Golfo Aranci — Notifiche locali (PWA)
   Funzionano dal browser/PWA senza bisogno di un server push.
   Due tipi di messaggio:
   1) Messaggio del giorno scritto a mano (WGA_DAILY_MESSAGES)
   2) Promemoria generico a rotazione, se non c'è un messaggio per oggi
   ═══════════════════════════════════════════════════════════ */

const WGA_NOTIF_KEY = 'wga_notif_enabled';
const WGA_NOTIF_LASTSHOWN_KEY = 'wga_notif_last_shown';

/* Promemoria generici di riserva — usati quando per la data odierna
   non è stato scritto un messaggio specifico qui sotto. Ruotano automaticamente. */
const WGA_GENERIC_MESSAGES = [
  "Scopri cosa fare oggi a Golfo Aranci! 🌊",
  "Hai già dato un'occhiata alle spiagge vicino a te? 📍",
  "Un aperitivo al tramonto? Guarda i locali consigliati 🍹",
  "Nuovi eventi e offerte ti aspettano nell'app ☀️"
];

/* ✏️ MESSAGGIO DEL GIORNO — modifica questa lista per mandare un'offerta
   o un evento specifico in un giorno preciso.
   Formato chiave: "YYYY-MM-DD" (es. "2026-09-01").
   Se la data di oggi non è qui sotto, viene usato un messaggio generico. */
const WGA_DAILY_MESSAGES = {
  // "2026-09-01": "🎉 Stasera Sagra del Pesce in piazza dalle 19:00!",
  // "2026-09-05": "🍹 Aperitivo 2x1 al Sunset Bar fino alle 20:00",
};

function wgaTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function wgaTodayMessage() {
  const key = wgaTodayKey();
  if (WGA_DAILY_MESSAGES[key]) return WGA_DAILY_MESSAGES[key];
  const idx = new Date().getDate() % WGA_GENERIC_MESSAGES.length;
  return WGA_GENERIC_MESSAGES[idx];
}

function wgaNotifEnabled() {
  return localStorage.getItem(WGA_NOTIF_KEY) === '1';
}

/* Imposta lo stato iniziale dell'interruttore nella schermata Profilo */
function initNotifToggle() {
  const toggle = document.getElementById('notif-toggle');
  if (!toggle) return;
  toggle.checked = wgaNotifEnabled();
}

/* Chiamata dall'interruttore nella schermata Profilo (onchange) */
function toggleNotifications(enabled) {
  if (enabled) {
    if (!("Notification" in window)) {
      alert("Il tuo browser non supporta le notifiche.");
      const t = document.getElementById('notif-toggle'); if (t) t.checked = false;
      return;
    }
    Notification.requestPermission().then(function (perm) {
      if (perm === "granted") {
        localStorage.setItem(WGA_NOTIF_KEY, '1');
        wgaCheckAndShowDaily(true);
      } else {
        localStorage.setItem(WGA_NOTIF_KEY, '0');
        const t = document.getElementById('notif-toggle'); if (t) t.checked = false;
      }
    }).catch(function () {
      const t = document.getElementById('notif-toggle'); if (t) t.checked = false;
    });
  } else {
    localStorage.setItem(WGA_NOTIF_KEY, '0');
  }
}

/* Mostra la notifica del giorno se non è già stata mostrata oggi
   (force=true la mostra comunque, usato appena l'utente attiva l'interruttore) */
function wgaCheckAndShowDaily(force) {
  if (!wgaNotifEnabled()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const today = wgaTodayKey();
  const lastShown = localStorage.getItem(WGA_NOTIF_LASTSHOWN_KEY);
  if (!force && lastShown === today) return;

  const body = wgaTodayMessage();
  const show = function (reg) {
    if (reg && reg.showNotification) {
      reg.showNotification("Welcome Golfo Aranci", { body: body });
    } else {
      try { new Notification("Welcome Golfo Aranci", { body: body }); } catch (e) {}
    }
    localStorage.setItem(WGA_NOTIF_LASTSHOWN_KEY, today);
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then(show).catch(function () { show(null); });
  } else {
    show(null);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initNotifToggle();
  wgaCheckAndShowDaily(false);
});
