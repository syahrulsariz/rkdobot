// ================== DATA PESAN ==================

const PESAN_MEM = [
'reqmem distrik1 njm 3+1 Months 1.350.000',
'reqmem distrik1 njm 3+1 Months 1.400.000',
'reqmem distrik1 njm 3+1 Months 1.500.000',
'reqmem distrik1 njm 6+2 Months 2.250.000',
'reqmem distrik1 njm 6+2 Months 2.400.000',
'reqmem distrik1 njm 6+2 Months 2.600.000',
'reqmem distrik1 njm 12+3 Months 4.050.000',
'reqmem distrik1 njm 12+3 Months 4.275.000',
'reqmem distrik1 njm 12+3 Months 4.500.000',
'reqmem distrik1 njm 12+12 Months 5.950.000',
'reqmem distrik1 njm 12+12 Months 6.500.000',
'reqmem distrik1 renew 3+1 Months 1.350.000',
'reqmem distrik1 renew 3+1 Months 1.400.000',
'reqmem distrik1 renew 3+1 Months 1.500.000',
'reqmem distrik1 renew 6+2 Months 2.250.000',
'reqmem distrik1 renew 6+2 Months 2.400.000',
'reqmem distrik1 renew 6+2 Months 2.600.000',
'reqmem distrik1 renew 12+3 Months 4.050.000',
'reqmem distrik1 renew 12+3 Months 4.275.000',
'reqmem distrik1 renew 12+3 Months 4.500.000',
'reqmem distrik1 renew 12+12 Months 5.950.000',
'reqmem distrik1 renew 12+12 Months 6.500.000',
'reqmem distrik1 upsc 6+2 Months 2.250.000',
'reqmem distrik1 upsc 6+2 Months 2.400.000',
'reqmem distrik1 upsc 6+2 Months 2.600.000',
'reqmem distrik1 upsc 12+3 Months 4.050.000',
'reqmem distrik1 upsc 12+3 Months 4.275.000',
'reqmem distrik1 upsc 12+3 Months 4.500.000',
'reqmem distrik1 upsc 12+12 Months 5.950.000',
'reqmem distrik1 upac 6+2 Months 2.400.000',
'reqmem distrik1 upac 6+2 Months 2.600.000',
'reqmem distrik1 upac 12+3 Months 4.050.000',
'reqmem distrik1 upac 12+3 Months 4.275.000',
'reqmem distrik1 upac 12+3 Months 4.500.000',
'reqmem distrik1 upac 12+12 Months 6.500.000',
'reqmem distrik1 cut 1 Month 100.000',
'reqmem distrik1 cut 2 Months 200.000',
'reqmem distrik1 cut 3 Months 300.000',
'reqmem distrik1 cut 4 Months 400.000',
'reqmem distrik1 cut 5 Months 500.000',
'reqmem distrik1 cut 6 Months 600.000',
'reqmem distrik1 cut 9 Months Maternity 100.000',
'reqmem distrik1 renew 1 Month BR 0',
'reqmem distrik1 renew 2 Months BR 0',
'reqmem distrik1 renew 3 Months BR 0',
'reqmem distrik1 dpn 3+1 Months 500.000',
'reqmem distrik1 dpn 6+2 Months 500.000',
'reqmem distrik1 dpn 12+3 Months 500.000',
'reqmem distrik1 dpn 3+1 Months 1.000.000',
'reqmem distrik1 dpn 6+2 Months 1.000.000',
'reqmem distrik1 dpn 12+3 Months 1.000.000',
'reqmem distrik1 dpr 3+1 Months 500.000',
'reqmem distrik1 dpr 6+2 Months 500.000',
'reqmem distrik1 dpr 12+3 Months 500.000',
'reqmem distrik1 dpr 3+1 Months 1.000.000',
'reqmem distrik1 dpr 6+2 Months 1.000.000',
'reqmem distrik1 dpr 12+3 Months 1.000.000',
];

