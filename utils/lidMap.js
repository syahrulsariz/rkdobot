// utils/lidMap.js
import fs from 'fs';

const LID_MAP_PATH = './lid_map.json';
const WHITELIST_PATH = './whitelist.json';

// ─── LID MAP ───────────────────────────────────────────────────────
export function loadLidMap() {
  if (!fs.existsSync(LID_MAP_PATH)) fs.writeFileSync(LID_MAP_PATH, JSON.stringify({}));
  return JSON.parse(fs.readFileSync(LID_MAP_PATH, 'utf8'));
}

function saveLidMap(map) {
  fs.writeFileSync(LID_MAP_PATH, JSON.stringify(map, null, 2));
}

// Simpan mapping: nomor HP <-> LID (dua arah)
export function saveLidEntry(jid) {
  const map = loadLidMap();
  const raw = jid.split('@')[0];

  if (jid.endsWith('@lid')) {
    // Simpan LID, belum tau HP-nya - simpan apa adanya
    if (!map.lid_to_phone[raw]) {
      map.lid_to_phone[raw] = null; // placeholder
      saveLidMap(map);
    }
  } else {
    // Format HP normal @s.whatsapp.net
    const phone = normalizePhone(raw);
    if (!map.phone_to_lid[phone]) {
      map.phone_to_lid[phone] = null; // belum ada LID-nya
    }
    saveLidMap(map);
  }
}

