// commands/cekaktif.js
import { getRemainingDays, normalizePhone, getPhoneByLid } from '../utils/lidMap.js';

function resolveSenderPhone(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderPhone = msg.key.remoteJidAlt || null;

  // 1. Kalau remoteJidAlt kebawa di pesan ini, pakai itu
  if (senderPhone) return normalizePhone(senderPhone.split('@')[0]);

  // 2. Kalau sender bukan format LID, dia udah nomor HP asli
  if (!sender.endsWith('@lid')) return normalizePhone(sender.split('@')[0]);

  // 3. Fallback: sender pakai @lid tapi remoteJidAlt gak kebawa di pesan ini
  //    -> cek mapping yang udah tersimpan sebelumnya (dari !myid / pesan lain)
  const lid = sender.split('@')[0];
  return getPhoneByLid(lid);
}

export default {
  command: ['!cekaktif', 'cekaktif'],
  execute: async (sock, msg) => {
    const from = msg.key.remoteJid;

    const phone = resolveSenderPhone(msg);
    if (!phone) {
      await sock.sendMessage(from, {
        text: '❌ Gagal mendeteksi nomor kamu. Kirim `!myid` dulu untuk verifikasi, lalu coba lagi.'
      }, { quoted: msg });
      return;
    }

    const remaining = getRemainingDays(phone);

    if (remaining > 0) {
      await sock.sendMessage(from, {
        text: `╔════ *STATUS AKTIF* ═════╗
║
║ No WA : +${phone}
║ Sisa hari : ${remaining} hari
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
    } else {
      await sock.sendMessage(from, {
        text: `╔════ *EXPIRED BOT* ═════╗
║
║ Masa aktif habis!
║ Gunakan !extend untuk memperpanjang!
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
    }
  }
};