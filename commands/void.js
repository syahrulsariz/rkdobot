import { handleVoidCommand } from '../puppeteer/gas-void.js';
import cabangMap from '../utils/cabang-map.js';

const validBranches = Object.keys(cabangMap);

export default {
  command: 'void',

  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    const parts = text.trim().split(' ');
    if (parts.length < 4) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: 'Format salah, contoh:\n' +
              '• void pml mem 00123\n' +
              '• void pml memkids 00456\n' +
              '• void pml pt 00789\n' +
              '• void pml ptkids 00999'+
              '\n\n_Void hanya bisa ketika data masih di approval!_'
      }, { quoted: msg });
    }

    const cabang = parts[1].toLowerCase();
    const jenis = parts[2].toLowerCase();
    const noMember = parts.slice(3).join(' ');

    if (!cabangMap[cabang]) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Kode cabang tidak valid!\n\n*Kode cabang:* ${validBranches.join(', ')}`
      }, { quoted: msg });
    }

    if (!['mem', 'memkids', 'pt', 'ptkids'].includes(jenis)) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Jenis harus: mem / memkids / pt / ptkids'
      }, { quoted: msg });
    }

    if (noMember.toLowerCase() === 'all') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Void all belum didukung, void satu-satu aja ya biar aman.'
      }, { quoted: msg });
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: '⏳ Memproses void transaksi, tunggu sebentar...'
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await handleVoidCommand(cabang, jenis, noMember, sock);

        if (typeof hasil === 'string') {
          // Gagal / error / member tidak ditemukan
          await sock.sendMessage(msg.key.remoteJid, {
            text: hasil
          }, { quoted: msg });
        } else {
          // Berhasil di-void
          const { cabangName, nama, noInvoice } = hasil;

          await sock.sendMessage(msg.key.remoteJid, {
            text: `🗑️ *Void Transaction berhasil*\n` +
                  `🏢 Cabang: *${cabangName}*\n` +
                  `👤 Nama: *${nama}*\n` +
                  `🧾 Invoice: *${noInvoice}*`
          }, { quoted: msg });
        }

      } catch (err) {
        console.error('❌ Error handle void:', err.message);
        await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Ulangi sekali lagi'
        }, { quoted: msg });
      }
    });
  }
};