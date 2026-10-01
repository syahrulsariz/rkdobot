import handleAkun from '../puppeteer/gas-akun.js';

const ALLOWED_GROUPS = {
  'akun': [
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
  command: 'akun',
  
  async execute(sock, msg, queue) {
    const rawText = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    // Buang prefix "!" biar konsisten dengan sistem command baru
    const text = rawText.trim().replace(/^!/, '');
    
    const textLower = text.trim().toLowerCase();
    
    // Kalau cuma ketik "akun" tanpa parameter
    if (textLower === 'akun' || textLower === 'akun ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !akun <nama member>
║ Example : !akun BUDI SANTOSO
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg }); // TAMBAH INI
    }
    
    if (textLower.startsWith('akun ')) {
      if (!isGroupAllowed('akun', msg)) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Bot tidak aktif di group ini untuk command `akun`'
        }, { quoted: msg }); // TAMBAH INI
      }
      
      const namaMember = text.trim().substring(5).trim();
      
      if (!namaMember) {
        return await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !akun <nama member>
║ Example : !akun BUDI SANTOSO
║
╚══════ *RKDO BOT V1* ═════╝`
        }, { quoted: msg }); // TAMBAH INI
      }
      
      // Kirim pesan loading
      await sock.sendMessage(msg.key.remoteJid, {
        text: `⏳ Mencari data member...\n\n` +
              `Nama: ${namaMember}`
      }, { quoted: msg }); // TAMBAH INI
      
      // Tambah ke queue
      queue.add(async () => {
        console.log('============================================');
        try {
          const result = await handleAkun(namaMember);
          
          await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ *Data Member Ditemukan!*\n\n` +
                  `Silahkan download aplikasi *HOM Apps* lalu login menggunakan:\n\n` +
                  `📱 ID : ${result.id}\n` +
                  `🔑 PW : ${result.password}`
          }, { quoted: msg }); // TAMBAH INI
        } catch (err) {
          console.error(`[FAILED] Gagal cari akun ${namaMember}: ${err.message}`);
          
          let errorMsg = '❌ *Gagal mencari data member*\n\n';
          
          if (err.message.includes('tidak ditemukan')) {
            errorMsg += '• Member tidak ditemukan\n' +
                       '• Pastikan nama sudah benar';
          } else {
            errorMsg += 'Terjadi kesalahan sistem, coba lagi';
          }
          
          await sock.sendMessage(msg.key.remoteJid, { 
            text: errorMsg 
          }, { quoted: msg }); // TAMBAH INI
        }
        console.log('============================================');
      });
    }
  }
};