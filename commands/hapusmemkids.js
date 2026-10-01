import handleReqHapusMemKids from '../puppeteer/gas-reqhapusmemkids.js';
import cabangMap from '../utils/cabang-map.js';

// Mapping distrik ke cabang-cabang
const distrikMap = {
  distrik1: ['pml', 'als', 'btr', 'ale', 'rnj', 'psr'],
  distrik2: ['icn', 'mpg', 'gsw', 'hers', 'jgk', 'cld'],
  distrik3: ['bgr', 'cbn', 'cnr', 'mrp', 'cbr', 'btn'],
  distrik4: ['gkb', 'gwb', 'smb', 'krn', 'hij']
};

// Helper untuk extract text
function getMessageText(msg) {
  const raw = msg.message?.conversation || 
         msg.message?.extendedTextMessage?.text || 
         msg.message?.imageMessage?.caption ||
         msg.message?.videoMessage?.caption ||
         '';
  // Buang prefix "!" biar konsisten dengan sistem command baru
  return raw.trim().replace(/^!/, '');
}

export default {
  command: 'hapusmemkids',
  description: 'Hapus membership kids (single/multiple/all/distrik)',
  
  async execute(sock, msg, queue) {
    const text = getMessageText(msg).trim().toLowerCase();
    const from = msg.key.remoteJid;
    
    // ================== HELP MESSAGE ==================
    if (text === 'hapusmemkids' || text === 'hapusmemkids ') {
      return await sock.sendMessage(from, {
        text: `📋 *FORMAT PERINTAH HAPUSMEMKIDS*\n\n` +
              `*Single target:*\n` +
              `hapusmemkids bgr Package 3+1 Months\n\n` +
              `*Multiple targets:*\n` +
              `hapusmemkids bgr kids swimming, kids yoga, kids dance\n\n` +
              `*Semua cabang:*\n` +
              `hapusmemkids all kids swimming, kids yoga\n\n` +
              `*Distrik (multiple cabang):*\n` +
              `hapusmemkids distrik1 kids swimming, kids dance\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*DISTRIK TERSEDIA:*\n` +
              Object.entries(distrikMap).map(([distrik, cabangList]) => 
                `• ${distrik}: ${cabangList.join(', ').toUpperCase()}`
              ).join('\n')
      }, { quoted: msg });
    }
    
    // ================== PROCESS HAPUSMEMKIDS ==================
    if (text.startsWith('hapusmemkids ')) {
      // Parse input
      const fullText = getMessageText(msg).trim();
      const parts = fullText.split(' ');
      
      // Validasi format
      if (parts.length < 3) {
        return await sock.sendMessage(from, {
          text: '❌ *Format salah!*\n\n' +
                '📝 Format yang benar:\n' +
                'hapusmemkids [cabang/all/distrik] [nama paket]\n\n' +
                '📌 Contoh:\n' +
                'hapusmemkids bgr kids swimming\n' +
                'hapusmemkids all kids yoga\n' +
                'hapusmemkids distrik1 kids dance'
        }, { quoted: msg });
      }
      
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
        return await sock.sendMessage(from, {
          text: `❌ *Input tidak valid!*\n\n` +
                `Kode cabang, distrik, atau 'all' tidak ditemukan.\n\n` +
                `*Distrik tersedia:*\n` +
                Object.keys(distrikMap).map(d => `• ${d}`).join('\n') + '\n\n' +
                `*Cabang tersedia:*\n` +
                Object.keys(cabangMap).join(', ').toUpperCase()
        }, { quoted: msg });
      }
      
      // Validasi nama paket
      if (!namaPaketTarget || namaPaketTarget.trim() === '') {
        return await sock.sendMessage(from, {
          text: '❌ Nama paket target tidak boleh kosong'
        }, { quoted: msg });
      }
      
      // Parse target untuk info
      const targetList = namaPaketTarget.split(',').map(t => t.trim()).filter(t => t);
      const targetInfo = targetList.length > 1 
        ? `${targetList.length} targets: [${targetList.join(', ')}]`
        : `1 target: "${namaPaketTarget}"`;
      
      // Send loading message
      await sock.sendMessage(from, {
        text: `⏳ *PROCESSING BULK DELETE KIDS...*\n\n` +
              `📍 Lokasi: ${locationLabel}\n` +
              `🏢 Cabang: ${cabangList.length} cabang (${cabangList.join(', ').toUpperCase()})\n` +
              `🎯 Target: ${targetInfo}\n\n` +
              `⏳ Mohon tunggu, proses sedang berjalan...`
      }, { quoted: msg });
      
      // Process function untuk single cabang
      const processOne = async (cabang) => {
        try {
          const stats = await handleReqHapusMemKids({
            cabang,
            namaPaketTarget
          });
          
          // Format hasil detail
          let detailMsg = `✅ *${cabang.toUpperCase()} - KIDS SELESAI*\n\n`;
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
          
          await sock.sendMessage(from, {
            text: detailMsg
          }, { quoted: msg });
          
          return { cabang, stats, success: true };
          
        } catch (err) {
          const errorMsg = err.message || 'jaringan terputus, ulangi sekali lagi';
          
          await sock.sendMessage(from, {
            text: `❌ *${cabang.toUpperCase()} - KIDS ERROR*\n\n` +
                  `🚫 Error: ${errorMsg}`
          }, { quoted: msg });
          
          console.error('❌ Error hapusmemkids:', err.message);
          
          return { cabang, error: err.message, success: false };
        }
      };
      
      // Add to queue
      queue.add(async () => {
        console.log(`============================================`);
        console.log(`[HAPUSMEMKIDS] ${locationLabel} - ${targetInfo}`);
        
        // Proses untuk multiple cabang (all, distrik, atau single)
        if (cabangList.length > 1) {
          await sock.sendMessage(from, {
            text: `🚀 *Memulai proses ${locationLabel} KIDS*\n\n` +
                  `📊 Total cabang: ${cabangList.length}\n` +
                  `🎯 Target: ${targetInfo}`
          }, { quoted: msg });
          
          // Collect all results
          const allResults = [];
          
          for (const cabang of cabangList) {
            const result = await processOne(cabang);
            allResults.push(result);
          }
          
          // Send summary
          const successCount = allResults.filter(r => r.success).length;
          const totalDeleted = allResults
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.stats.totalDeleted, 0);
          
          let summaryMsg = `🎉 *RINGKASAN ${locationLabel} KIDS*\n\n`;
          summaryMsg += `✅ Berhasil: ${successCount}/${cabangList.length} cabang\n`;
          summaryMsg += `📊 Total keseluruhan: ${totalDeleted} data terhapus\n\n`;
          summaryMsg += `*Detail per target (semua cabang):*\n`;
          
          // Aggregate by target
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
          
          await sock.sendMessage(from, {
            text: summaryMsg
          }, { quoted: msg });
          
        } else {
          // Single cabang
          await processOne(cabangList[0]);
        }
        
        console.log(`============================================`);
      });
    }
  }
};