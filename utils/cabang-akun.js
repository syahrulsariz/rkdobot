import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// whitelist.json ada di root project
const WHITELIST_PATH = path.join(__dirname, '../whitelist.json');

// Semua cabang di cabang-map.js WAJIB punya akun khusus (dual-login flow) sendiri-sendiri
// buat proses cutting sesi — bukan cuma RNJ. Kalau akunnya belum pernah di-setting lewat
// !settingakun, command !cutting bakal ditolak dan diminta setting dulu.
export function butuhAkunKhusus(cabang) {
  return true;
}

function bacaWhitelist() {
  try {
    const raw = fs.readFileSync(WHITELIST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('❌ Gagal baca whitelist.json:', err.message);
    return { phones: [], jids: [], expiry: {}, akunCabang: {} };
  }
}

function tulisWhitelist(data) {
  fs.writeFileSync(WHITELIST_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Ambil akun cabang dari whitelist.json. Return null kalau belum pernah di-setting.
export function getAkunCabang(cabang) {
  const data = bacaWhitelist();
  const akun = data.akunCabang?.[cabang.toLowerCase()];

  if (!akun || !akun.username || !akun.password) return null;

  return akun;
}

// Simpan/replace akun cabang di whitelist.json. Kalau cabang udah ada, otomatis ke-replace.
export function setAkunCabang(cabang, username, password) {
  const data = bacaWhitelist();
  if (!data.akunCabang) data.akunCabang = {};

  const cabangKey = cabang.toLowerCase();
  const isReplace = !!data.akunCabang[cabangKey];

  data.akunCabang[cabangKey] = { username, password };
  tulisWhitelist(data);

  return { isReplace };
}