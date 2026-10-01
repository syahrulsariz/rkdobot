import fs from 'fs';
import { getSaldo, tambahSaldo, potongSaldo, normalizeSaldoPhone, formatRupiah, setSaldo } from '../utils/saldo.js';

function getMessageText(msg) {
  return msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
}

function isAdmin(sender, ADMIN_LIST = []) {
  const senderRaw = (sender || '').split('@')[0];
  const normalize = (p) => { let c = String(p || '').replace(/\D/g, ''); if (c.startsWith('0')) c = '62' + c.substring(1); else if (c && !c.startsWith('62')) c = '62' + c; return c; };
  const senderNorm = normalize(senderRaw);
  return ADMIN_LIST.some(a => normalize(a) === senderNorm);
}

function parseAmount(raw) {
  const value = String(raw || '').toLowerCase().trim().replace(/rp/g, '').replace(/\s/g, '');
  if (!value) return NaN;
  const multipliers = { k: 1000, rb: 1000, jt: 1000000, j: 1000000 };
  const match = value.match(/^([0-9]+(?:[.,][0-9]+)?)((?:k|rb|jt|j)?)$/);
  if (!match) { const plain = Number(value.replace(/[.,]/g, '')); return Number.isFinite(plain) ? plain : NaN; }
  return Number(match[1].replace(',', '.')) * (multipliers[match[2]] || 1);
}

export default {
  command: ['!listsaldo','!ceksaldouser','!addsaldo','!tambahsaldo','!kurangsaldo','!minsaldo','!hapussaldo','!resetsaldo'],

  async execute(sock, msg, queue, ADMIN_LIST = []) {
    const text = getMessageText(msg).trim();
    const lower = text.toLowerCase();
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    if (!isAdmin(sender, ADMIN_LIST)) { await sock.sendMessage(from, { text: '❌ Akses ditolak. Command saldo admin hanya bisa digunakan oleh admin.' }, { quoted: msg }); return; }

    if (lower === '!listsaldo') {
      let data = {};
      try { if (fs.existsSync('./saldo.json')) data = JSON.parse(fs.readFileSync('./saldo.json', 'utf8')) || {}; } catch {}
      const entries = Object.entries(data).map(([phone, info]) => [normalizeSaldoPhone(phone), Number(info?.saldo || 0)]).filter(([phone]) => phone).sort((a,b) => b[1]-a[1]);
      const total = entries.reduce((s, [,saldo]) => s + saldo, 0);
      const active = entries.filter(([,saldo]) => saldo > 0).length;
      if (!entries.length) { await sock.sendMessage(from, { text: '💳 LIST SALDO USER\n\nBelum ada data saldo user.' }, { quoted: msg }); return; }
      let chunks = [], current = '💳 LIST SALDO USER\n\n';
      entries.forEach(([phone,saldo], i) => { const line = `${i+1}. +${phone} — ${formatRupiah(saldo)}\n`; if ((current+line).length > 3500) { chunks.push(current); current=''; } current += line; });
      current += `\n👥 Total user: ${entries.length}\n💰 User bersaldo: ${active}\n💵 Total saldo: ${formatRupiah(total)}`;
      chunks.push(current);
      for (const chunk of chunks) await sock.sendMessage(from, { text: chunk }, { quoted: msg });
      return;
    }

    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const phone = normalizeSaldoPhone(parts[1]);
    if (!phone || !/^62\d{7,15}$/.test(phone)) { await sock.sendMessage(from, { text: '❌ Nomor user tidak valid. Contoh: `081234567890`.' }, { quoted: msg }); return; }

    if (command === '!ceksaldouser') { await sock.sendMessage(from, { text: `💳 SALDO USER\n\n📱 +${phone}\n💰 Saldo: *${formatRupiah(getSaldo(phone))}*` }, { quoted: msg }); return; }

    if (command === '!hapussaldo' || command === '!resetsaldo') {
      const before = getSaldo(phone); setSaldo(phone, 0);
      await sock.sendMessage(from, { text: `🗑️ Saldo user dihapus\n\n📱 +${phone}\n💰 Sebelum: ${formatRupiah(before)}\n💰 Sekarang: *Rp 0*` }, { quoted: msg }); return;
    }

    const amount = parseAmount(parts[2]);
    if (!Number.isFinite(amount) || amount <= 0) { await sock.sendMessage(from, { text: '❌ Nominal tidak valid. Contoh: `!addsaldo 081234567890 10k`.' }, { quoted: msg }); return; }

    if (command === '!addsaldo' || command === '!tambahsaldo') {
      const before = getSaldo(phone); const after = tambahSaldo(phone, amount);
      await sock.sendMessage(from, { text: `➕ Saldo berhasil ditambahkan\n\n📱 +${phone}\n➕ Tambah: ${formatRupiah(amount)}\n💰 Sebelum: ${formatRupiah(before)}\n💰 Sekarang: *${formatRupiah(after)}*` }, { quoted: msg }); return;
    }

    if (command === '!kurangsaldo' || command === '!minsaldo') {
      const before = getSaldo(phone);
      if (before < amount) { await sock.sendMessage(from, { text: `❌ Saldo tidak cukup.\n\n📱 +${phone}\n💰 Saldo: ${formatRupiah(before)}\n➖ Diminta: ${formatRupiah(amount)}` }, { quoted: msg }); return; }
      const result = potongSaldo(phone, amount);
      await sock.sendMessage(from, { text: `➖ Saldo berhasil dikurangi\n\n📱 +${phone}\n➖ Kurang: ${formatRupiah(amount)}\n💰 Sebelum: ${formatRupiah(before)}\n💰 Sekarang: *${formatRupiah(result.saldo)}*` }, { quoted: msg });
    }
  }
};