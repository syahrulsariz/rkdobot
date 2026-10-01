import { handleKirimPeringkat } from '../puppeteer/gas-kirimperingkat.js';

export default {
  command: 'kirimperingkat',
  
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    const args = text.trim().split(' ')[1]; // misal "kirimperingkat 17-08-25"
    
    if (!args || !args.match(/^\d{2}-\d{2}-\d{2}$/)) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Format salah.\n\nContoh penggunaan: kirimperingkat 17-08-25'
      }, { quoted: msg });
    }
    
    await sock.sendMessage(msg.key.remoteJid, {
      text: '⏳ Mengambil data peringkat, tunggu sebentar...'
    }, { quoted: msg });
    
    queue.add(async () => {
      try {
        const hasil = await handleKirimPeringkat(args);
        
        await sock.sendMessage(msg.key.remoteJid, {
          text: hasil
        }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR kirimperingkat]', err.message);
        
        await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Gagal mengambil peringkat, coba lagi.'
        }, { quoted: msg });
      }
    });
  }
};