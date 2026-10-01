import { handleTransaksiKeuangan, handleCekSaldo, handleTarikTunai, handleSetorTunai } from '../puppeteer/gas-rkdo.js';

// Helper extract text dari message
function getMessageText(msg) {
  return msg.message?.conversation ||
         msg.message?.extendedTextMessage?.text ||
         msg.message?.imageMessage?.caption ||
         msg.message?.videoMessage?.caption ||
         '';
}

// ─── Pending multi-step transaksi (hanya di memory) ─────────────────────────
// key = remoteJid (from)
const pending = new Map();

// Timeout pending 5 menit
const PENDING_TTL_MS = 5 * 60 * 1000;

function clearPending(from) {
  pending.delete(from);
}

function setPending(from, data) {
  pending.set(from, { ...data, createdAt: Date.now() });
}

function getPending(from) {
  const p = pending.get(from);
  if (!p) return null;
  if (Date.now() - p.createdAt > PENDING_TTL_MS) {
    pending.delete(from);
    return null;
  }
  return p;
}

// ─── Opsi kategori & sumber (harus persis sama dengan $kategoriArray & $akunList di index.php) ──
const KATEGORI_LIST = [
  { key: 'A', value: 'Makanan & Minuman', label: '🍽️ Makanan & Minuman' },
  { key: 'B', value: 'Transportasi',      label: '⛽ Transportasi' },
  { key: 'C', value: 'Kendaraan',         label: '🏍️ Kendaraan' },
  { key: 'D', value: 'Elektronik/Gawai',  label: '📱 Elektronik/Gawai' },
  { key: 'E', value: 'Tagihan & Rutin',   label: '⚡ Tagihan & Rutin' },
  { key: 'F', value: 'Transfer Keluarga', label: '👨‍👩‍👧 Transfer Keluarga' },
  { key: 'G', value: 'Utang/Piutang',     label: '🤝 Utang/Piutang' },
  { key: 'H', value: 'Kebutuhan Harian',  label: '🛍️ Kebutuhan Harian' },
  { key: 'I', value: 'Hiburan',           label: '🎮 Hiburan' },
  { key: 'J', value: 'Transfer Internal', label: '🔄 Transfer Internal' },
  { key: 'K', value: 'Lainnya',           label: '💳 Lainnya' },
];

const SUMBER_LIST = [
  { key: 'A', value: 'cash',    label: '💵 Cash' },
  { key: 'B', value: 'bca',     label: '🔵 BCA' },
  { key: 'C', value: 'mandiri', label: '🟡 Mandiri' },
];

// Sumber tarik tunai: gak bisa dari cash (sesuai TARIK_SUMBER_VALID di gas-rkdo.js)
const TARIK_SUMBER_LIST = [
  { key: 'A', value: 'bca',     label: '🔵 BCA' },
  { key: 'B', value: 'mandiri', label: '🟡 Mandiri' },
];

// Tujuan setor tunai: gak bisa ke cash (sesuai SETOR_TUJUAN_VALID di gas-rkdo.js)
const SETOR_TUJUAN_LIST = [
  { key: 'A', value: 'bca',     label: '🔵 BCA' },
  { key: 'B', value: 'mandiri', label: '🟡 Mandiri' },
];

function formatKategoriMenu() {
  return KATEGORI_LIST.map(k => `${k.key}. ${k.label}`).join('\n');
}

function formatSumberMenu() {
  return SUMBER_LIST.map(s => `${s.key}. ${s.label}`).join('\n');
}

function formatTarikSumberMenu() {
  return TARIK_SUMBER_LIST.map(s => `${s.key}. ${s.label}`).join('\n');
}

function formatSetorTujuanMenu() {
  return SETOR_TUJUAN_LIST.map(s => `${s.key}. ${s.label}`).join('\n');
}

function findKategori(input) {
  const t = input.trim().toUpperCase();
  return KATEGORI_LIST.find(k => k.key === t || k.value.toLowerCase() === input.trim().toLowerCase());
}

function findSumber(input) {
  const t = input.trim().toUpperCase();
  return SUMBER_LIST.find(s => s.key === t || s.value.toLowerCase() === input.trim().toLowerCase());
}

