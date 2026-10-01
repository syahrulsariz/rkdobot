// commands/tes.js
//
// !tes
// - Dipake di dalam grup buat liat JID grup itu
// - Bot TIDAK reply apapun, cuma cetak ke console
// - Berguna buat isi GROUP_JID_MAP di commands/addgrup.js

function getMessageText(msg) {
  return msg.message?.conversation ||
         msg.message?.extendedTextMessage?.text ||
         msg.message?.imageMessage?.caption ||
         msg.message?.videoMessage?.caption ||
         '';
}

export default {
  command: ['!tes', 'tes'],

  execute: async (sock, msg) => {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const senderName = msg.pushName || 'Unknown';

    if (!isGroup) {
      console.log(`\n🧪 [TES] Command dipakai di private chat, bukan grup. Dari: ${senderName} (${from})`);
      return; // tetap no-reply sesuai request
    }

    let groupName = '(gagal ambil nama grup)';
    try {
      const groupMeta = await sock.groupMetadata(from);
      groupName = groupMeta.subject;
    } catch (err) {
      groupName = `(error: ${err.message})`;
    }

    console.log('\n🧪 ═══════════════════════════════════════════');
    console.log(`🧪 [TES] JID Grup Terdeteksi`);
    console.log(`🧪 Nama Grup : ${groupName}`);
    console.log(`🧪 JID Grup  : ${from}`);
    console.log(`🧪 Diminta oleh: ${senderName}`);
    console.log(`🧪 Copy baris ini ke GROUP_JID_MAP:`);
    console.log(`🧪   '${from}': '${groupName}',`);
    console.log('🧪 ═══════════════════════════════════════════\n');

    // sengaja tidak ada sock.sendMessage() -> bot no-reply
  }
};