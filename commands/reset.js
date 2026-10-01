import handleReset from '../puppeteer/gas-reset.js';

const ALLOWED_GROUPS = {
  'reset': [
    // Kosongkan kalau mau semua group bisa
  ]
};

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
  command: 'reset',
  
  async execute(sock, msg, queue) {
    const rawText = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    // Buang prefix "!" biar konsisten dengan sistem command baru
    const text = rawText.trim().replace(/^!/, '');
    
    const textLower = text.trim().toLowerCase();
    
    // Kalau cuma ketik "reset" tanpa parameter
    if (textLower === 'reset' || textLower === 'reset ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !reset <nama member>
║ Example : !reset BUDI SANTOSO
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg });
    }
    
    if (textLower.startsWith('reset ')) {
      if (!isGroupAllowed('reset', msg)) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Bot tidak aktif di group ini untuk command `reset`'
        }, { quoted: msg });
      }
      
      const namaMember = text.trim().substring(6).trim(); // 'reset ' = 6 karakter
      
      if (!namaMember) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Format salah!\n\n' +
                'Contoh: `reset AHMAD SYAHRONI`'
        }, { quoted: msg });
      }
      
      // Kirim pesan loading
      await sock.sendMessage(msg.key.remoteJid, {
        text: `⏳ Sedang reset password...\n\n` +
              `Nama: ${namaMember}`
      }, { quoted: msg });
      
      // Tambah ke queue
      queue.add(async () => {
        console.log('============================================');
        try {
          const result = await handleReset(namaMember);
          
          await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ *Password Berhasil Di-Reset!*\n\n` +
                  `Member: ${namaMember}\n\n` +
                  `Password baru sudah dibuat dan bisa digunakan untuk login di aplikasi HOM Apps.`
          }, { quoted: msg });
        } catch (err) {
          console.error(`[FAILED] Gagal reset password ${namaMember}: ${err.message}`);
          
          let errorMsg = '❌ *Gagal reset password*\n\n';
          
          if (err.message.includes('tidak ditemukan')) {
            errorMsg += '• Member tidak ditemukan\n' +
                       '• Pastikan nama sudah benar';
          } else if (err.message.includes('Regenerate Password')) {
            errorMsg += '• Tombol Regenerate Password tidak ditemukan\n' +
                       '• Pastikan member sudah terdaftar dengan benar';
          } else if (err.message.includes('Confirm')) {
            errorMsg += '• Tombol Confirm tidak ditemukan\n' +
                       '• Coba lagi dalam beberapa saat';
          } else {
            errorMsg += 'Terjadi kesalahan sistem, coba lagi';
          }
          
          await sock.sendMessage(msg.key.remoteJid, { 
            text: errorMsg 
          }, { quoted: msg });
        }
        console.log('============================================');
      });
    }
  }
};