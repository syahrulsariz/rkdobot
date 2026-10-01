// commands/saldo.js
import { getSaldo, normalizeSaldoPhone, formatRupiah } from '../utils/saldo.js';
import { getPhoneByLid } from '../utils/lidMap.js';

function resolvePhone(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const alt = msg.key.remoteJidAlt || null;
  if (alt) return normalizeSaldoPhone(alt.split('@')[0]);
  if (!sender.endsWith('@lid')) return normalizeSaldoPhone(sender.split('@')[0]);
  return normalizeSaldoPhone(getPhoneByLid(sender.split('@')[0]) || '');
}

export default {
  command: ['!saldo'],
  execute: async (sock, msg) => {
    const from = msg.key.remoteJid;
    const phone = resolvePhone(msg);
    if (!phone) {
      await sock.sendMessage(from, { text: '❌ Nomor WhatsApp kamu belum bisa dikenali.' }, { quoted: msg });
      return;
    }
    await sock.sendMessage(from, {
      text: '💰 *SALDO RKDO BOT*\n\n💳 Saldo kamu: *' + formatRupiah(getSaldo(phone)) + '*\n\nGunakan *!topup 10k* untuk isi saldo.'
    }, { quoted: msg });
  }
};