const PESAN_KIDS = [
'reqmemkids distrik1 njm 3 Months Siblings 2.234.650',
'reqmemkids distrik1 njm 6 Months Siblings 4.027.300',
'reqmemkids distrik1 njm 9 Months Siblings 5.392.450',
'reqmemkids distrik1 njm 3 Months Primary 2.397.000',
'reqmemkids distrik1 njm 6 Months Primary 4.434.000',
'reqmemkids distrik1 njm 9 Months Primary 6.171.000',
'reqmemkids distrik1 renew 3 Months Siblings 2.234.650',
'reqmemkids distrik1 renew 6 Months Siblings 4.027.300',
'reqmemkids distrik1 renew 9 Months Siblings 5.392.450',
'reqmemkids distrik1 renew 3 Months Primary 2.397.000',
'reqmemkids distrik1 renew 6 Months Primary 4.434.000',
'reqmemkids distrik1 renew 9 Months Primary 6.171.000',
'reqmemkids distrik1 upac 6 Months Siblings 4.027.300',
'reqmemkids distrik1 upac 9 Months Siblings 5.392.450',
'reqmemkids distrik1 upac 6 Months Primary 4.434.000',
'reqmemkids distrik1 upac 9 Months Primary 5.871.000',
'reqmemkids distrik1 cut 1 Month 100.000',
'reqmemkids distrik1 cut 2 Months 200.000',
'reqmemkids distrik1 cut 3 Months 300.000',
'reqmemkids distrik1 cut 4 Months 400.000',
'reqmemkids distrik1 cut 5 Months 500.000',
'reqmemkids distrik1 cut 6 Months 600.000',
'reqmemkids distrik1 dpn 3 Months Siblings 500.000',
'reqmemkids distrik1 dpn 3 Months Siblings 750.000',
'reqmemkids distrik1 dpn 3 Months Siblings 1.000.000',
'reqmemkids distrik1 dpn 3 Months Primary 500.000',
'reqmemkids distrik1 dpn 3 Months Primary 750.000',
'reqmemkids distrik1 dpn 3 Months Primary 1.000.000',
'reqmemkids distrik1 dpn 6 Months Siblings 500.000',
'reqmemkids distrik1 dpn 6 Months Siblings 750.000',
'reqmemkids distrik1 dpn 6 Months Siblings 1.000.000',
'reqmemkids distrik1 dpn 6 Months Primary 500.000',
'reqmemkids distrik1 dpn 6 Months Primary 750.000',
'reqmemkids distrik1 dpn 6 Months Primary 1.000.000',
'reqmemkids distrik1 dpn 9 Months Siblings 500.000',
'reqmemkids distrik1 dpn 9 Months Siblings 750.000',
'reqmemkids distrik1 dpn 9 Months Siblings 1.000.000',
'reqmemkids distrik1 dpn 9 Months Primary 500.000',
'reqmemkids distrik1 dpn 9 Months Primary 750.000',
'reqmemkids distrik1 dpn 9 Months Primary 1.000.000',
'reqmemkids distrik1 dpr 3 Months Siblings 500.000',
'reqmemkids distrik1 dpr 3 Months Siblings 750.000',
'reqmemkids distrik1 dpr 3 Months Siblings 1.000.000',
'reqmemkids distrik1 dpr 3 Months Primary 500.000',
'reqmemkids distrik1 dpr 3 Months Primary 750.000',
'reqmemkids distrik1 dpr 3 Months Primary 1.000.000',
'reqmemkids distrik1 dpr 6 Months Siblings 500.000',
'reqmemkids distrik1 dpr 6 Months Siblings 750.000',
'reqmemkids distrik1 dpr 6 Months Siblings 1.000.000',
'reqmemkids distrik1 dpr 6 Months Primary 500.000',
'reqmemkids distrik1 dpr 6 Months Primary 750.000',
'reqmemkids distrik1 dpr 6 Months Primary 1.000.000',
'reqmemkids distrik1 dpr 9 Months Siblings 500.000',
'reqmemkids distrik1 dpr 9 Months Siblings 750.000',
'reqmemkids distrik1 dpr 9 Months Siblings 1.000.000',
'reqmemkids distrik1 dpr 9 Months Primary 500.000',
'reqmemkids distrik1 dpr 9 Months Primary 750.000',
'reqmemkids distrik1 dpr 9 Months Primary 1.000.000',
];

