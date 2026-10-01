// commands/topup.js
import { initiateTopup, isProcessing, lockProcessing, unlockProcessing } from '../utils/extendPayment.js';
import { tambahSaldo, normalizeSaldoPhone, formatRupiah } from '../utils/saldo.js';
import { getPhoneByLid } from '../utils/lidMap.js';

const NOMINALS = [
  [10000, '10k'], [20000, '20k'], [25000, '25k'], [30000, '30k'],
  [35000, '35k'], [40000, '40k'], [45000, '45k'], [50000, '50k'],
  [55000, '55k'], [60000, '60k'], [65000, '65k'], [70000, '70k'],
  [75000, '75k'], [80000, '80k'], [85000, '85k'], [90000, '90k'],
  [95000, '95k'], [100000, '100k'], [150000, '150k'], [200000, '200k']
].map(([amount, label]) => ({ amount, label }));

function resolvePhone(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const alt = msg.key.remoteJidAlt || null;
  if (alt) return normalizeSaldoPhone(alt.split('@')[0]);
  if (!sender.endsWith('@lid')) return normalizeSaldoPhone(sender.split('@')[0]);
  return normalizeSaldoPhone(getPhoneByLid(sender.split('@')[0]) || '');
}

function parseAmount(raw) {
  if (!raw) return null;
  const value = String(raw).toLowerCase().trim().replace(/rp/g, '').replace(/\s/g, '');
  if (/^\d+(\.\d+)?k$/.test(value)) return Math.round(parseFloat(value.slice(0, -1)) * 1000);
  const digits = value.replace(/\./g, '').replace(/,/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

export default {
  command: ['!topup'],
  execute: async (sock, msg) => {
    const from = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const amount = parseAmount(text.trim().split(/\s+/)[1]);
    const option = NOMINALS.find(x => x.amount === amount);

    if (!option) {
      const list = NOMINALS.map(x => '• ' + x.label + ' → ' + formatRupiah(x.amount) + ' saldo').join('\n');
      await sock.sendMessage(from, { text: '💰 *TOP UP SALDO*\n\nFormat: *!topup 10k* atau *!topup 10000*\n\n' + list }, { quoted: msg });
      return;
    }

    const phone = resolvePhone(msg);
    if (!phone) { await sock.sendMessage(from, { text: '❌ Nomor WhatsApp kamu belum bisa dikenali.' }, { quoted: msg }); return; }
    if (isProcessing(phone)) { await sock.sendMessage(from, { text: '⏳ Masih ada pembayaran QRIS yang belum selesai. Tunggu sampai selesai/expired.' }, { quoted: msg }); return; }

    let session;
    try {
      await sock.sendMessage(from, { text: '💰 *TOP UP SALDO*\n\nNominal saldo: *' + formatRupiah(option.amount) + '*\nMemuat QRIS, mohon tunggu...' }, { quoted: msg });
      session = await initiateTopup(option.label);
    } catch (err) {
      await sock.sendMessage(from, { text: '❌ Gagal membuat pembayaran QRIS.\n\n' + (err.message || 'Silakan coba lagi.') }, { quoted: msg });
      return;
    }

    let qrMsg;
    try {
      qrMsg = await sock.sendMessage(from, {
        image: session.qrBuffer,
        caption: '╔════ *TOP UP SALDO* ═════╗\n║\n║ Saldo masuk : ' + formatRupiah(option.amount) + '\n║ Pembayaran  : ' + (session.totalAmount || formatRupiah(option.amount)) + '\n║\n║ Scan QRIS untuk membayar.\n║ QRIS berlaku sekitar 5 menit.\n║\n╚══════════════════════════╝'
      }, { quoted: msg });
      lockProcessing(phone);
      const status = await session.checkStatus();
      await sock.sendMessage(from, { delete: qrMsg.key }).catch(() => {});

      if (status === 'success') {
        const newSaldo = tambahSaldo(phone, option.amount);
        await sock.sendMessage(from, { text: '✅ *TOP UP BERHASIL*\n\n💰 Saldo masuk: *' + formatRupiah(option.amount) + '*\n💳 Saldo sekarang: *' + formatRupiah(newSaldo) + '*\n\nGunakan *!saldo* untuk mengecek saldo.' }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: '❌ Pembayaran belum berhasil. Saldo tidak ditambahkan.\n\nSilakan ulangi *!topup*.' }, { quoted: msg });
      }
    } catch (err) {
      await sock.sendMessage(from, { text: '❌ Top up gagal. Saldo tidak ditambahkan.\n\n' + (err.message || 'Silakan coba lagi.') }, { quoted: msg });
    } finally {
      unlockProcessing(phone);
      if (session) await session.close().catch(() => {});
    }
  }
};
