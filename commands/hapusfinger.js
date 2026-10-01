import handleHapusFinger from '../puppeteer/gas-hapusfinger.js';
import cabangMap from '../utils/cabang-map.js';

const ALLOWED_GROUPS = {
  'hapusfinger': []
};

const validBranches = Object.keys(cabangMap);

function isGroupAllowed(command, msg) {
  if (!msg.key.remoteJid.endsWith('@g.us')) {
    return true;
  }
  
  if (ALLOWED_GROUPS[command].length === 0) {
    return true;
  }
  
  return ALLOWED_GROUPS[command].includes(msg.key.remoteJid);
}

export default {
  command: 'hapusfinger',
  
  async execute(sock, msg, queue) {
    const rawText = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    // Buang prefix "!" biar konsisten dengan sistem command baru
    const text = rawText.trim().replace(/^!/, '');
    
    const textLower = text.trim().toLowerCase();
    
    if (textLower === 'hapusfinger' || textLower === 'hapusfinger ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: 'Contoh format: hapusfinger bgr SC BUDI AHMAD'
      }, { quoted: msg });
    }
    
    if (textLower.startsWith('hapusfinger ')) {
      if (!isGroupAllowed('hapusfinger', msg)) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Bot tidak aktif di group ini untuk command `hapusfinger`'
        }, { quoted: msg });
      }
      
      const parts = text.trim().split(' ');
      if (parts.length < 4) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: 'Format salah, contoh: hapusfinger bgr SC BUDI AHMAD'
        }, { quoted: msg });
      }
      
      const cabang = parts[1].toLowerCase();
      const jenis = parts[2];
      const namaMember = parts.slice(3).join(' ');
      
      if (!cabangMap[cabang]) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ Kode cabang tidak valid!\n\n*Kode cabang:* ${validBranches.join(', ')}`
        }, { quoted: msg });
      }
      
      if (!['SC', 'AC', 'CCB'].includes(jenis.toUpperCase())) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Jenis club tidak valid!\n\n*Gunakan:* SC / AC / CCB'
        }, { quoted: msg });
      }
      
      await sock.sendMessage(msg.key.remoteJid, {
        text: '⏳ Memproses hapus finger, tunggu sebentar...'
      }, { quoted: msg });
      
      queue.add(async () => {
        console.log('============================================');
        console.log(`[PROCESS] Memulai proses hapus finger untuk ${namaMember}`);
        try {
          await handleHapusFinger(cabang, jenis, namaMember);
          
          await sock.sendMessage(msg.key.remoteJid, {
            text: '✅ Finger berhasil dihapus!'
          }, { quoted: msg });
          
          console.log('============================================');
        } catch (err) {
          console.error(`[FAILED] Gagal proses hapus finger ${namaMember}: ${err.message}`);
          console.log('============================================');
          
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ ${err.message}`
          }, { quoted: msg });
        }
      });
    }
  }
};