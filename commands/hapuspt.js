import handleReqHapusPt from '../puppeteer/gas-reqhapuspt.js';
import cabangMap from '../utils/cabang-map.js';

const validBranches = Object.keys(cabangMap);

// Mapping distrik ke cabang-cabang
const distrikMap = {
  distrik1: ['pml', 'als', 'btr', 'ale', 'rnj', 'psr'],
  distrik2: ['icn', 'mpg', 'gsw', 'hers', 'jgk', 'cld'],
  distrik3: ['bgr', 'cbn', 'cnr', 'mrp', 'cbr', 'btn'],
  distrik4: ['gkb', 'gwb', 'smb', 'krn', 'hij']
};

export default {
  command: 'hapuspt',
  
  async execute(sock, msg, queue) {
    const rawText = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    // Buang prefix "!" biar konsisten dengan sistem command baru
    const text = rawText.trim().replace(/^!/, '');
    
    const textLower = text.trim().toLowerCase();
    
    if (textLower === 'hapuspt' || textLower === 'hapuspt ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `📋 *Format perintah hapuspt:*

*Single target:*
hapuspt bgr PT POS 10 Sesi Promo Spesial

*Multiple targets:*
hapuspt bgr PT POS, PT Group, PT Promo

*Semua cabang:*
hapuspt all PT POS, PT Group, PT Promo

*Distrik (multiple cabang):*
hapuspt distrik1 PT POS, PT Group

*Distrik tersedia:*
${Object.entries(distrikMap).map(([distrik, cabangList]) => 
  `• ${distrik}: ${cabangList.join(', ').toUpperCase()}`
).join('\n')}`
      }, { quoted: msg });
    }
    
    if (textLower.startsWith('hapuspt ')) {
      const parts = text.trim().split(' ');
      const cabangInput = parts[1].toLowerCase();
      const namaPaketTarget = parts.slice(2).join(' ');
      
      // Tentukan cabang yang akan diproses
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
      
      if (!namaPaketTarget || namaPaketTarget.trim() === '') {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ nama paket target tidak boleh kosong'
        }, { quoted: msg });
      }
      
      // Parse target untuk info
      const targetList = namaPaketTarget.split(',').map(t => t.trim()).filter(t => t);
      const targetInfo = targetList.length > 1 
        ? `${targetList.length} targets: [${targetList.join(', ')}]`
        : `1 target: "${namaPaketTarget}"`;
      
      await sock.sendMessage(msg.key.remoteJid, {
        text: `⏳ *Processing bulk delete PT...*
📍 Lokasi: ${locationLabel}
🏢 Cabang: ${cabangList.length} cabang (${cabangList.join(', ').toUpperCase()})
🎯 Target: ${targetInfo}
_Mohon tunggu, proses sedang berjalan..._`
      }, { quoted: msg });
      
      const processOne = async (cabang) => {
        try {
          const stats = await handleReqHapusPt({
            cabang,
            namaPaketTarget
          });
          
          // Format hasil detail
          let detailMsg = `✅ *${cabang.toUpperCase()} - PT SELESAI*\n\n`;
          detailMsg += `📊 *Terhapus dari cabang ${cabang.toUpperCase()}:*\n`;
          
          // List detail per target
          let hasDeletedData = false;
          targetList.forEach(target => {
            const targetStat = stats.byTarget[target];
            if (targetStat && targetStat.deleted > 0) {
              detailMsg += `${target} = ${targetStat.deleted}\n`;
              hasDeletedData = true;
            }
          });
          
          if (!hasDeletedData) {
            detailMsg += `_Tidak ada data yang ditemukan_\n`;
          }
          
          detailMsg += `\n📈 Total: ${stats.totalDeleted} data terhapus`;
          
          await sock.sendMessage(msg.key.remoteJid, {
            text: detailMsg
          }, { quoted: msg });
          
          return { cabang, stats, success: true };
          
        } catch (err) {
          const errorMsg = err.message || 'jaringan terputus, ulangi sekali lagi';
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ *${cabang.toUpperCase()} - PT ERROR*
🚫 Error: ${errorMsg}`
          }, { quoted: msg });
          console.error('❌ Error hapuspt:', err.message);
          
          return { cabang, error: err.message, success: false };
        }
      };
      
      queue.add(async () => {
        console.log('============================================');
        
        try {
          if (cabangList.length > 1) {
            await sock.sendMessage(msg.key.remoteJid, {
              text: `🚀 *Memulai proses ${locationLabel} PT*
📊 Total cabang: ${cabangList.length}
🎯 Target: ${targetInfo}`
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
            
            let summaryMsg = `🎉 *RINGKASAN ${locationLabel} PT*\n\n`;
            summaryMsg += `✅ Berhasil: ${successCount}/${cabangList.length} cabang\n`;
            summaryMsg += `📊 Total keseluruhan: ${totalDeleted} data terhapus\n\n`;
            summaryMsg += `*Detail per target (semua cabang):*\n`;
            
            const targetTotals = {};
            targetList.forEach(target => {
              targetTotals[target] = 0;
            });
            
            allResults.forEach(result => {
              if (result.success && result.stats) {
                targetList.forEach(target => {
                  const targetStat = result.stats.byTarget[target];
                  if (targetStat) {
                    targetTotals[target] += targetStat.deleted;
                  }
                });
              }
            });
            
            targetList.forEach(target => {
              summaryMsg += `${target} = ${targetTotals[target]}\n`;
            });
            
            await sock.sendMessage(msg.key.remoteJid, {
              text: summaryMsg
            }, { quoted: msg });
            
          } else {
            await processOne(cabangList[0]);
          }
        } catch (err) {
          console.error(`[FAILED] Error hapuspt: ${err.message}`);
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ ${err.message}`
          }, { quoted: msg });
        }
        
        console.log('============================================');
      });
    }
  }
};