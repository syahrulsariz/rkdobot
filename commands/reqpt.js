import handleReqPaketPt from '../puppeteer/gas-reqpaketpt.js';
import cabangMap from '../utils/cabang-map.js';

// Mapping distrik ke cabang-cabang
const distrikMap = {
  distrik1: ['pml', 'als', 'btr', 'ale', 'rnj', 'psr'],
  distrik2: ['icn', 'mpg', 'gsw', 'hers', 'jgk', 'cld'],
  distrik3: ['bgr', 'cbn', 'cnr', 'mrp', 'cbr', 'btn'],
  distrik4: ['gkb', 'gwb', 'smb', 'krn', 'hij']
};

// Grup yang diizinkan (kosongkan untuk allow semua grup)
const ALLOWED_GROUPS = [];

// Mapping jenis PT ke dropdown
const dropdownJenisMap = {
  reg: 'PT Reguler',
  pos: 'PT POS',
  ptdp: 'PT DP'
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
  command: 'reqpt',
  description: 'Request tambah paket Personal Training',
  
  async execute(sock, msg, queue) {
    const text = getMessageText(msg).trim().toLowerCase();
    const from = msg.key.remoteJid;
    
    // ================== HELP MESSAGE ==================
    if (text === 'reqpt' || text === 'reqpt ') {
      return await sock.sendMessage(from, {
        text: `📋 *CARA PAKAI REQPT*\n\n` +
              `*Single cabang (PT Reguler/POS):*\n` +
              `reqpt bgr reg 20 Sesi 4.500.000\n\n` +
              `*Semua cabang:*\n` +
              `reqpt all pos 10 Sesi 2.500.000\n\n` +
              `*Distrik (multiple cabang):*\n` +
              `reqpt distrik1 reg 20 Sesi 4.500.000\n\n` +
              `*Format PT DP:*\n` +
              `reqpt bgr ptdp reg 10 Sesi 1.500.000\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*JENIS PT:*\n` +
              `• reg - PT Reguler\n` +
              `• pos - PT POS\n` +
              `• ptdp - PT DP (perlu tambah jenis: reg/pos)\n\n` +
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
    
    // ================== PROCESS REQPT ==================
    if (text.startsWith('reqpt ')) {
      // Cek permission grup
      if (!isGroupAllowed(msg)) {
        return await sock.sendMessage(from, {
          text: '❌ Bot tidak aktif di group ini untuk command `reqpt`'
        }, { quoted: msg });
      }
      
      // Parse input
      const fullText = getMessageText(msg).trim();
      const parts = fullText.split(' ');
      
      const cabangInput = parts[1].toLowerCase();
      const jenisInput = parts[2].toLowerCase();
      const isDP = jenisInput === 'ptdp';
      
      // Validasi jenis PT
      if (!['reg', 'pos', 'ptdp'].includes(jenisInput)) {
        return await sock.sendMessage(from, {
          text: '❌ *Jenis PT tidak valid!*\n\n' +
                'Jenis yang tersedia:\n' +
                '• reg - PT Reguler\n' +
                '• pos - PT POS\n' +
                '• ptdp - PT DP'
        }, { quoted: msg });
      }
      
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
      
      // Parse data PT
      const jenisDasar = isDP ? parts[3].toLowerCase() : jenisInput;
      
      // Validasi jenis dasar untuk DP
      if (isDP && !['reg', 'pos'].includes(jenisDasar)) {
        return await sock.sendMessage(from, {
          text: '❌ *Jenis PT DP tidak valid!*\n\n' +
                'Untuk PT DP, gunakan: reg atau pos\n\n' +
                'Contoh: reqpt bgr ptdp reg 10 Sesi 1.500.000'
        }, { quoted: msg });
      }
      
      // Sesi mulai dari index 3 atau 4
      const sesiIndex = isDP ? 4 : 3;
      const sesiAsli = parts[sesiIndex]; // angka sesi asli dari command
      const jumlahSesi = isDP ? '0' : sesiAsli;
      const deskripsi = `${sesiAsli} ${parts.slice(sesiIndex + 1, parts.length - 1).join(' ')}`;
      const harga = parts[parts.length - 1];
      
      // Generate nama paket
      const namaPaket = isDP
        ? `DP PT ${jenisDasar.toUpperCase()} ${deskripsi}`
        : `PT ${jenisInput.toUpperCase()} ${deskripsi}`;
      
      // Get dropdown jenis
      const dropdownJenis = dropdownJenisMap[jenisInput];
      
      if (!dropdownJenis) {
        return await sock.sendMessage(from, {
          text: '❌ Jenis PT tidak dikenali untuk dropdown'
        }, { quoted: msg });
      }
      
      // Send loading message
      await sock.sendMessage(from, {
        text: `⏳ *MEMPROSES TAMBAH PAKET PT*\n\n` +
              `📍 Lokasi: ${locationLabel}\n` +
              `🏢 Total: ${cabangList.length} cabang\n` +
              `📦 Paket: ${namaPaket}\n` +
              `💰 Harga: ${harga}\n` +
              `🔢 Sesi: ${jumlahSesi}\n\n` +
              `⏳ Mohon tunggu, proses sedang berjalan...`
      }, { quoted: msg });
      
      // Add to queue
      queue.add(async () => {
        console.log(`============================================`);
        console.log(`[REQPT] ${locationLabel} - ${namaPaket} - ${harga}`);
        console.log(`[INFO] Processing ${cabangList.length} cabang...`);
        
        const results = [];
        let processedCount = 0;
        
        for (const cabang of cabangList) {
          processedCount++;
          
          try {
            console.log(`[${processedCount}/${cabangList.length}] Processing ${cabang.toUpperCase()}...`);
            
            await handleReqPaketPt({
              cabang,
              namaPaket,
              dropdownJenis,
              jumlahSesi,
              harga
            });
            
            // Send individual success message
            await sock.sendMessage(from, {
              text: `✅ *${cabang.toUpperCase()} - BERHASIL*\n\n` +
                    `📦 Paket PT berhasil ditambahkan\n` +
                    `${namaPaket}\n` +
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
        summaryMsg += `🎉 *RINGKASAN ${locationLabel} PT*\n`;
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
        
        summaryMsg += `📦 *Detail Paket PT:*\n`;
        summaryMsg += `• Nama: ${namaPaket}\n`;
        summaryMsg += `• Harga: ${harga}\n`;
        summaryMsg += `• Sesi: ${jumlahSesi}\n\n`;
        
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