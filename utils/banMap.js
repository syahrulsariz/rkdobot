// utils/banMap.js
import fs from 'fs';
import { normalizePhone, getPhoneByLid } from './lidMap.js';

const BAN_PATH = './banned.json';

// ─── LOAD / SAVE ────────────────────────────────────────────────────
function loadBanData() {
  if (!fs.existsSync(BAN_PATH)) {
    fs.writeFileSync(BAN_PATH, JSON.stringify({}, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(BAN_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveBanData(data) {
  fs.writeFileSync(BAN_PATH, JSON.stringify(data, null, 2));
}

// Helper: cari nomor HP dari JID pengirim (HP langsung atau LID)
function resolvePhone(senderJid) {
  const raw = senderJid.split('@')[0];
  if (!senderJid.endsWith('@lid')) return normalizePhone(raw);
  return getPhoneByLid(raw); // null kalau LID belum ke-mapping ke nomor HP
}

// ─── BAN (sementara, dibuka manual pakai !unban) ────────────────────
export function banUser(phoneInput, reason) {
  const phone = normalizePhone(phoneInput);
  const data = loadBanData();

  if (data[phone]) {
    return { success: false, reason: 'already_banned', phone };
  }

  data[phone] = {
    bannedAt: Date.now(),
    reason: reason && reason.trim() ? reason.trim() : 'Terdeteksi penggunaan multiuser'
  };
  saveBanData(data);

  return { success: true, phone, reason: data[phone].reason };
}

export function unbanUser(phoneInput) {
  const phone = normalizePhone(phoneInput);
  const data = loadBanData();

  if (!data[phone]) {
    return { success: false, reason: 'not_found', phone };
  }

  delete data[phone];
  saveBanData(data);

  return { success: true, phone };
}

// Cek status ban berdasarkan JID pengirim (HP atau LID)
export function isBanned(senderJid) {
  const phone = resolvePhone(senderJid);
  if (!phone) return false;

  const data = loadBanData();
  return !!data[phone];
}

export function getBanInfo(senderJid) {
  const phone = resolvePhone(senderJid);
  if (!phone) return null;

  const data = loadBanData();
  return data[phone] ? { phone, ...data[phone] } : null;
}

// Buat display di !listban
export function getBannedListDisplay() {
  const data = loadBanData();
  const phones = Object.keys(data);

  return phones.map((phone, idx) => {
    const info = data[phone];
    const tanggal = new Date(info.bannedAt).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false
    });
    return `${idx + 1}. +${phone}\n   📅 Dibanned: ${tanggal}\n   📝 Alasan: ${info.reason}`;
  });
}