function findTarikSumber(input) {
  const t = input.trim().toUpperCase();
  return TARIK_SUMBER_LIST.find(s => s.key === t || s.value.toLowerCase() === input.trim().toLowerCase());
}

function findSetorTujuan(input) {
  const t = input.trim().toUpperCase();
  return SETOR_TUJUAN_LIST.find(s => s.key === t || s.value.toLowerCase() === input.trim().toLowerCase());
}

// ─── Cek admin (owner only) ─────────────────────────────────────────────────
function isAdmin(sender, ADMIN_LIST = []) {
  if (!ADMIN_LIST || ADMIN_LIST.length === 0) return false;
  const senderRaw = (sender || '').split('@')[0];
  const normalize = (p) => {
    let c = String(p).replace(/\D/g, '');
    if (c.startsWith('0')) c = '62' + c.substring(1);
    else if (!c.startsWith('62')) c = '62' + c;
    return c;
  };
  const senderNorm = normalize(senderRaw);
  return ADMIN_LIST.some(a => normalize(a) === senderNorm);
}

/**
 * Dipanggil dari index.js untuk pesan non-command (huruf A/B/C dst)
 * Return true jika pesan sudah ditangani (pending step).
 */
export async function handlePendingKeuangan(sock, msg, queue, ADMIN_LIST = []) {
  const text = getMessageText(msg).trim();
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  // Hanya owner yang boleh pakai alur ini
  if (!isAdmin(sender, ADMIN_LIST)) return false;

  const p = getPending(from);
  if (!p) return false;

  // ── Step 1: pilih kategori ──
  if (p.step === 'kategori') {
    if (text.toLowerCase() === 'batal') {
      clearPending(from);
      await sock.sendMessage(from, { text: '❌ Transaksi dibatalkan.' }, { quoted: msg });
      return true;
    }

    const kat = findKategori(text);
    if (!kat) {
      await sock.sendMessage(from, {
        text: `❌ Pilihan tidak valid.\n\nPilih salah satu huruf:\n\n${formatKategoriMenu()}\n\nKetik *batal* untuk membatalkan.`
      }, { quoted: msg });
      return true;
    }

    setPending(from, {
      ...p,
      step: 'sumber',
      kategori: kat.value,
      kategoriLabel: kat.label
    });

    const emoji = p.tipe === 'masuk' ? '💰' : '💸';
    await sock.sendMessage(from, {
      text: `${emoji} *Pilih sumber dana*\n\n` +
            `💵 Jumlah: Rp ${parseInt(p.jumlah).toLocaleString('id-ID')}\n` +
            `📋 Catatan: ${p.catatan}\n` +
            `🏷️ Kategori: ${kat.label}\n\n` +
            `${formatSumberMenu()}\n\n` +
            `_Ketik huruf (A/B/C) atau *batal*_`
    }, { quoted: msg });
    return true;
  }

  // ── Step 2: pilih sumber ──
  if (p.step === 'sumber') {
    if (text.toLowerCase() === 'batal') {
      clearPending(from);
      await sock.sendMessage(from, { text: '❌ Transaksi dibatalkan.' }, { quoted: msg });
      return true;
    }

    const sum = findSumber(text);
    if (!sum) {
      await sock.sendMessage(from, {
        text: `❌ Pilihan tidak valid.\n\nPilih salah satu:\n\n${formatSumberMenu()}\n\nKetik *batal* untuk membatalkan.`
      }, { quoted: msg });
      return true;
    }

    // Semua data lengkap → proses
    clearPending(from);

    const emoji = p.tipe === 'masuk' ? '💰' : '💸';
    const jenis = p.tipe === 'masuk' ? 'pemasukan' : 'pengeluaran';

    await sock.sendMessage(from, {
      text: `${emoji} Memproses transaksi ${jenis}...\n\n` +
            `💵 Jumlah: Rp ${parseInt(p.jumlah).toLocaleString('id-ID')}\n` +
            `📋 Catatan: ${p.catatan}\n` +
            `🏷️ Kategori: ${p.kategoriLabel}\n` +
            `💳 Sumber: ${sum.label}\n\n` +
            `⏳ Mohon tunggu sebentar...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        console.log(`💰 Processing ${p.tipe}: Rp ${p.jumlah} | ${p.catatan} | ${p.kategori} | ${sum.value}`);

        const result = await handleTransaksiKeuangan(
          p.tipe,
          p.jumlah,
          p.catatan,
          p.kategori,
          sum.value
        );

        await sock.sendMessage(from, { text: result }, { quoted: msg });
        console.log(`✅ Transaksi ${p.tipe} berhasil: ${p.catatan}`);
      } catch (err) {
        console.error('[ERROR Handler Transaksi]', {
          error: err.message,
          tipe: p.tipe,
          jumlah: p.jumlah,
          catatan: p.catatan,
          kategori: p.kategori,
          sumber: sum.value,
          from
        });

        await sock.sendMessage(from, {
          text: `❌ *Gagal memproses transaksi!*\n\n` +
                `Error: ${err.message}\n\n` +
                `🔄 Silakan coba lagi atau cek:\n` +
                `• Koneksi internet\n` +
                `• Format input sudah benar\n` +
                `• Server tidak sedang maintenance`
        }, { quoted: msg });
      }
    });

    return true;
  }

  // ── Step tarik tunai: pilih sumber ──
  if (p.step === 'tarik_sumber') {
    if (text.toLowerCase() === 'batal') {
      clearPending(from);
      await sock.sendMessage(from, { text: '❌ Tarik tunai dibatalkan.' }, { quoted: msg });
      return true;
    }

    const sum = findTarikSumber(text);
    if (!sum) {
      await sock.sendMessage(from, {
        text: `❌ Pilihan tidak valid.\n\nPilih salah satu:\n\n${formatTarikSumberMenu()}\n\nKetik *batal* untuk membatalkan.`
      }, { quoted: msg });
      return true;
    }

    clearPending(from);

    await sock.sendMessage(from, {
      text: `🏧 Memproses tarik tunai...\n\n` +
            `💵 Jumlah: Rp ${parseInt(p.jumlah).toLocaleString('id-ID')}\n` +
            `📤 Dari  : ${sum.label}\n` +
            `📥 Ke    : 💵 Cash\n\n` +
            `⏳ Mohon tunggu sebentar...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        console.log(`🏧 Processing tarik tunai: Rp ${p.jumlah} dari ${sum.value}`);

        const result = await handleTarikTunai(p.jumlah, sum.value);

        await sock.sendMessage(from, { text: result }, { quoted: msg });
        console.log(`✅ Tarik tunai berhasil: Rp ${p.jumlah} dari ${sum.value}`);
      } catch (err) {
        console.error('[ERROR Handler Tarik Tunai]', {
          error: err.message,
          jumlah: p.jumlah,
          sumber: sum.value,
          from
        });

        await sock.sendMessage(from, {
          text: `❌ *Gagal memproses tarik tunai!*\n\n` +
                `Error: ${err.message}\n\n` +
                `🔄 Silakan coba lagi atau cek:\n` +
                `• Koneksi internet\n` +
                `• Saldo cukup\n` +
                `• Server tidak sedang maintenance`
        }, { quoted: msg });
      }
    });

    return true;
  }

  // ── Step setor tunai: pilih tujuan ──
  if (p.step === 'setor_tujuan') {
    if (text.toLowerCase() === 'batal') {
      clearPending(from);
      await sock.sendMessage(from, { text: '❌ Setor tunai dibatalkan.' }, { quoted: msg });
      return true;
    }

    const tujuan = findSetorTujuan(text);
    if (!tujuan) {
      await sock.sendMessage(from, {
        text: `❌ Pilihan tidak valid.\n\nPilih salah satu:\n\n${formatSetorTujuanMenu()}\n\nKetik *batal* untuk membatalkan.`
      }, { quoted: msg });
      return true;
    }

    clearPending(from);

    await sock.sendMessage(from, {
      text: `🏦 Memproses setor tunai...\n\n` +
            `💵 Jumlah: Rp ${parseInt(p.jumlah).toLocaleString('id-ID')}\n` +
            `📤 Dari  : 💵 Cash\n` +
            `📥 Ke    : ${tujuan.label}\n\n` +
            `⏳ Mohon tunggu sebentar...`
    }, { quoted: msg });

    queue.add(async () => {
      try {
        console.log(`🏦 Processing setor tunai: Rp ${p.jumlah} ke ${tujuan.value}`);

        const result = await handleSetorTunai(p.jumlah, tujuan.value);

        await sock.sendMessage(from, { text: result }, { quoted: msg });
        console.log(`✅ Setor tunai berhasil: Rp ${p.jumlah} ke ${tujuan.value}`);
      } catch (err) {
        console.error('[ERROR Handler Setor Tunai]', {
          error: err.message,
          jumlah: p.jumlah,
          tujuan: tujuan.value,
          from
        });

        await sock.sendMessage(from, {
          text: `❌ *Gagal memproses setor tunai!*\n\n` +
                `Error: ${err.message}\n\n` +
                `🔄 Silakan coba lagi atau cek:\n` +
                `• Saldo Cash cukup\n` +
                `• Koneksi internet\n` +
                `• Server tidak sedang maintenance`
        }, { quoted: msg });
      }
    });

    return true;
  }

  return false;
}

