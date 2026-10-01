import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  command: 'logout',
  
  async execute(sock, msg, queue) {
    const from = msg.key.remoteJid;
    
    // GANTI DENGAN NOMOR KAMU
    const ownerNumber = '6285161706431@s.whatsapp.net'; 
    
    if (msg.key.participant !== ownerNumber && from !== ownerNumber) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Command ini hanya untuk owner!'
      }, { quoted: msg });
    }
    
    await sock.sendMessage(msg.key.remoteJid, {
      text: '🔄 Logging out dan menghapus session...'
    }, { quoted: msg });
    
    try {
      await sock.logout();
      
      const authPath = path.join(__dirname, '..', 'auth_info_baileys');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      
      console.log('✅ Session berhasil dihapus!');
      console.log('⚠️ Restart bot untuk scan QR code lagi');
      
      process.exit(0);
    } catch (err) {
      console.error('Error saat logout:', err);
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Gagal logout: ' + err.message
      }, { quoted: msg });
    }
  }
};