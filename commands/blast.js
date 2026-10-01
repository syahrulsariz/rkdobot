// ============================================================
// COMMAND: blast <cabang>
// Contoh: blast pml
//         syahrul - 085161706431
//         ahmad - 089677289925
// ============================================================

// Link Google Form per cabang
import { getLinkPreview } from 'link-preview-js';
import fs from 'fs';
const BRANCH_LINKS = {
  pml:  'https://docs.google.com/forms/d/e/1FAIpQLSfc9NQWobPVgOX48bMLh90IjPQ3ctCQKBpWz90RyLynESnrRw/viewform',
  bgr:  'https://docs.google.com/forms/d/e/1FAIpQLScwi7Za9O-e0BtGiThLkyFhkIKbriDFpG3llN7FdAx9QSczyg/viewform',
  bint: 'https://docs.google.com/forms/d/e/1FAIpQLSeicSKY5iIiJf0BckKem1136bvIfccZv8oXcPaLdjJQW2cOCw/viewform',
  mbnt: 'https://docs.google.com/forms/d/e/1FAIpQLSeAUgq6U5ZC828GTJWplPWGZkbhHFN8mGWgejl0hPHizihQog/viewform',
  ssb:  'https://docs.google.com/forms/d/e/1FAIpQLSdidK5ffGUhZkGzAJTN4dCFVU-aM40ZaReQfWy9yFyOq1jfDA/viewform',
  prj:  'https://docs.google.com/forms/d/e/1FAIpQLSfjwEAhQNlV2PK51DRc2ZsAuZMMMZGB6Q-nzjdRV-E_3YfVFw/viewform',
};

// Nama lengkap cabang untuk display
const BRANCH_NAMES = {
  pml:  'Pamulang',
  bgr:  'Bogor',
  bint: 'Bintaro',
  mbnt: 'Merpati Bintaro',
  ssb:  'Pasteur',
  prj:  'Pondok Ranji',
};

// Nama pengirim yang tampil di pesan (nama staff QC yang ngirim blast)
// Bisa diganti sesuai kebutuhan, atau bisa diambil dari teks command nanti
const SENDER_NAME = 'Syahrul';

// ─── Helper ──────────────────────────────────────────────────

function getMessageText(msg) {
  return msg.message?.conversation ||
         msg.message?.extendedTextMessage?.text ||
         msg.message?.imageMessage?.caption ||
         msg.message?.videoMessage?.caption ||
         '';
}

// Format nama jadi URL-encoded (spasi → +)
function encodeNameForUrl(name) {
  return name.trim().toUpperCase().replace(/\s+/g, '+');
}

// Format nomor WA jadi JID
function formatNumber(number) {
  // Hapus semua karakter non-digit
  let num = number.replace(/\D/g, '');
  // Ganti awalan 0 dengan 62
  if (num.startsWith('0')) {
    num = '62' + num.slice(1);
  }
  return num + '@s.whatsapp.net';
}

// Build pesan untuk satu member
function buildMessage(nama, baseLink) {
  const encodedName = encodeNameForUrl(nama);
  const link = `${baseLink}?usp=pp_url&entry.2117192986=${encodedName}`;

  return (
    `Halo Kak ${nama.trim().toUpperCase()}, saya ${SENDER_NAME} dari tim QC House of Metamorfit. ` +
    `Terima kasih sudah menggunakan layanan Personal Trainer kami 😊 ` +
    `Kami ingin meminta sedikit waktu Kakak untuk mengisi survei berikut sebagai bahan evaluasi dan peningkatan kualitas layanan kami :\n\n` +
    `${link}\n\n` +
    `Feedback dari Kakak sangat berarti untuk membantu kami memberikan pelayanan yang lebih baik lagi. ` +
    `Terima kasih atas waktunya 🙏`
  );
}

// Parse baris daftar member: "NAMA - NOMOR"
function parseMemberList(lines) {
  const members = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Support separator " - " atau "-"
    const match = trimmed.match(/^(.+?)\s*-\s*(\d[\d\s]+)$/);
    if (match) {
      const nama   = match[1].trim();
      const nomor  = match[2].trim();
      members.push({ nama, nomor });
    }
  }
  return members;
}

