// commands/listaktif.js
import { getActiveUsersDetailed, getPhoneByLid, normalizePhone } from '../utils/lidMap.js';

// Resolusi nomor pengirim (sama seperti di cekaktif.js / extend.js)
function resolveSenderPhone(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const senderPhone = msg.key.remoteJidAlt || null;

  if (senderPhone) return normalizePhone(senderPhone.split('@')[0]);
  if (!sender.endsWith('@lid')) return normalizePhone(sender.split('@')[0]);

  const lid = sender.split('@')[0];
  return getPhoneByLid(lid);
}

function isAdminSender(msg, ADMIN_LIST = []) {
  const phone = resolveSenderPhone(msg);
  if (!phone) return false;
  return ADMIN_LIST.some(admin => normalizePhone(admin) === phone);
}

function formatExpiredDate(timestampMs) {
  return new Date(timestampMs).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export default {
  command: ['!listaktif', 'listaktif'],
  execute: async (sock, msg, queue, ADMIN_LIST) => {
    const from = msg.key.remoteJid;

    // Cuma admin yang boleh liat daftar nomor semua user
    if (!isAdminSender(msg, ADMIN_LIST)) {
      await sock.sendMessage(from, {
        text: '❌ *Akses Ditolak!*\n\nHanya admin yang bisa melihat daftar user aktif.'
      }, { quoted: msg });
      return;
    }

    const activeUsers = getActiveUsersDetailed();

    if (activeUsers.length === 0) {
      await sock.sendMessage(from, {
        text: `╔════ *LIST USER AKTIF* ═════╗
║
║ Belum ada user yang aktif.
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const body = activeUsers
      .map((u, idx) => {
        const expDate = formatExpiredDate(u.expiredAt);
        return `║ ${idx + 1}. +${u.phone}\n║    Sisa : ${u.remainingDays} hari\n║    Exp  : ${expDate}`;
      })
      .join('\n║\n');

    await sock.sendMessage(from, {
      text: `╔════ *LIST USER AKTIF* ═════╗
║
${body}
║
║ Total : ${activeUsers.length} user aktif
║
╚══════ *RKDO BOT V1* ═════╝`
    }, { quoted: msg });
  }
};