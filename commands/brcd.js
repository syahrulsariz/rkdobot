import handleAmbilBarcode from '../puppeteer/gas-ambilbarcode.js';
import cabangMap from '../utils/cabang-map.js';

const ALLOWED_GROUPS = {
  'brcd': []
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
  command: 'brcd',
  
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    // Buang prefix "!" biar parsing di bawah tetap konsisten,
    // apapun mode command yang dipakai (dengan/tanpa prefix)
    const textNoPrefix = text.trim().replace(/^!/, '');
    const textLower = textNoPrefix.toLowerCase();
    
    if (textLower === 'brcd' || textLower === 'brcd ') {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: 'Contoh format: !brcd bgr SC BUDI AHMAD'
      }, { quoted: msg });
    }
    
    if (textLower.startsWith('brcd ')) {
      if (!isGroupAllowed('brcd', msg)) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Bot tidak aktif di group ini untuk command `brcd`'
        }, { quoted: msg });
      }
      
      const parts = textNoPrefix.split(' ');
      if (parts.length < 3) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: 'Format salah, contoh: brcd cnr HENRICUS DWI ANANTO'
        }, { quoted: msg });
      }
      
      const cabang = parts[1].toLowerCase();
      const namaMember = parts.slice(2).join(' ');
      
      if (!cabangMap[cabang]) {
        return await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ Kode cabang tidak valid!\n\n*Kode cabang:* ${validBranches.join(', ')}`
        }, { quoted: msg });
      }
      
      await sock.sendMessage(msg.key.remoteJid, {
        text: '⏳ Mengambil barcode, tunggu sebentar...'
      }, { quoted: msg });
      
      queue.add(async () => {
        try {
          const result = await handleAmbilBarcode(cabang, namaMember);
          
          if (result && result.success) {
            if (result.totalSesi === 1) {
              await sock.sendMessage(msg.key.remoteJid, {
                text: result.barcodes[0].barcode
              }, { quoted: msg });
            } else {
              let message = `*${result.member}*\n`;
              message += `Total Sesi: ${result.totalSesi}\n\n`;
              
              result.barcodes.forEach((item) => {
                message += `Sesi ${item.sesi} : ${item.barcode}\n`;
              });
              
              await sock.sendMessage(msg.key.remoteJid, {
                text: message
              }, { quoted: msg });
            }
          } else {
            await sock.sendMessage(msg.key.remoteJid, {
              text: '❌ Gagal mengambil barcode'
            }, { quoted: msg });
          }
        } catch (err) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Error: ${err.message}`
          }, { quoted: msg });
          console.error('❌ Error ambil barcode:', err.message);
        }
      });
    }
  }
};