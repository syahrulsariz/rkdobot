import { ptReport } from '../puppeteer/gas-ptreport.js';

export default {
  command: 'ptreport',
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length !== 2) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !ptreport <kode cabang>
║ Example : !ptreport pml 
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang = parts[1].toLowerCase();

    await sock.sendMessage(msg.key.remoteJid, {
      text: `Membuat report pt by pt ${cabang.toUpperCase()}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await ptReport(cabang);
        await sock.sendMessage(msg.key.remoteJid, { text: hasil }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR PT REPORT]', err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};