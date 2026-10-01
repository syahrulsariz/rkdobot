// commands/dailycek.js
import { dailyCek } from '../puppeteer/gas-dailycek.js';
import { CABANG } from '../config/sheets.config.js';

export default {
  command: 'dailycek',

  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    const parts = text.trim().split(/\s+/);
    const cabangList = Object.keys(CABANG).join(', ');

    // Validasi format: dailycek cabang nomor
    if (parts.length !== 3) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !dailycek <kode cabang> <tanggal>
║ Example : !dailycek pml 1
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang = parts[1].toLowerCase();
    const nomor = parts[2];

    // Validasi cabang lebih awal biar langsung kasih feedback
    if (!CABANG[cabang]) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Cabang *${cabang}* tidak ditemukan!\n\nCabang tersedia: ${cabangList}`
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `Mengambil data daily sheet ${nomor} cabang ${CABANG[cabang].nama}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await dailyCek(cabang, nomor);

        await sock.sendMessage(msg.key.remoteJid, {
          text: hasil
        }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR handler dailycek]', err.message);

        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};