const PESAN_PT = [
'reqpt distrik1 REG 10 Sesi 2.250.000',
'reqpt distrik1 REG 10 Sesi 2.500.000',
'reqpt distrik1 REG 10 Sesi 3.000.000',
'reqpt distrik1 REG 20 Sesi 4.000.000',
'reqpt distrik1 REG 20 Sesi 4.500.000',
'reqpt distrik1 REG 20 Sesi 5.000.000',
'reqpt distrik1 REG 30 Sesi 5.850.000',
'reqpt distrik1 REG 30 Sesi 6.750.000',
'reqpt distrik1 REG 30 Sesi 7.250.000',
'reqpt distrik1 REG 40 Sesi 7.500.000',
'reqpt distrik1 REG 40 Sesi 8.000.000',
'reqpt distrik1 REG 40 Sesi 9.000.000',
'reqpt distrik1 REG 50 Sesi 9.000.000',
'reqpt distrik1 REG 50 Sesi 10.000.000',
'reqpt distrik1 REG 50 Sesi 11.000.000',
'reqpt distrik1 POS 10 Sesi 2.250.000',
'reqpt distrik1 POS 10 Sesi 2.500.000',
'reqpt distrik1 POS 10 Sesi 3.000.000',
'reqpt distrik1 POS 20 Sesi 4.000.000',
'reqpt distrik1 POS 20 Sesi 4.500.000',
'reqpt distrik1 POS 20 Sesi 5.000.000',
'reqpt distrik1 POS 30 Sesi 5.850.000',
'reqpt distrik1 POS 30 Sesi 6.750.000',
'reqpt distrik1 POS 30 Sesi 7.250.000',
'reqpt distrik1 POS 40 Sesi 7.500.000',
'reqpt distrik1 POS 40 Sesi 8.000.000',
'reqpt distrik1 POS 40 Sesi 9.000.000',
'reqpt distrik1 POS 50 Sesi 9.000.000',
'reqpt distrik1 POS 50 Sesi 10.000.000',
'reqpt distrik1 POS 50 Sesi 11.000.000',
'reqpt distrik1 ptdp REG 10 Sesi 500.000',
'reqpt distrik1 ptdp REG 10 Sesi 750.000',
'reqpt distrik1 ptdp REG 10 Sesi 1.000.000',
'reqpt distrik1 ptdp REG 20 Sesi 500.000',
'reqpt distrik1 ptdp REG 20 Sesi 750.000',
'reqpt distrik1 ptdp REG 20 Sesi 1.000.000',
'reqpt distrik1 ptdp REG 30 Sesi 500.000',
'reqpt distrik1 ptdp REG 30 Sesi 750.000',
'reqpt distrik1 ptdp REG 30 Sesi 1.000.000',
'reqpt distrik1 ptdp REG 40 Sesi 500.000',
'reqpt distrik1 ptdp REG 40 Sesi 750.000',
'reqpt distrik1 ptdp REG 40 Sesi 1.000.000',
'reqpt distrik1 ptdp REG 50 Sesi 500.000',
'reqpt distrik1 ptdp REG 50 Sesi 750.000',
'reqpt distrik1 ptdp REG 50 Sesi 1.000.000',
'reqpt distrik1 ptdp POS 10 Sesi 500.000',
'reqpt distrik1 ptdp POS 10 Sesi 750.000',
'reqpt distrik1 ptdp POS 10 Sesi 1.000.000',
'reqpt distrik1 ptdp POS 20 Sesi 500.000',
'reqpt distrik1 ptdp POS 20 Sesi 750.000',
'reqpt distrik1 ptdp POS 20 Sesi 1.000.000',
'reqpt distrik1 ptdp POS 30 Sesi 500.000',
'reqpt distrik1 ptdp POS 30 Sesi 750.000',
'reqpt distrik1 ptdp POS 30 Sesi 1.000.000',
'reqpt distrik1 ptdp POS 40 Sesi 500.000',
'reqpt distrik1 ptdp POS 40 Sesi 750.000',
'reqpt distrik1 ptdp POS 40 Sesi 1.000.000',
'reqpt distrik1 ptdp POS 50 Sesi 500.000',
'reqpt distrik1 ptdp POS 50 Sesi 750.000',
'reqpt distrik1 ptdp POS 50 Sesi 1.000.000',
'reqpt distrik1 REG Pilates 10 Sesi 3.500.000',
'reqpt distrik1 POS Pilates 10 Sesi 3.500.000',
'reqpt distrik1 ptdp REG Pilates 10 Sesi 500.000',
'reqpt distrik1 ptdp REG Pilates 10 Sesi 750.000',
'reqpt distrik1 ptdp REG Pilates 10 Sesi 1.000.000',
'reqpt distrik1 ptdp POS Pilates 10 Sesi 500.000',
'reqpt distrik1 ptdp POS Pilates 10 Sesi 750.000',
'reqpt distrik1 ptdp POS Pilates 10 Sesi 1.000.000',
];

// ================== CONFIG ==================

const ADMIN_NUMBERS = [
  '6285161706431@s.whatsapp.net',
];

const ALLOWED_GROUPS = [];

// ================== HELPER ==================

function getMessageText(msg) {
  return msg.message?.conversation ||
         msg.message?.extendedTextMessage?.text ||
         msg.message?.imageMessage?.caption ||
         msg.message?.videoMessage?.caption ||
         '';
}

