import { kidsReport } from '../puppeteer/gas-kidsreport.js';

export default {
  command: 'kidsreport',
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length !== 2) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !kidsreport <kode cabang>
║ Example : !kidsreport pml
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang = parts[1].toLowerCase();

    await sock.sendMessage(msg.key.remoteJid, {
      text: `Membuat kids report ${cabang.toUpperCase()}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await kidsReport(cabang);
        await sock.sendMessage(msg.key.remoteJid, { text: hasil }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR KIDS REPORT]', err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};