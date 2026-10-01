import { closingReport }  from '../puppeteer/gas-rincianreport.js';
import { salesReport }    from '../puppeteer/gas-salesreport.js';
import { ptReport }       from '../puppeteer/gas-ptreport.js';
import { kidsReport }     from '../puppeteer/gas-kidsreport.js';
import { akumulasiReport } from '../puppeteer/gas-akumulasireport.js';
import { peringkatReport } from '../puppeteer/gas-peringkatreport.js';
import { databaseReport }  from '../puppeteer/gas-databasereport.js';
import { salesToday }      from '../puppeteer/gas-salestoday.js';
import { getCabangInfo }   from '../config/sheets.config.js';

export default {
  command: 'allreport',
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/);

    if (parts.length !== 3) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !allreport <kode cabang> <tanggal>
║ Example : !allreport pml 1
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
      return;
    }

    const cabang  = parts[1].toLowerCase();
    const tanggal = parseInt(parts[2]);

    // Validasi cabang
    let info;
    try {
      info = getCabangInfo(cabang);
    } catch {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Cabang tidak valid: ${cabang}\nGunakan !kodecabang untuk melihat daftar cabang tersedia.`
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `Membuat semua report ${cabang.toUpperCase()} tanggal ${tanggal}...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        // 1. CLOSING
        const closing = await closingReport(cabang, tanggal);
        await sock.sendMessage(msg.key.remoteJid, { text: closing }, { quoted: msg });

        // 2. SALES
        const sales = await salesReport(cabang);
        await sock.sendMessage(msg.key.remoteJid, { text: sales }, { quoted: msg });

        // 3. PT
        const pt = await ptReport(cabang);
        await sock.sendMessage(msg.key.remoteJid, { text: pt }, { quoted: msg });

        // 4. KIDS (khusus hasKids: true)
        if (info.hasKids) {
          const kids = await kidsReport(cabang);
          await sock.sendMessage(msg.key.remoteJid, { text: kids }, { quoted: msg });
        }

        // 5. AKUMULASI
        const akum = await akumulasiReport(cabang, tanggal);
        await sock.sendMessage(msg.key.remoteJid, { text: akum }, { quoted: msg });

        // 6. PERINGKAT
        const rank = await peringkatReport(cabang, tanggal); // ← tambah tanggal
        await sock.sendMessage(msg.key.remoteJid, { text: rank }, { quoted: msg });

        // 7. DATABASE
        const db = await databaseReport(cabang, tanggal);
        await sock.sendMessage(msg.key.remoteJid, { text: db.pesan1 }, { quoted: msg });
        await sock.sendMessage(msg.key.remoteJid, { text: db.pesan2 }, { quoted: msg });

        // 8. SALES TODAY
        const salesT = await salesToday(cabang, tanggal);
        await sock.sendMessage(msg.key.remoteJid, { text: salesT }, { quoted: msg });

      } catch (err) {
        console.error('[ERROR allreport]', err.message);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg });
      }
    });
  }
};