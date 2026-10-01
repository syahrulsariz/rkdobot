import { databaseReport } from '../puppeteer/gas-databasereport.js';

export default {
  command: 'databasereport',
  async execute(sock, msg, queue){
    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/);

    if(parts.length !== 3){
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !databasereport <kode cabang> <tanggal>
║ Example : !databasereport pml 1
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang = parts[1].toLowerCase();
    const tanggal = parseInt(parts[2]);

    if (isNaN(tanggal) || tanggal < 1 || tanggal > 31) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Tanggal tidak valid`
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `⏳ Mengambil database ${cabang.toUpperCase()} tanggal ${tanggal}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const { pesan1, pesan2 } = await databaseReport(cabang, tanggal);

        await sock.sendMessage(msg.key.remoteJid, { text: pesan1 }, { quoted: msg });
        await sock.sendMessage(msg.key.remoteJid, { text: pesan2 }, { quoted: msg });

      } catch(err) {
        console.error('[ERROR DATABASE REPORT]', err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};
