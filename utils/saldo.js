// utils/saldo.js
import fs from 'fs';

const SALDO_PATH = './saldo.json';

function ensureFile() {
  if (!fs.existsSync(SALDO_PATH)) fs.writeFileSync(SALDO_PATH, JSON.stringify({}, null, 2));
}

function loadSaldo() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(SALDO_PATH, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function saveSaldo(data) { fs.writeFileSync(SALDO_PATH, JSON.stringify(data, null, 2)); }

export function normalizeSaldoPhone(phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
  else if (cleaned && !cleaned.startsWith('62')) cleaned = '62' + cleaned;
  return cleaned;
}

export function getSaldo(phone) {
  const normalized = normalizeSaldoPhone(phone);
  if (!normalized) return 0;
  const data = loadSaldo();
  return Number(data[normalized]?.saldo || 0);
}

export function tambahSaldo(phone, amount) {
  const normalized = normalizeSaldoPhone(phone);
  const nominal = Number(amount);
  if (!normalized) throw new Error('Nomor user tidak valid.');
  if (!Number.isFinite(nominal) || nominal <= 0) throw new Error('Nominal saldo tidak valid.');
  const data = loadSaldo();
  if (!data[normalized]) data[normalized] = { saldo: 0 };
  data[normalized].saldo = Number(data[normalized].saldo || 0) + nominal;
  data[normalized].updatedAt = new Date().toISOString();
  saveSaldo(data);
  return data[normalized].saldo;
}

export function potongSaldo(phone, amount) {
  const normalized = normalizeSaldoPhone(phone);
  const nominal = Number(amount);
  if (!normalized) return { success: false, reason: 'invalid_phone', saldo: 0 };
  if (!Number.isFinite(nominal) || nominal < 0) return { success: false, reason: 'invalid_amount', saldo: getSaldo(normalized) };
  const data = loadSaldo();
  const current = Number(data[normalized]?.saldo || 0);
  if (current < nominal) return { success: false, reason: 'insufficient', saldo: current, required: nominal };
  if (!data[normalized]) data[normalized] = { saldo: 0 };
  data[normalized].saldo = current - nominal;
  data[normalized].updatedAt = new Date().toISOString();
  saveSaldo(data);
  return { success: true, saldo: data[normalized].saldo, deducted: nominal };
}

export function refundSaldo(phone, amount) { return tambahSaldo(phone, amount); }
export function formatRupiah(amount) { return 'Rp ' + Number(amount || 0).toLocaleString('id-ID'); }
