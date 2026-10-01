import syncMember from '../puppeteer/gas-sinkron.js';

export default {
  command: 'sinkron',
  
  async execute(sock, msg, queue) {
    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || '';
    
    const parts = text.trim().split(/\s+/);
    
    // Validasi format: sinkron [nomor_anggota]
    if (parts.length !== 2) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `╔════ *INVALID FORMAT* ═════╗
║
║ Format  : !sinkron <no member>
║ Example : !sinkron HOM-PML-0000921
║
╚══════ *RKDO BOT V1* ═════╝`
      }, { quoted: msg }); // TAMBAH INI
      return;
    }
    
    const nomorAnggota = parts[1];
    
    await sock.sendMessage(msg.key.remoteJid, {
      text: `⏳ Sinkron nomor member ${nomorAnggota}...`
    }, { quoted: msg }); // TAMBAH INI
    
    queue.add(async () => {
      try {
        const result = await syncMember(nomorAnggota);
        
        await sock.sendMessage(msg.key.remoteJid, {
          text: `✅ ${result.message}`
        }, { quoted: msg }); // TAMBAH INI
      } catch (err) {
        console.error('[ERROR handler syncmember]', err.message);
        
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ ${err.message}`
        }, { quoted: msg }); // TAMBAH INI
      }
    });
  }
};