// ─── Export ───────────────────────────────────────────────────

export default {
  command: 'blast',
  description: 'Blast pesan survei QC ke daftar member per cabang',

  async execute(sock, msg, queue) {
    const rawText = getMessageText(msg).trim();
    const from    = msg.key.remoteJid;

    // Cek apakah pesan dimulai dengan "blast"
    if (!rawText.toLowerCase().startsWith('blast')) return;

    const lines      = rawText.split('\n');
    const firstLine  = lines[0].trim().toLowerCase();  // "blast pml"
    const parts      = firstLine.split(/\s+/);          // ["blast", "pml"]

    if (parts.length < 2) {
      return await sock.sendMessage(from, {
        text: '❌ Format salah!\n\nContoh:\n*blast pml*\nsyahrul - 085161706431\nahmad - 089677289925'
      }, { quoted: msg });
    }

    const branchCode = parts[1].toLowerCase();
    const baseLink   = BRANCH_LINKS[branchCode];

    if (!baseLink) {
      const available = Object.keys(BRANCH_LINKS).join(', ');
      return await sock.sendMessage(from, {
        text: `❌ Cabang *${branchCode}* tidak ditemukan!\n\nCabang tersedia: ${available}`
      }, { quoted: msg });
    }

    // Parse daftar member dari baris ke-2 dst
    const memberLines = lines.slice(1);
    const members     = parseMemberList(memberLines);

    if (members.length === 0) {
      return await sock.sendMessage(from, {
        text: '❌ Tidak ada member ditemukan!\n\nFormat daftar:\n*NAMA - NOMOR*\nContoh: syahrul - 085161706431'
      }, { quoted: msg });
    }

    const branchName = BRANCH_NAMES[branchCode];

    // Konfirmasi awal
    await sock.sendMessage(from, {
      text: `⏳ *BLAST SURVEI QC*\n\n` +
            `📍 Cabang: ${branchName} (${branchCode.toUpperCase()})\n` +
            `👥 Total member: ${members.length}\n` +
            `⏳ Mengirim pesan...`
    }, { quoted: msg });

    // Kirim via queue
    queue.add(async () => {
      console.log(`[BLAST] Cabang: ${branchName} | Total: ${members.length} member`);

      let successCount = 0;
      let failedList   = [];

      for (let i = 0; i < members.length; i++) {
        const { nama, nomor } = members[i];
        const jid     = formatNumber(nomor);
        const pesan   = buildMessage(nama, baseLink);
        const urut    = i + 1;

        try {
          console.log(`[${urut}/${members.length}] Kirim ke ${nama} (${nomor})`);
          // Generate preview dulu
// Baca gambar dari folder project
const thumbBuffer = fs.readFileSync('./assets/preview.png'); // sesuaikan path-nya

await sock.sendMessage(jid, {
  text: pesan,
  linkPreview: {
    matchedText: baseLink,
    canonicalUrl: baseLink,
    title: 'House of Metamorfit - Survei Kepuasan Member',
    description: 'Kami ingin meminta sedikit waktu Anda untuk mengisi survei sebagai bahan evaluasi dan peningkatan kualitas layanan kami.',
    jpegThumbnail: thumbBuffer,
  }
});
          successCount++;
          console.log(`[SUCCESS] ${nama}`);
        } catch (err) {
          console.error(`[FAILED] ${nama} (${nomor}):`, err.message);
          failedList.push(`${nama} - ${nomor}`);
        }

        // Delay antar pesan (1.5 detik)
        if (i < members.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      // Summary
      let summary = `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      summary    += `✅ *BLAST SELESAI*\n`;
      summary    += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      summary    += `📍 Cabang: ${branchName}\n`;
      summary    += `✅ Berhasil: ${successCount}/${members.length}\n`;

      if (failedList.length > 0) {
        summary += `❌ Gagal (${failedList.length}):\n`;
        summary += failedList.map(f => `  • ${f}`).join('\n');
      }

      summary += `\n━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(from, { text: summary }, { quoted: msg });

      console.log(`[BLAST DONE] Success: ${successCount}, Failed: ${failedList.length}`);
    });
  }
};