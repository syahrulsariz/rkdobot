import handleReqPaketMemKids from '../puppeteer/gas-reqpaketmemkids.js';
import cabangMap from '../utils/cabang-map.js';

// Mapping distrik ke cabang-cabang
const distrikMap = {
  distrik1: ['als', 'ale', 'rnj', 'psr'],
  distrik2: ['icn', 'mpg', 'gsw', 'hers', 'jgk', 'cld'],
  distrik3: ['bgr', 'cbn', 'cnr', 'mrp', 'cbr', 'btn'],
  distrik4: ['gkb', 'gwb', 'smb', 'krn', 'hij']
};

// Grup yang diizinkan (kosongkan untuk allow semua grup)
const ALLOWED_GROUPS = [];

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

// Helper untuk cek apakah grup diizinkan
function isGroupAllowed(msg) {
  if (!msg.key.remoteJid.endsWith('@g.us')) {
    return true; // Allow di private chat
  }
  
  if (ALLOWED_GROUPS.length === 0) {
    return true; // Allow semua grup
  }
  
  return ALLOWED_GROUPS.includes(msg.key.remoteJid);
}

export default {
  command: 'reqmemkids',
  description: 'Request tambah paket membership Kids',
  
  async execute(sock, msg, queue) {
    const text = getMessageText(msg).trim().toLowerCase();
    const from = msg.key.remoteJid;
    
    // ================== HELP MESSAGE ==================
    if (text === 'reqmemkids' || text === 'reqmemkids ') {
      return await sock.sendMessage(from, {
        text: `📋 *CARA PAKAI REQMEMKIDS*\n\n` +
              `*Single cabang:*\n` +
              `reqmemkids bgr NJM 9 Months Toddler 4.050.000\n\n` +
              `*Semua cabang:*\n` +
              `reqmemkids all NJM 9 Months Toddler 4.050.000\n\n` +
              `*Distrik (multiple cabang):*\n` +
              `reqmemkids distrik1 NJM 9 Months Toddler 4.050.000\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*DISTRIK TERSEDIA:*\n` +
              Object.entries(distrikMap).map(([distrik, cabangList]) => 
                `• ${distrik.toUpperCase()}: ${cabangList.join(', ').toUpperCase()}`
              ).join('\n') + '\n\n' +
              `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*CABANG TERSEDIA:*\n` +
              Object.keys(cabangMap).join(', ').toUpperCase()
      }, { quoted: msg });
    }
    
    // ================== PROCESS REQMEMKIDS ==================
    if (text.startsWith('reqmemkids ')) {
      // Cek permission grup
      if (!isGroupAllowed(msg)) {
        return await sock.sendMessage(from, {
          text: '❌ Bot tidak aktif di group ini untuk command `reqmemkids`'
        }, { quoted: msg });
      }
      
      // Parse input
      const fullText = getMessageText(msg).trim();
      const parts = fullText.split(' ');
      
      // Validasi format
      if (parts.length < 5) {
        return await sock.sendMessage(from, {
          text: '❌ *Format salah!*\n\n' +
                '📝 Format yang benar:\n' +
                'reqmemkids [cabang/distrik/all] [kode] [durasi] [harga]\n\n' +
                '📌 Contoh:\n' +
                'reqmemkids bgr NJM 9 Months Toddler 4.050.000'
        }, { quoted: msg });
      }
      
      const cabangInput = parts[1].toLowerCase();
      const kodeJenis = parts[2].toUpperCase();
      const harga = parts[parts.length - 1];
      const durasi = parts.slice(3, parts.length - 1).join(' ');
      
      // Tentukan cabang yang akan diproses
      let cabangList = [];
      let locationLabel = '';
      
      if (cabangInput === 'all') {
        cabangList = Object.keys(cabangMap);
        locationLabel = 'ALL BRANCHES';
      } else if (distrikMap[cabangInput]) {
        cabangList = distrikMap[cabangInput];
        locationLabel = `DISTRIK ${cabangInput.toUpperCase()}`;
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
      
      // Send loading message
      await sock.sendMessage(from, {
        text: `⏳ *MEMPROSES TAMBAH PAKET KIDS*\n\n` +
              `📍 Lokasi: ${locationLabel}\n` +
              `🏢 Total: ${cabangList.length} cabang\n` +
              `📦 Paket: ${kodeJenis} ${durasi}\n` +
              `💰 Harga: ${harga}\n\n` +
              `⏳ Mohon tunggu, proses sedang berjalan...`
      }, { quoted: msg });
      
      // Add to queue
      queue.add(async () => {
        console.log(`============================================`);
        console.log(`[REQMEMKIDS] ${locationLabel} - ${kodeJenis} ${durasi} - ${harga}`);
        console.log(`[INFO] Processing ${cabangList.length} cabang...`);
        
        const results = [];
        let processedCount = 0;
        
        for (const cabang of cabangList) {
          processedCount++;
          
          try {
            console.log(`[${processedCount}/${cabangList.length}] Processing ${cabang.toUpperCase()}...`);
            
            await handleReqPaketMemKids(cabang, kodeJenis, durasi, harga);
            
            // Send individual success message
            await sock.sendMessage(from, {
              text: `✅ *${cabang.toUpperCase()} - BERHASIL*\n\n` +
                    `📦 Paket Kids ${kodeJenis} ${durasi} berhasil ditambahkan\n` +
                    `💰 Harga: ${harga}\n` +
                    `📊 Progress: ${processedCount}/${cabangList.length}`
            }, { quoted: msg });
            
            results.push({ cabang, success: true });
            console.log(`[SUCCESS] ${cabang.toUpperCase()} selesai`);
            
          } catch (err) {
            console.error(`[FAILED] Error di cabang ${cabang.toUpperCase()}:`, err.message);
            
            // Send individual error message
            await sock.sendMessage(from, {
              text: `❌ *${cabang.toUpperCase()} - GAGAL*\n\n` +
                    `🚫 Error: ${err.message}\n` +
                    `📊 Progress: ${processedCount}/${cabangList.length}`
            }, { quoted: msg });
            
            results.push({ cabang, success: false, error: err.message });
          }
          
          // Delay antar cabang untuk avoid spam
          if (processedCount < cabangList.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        // ================== SUMMARY MESSAGE ==================
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
        
        let summaryMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        summaryMsg += `🎉 *RINGKASAN ${locationLabel}*\n`;
        summaryMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        summaryMsg += `📊 *Status:*\n`;
        summaryMsg += `✅ Berhasil: ${successCount}/${cabangList.length} cabang\n`;
        
        if (failedCount > 0) {
          summaryMsg += `❌ Gagal: ${failedCount} cabang\n\n`;
          summaryMsg += `*Cabang yang gagal:*\n`;
          results.filter(r => !r.success).forEach((r, index) => {
            summaryMsg += `${index + 1}. ${r.cabang.toUpperCase()}\n`;
            summaryMsg += `   └ Error: ${r.error}\n`;
          });
          summaryMsg += '\n';
        } else {
          summaryMsg += '\n';
        }
        
        summaryMsg += `📦 *Detail Paket Kids:*\n`;
        summaryMsg += `• Kode: ${kodeJenis}\n`;
        summaryMsg += `• Durasi: ${durasi}\n`;
        summaryMsg += `• Harga: ${harga}\n\n`;
        
        summaryMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        
        if (successCount === cabangList.length) {
          summaryMsg += `✅ Semua cabang berhasil diproses!`;
        } else if (successCount > 0) {
          summaryMsg += `⚠️ Beberapa cabang berhasil, cek detail di atas`;
        } else {
          summaryMsg += `❌ Semua cabang gagal diproses`;
        }
        
        await sock.sendMessage(from, {
          text: summaryMsg
        }, { quoted: msg });
        
        console.log(`[SUMMARY] Success: ${successCount}, Failed: ${failedCount}`);
        console.log(`============================================`);
      });
    }
  }
};