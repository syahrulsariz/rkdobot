import { salesUpdate } from '../puppeteer/gas-updatesales.js';

export default {
  command: 'updatesales',
  async execute(sock, msg, queue) {
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length !== 2) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !updatesales <kode cabang>
║ Example : !updatesales pml
║
╚══════ *RKDO BOT V1* ═════╝`,
      }, { quoted: msg });
      return;
    }

    const cabang = parts[1].toLowerCase();

    await sock.sendMessage(msg.key.remoteJid, {
      text: `⏳ Mengambil update sales ${cabang.toUpperCase()}...`,
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await salesUpdate(cabang);
        await sock.sendMessage(msg.key.remoteJid, {
          text: hasil,
        }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR updatesales]', err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`,
        }, { quoted: msg });
      }
    });
  },
};