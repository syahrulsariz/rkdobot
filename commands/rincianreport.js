import { closingReport } from '../puppeteer/gas-rincianreport.js'; // ← update path

export default {
  command: 'rincianreport',
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length !== 3) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !rincianreport <kode cabang> <tanggal>
║ Example : !rincianreport pml 1
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang  = parts[1].toLowerCase();
    const tanggal = parts[2];

    await sock.sendMessage(msg.key.remoteJid, {
      text: `Membuat rincian report ${cabang.toUpperCase()} tanggal ${tanggal}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await closingReport(cabang, tanggal);
        await sock.sendMessage(msg.key.remoteJid, { text: hasil }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR handler report]', err.message);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};