export default {
  command: ['!masuk', '!keluar', '!tarik', '!setor', '!ceksaldo'],

  async execute(sock, msg, queue, ADMIN_LIST = []) {
    const text = getMessageText(msg).trim();
    const lower = text.toLowerCase();
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    // ─── Khusus owner/admin saja ────────────────────────────────────────────
    if (!isAdmin(sender, ADMIN_LIST)) {
      // diam saja, tidak reply apa-apa
      return;
    }

    // ================== TRANSAKSI MASUK/KELUAR ==================
    if (lower.startsWith('!masuk ') || lower.startsWith('!keluar ')) {
      const isMasuk = lower.startsWith('!masuk ');
      const tipe = isMasuk ? 'masuk' : 'keluar';
      const emoji = isMasuk ? '💰' : '💸';

      const fullText = getMessageText(msg).trim();
      const parts = fullText.split(/\s+/);

      // Validasi format
      if (parts.length < 3) {
        return await sock.sendMessage(from, {
          text: `❌ *Format salah!*\n\n` +
                `📝 *Cara pakai:*\n` +
                `!${tipe} [jumlah] [catatan]\n\n` +
                `📌 *Contoh:*\n` +
                `• !${tipe} 150000 beli makan\n` +
                `• !${tipe} 50000 bayar listrik\n` +
                `• !${tipe} 1.500.000 gaji bulanan\n\n` +
                `_Setelah itu bot akan minta pilih kategori & sumber dana._`
        }, { quoted: msg });
      }

      // Parse jumlah (hapus titik pemisah ribuan)
      const jumlahRaw = parts[1].replace(/\./g, '').replace(/,/g, '');

      if (isNaN(jumlahRaw) || parseFloat(jumlahRaw) <= 0) {
        return await sock.sendMessage(from, {
          text: `❌ *Jumlah tidak valid!*\n\n` +
                `Jumlah harus berupa angka positif\n\n` +
                `📝 Contoh: !${tipe} 150000 catatan`
        }, { quoted: msg });
      }

      const catatan = parts.slice(2).join(' ').trim();

      if (catatan.length < 3) {
        return await sock.sendMessage(from, {
          text: `❌ *Catatan terlalu pendek!*\n\n` +
                `Catatan minimal 3 karakter\n\n` +
                `📝 Contoh: !${tipe} 25000 makan siang`
        }, { quoted: msg });
      }

      // Simpan pending & minta kategori
      setPending(from, {
        step: 'kategori',
        tipe,
        jumlah: jumlahRaw,
        catatan
      });

      await sock.sendMessage(from, {
        text: `${emoji} *Pilih kategori*\n\n` +
              `💵 Jumlah: Rp ${parseInt(jumlahRaw).toLocaleString('id-ID')}\n` +
              `📋 Catatan: ${catatan}\n\n` +
              `${formatKategoriMenu()}\n\n` +
              `_Ketik huruf (A–K) atau *batal*_`
      }, { quoted: msg });
      return;
    }

    // ================== TARIK TUNAI ==================
    if (lower.startsWith('!tarik ') || lower === '!tarik') {
      const fullText = getMessageText(msg).trim();
      const parts = fullText.split(/\s+/);

      if (parts.length < 2) {
        return await sock.sendMessage(from, {
          text: `❌ *Format salah!*\n\n` +
                `📝 *Cara pakai:*\n` +
                `!tarik [jumlah]\n\n` +
                `📌 *Contoh:*\n` +
                `• !tarik 100000\n` +
                `• !tarik 1.500.000\n\n` +
                `_Setelah itu bot akan minta pilih sumber dana (BCA/Mandiri)._`
        }, { quoted: msg });
      }

      const jumlahRaw = parts[1].replace(/\./g, '').replace(/,/g, '');

      if (isNaN(jumlahRaw) || parseFloat(jumlahRaw) <= 0) {
        return await sock.sendMessage(from, {
          text: `❌ *Jumlah tidak valid!*\n\n` +
                `Jumlah harus berupa angka positif\n\n` +
                `📝 Contoh: !tarik 100000`
        }, { quoted: msg });
      }

      setPending(from, {
        step: 'tarik_sumber',
        jumlah: jumlahRaw
      });

      await sock.sendMessage(from, {
        text: `🏧 *Tarik tunai ke Cash*\n\n` +
              `💵 Jumlah: Rp ${parseInt(jumlahRaw).toLocaleString('id-ID')}\n\n` +
              `*Pilih sumber dana*\n\n` +
              `${formatTarikSumberMenu()}\n\n` +
              `_Ketik huruf (A/B) atau *batal*_`
      }, { quoted: msg });
      return;
    }

    // ================== SETOR TUNAI ==================
    if (lower.startsWith('!setor ') || lower === '!setor') {
      const fullText = getMessageText(msg).trim();
      const parts = fullText.split(/\s+/);

      if (parts.length < 2) {
        return await sock.sendMessage(from, {
          text: `❌ *Format salah!*\n\n` +
                `📝 *Cara pakai:*\n` +
                `!setor [jumlah]\n\n` +
                `📌 *Contoh:*\n` +
                `• !setor 100000\n` +
                `• !setor 1.500.000\n\n` +
                `_Setelah itu bot akan minta pilih tujuan (BCA/Mandiri)._`
        }, { quoted: msg });
      }

      const jumlahRaw = parts[1].replace(/\./g, '').replace(/,/g, '');

      if (isNaN(jumlahRaw) || parseFloat(jumlahRaw) <= 0) {
        return await sock.sendMessage(from, {
          text: `❌ *Jumlah tidak valid!*\n\n` +
                `Jumlah harus berupa angka positif\n\n` +
                `📝 Contoh: !setor 100000`
        }, { quoted: msg });
      }

      setPending(from, {
        step: 'setor_tujuan',
        jumlah: jumlahRaw
      });

      await sock.sendMessage(from, {
        text: `🏦 *Setor tunai dari Cash*\n\n` +
              `💵 Jumlah: Rp ${parseInt(jumlahRaw).toLocaleString('id-ID')}\n\n` +
              `*Pilih tujuan dana*\n\n` +
              `${formatSetorTujuanMenu()}\n\n` +
              `_Ketik huruf (A/B) atau *batal*_`
      }, { quoted: msg });
      return;
    }

    // ================== CEK SALDO ==================
    if (lower === '!ceksaldo') {
      await sock.sendMessage(from, {
        text: '📊 Mengambil data keuangan...\n\n' +
              '⏳ Mohon tunggu sebentar...'
      }, { quoted: msg });

      queue.add(async () => {
        try {
          console.log('💳 Mengambil data saldo...');
          const result = await handleCekSaldo();
          await sock.sendMessage(from, { text: result }, { quoted: msg });
          console.log('✅ Data saldo berhasil diambil');
        } catch (err) {
          console.error('[ERROR Handler Saldo]', { error: err.message, from });
          await sock.sendMessage(from, {
            text: `❌ *Gagal mengambil data saldo!*\n\n` +
                  `Error: ${err.message}\n\n` +
                  `🔄 Silakan coba lagi atau cek:\n` +
                  `• Koneksi internet\n` +
                  `• Server tidak sedang maintenance\n` +
                  `• Kredensial login masih valid`
          }, { quoted: msg });
        }
      });
    }
  }
};