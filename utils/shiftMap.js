// utils/shiftMap.js
import fs from 'fs';
import { normalizePhone, getPhoneByLid } from './lidMap.js';

const SHIFT_PATH = './shift.json';

// Jam aktif tiap shift (dalam menit dari 00:00)
const SHIFT_WINDOWS = {
  pagi:  { start: 6 * 60,        end: 14 * 60,        label: '06.00 - 14.00' },
  siang: {
  start: 14 * 60,
  end: 26 * 60,
  label: '14.00 - 22.00'
},
};

// ─── LOAD / SAVE ────────────────────────────────────────────────────
function loadShiftData() {
  if (!fs.existsSync(SHIFT_PATH)) {
    fs.writeFileSync(SHIFT_PATH, JSON.stringify({}, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(SHIFT_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveShiftData(data) {
  fs.writeFileSync(SHIFT_PATH, JSON.stringify(data, null, 2));
}

// ─── WAKTU JAKARTA ──────────────────────────────────────────────────
function getJakartaNow() {
  const jakartaStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  return new Date(jakartaStr);
}

function getTodayDateStr() {
  const j = getJakartaNow();
  const y = j.getFullYear();
  const m = String(j.getMonth() + 1).padStart(2, '0');
  const d = String(j.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWithinWindow(shift) {
  const win = SHIFT_WINDOWS[shift];
  if (!win) return false;
  const j = getJakartaNow();
  const minutesNow = j.getHours() * 60 + j.getMinutes();
  return minutesNow >= win.start && minutesNow <= win.end;
}

// ─── RESOLVE NOMOR DARI JID (HP atau LID) ──────────────────────────
function resolvePhone(senderJid) {
  const raw = senderJid.split('@')[0];
  if (!senderJid.endsWith('@lid')) return normalizePhone(raw);
  return getPhoneByLid(raw); // null kalau LID belum ke-mapping ke nomor HP
}

// ─── API UTAMA ──────────────────────────────────────────────────────

// Simpan pilihan shift user untuk HARI INI (Asia/Jakarta)
// Hanya boleh diset SEKALI per hari. Kalau sudah pernah set hari ini,
// permintaan ganti shift ditolak (harus tunggu hari berikutnya).
export function setUserShift(senderJid, shift) {
  const phone = resolvePhone(senderJid);
  if (!phone) return { success: false, reason: 'phone_not_found' };

  const data = loadShiftData();
  const existing = data[phone];
  const today = getTodayDateStr();

  if (existing && existing.date === today) {
    return {
      success: false,
      reason: 'already_set',
      shift: existing.shift,
      phone
    };
  }

  data[phone] = { shift, date: today };
  saveShiftData(data);

  return { success: true, phone, shift };
}

// Ambil shift user HARI INI. Kalau tanggal tersimpan beda dari hari ini
// (belum pilih ulang), otomatis dianggap belum pilih -> reset harian.
export function getUserShift(senderJid) {
  const phone = resolvePhone(senderJid);
  if (!phone) return null;

  const data = loadShiftData();
  const entry = data[phone];
  if (!entry) return null;
  if (entry.date !== getTodayDateStr()) return null;

  return entry.shift;
}

// Hapus pilihan shift hari ini, biar user bisa pilih ulang !pagi/!siang
export function resetUserShift(phone) {
  const normalized = normalizePhone(phone);
  const data = loadShiftData();

  if (!data[normalized]) {
    return { success: false, reason: 'not_found' };
  }

  delete data[normalized];
  saveShiftData(data);

  return { success: true, phone: normalized };
}

export function getShiftWindowLabel(shift) {
  return SHIFT_WINDOWS[shift]?.label || '-';
}

// Dipanggil sebelum eksekusi command lain.
// status: 'not_set' | 'outside_window' | 'ok'
export function checkShiftAccess(senderJid) {
  const shift = getUserShift(senderJid);
  if (!shift) return { status: 'not_set' };

  if (!isWithinWindow(shift)) return { status: 'outside_window', shift };

  return { status: 'ok', shift };
}