// Load dengan struktur dua arah
function loadLidMapFull() {
  if (!fs.existsSync(LID_MAP_PATH)) {
    const empty = { phone_to_lid: {}, lid_to_phone: {} };
    fs.writeFileSync(LID_MAP_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    const data = JSON.parse(fs.readFileSync(LID_MAP_PATH, 'utf8'));
    if (!data.phone_to_lid) data.phone_to_lid = {};
    if (!data.lid_to_phone) data.lid_to_phone = {};
    return data;
  } catch {
    const empty = { phone_to_lid: {}, lid_to_phone: {} };
    fs.writeFileSync(LID_MAP_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

// Rekam setiap sender yang masuk, link HP <-> LID kalau bisa
export function recordSender(jid, linkedJid = null) {
  const map = loadLidMapFull();
  const raw = jid.split('@')[0];

  if (jid.endsWith('@lid')) {
    // Ini LID
    if (!map.lid_to_phone[raw]) map.lid_to_phone[raw] = null;
    if (linkedJid && !linkedJid.endsWith('@lid')) {
      const phone = normalizePhone(linkedJid.split('@')[0]);
      map.lid_to_phone[raw] = phone;
      map.phone_to_lid[phone] = raw;
    }
  } else {
    // Ini nomor HP biasa
    const phone = normalizePhone(raw);
    if (!map.phone_to_lid[phone]) map.phone_to_lid[phone] = null;
    if (linkedJid && linkedJid.endsWith('@lid')) {
      const lid = linkedJid.split('@')[0];
      map.phone_to_lid[phone] = lid;
      map.lid_to_phone[lid] = phone;
    }
  }

  fs.writeFileSync(LID_MAP_PATH, JSON.stringify(map, null, 2));
}

export function getLidByPhone(phone) {
  const map = loadLidMapFull();
  const normalized = normalizePhone(phone);
  return map.phone_to_lid[normalized] || null;
}

export function getPhoneByLid(lid) {
  const map = loadLidMapFull();
  return map.lid_to_phone[lid] || null;
}

// ─── WHITELIST ──────────────────────────────────────────────────────
function loadWhitelist() {
  if (!fs.existsSync(WHITELIST_PATH)) {
    fs.writeFileSync(WHITELIST_PATH, JSON.stringify({ phones: [], jids: [], expiry: {} }, null, 2));
  }
  try {
    const data = JSON.parse(fs.readFileSync(WHITELIST_PATH, 'utf8'));
    if (!data.phones) data.phones = [];
    if (!data.jids) data.jids = [];
    if (!data.expiry) data.expiry = {};
    return data;
  } catch {
    return { phones: [], jids: [], expiry: {} };
  }
}

function saveWhitelist(wl) {
  fs.writeFileSync(WHITELIST_PATH, JSON.stringify(wl, null, 2));
}

export function addToWhitelist(phone) {
  const normalized = normalizePhone(phone);
  const wl = loadWhitelist();
  const map = loadLidMapFull();

  if (wl.phones.includes(normalized)) return { success: false, reason: 'already_exists' };

  wl.phones.push(normalized);

  // Kalau LID-nya udah kerekam, tambah juga
  const lid = map.phone_to_lid[normalized];
  if (lid && !wl.jids.includes(`${lid}@lid`)) {
    wl.jids.push(`${lid}@lid`);
  }
  // Tambah format JID HP juga
  const phoneJid = `${normalized}@s.whatsapp.net`;
  if (!wl.jids.includes(phoneJid)) {
    wl.jids.push(phoneJid);
  }

  saveWhitelist(wl);
  return { success: true, phone: normalized, lid: lid || 'belum terdeteksi' };
}

export function removeFromWhitelist(phone) {
  const normalized = normalizePhone(phone);
  const wl = loadWhitelist();
  const map = loadLidMapFull();

  if (!wl.phones.includes(normalized)) return { success: false, reason: 'not_found' };

  wl.phones = wl.phones.filter(p => p !== normalized);

  // Hapus JID HP
  wl.jids = wl.jids.filter(j => j !== `${normalized}@s.whatsapp.net`);

  // Hapus LID kalau ada
  const lid = map.phone_to_lid[normalized];
  if (lid) {
    wl.jids = wl.jids.filter(j => j !== `${lid}@lid`);
  }

  // Hapus juga data expiry-nya
  if (wl.expiry && wl.expiry[normalized] !== undefined) {
    delete wl.expiry[normalized];
  }

  saveWhitelist(wl);
  return { success: true, phone: normalized };
}

export function isWhitelisted(senderJid) {
  const wl = loadWhitelist();

  // Cek langsung by JID (HP atau LID)
  if (wl.jids.includes(senderJid)) return true;

  // Cek by nomor HP dari JID
  const raw = senderJid.split('@')[0];
  if (!senderJid.endsWith('@lid')) {
    const phone = normalizePhone(raw);
    if (wl.phones.includes(phone)) return true;
  } else {
    // Ini LID, cek via mapping
    const map = loadLidMapFull();
    const phone = map.lid_to_phone[raw];
    if (phone && wl.phones.includes(phone)) return true;
  }

  return false;
}

// Kurangin masa aktif sejumlah `days` hari (bukan hapus total).
// Ditolak kalau: user gak punya masa aktif (belum pernah !aktif / udah expired),
// atau sisa masa aktifnya lebih kecil dari jumlah hari yang mau dikurangin.
export function removeActivePeriod(phone, days) {
  const normalized = normalizePhone(phone);
  const wl = loadWhitelist();

  const currentExpiry = wl.expiry?.[normalized];
  const now = Date.now();

  if (!currentExpiry || currentExpiry <= now) {
    return { success: false, reason: 'not_found' };
  }

  const daysToRemove = Number(days);
  if (!daysToRemove || daysToRemove <= 0) {
    return { success: false, reason: 'invalid_days' };
  }

  const remainingMs = currentExpiry - now;
  const requestedMs = daysToRemove * 24 * 60 * 60 * 1000;
  const remainingDaysNow = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  if (requestedMs > remainingMs) {
    return { success: false, reason: 'insufficient', remainingDays: remainingDaysNow };
  }

  const newExpiry = currentExpiry - requestedMs;
  wl.expiry[normalized] = newExpiry;
  saveWhitelist(wl);

  const remainingDaysAfter = Math.max(0, Math.ceil((newExpiry - now) / (24 * 60 * 60 * 1000)));

  return { success: true, phone: normalized, removedDays: daysToRemove, remainingDays: remainingDaysAfter };
}

export function getWhitelistDisplay() {
  const wl = loadWhitelist();
  const map = loadLidMapFull();

  return wl.phones.map((phone, idx) => {
    const lid = map.phone_to_lid[phone];
    const remaining = getRemainingDays(phone);
    const statusAktif = remaining > 0 ? `✅ ${remaining} hari lagi` : `⛔ Expired`;
    return `${idx + 1}. +${phone}\n   LID: ${lid ? lid + '@lid' : '⏳ belum terdeteksi'}\n   Masa Aktif: ${statusAktif}`;
  });
}

// ─── MASA AKTIF ─────────────────────────────────────────────────────

// Set / perpanjang masa aktif nomor.
// Kalau masih ada sisa masa aktif (belum expired), hari baru DITAMBAHKAN
// dari expiredAt yang lama. Kalau udah expired / belum pernah aktif,
// dihitung dari sekarang.
export function setActivePeriod(phone, days) {
  const normalized = normalizePhone(phone);
  const wl = loadWhitelist();
  if (!wl.expiry) wl.expiry = {};

  const now = Date.now();
  const currentExpiry = wl.expiry[normalized] || 0;
  const baseTime = currentExpiry > now ? currentExpiry : now;

  const expiredAt = baseTime + (Number(days) * 24 * 60 * 60 * 1000);
  wl.expiry[normalized] = expiredAt;
  saveWhitelist(wl);

  return { success: true, phone: normalized, expiredAt };
}

// Cek expired berdasarkan JID pengirim (HP atau LID)
// Return true kalau: gak ketemu nomornya, belum pernah di-!aktif, ATAU udah lewat expiredAt
export function isExpired(senderJid) {
  const phone = resolvePhoneFromJid(senderJid);
  if (!phone) return true;

  const wl = loadWhitelist();
  const expiredAt = wl.expiry?.[phone];
  if (!expiredAt) return true; // belum pernah diaktifkan admin

  return Date.now() > expiredAt;
}

// Sisa hari masa aktif (buat display, misal di !listuser)
export function getRemainingDays(phone) {
  const normalized = normalizePhone(phone);
  const wl = loadWhitelist();
  const expiredAt = wl.expiry?.[normalized];
  if (!expiredAt) return 0;

  const remainingMs = expiredAt - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;
}

// Helper: cari nomor HP dari JID pengirim (HP langsung atau LID)
function resolvePhoneFromJid(senderJid) {
  const raw = senderJid.split('@')[0];
  if (!senderJid.endsWith('@lid')) return normalizePhone(raw);

  const map = loadLidMapFull();
  return map.lid_to_phone[raw] || null;
}

// ─── ACTIVE USERS (untuk broadcast jam 6 pagi) ──────────────────────
// Ambil nomor HP yang masih punya masa aktif (belum expired)
export function getActivePhones() {
  const wl = loadWhitelist();
  const now = Date.now();
  return wl.phones.filter(phone => wl.expiry?.[phone] && wl.expiry[phone] > now);
}

// Ambil detail user aktif (nomor, expiredAt, sisa hari) - buat !listaktif
// Diurutkan dari yang paling deket expired duluan
export function getActiveUsersDetailed() {
  const wl = loadWhitelist();
  const now = Date.now();

  return wl.phones
    .filter(phone => wl.expiry?.[phone] && wl.expiry[phone] > now)
    .map(phone => {
      const expiredAt = wl.expiry[phone];
      const remainingDays = Math.ceil((expiredAt - now) / (24 * 60 * 60 * 1000));
      return { phone, expiredAt, remainingDays };
    })
    .sort((a, b) => a.expiredAt - b.expiredAt);
}

// ─── UTILS ──────────────────────────────────────────────────────────
export function normalizePhone(phone) {
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
  else if (!cleaned.startsWith('62')) cleaned = '62' + cleaned;
  return cleaned;
}