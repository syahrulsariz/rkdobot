import { salesReport } from '../puppeteer/gas-salesreport.js';

export default {
  command: 'salesreport',
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length !== 2) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !salesreport <kode cabang>
║ Example : !salesreport pml
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang = parts[1].toLowerCase();

    await sock.sendMessage(msg.key.remoteJid, {
      text: `Membuat sales report ${cabang.toUpperCase()}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await salesReport(cabang);
        await sock.sendMessage(msg.key.remoteJid, { text: hasil }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR SALES REPORT]', err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};