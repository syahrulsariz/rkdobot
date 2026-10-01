import handleReqHapusInstruktur from '../puppeteer/gas-reqhapusinstruktur.js';
import cabangMap from '../utils/cabang-map.js';

const validBranches = Object.keys(cabangMap);

const distrikMap = {
  distrik1: ['pml', 'alsut', 'bint', 'ale', 'prj', 'ssb'],
  distrik2: ['bsd', 'mmp', 'swg', 'bsg', 'jgk', 'cldk'],
  distrik3: ['bgr', 'cbn', 'cnr', 'mbnt', 'cbr', 'bng'],
  distrik4: ['gkb', 'gwb', 'smb', 'kbt', 'hi']
};

export default {
  command: 'hapusinstruktur',

  async execute(sock, msg, queue) {
    const rawText = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    // Buang prefix "!" biar konsisten dengan sistem command baru
    const text = rawText.trim().replace(/^!/, '');

    const textLower = text.trim().toLowerCase();

    if (textLower === 'hapusinstruktur' || textLower === 'hapusinstruktur ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `📋 *Format perintah hapusinstruktur:*

*Single cabang:*
hapusinstruktur bgr

*Semua cabang:*
hapusinstruktur all

*Per distrik:*
hapusinstruktur distrik1

*Distrik tersedia:*
${Object.entries(distrikMap).map(([distrik, cabangList]) =>
  `• ${distrik}: ${cabangList.join(', ').toUpperCase()}`
).join('\n')}

⚠️ *Perintah ini akan menghapus SEMUA instruktur pada cabang yang dipilih!*`
      }, { quoted: msg });
    }

    if (textLower.startsWith('hapusinstruktur ')) {
      const parts = text.trim().split(' ');
      const cabangInput = parts[1].toLowerCase();

      let cabangList = [];
      let locationLabel = '';

      if (cabangInput === 'all') {
        cabangList = Object.keys(cabangMap);
        locationLabel = 'ALL BRANCHES';
      } else if (distrikMap[cabangInput]) {
        cabangList = distrikMap[cabangInput];
        locationLabel = `DISTRIK: ${cabangInput.toUpperCase()}`;
      } else if (cabangMap[cabangInput]) {
        cabangList = [cabangInput];
        locationLabel = cabangInput.toUpperCase();
      } else {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ *Input tidak valid!*

Kode cabang, distrik, atau 'all' tidak ditemukan.

*Distrik tersedia:*
${Object.keys(distrikMap).map(d => `• ${d}`).join('\n')}

*Cabang tersedia:*
${validBranches.join(', ')}`
        }, { quoted: msg });
      }

      await sock.sendMessage(msg.key.remoteJid, {
        text: `⏳ *Processing hapus instruktur...*
📍 Lokasi: ${locationLabel}
🏢 Cabang: ${cabangList.length} cabang (${cabangList.join(', ').toUpperCase()})
_Mohon tunggu, proses sedang berjalan..._`
      }, { quoted: msg });

      const processOne = async (cabang) => {
        try {
          const stats = await handleReqHapusInstruktur({ cabang });

          const resultMsg = stats.totalDeleted > 0
            ? `✅ *${cabang.toUpperCase()} - SELESAI*\n\n📊 Total instruktur dihapus: *${stats.totalDeleted}*`
            : `✅ *${cabang.toUpperCase()} - SELESAI*\n\n_Tidak ada instruktur yang ditemukan_`;

          await sock.sendMessage(msg.key.remoteJid, {
            text: resultMsg
          }, { quoted: msg });

          return { cabang, stats, success: true };

        } catch (err) {
          const errorMsg = err.message || 'jaringan terputus, ulangi sekali lagi';
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ *${cabang.toUpperCase()} - ERROR*\n🚫 Error: ${errorMsg}`
          }, { quoted: msg });
          console.error('❌ Error hapusinstruktur:', err.message);

          return { cabang, error: err.message, success: false };
        }
      };

      queue.add(async () => {
        console.log('============================================');

        try {
          if (cabangList.length > 1) {
            await sock.sendMessage(msg.key.remoteJid, {
              text: `🚀 *Memulai proses ${locationLabel}*\n📊 Total cabang: ${cabangList.length}`
            }, { quoted: msg });

            const allResults = [];
            for (const cabang of cabangList) {
              const result = await processOne(cabang);
              allResults.push(result);
            }

            const successCount = allResults.filter(r => r.success).length;
            const totalDeleted = allResults
              .filter(r => r.success)
              .reduce((sum, r) => sum + r.stats.totalDeleted, 0);

            await sock.sendMessage(msg.key.remoteJid, {
              text: `🎉 *RINGKASAN ${locationLabel}*\n\n✅ Berhasil: ${successCount}/${cabangList.length} cabang\n📊 Total instruktur dihapus: *${totalDeleted}*`
            }, { quoted: msg });

          } else {
            await processOne(cabangList[0]);
          }
        } catch (err) {
          console.error(`[FAILED] Error hapusinstruktur: ${err.message}`);
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ ${err.message}`
          }, { quoted: msg });
        }

        console.log('============================================');
      });
    }
  }
};