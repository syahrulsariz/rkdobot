import handleReqHapusKelas from '../puppeteer/gas-reqhapuskelas.js';
import cabangMap from '../utils/cabang-map.js';

const validBranches = Object.keys(cabangMap);

const distrikMap = {
  distrik1: ['pml', 'alsut', 'bint', 'ale', 'prj', 'ssb'],
  distrik2: ['bsd', 'mmp', 'swg', 'bsg', 'jgk', 'cldk'],
  distrik3: ['bgr', 'cbn', 'cnr', 'mbnt', 'cbr', 'bng'],
  distrik4: ['gkb', 'gwb', 'smb', 'kbt', 'hi']
};

export default {
  command: 'hapuskelas',

  async execute(sock, msg, queue) {
    const rawText = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text || '';

    // Buang prefix "!" biar konsisten dengan sistem command baru
    const text = rawText.trim().replace(/^!/, '');

    const textLower = text.trim().toLowerCase();

    if (textLower === 'hapuskelas' || textLower === 'hapuskelas ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `📋 *Format perintah hapuskelas:*

*Single cabang:*
hapuskelas bgr

*Semua cabang:*
hapuskelas all

*Per distrik:*
hapuskelas distrik1

*Distrik tersedia:*
${Object.entries(distrikMap).map(([distrik, cabangList]) =>
  `• ${distrik}: ${cabangList.join(', ').toUpperCase()}`
).join('\n')}

⚠️ *Perintah ini akan menghapus SEMUA kelas (Regular + Kids) pada cabang yang dipilih!*`
      }, { quoted: msg });
    }

    if (textLower.startsWith('hapuskelas ')) {
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
        text: `⏳ *Processing hapus kelas...*
📍 Lokasi: ${locationLabel}
🏢 Cabang: ${cabangList.length} cabang (${cabangList.join(', ').toUpperCase()})
_Mohon tunggu, proses sedang berjalan..._`
      }, { quoted: msg });

      const processOne = async (cabang) => {
        try {
          const stats = await handleReqHapusKelas({ cabang });

          let detailMsg = `✅ *${cabang.toUpperCase()} - SELESAI*\n\n`;
          detailMsg += `📊 *Hasil hapus kelas ${cabang.toUpperCase()}:*\n`;

          if (stats.totalDeleted > 0) {
            detailMsg += `Regular : ${stats.regular.totalDeleted} kelas\n`;
            detailMsg += `Kids    : ${stats.kids.totalDeleted} kelas\n`;
            detailMsg += `\n📈 Total: *${stats.totalDeleted} kelas dihapus*`;
          } else {
            detailMsg += `_Tidak ada kelas yang ditemukan_`;
          }

          await sock.sendMessage(msg.key.remoteJid, {
            text: detailMsg
          }, { quoted: msg });

          return { cabang, stats, success: true };

        } catch (err) {
          const errorMsg = err.message || 'jaringan terputus, ulangi sekali lagi';
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ *${cabang.toUpperCase()} - ERROR*\n🚫 Error: ${errorMsg}`
          }, { quoted: msg });
          console.error('❌ Error hapuskelas:', err.message);

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
            const totalRegular = allResults
              .filter(r => r.success)
              .reduce((sum, r) => sum + r.stats.regular.totalDeleted, 0);
            const totalKids = allResults
              .filter(r => r.success)
              .reduce((sum, r) => sum + r.stats.kids.totalDeleted, 0);

            await sock.sendMessage(msg.key.remoteJid, {
              text: `🎉 *RINGKASAN ${locationLabel}*\n\n✅ Berhasil: ${successCount}/${cabangList.length} cabang\n📊 Regular: ${totalRegular} kelas\n📊 Kids   : ${totalKids} kelas\n📈 Total  : *${totalDeleted} kelas dihapus*`
            }, { quoted: msg });

          } else {
            await processOne(cabangList[0]);
          }
        } catch (err) {
          console.error(`[FAILED] Error hapuskelas: ${err.message}`);
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ ${err.message}`
          }, { quoted: msg });
        }

        console.log('============================================');
      });
    }
  }
};