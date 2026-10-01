import { peringkatReport } from '../puppeteer/gas-peringkatreport.js';

export default {
  command: 'peringkatreport',
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length !== 3) {  // ← ubah dari 2 jadi 3
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !peringkatreport <kode cabang> <tanggal>
║ Example : !peringkatreport pml 1 
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang  = parts[1].toLowerCase();
    const tanggal = parts[2];

    await sock.sendMessage(msg.key.remoteJid, {
      text: `Membuat peringkat report ${cabang.toUpperCase()}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await peringkatReport(cabang, tanggal);  // ← tambah tanggal
        await sock.sendMessage(msg.key.remoteJid, { text: hasil }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR PERINGKAT REPORT]', err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};