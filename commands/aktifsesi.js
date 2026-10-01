import { handleAktifSesiCommand } from '../puppeteer/gas-aktifsesi.js';
import cabangMap from '../utils/cabang-map.js';

const validBranches = Object.keys(cabangMap);

export default {
  command: 'sesiaktif',

  async execute(sock, msg, queue) {
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    const fullText = text.trim();
    const urlMatch = fullText.match(/https?:\/\/\S+/);

    if (!urlMatch) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: 'Cara penggunaan aktif sesi:\n' +
        '1. Buka sesi latihan lalu cari nama member dan sesi yg mau diaktifkan\n' +
        '2. Kalau sudah ketemu klik lihat sesi lalu salin link yg ada diatas halaman web dan pastekan kesini\n\n' +
              'Contoh : !aktifsesi ale https://houseofmetamorfit.ampabatech.com/menu.php?open=sesi-pelatih-view-detail&id=xxx&ket=sesi'
      }, { quoted: msg });
    }

    const link = urlMatch[0];
    const beforeLink = fullText.slice(0, urlMatch.index).trim();
    const parts = beforeLink.split(/\s+/);

    if (parts.length < 2) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: 'Cara penggunaan aktif sesi:\n' +
        '1. Buka sesi latihan lalu cari nama member dan sesi yg mau diaktifkan\n' +
        '2. Kalau sudah ketemu klik lihat sesi lalu salin link yg ada diatas halaman web dan pastekan kesini\n\n' +
              'Contoh : !aktifsesi ale https://houseofmetamorfit.ampabatech.com/menu.php?open=sesi-pelatih-view-detail&id=xxx&ket=sesi'
      }, { quoted: msg });
    }

    const cabang = parts[1].toLowerCase();

    if (!cabangMap[cabang]) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Kode cabang tidak valid!\n\n*Kode cabang:* ${validBranches.join(', ')}`
      }, { quoted: msg });
    }

    if (!link.includes('sesi-pelatih-view-detail')) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Link tidak valid'
      }, { quoted: msg });
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: '⏳ Cek sesi & memproses aktifasi, tunggu sebentar...'
    }, { quoted: msg });

    queue.add(async () => {
      try {
        const hasil = await handleAktifSesiCommand(cabang, link, sock);

        if (typeof hasil === 'string') {
          // Ditolak / error
          await sock.sendMessage(msg.key.remoteJid, {
            text: hasil
          }, { quoted: msg });
        } else {
          const {
            cabangName,
            namaMember,
            tanggalTransaksi,
            jumlahSesi,
            sisaSesi,
            tanggalBaru
          } = hasil;

          await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ *Aktifasi Sesi Berhasil*\n`
          }, { quoted: msg });
        }

      } catch (err) {
        console.error('❌ Error handle aktifsesi:', err.message);
        await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Ulangi sekali lagi'
        }, { quoted: msg });
      }
    });
  }
};