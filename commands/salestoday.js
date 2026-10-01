import { salesToday } from '../puppeteer/gas-salestoday.js';

export default {
  command: 'saletoday',
  async execute(sock, msg, queue) {

    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';

    const parts = text.trim().split(/\s+/);

    if (parts.length !== 3) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !saletoday <kode cabang> <tanggal>
║ Example : !saletoday pml 1
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang = parts[1].toLowerCase();
    const tanggal = parts[2];

    const tglNum = Number(tanggal);
    if (isNaN(tglNum) || tglNum < 1 || tglNum > 31) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !saletoday <kode cabang> <tanggal>
║ Example : !saletoday pml 1
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `Membuat sales today ${cabang.toUpperCase()} tanggal ${tanggal}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await salesToday(cabang, tanggal);

        await sock.sendMessage(msg.key.remoteJid, {
          text: hasil
        }, { quoted: msg });

      } catch (err) {
        console.error('[ERROR saletoday]', err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};
