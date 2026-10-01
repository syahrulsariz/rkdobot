import { handleIsiMTD } from '../puppeteer/gas-isimtd.js';

export default {
  command: 'isimtd',
  
  async execute(sock, msg, queue) {
    queue.add(async () => {
      try {
        // Ambil text dari berbagai tipe pesan
        const text = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || '';
        
        const lines = text.split('\n').slice(1); // buang baris pertama (isimtd)
        const dataMTD = {};
        
        for (let line of lines) {
          const match = line.match(/^\d+\.\s+(.+?)\s*:\s*([\d\.]+)/);
          if (match) {
            const clubName = match[1].trim().toUpperCase();
            const amount = match[2].replace(/\./g, ''); // hapus titik ribuan
            dataMTD[clubName] = amount;
          }
        }
        
        if (Object.keys(dataMTD).length === 0) {
          return await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Format salah atau data kosong.\n\n' +
                  'Contoh:\n' +
                  'isimtd\n' +
                  '1. CLUB A : 123.456.789\n' +
                  '2. CLUB B : 987.654.321'
          }, { quoted: msg });
        }
        
        const hasil = await handleIsiMTD(dataMTD);
        
        await sock.sendMessage(msg.key.remoteJid, {
          text: `✅ MTD berhasil diisi ke web:\n\n${hasil}`
        }, { quoted: msg });
      } catch (err) {
        console.error('[ERROR isi MTD]', err.message);
        
        await sock.sendMessage(msg.key.remoteJid, {
          text: '❌ Gagal isi MTD, cek format atau coba lagi.'
        }, { quoted: msg });
      }
    });
  }
};