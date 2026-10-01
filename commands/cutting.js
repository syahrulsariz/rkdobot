import handleReqCuttingSesi from '../puppeteer/gas-reqcuttingsesi.js';
import cabangMap from '../utils/cabang-map.js';
import { butuhAkunKhusus, getAkunCabang } from '../utils/cabang-akun.js';

const validBranches = Object.keys(cabangMap);

export default {
  command: 'cutting',
  
  async execute(sock, msg, queue, adminList = []) {
    const rawText = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    // Buang prefix "!" biar konsisten dengan sistem command baru
    const text = rawText.trim().replace(/^!/, '');
    
    const textLower = text.trim().toLowerCase();
    
    if (textLower === 'cutting' || textLower === 'cutting ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: 'Contoh format: cutting bgr SC BUDI AHMAD'
      }, { quoted: msg });
    }
    
    if (textLower.startsWith('cutting ')) {
      const parts = text.trim().split(' ');
      if (parts.length < 3) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: 'Format salah, contoh: cutting cnr HENRICUS DWI ANANTO'
        }, { quoted: msg });
      }
      
      const cabang = parts[1].toLowerCase();
      const namaMember = parts.slice(2).join(' ');
      
      if (!cabangMap[cabang]) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ Kode cabang tidak valid!\n\n*Kode cabang:* ${validBranches.join(', ')}`
        }, { quoted: msg });
      }
      
      // Cabang tertentu butuh akun khusus buat proses cutting, cek dulu sebelum mulai
      if (butuhAkunKhusus(cabang) && !getAkunCabang(cabang)) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ Akun untuk cabang *${cabang.toUpperCase()}* belum di-setting.\n\nSilakan setting dulu dengan:\n!settingakun ${cabang} <username sistem> <password sistem>`
        }, { quoted: msg });
      }
      
      await sock.sendMessage(msg.key.remoteJid, {
        text: '⏳ Memproses cutting sesi...'
      }, { quoted: msg });
      
      queue.add(async () => {
        try {
          const result = await handleReqCuttingSesi(cabang, namaMember);
          
          if (result && result.totalCutting > 0) {
            const sesiText = result.totalCutting === 1 ? 'sesi' : 'sesi';
            await sock.sendMessage(msg.key.remoteJid, {
              text: `✅ Done! Total ${result.totalCutting} ${sesiText} berhasil di-cutting untuk ${namaMember}`
            }, { quoted: msg });
          } else {
            await sock.sendMessage(msg.key.remoteJid, {
              text: '✅ Done! Tidak ada sesi yang perlu di-cutting'
            }, { quoted: msg });
          }
        } catch (err) {
          let errorMsg = '❌ Gagal: ';
          
          if (err.message.includes('silahkan checkin member dulu')) {
            errorMsg += 'Member belum check-in. Silakan check-in member terlebih dahulu.';
          } else if (err.message.includes('Cabang tidak dikenali')) {
            errorMsg += 'Kode cabang tidak dikenali';
          } else if (err.message.includes('Timeout') || err.message.includes('timeout')) {
            errorMsg += 'Request timeout, coba lagi';
          } else if (err.message.includes('tidak ditemukan')) {
            errorMsg += `Member "${namaMember}" tidak ditemukan di sistem`;
          } else if (err.message.includes('tidak ada sesi')) {
            errorMsg += `Tidak ada sesi aktif untuk "${namaMember}"`;
          } else if (err.message.includes('belum di-setting')) {
            errorMsg += err.message;
          } else if (err.message.includes('Akun cabang') && err.message.includes('salah')) {
            errorMsg += `${err.message}`;
          } else if (err.message.includes('Login gagal untuk akun')) {
            errorMsg += err.message;
          } else if (err.message.includes('Kode barcode/unik tidak ditemukan')) {
            errorMsg += 'Kode unik barcode tidak ditemukan di halaman, coba lagi';
          } else {
            errorMsg += err.message;
          }
          
          await sock.sendMessage(msg.key.remoteJid, {
            text: errorMsg
          }, { quoted: msg });
          
          console.error('❌ Error cut:', err.message);
        }
      });
    }
  }
};