function isGroupAllowed(msg) {
  if (!msg.key.remoteJid.endsWith('@g.us')) {
    return true;
  }

  if (ALLOWED_GROUPS.length === 0) {
    return true;
  }

  return ALLOWED_GROUPS.includes(msg.key.remoteJid);
}

function isAdmin(msg) {
  const senderId = msg.key.participant || msg.key.remoteJid;
  return ADMIN_NUMBERS.includes(senderId);
}

// ================== HELPER TRANSFORM PESAN ==================

// Ganti kode cabang default "distrik1" pada tiap pesan dengan kode cabang
// yang diminta user, lalu tambahkan prefix "!" di depan tiap pesan.
function buildPesanList(baseList, kodeCabang) {
  return baseList.map(pesan => {
    const pesanCabang = kodeCabang
      ? pesan.replace(/\bdistrik1\b/, kodeCabang)
      : pesan;

    return `!${pesanCabang}`;
  });
}

// ================== FUNCTION KIRIM ==================

async function kirimPaket({
  sock,
  msg,
  queue,
  from,
  namaCommand,
  pesanList
}) {

  await sock.sendMessage(from, {
    text:
      `⏳ *MENGIRIM PESAN*\n\n` +
      `📦 Paket : ${namaCommand}\n` +
      `📝 Total : ${pesanList.length} pesan\n\n` +
      `Mohon tunggu...`
  }, { quoted: msg });

  queue.add(async () => {

    console.log(`============================================`);
    console.log(`[${namaCommand}] Mengirim ${pesanList.length} pesan`);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < pesanList.length; i++) {

      const pesan = pesanList[i];
      const nomorUrut = i + 1;

      try {

        console.log(
          `[${nomorUrut}/${pesanList.length}] ${pesan}`
        );

        await sock.sendMessage(
          from,
          { text: pesan },
          { quoted: msg }
        );

        successCount++;

        if (i < pesanList.length - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, 1000)
          );
        }

      } catch (err) {

        failedCount++;

        console.error(
          `[FAILED] ${nomorUrut}`,
          err.message
        );

        await new Promise(resolve =>
          setTimeout(resolve, 500)
        );
      }
    }

    let summaryMsg =
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *SELESAI*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📦 Paket : ${namaCommand}\n\n` +
      `✅ Berhasil : ${successCount}/${pesanList.length}\n`;

    if (failedCount > 0) {
      summaryMsg += `❌ Gagal : ${failedCount}\n`;
    }

    summaryMsg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(
      from,
      { text: summaryMsg },
      { quoted: msg }
    );

    console.log(`============================================`);
  });
}

// ================== COMMAND ==================

export default {
  command: [
    'buatpaketmem',
    'buatpaketkids',
    'buatpaketpt'
  ],

  description: 'Kirim paket hardcode',

  async execute(sock, msg, queue) {

    const rawText = getMessageText(msg)
      .trim()
      .toLowerCase()
      .replace(/^!/, '');

    // Pisahkan nama command dari kode cabang, contoh:
    // "buatpaketmem pml" -> command = "buatpaketmem", kodeCabang = "pml"
    const [command, kodeCabang] = rawText.split(/\s+/);

    const from = msg.key.remoteJid;

    if (![
      'buatpaketmem',
      'buatpaketkids',
      'buatpaketpt'
    ].includes(command)) {
      return;
    }

    if (!isGroupAllowed(msg)) {
      return await sock.sendMessage(from, {
        text: '❌ Bot tidak aktif di group ini.'
      }, { quoted: msg });
    }

    // Uncomment kalau mau admin only
    /*
    if (!isAdmin(msg)) {
      return await sock.sendMessage(from, {
        text: '🔒 Akses ditolak.'
      }, { quoted: msg });
    }
    */

    const labelCabang = kodeCabang ? ` (${kodeCabang.toUpperCase()})` : '';

    if (command === 'buatpaketmem') {
      return kirimPaket({
        sock,
        msg,
        queue,
        from,
        namaCommand: `MEMBERSHIP${labelCabang}`,
        pesanList: buildPesanList(PESAN_MEM, kodeCabang)
      });
    }

    if (command === 'buatpaketkids') {
      return kirimPaket({
        sock,
        msg,
        queue,
        from,
        namaCommand: `KIDS${labelCabang}`,
        pesanList: buildPesanList(PESAN_KIDS, kodeCabang)
      });
    }

    if (command === 'buatpaketpt') {
      return kirimPaket({
        sock,
        msg,
        queue,
        from,
        namaCommand: `PERSONAL TRAINER${labelCabang}`,
        pesanList: buildPesanList(PESAN_PT, kodeCabang)
      });
    }

  }
};