import { setActivePeriod } from '../utils/lidMap.js';

function isAdminSender(sender, ADMIN_LIST) {
  const normalize = (p) => {
    let cleaned = String(p).replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    else if (!cleaned.startsWith('62')) cleaned = '62' + cleaned;
    return cleaned;
  };
  const senderNormalized = normalize(sender.split('@')[0]);
  return ADMIN_LIST.some(admin => normalize(admin) === senderNormalized);
}

export default {
  command: ['!aktif', 'aktif'],
  execute: async (sock, msg, queue, ADMIN_LIST) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    if (!isAdminSender(sender, ADMIN_LIST)) {
      await sock.sendMessage(from, { text: `╔════ *INVALID FORMAT* ═════╗
║
║ Hanya admin BOT yang dapat menggunakan perintah ini.
║
╚══════ *RKDO BOT V1* ═════╝` }, { quoted: msg });
      return;
    }

    const parts = text.trim().split(/\s+/);
    const targetPhone = parts[1];
    const days = parseInt(parts[2], 10);

    if (!targetPhone || !/^\d+$/.test(targetPhone.replace(/\+/g, '')) || !days || days <= 0) {
      await sock.sendMessage(from, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !aktif <no wa> <total hari>
║ Example : !aktif 089677289925 30
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const result = setActivePeriod(targetPhone, days);
    const expiredDate = new Date(result.expiredAt).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false
    });

    await sock.sendMessage(from, {
      text: `╔════ *SUCCES* ═════╗
║
║ No WA    : +${result.phone}
║ Durasi   : ${days} hari
║ Exp date : ${expiredDate}
║
╚══════ *RKDO BOT V1* ═════╝`
    }, { quoted: msg });
  }
};