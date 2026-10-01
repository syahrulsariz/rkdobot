// commands/shift.js
import { setUserShift, getShiftWindowLabel } from '../utils/shiftMap.js';

export default {
  command: ['!pagi', 'pagi', '!siang', 'siang'],
  async execute(sock, msg) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      ''
    ).toLowerCase().trim();

    const shift = text.includes('siang') ? 'siang' : 'pagi';
    const result = setUserShift(sender, shift);

    if (!result.success) {
      if (result.reason === 'already_set') {
        await sock.sendMessage(from, {
          text: `❌ Jadwal Anda hari ini sudah diatur ke *${getShiftWindowLabel(result.shift)}* (${result.shift}).\n\nJadwal hanya bisa diatur *sekali sehari*. Silakan coba lagi besok.`
        }, { quoted: msg });
        return;
      }

      await sock.sendMessage(from, {
        text: `❌ Gagal atur jadwal, nomor Anda belum terdeteksi sistem.\n\nCoba kirim pesan apapun dulu ke bot, lalu ulangi *!${shift}*.`
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(from, {
text: `╔════ *SUCCESS* ═════╗
║
║ BOT Aktif  : ${getShiftWindowLabel(shift)}
║
╚══════ *RKDO BOT V1* ═════╝`
    }, { quoted: msg });
  }
};