import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../config/.env') });

// Kredensial login
// PENTING: jangan hardcode default di sini, isi lewat .env saja.
const KEUANGAN_USERNAME = process.env.KEUANGAN_USERNAME;
const KEUANGAN_PASSWORD = process.env.KEUANGAN_PASSWORD;
const KEUANGAN_URL = 'https://rkdosystem.com/keuangan';

if (!KEUANGAN_USERNAME || !KEUANGAN_PASSWORD) {
  throw new Error(
    'KEUANGAN_USERNAME / KEUANGAN_PASSWORD belum di-set di .env. ' +
    'Isi dulu di config/.env sebelum menjalankan bot ini.'
  );
}

// Puppeteer config
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-extensions',
  '--disable-features=site-per-process',
  '--mute-audio',
];

// Sumber dana valid (harus persis sama dengan key $akunList di akun.php)
const SUMBER_VALID = ['cash', 'bca', 'mandiri'];
// Sumber yang boleh dipakai buat tarik tunai (gak bisa tarik dari cash ke cash)
const TARIK_SUMBER_VALID = ['bca', 'mandiri'];
// Tujuan setor tunai (Cash -> BCA/Mandiri), sama dengan pilihan di form "Setor tunai" index.php
const SETOR_TUJUAN_VALID = ['bca', 'mandiri'];

// ─── Helper baru untuk versi web terbaru ────────────────────────────────────

// index.php sekarang punya validasi client-side yang memanggil alert() kalau saldo
// gak cukup / nominal kosong, lalu e.preventDefault(). Di Puppeteer, alert() yang
// gak ditangani bikin halaman "beku" (page.evaluate menggantung) dan submit gak
// pernah jalan. Jadi dialog harus ditangkap SEBELUM klik submit, pesannya dipakai
// sebagai pesan error ke user.
function pantauDialog(page) {
  const state = { messages: [] };
  state.promise = new Promise((resolve) => {
    page.on('dialog', async (dialog) => {
      state.messages.push(dialog.message());
      await dialog.accept().catch(() => {});
      resolve();
    });
  });
  return state;
}

// Klik tombol submit, lalu tunggu navigasi ATAU dialog (mana yang duluan).
// Kalau dialog muncul, artinya form ditolak di sisi client → lempar error.
async function klikSubmit(page, selector, dialogState) {
  const nav = page
    .waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    .catch(() => null);

  await page.click(selector);
  await Promise.race([nav, dialogState.promise]);

  if (dialogState.messages.length > 0) {
    throw new Error(dialogState.messages[0]);
  }
}

// Buka dashboard bulan berjalan. index.php tanpa ?bulan&tahun akan redirect ke
// bulan sekarang, dan goto() otomatis mengikuti redirect itu.
async function bukaDashboard(page) {
  await page.goto(`${KEUANGAN_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('[data-field="saldo-akhir"]', { timeout: 10000 });
}

// Jumlah transaksi bulan ini (badge di hero) — dipakai buat memastikan submit
// benar-benar menambah baris (tarik/setor = +2, transaksi biasa = +1).
async function bacaJumlahTransaksi(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-field="jumlah-transaksi"]');
    return el ? Number(el.dataset.value) : null;
  });
}

// Pilih <select> dan VERIFIKASI value-nya benar-benar ke-set.
// page.select() Puppeteer tidak error kalau value tidak match — dia diam saja
// dan browser bisa fallback ke option pertama (biasanya "Cash"). Ini yang bikin
// kadang sumber "BCA" kepilih malah kesimpen sebagai "Cash" di sistem.
async function selectAndVerify(page, selector, expectedValue, label, anchorSelector = null) {
  await page.waitForSelector(selector, { timeout: 10000, visible: true });

  // PENTING: ternyata ada DUA <select name="sumber"> dan KEDUANYA di dalam
  // <form> (satu di form "Update Gaji", satu di form transaksi masuk/keluar) —
  // jadi heuristik ".closest('form')" saja TIDAK cukup untuk membedakan.
  // page.select() Puppeteer ambil elemen PERTAMA yang match di DOM tanpa
  // peduli form mana; kalau itu form gaji (karena urutannya duluan di
  // halaman), verifikasi lokal ikut baca elemen yang sama dan "berhasil",
  // padahal select di form transaksi tidak pernah berubah.
  //
  // Solusinya: pakai elemen unik terdekat sebagai "jangkar" (anchorSelector).
  // Untuk sumber di form transaksi, jangkarnya select[name="kategori"] —
  // elemen itu cuma ada satu di halaman dan bersebelahan (sibling) dengan
  // select[name="sumber"] yang benar. Kita cari ancestor terdekat yang
  // memuat jangkar itu SEKALIGUS salah satu elemen target.
  const marker = `data-bot-target-${Math.random().toString(36).slice(2, 8)}`;

  const found = await page.evaluate((sel, marker, anchorSel) => {
    const els = Array.from(document.querySelectorAll(sel));
    let target = null;

    if (anchorSel) {
      const anchor = document.querySelector(anchorSel);
      if (anchor) {
        let node = anchor.parentElement;
        while (node && !target) {
          target = els.find(e => node.contains(e));
          node = node.parentElement;
        }
      }
    }

    if (!target) target = els.find(e => e.closest('form')) || els[0];
    if (!target) return { found: false, count: els.length };
    target.setAttribute(marker, '1');
    return { found: true, count: els.length };
  }, selector, marker, anchorSelector);

  if (!found.found) {
    throw new Error(`Elemen "${selector}" tidak ditemukan di halaman untuk ${label}.`);
  }
  if (found.count > 1) {
    console.warn(`⚠️ ${label}: ditemukan ${found.count} elemen "${selector}" di halaman (duplikat). Pakai yang di dalam <form>.`);
  }

  const scopedSelector = `[${marker}]`;

  await page.select(scopedSelector, expectedValue);

  let actual = await page.$eval(scopedSelector, el => el.value);

  if (actual !== expectedValue) {
    console.warn(`⚠️ ${label}: page.select gagal set value (dapat "${actual}", mau "${expectedValue}"). Mencoba force-set...`);

    // Paksa set langsung ke DOM + trigger event, kalau-kalau option value
    // tidak exact match (spasi/huruf besar-kecil dsb).
    actual = await page.evaluate((sel, val) => {
      const target = document.querySelector(sel);
      if (!target) return null;

      const opt = Array.from(target.options).find(
        o => o.value === val || o.value.toLowerCase() === String(val).toLowerCase()
      );
      if (opt) {
        target.value = opt.value;
      } else {
        target.value = val;
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return target.value;
    }, scopedSelector, expectedValue);
  }

  // Bersihkan marker biar gak numpuk di DOM kalau fungsi ini dipanggil berkali-kali.
  await page.evaluate((sel, marker) => {
    const el = document.querySelector(sel);
    if (el) el.removeAttribute(marker);
  }, scopedSelector, marker);

  if (actual !== expectedValue) {
    throw new Error(
      `Gagal set ${label} ke "${expectedValue}" (halaman malah pakai "${actual}"). ` +
      `Kemungkinan value option di form beda dengan yang dikirim bot, atau ada elemen "${selector}" duplikat di halaman.`
    );
  }

  console.log(`✅ ${label} terkonfirmasi: ${actual}`);
  return actual;
}

// Login ke sistem keuangan
async function login(page) {
  console.log('🔐 Login ke sistem keuangan...');

  await page.goto(`${KEUANGAN_URL}/login.php`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await page.type('input[name="username"]', KEUANGAN_USERNAME);
  await page.type('input[name="password"]', KEUANGAN_PASSWORD);

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);

  console.log('✅ Login berhasil');
}

// Ambil tanggal hari ini (YYYY-MM-DD) sesuai timezone Jakarta
function todayISO() {
  const now = new Date();
  // Asia/Jakarta = UTC+7
  const jakarta = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const y = jakarta.getFullYear();
  const m = String(jakarta.getMonth() + 1).padStart(2, '0');
  const d = String(jakarta.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Ambil semua data keuangan dari halaman (desain baru)
async function ambilDataKeuangan(page) {
  const data = await page.evaluate(() => {
    const getField = (name) => document.querySelector(`[data-field="${name}"]`);
    const getValue = (name, fallback = 0) => {
      const el = getField(name);
      return el ? Number(el.dataset.value) : fallback;
    };
    const getText = (name, fallback = '') => {
      const el = getField(name);
      return el ? el.textContent.trim() : fallback;
    };

    // Periode
    const periodeEl = getField('periode');
    let periode = '';
    if (periodeEl) {
      // contoh: "AGUSTUS 2026 · SALDO AKHIR" → ambil bagian depan
      periode = (periodeEl.textContent || '').split('·')[0].trim();
    } else {
      const bulanSelect = document.querySelector('select[name="bulan"]');
      const tahunSelect = document.querySelector('select[name="tahun"]');
      const bulanLabel = bulanSelect ? bulanSelect.options[bulanSelect.selectedIndex]?.text : '';
      const tahun = tahunSelect ? tahunSelect.value : '';
      periode = `${bulanLabel} ${tahun}`.trim();
    }

    const saldoAkhir = getValue('saldo-akhir');
    const jumlahTransaksi = getValue('jumlah-transaksi');
    const statusEl = getField('status');
    const status = statusEl ? (statusEl.dataset.status || 'aman') : (saldoAkhir >= 0 ? 'aman' : 'waspada');

    const perHariEl = getField('per-hari');
    const perHari = perHariEl ? Number(perHariEl.dataset.value) : null;
    const sisaHariEl = getField('sisa-hari');
    const sisaHari = sisaHariEl ? Number(sisaHariEl.dataset.value) : null;

    // Pesan error (misal saldo gak cukup) — kalau ada, artinya transaksi TIDAK tersimpan.
    // Butuh atribut data-field="error-message" di banner error index.php.
    const errorEl = getField('error-message');
    const errorMessage = errorEl ? errorEl.textContent.trim() : null;

    // Saldo per sumber (Cash / BCA / Mandiri) — scrape dari card
    // Struktur: <p class="eyebrow">Saldo Cash</p> lalu sibling <p class="font-num ...">Rp200.000</p>
    const parseRp = (txt) => {
      if (!txt) return 0;
      const cleaned = String(txt).replace(/[^\d,-]/g, '').replace(/\./g, '').replace(/,/g, '');
      const n = Number(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const saldoSumber = { cash: 0, bca: 0, mandiri: 0 };

    // Cara utama (akurat): atribut data-field="saldo-akun" data-akun="cash|bca|mandiri"
    // data-value="..." di <p> saldo tiap akun (lihat perubahan kecil di index.php).
    const saldoEls = Array.from(document.querySelectorAll('[data-field="saldo-akun"]'));
    let dapatDariAtribut = false;
    for (const el of saldoEls) {
      const key = el.dataset.akun;
      if (key in saldoSumber) {
        saldoSumber[key] = Number(el.dataset.value) || 0;
        dapatDariAtribut = true;
      }
    }

    // Fallback kalau atribut belum dipasang di index.php: scrape card saldo.
    // FIX: sebelumnya SEMUA .card dengan eyebrow yg mengandung "cash" ikut ke-match,
    // termasuk card "Tarik tunai" (eyebrow "Ke Cash") & "Setor tunai" ("Dari Cash").
    // Di card itu .font-num adalah <input>, jadi saldo Cash tertimpa jadi 0.
    // Sekarang hanya eyebrow yang diawali "saldo " dan amount dari <p>.
    if (!dapatDariAtribut) {
      const cards = Array.from(document.querySelectorAll('.card'));
      for (const card of cards) {
        const eyebrow = card.querySelector('.eyebrow');
        if (!eyebrow) continue;
        const label = (eyebrow.textContent || '').trim().toLowerCase();
        if (!label.startsWith('saldo ')) continue;
        const amountEl = card.querySelector('p.font-num');
        const amountText = amountEl ? amountEl.textContent : '';
        if (label.includes('cash')) saldoSumber.cash = parseRp(amountText);
        else if (label.includes('bca')) saldoSumber.bca = parseRp(amountText);
        else if (label.includes('mandiri')) saldoSumber.mandiri = parseRp(amountText);
      }
    }

    // Fallback terakhir: cari text "Saldo Cash" di mana saja
    if (saldoSumber.cash === 0 && saldoSumber.bca === 0 && saldoSumber.mandiri === 0) {
      const allText = document.body.innerText || '';
      const matchCash = allText.match(/Saldo Cash[\s\S]*?Rp\s*([\d.]+)/i);
      const matchBca = allText.match(/Saldo BCA[\s\S]*?Rp\s*([\d.]+)/i);
      const matchMandiri = allText.match(/Saldo Mandiri[\s\S]*?Rp\s*([\d.]+)/i);
      if (matchCash) saldoSumber.cash = parseRp(matchCash[1]);
      if (matchBca) saldoSumber.bca = parseRp(matchBca[1]);
      if (matchMandiri) saldoSumber.mandiri = parseRp(matchMandiri[1]);
    }

    // Transaksi terbaru (jika masih ada data-transaksi)
    const rows = Array.from(document.querySelectorAll('[data-transaksi]')).slice(0, 5);
    const transaksiTerbaru = rows.map(row => ({
      id: row.dataset.id,
      tipe: row.dataset.tipe,
      jumlah: Number(row.dataset.jumlah),
      catatan: row.dataset.catatan,
      tanggal: row.dataset.tanggal,
      kategori: row.dataset.kategori || '',
      sumber: row.dataset.sumber || ''
    }));

    // Angka lain (opsional, kalau masih ada)
    const saldoSebelumnya = getValue('saldo-sebelumnya');
    const gaji = getValue('gaji');
    const pemasukan = getValue('pemasukan');
    const pengeluaran = getValue('pengeluaran');

    return {
      periode,
      saldoAkhir,
      jumlahTransaksi,
      status,
      perHari,
      sisaHari,
      errorMessage,
      saldoSumber,
      saldoSebelumnya,
      gaji,
      pemasukan,
      pengeluaran,
      transaksiTerbaru
    };
  });

  console.log('[DATA KEUANGAN]', data);
  return data;
}

// Helper format Rupiah
function rp(angka) {
  return Number(angka).toLocaleString('id-ID');
}

const STATUS_LABEL = {
  sangat_aman: { emoji: '✅', text: 'Sangat Aman' },
  aman:        { emoji: '✅', text: 'Aman' },
  perhatian:   { emoji: '🟡', text: 'Perlu Perhatian' },
  waspada:     { emoji: '🔴', text: 'Waspada' },
};

function formatStatusLine(data) {
  const s = STATUS_LABEL[data.status] || STATUS_LABEL.aman;
  let line = `${s.emoji} Status: ${s.text}`;
  if (data.perHari !== null && data.sisaHari !== null) {
    line += ` (≈ Rp ${rp(data.perHari)}/hari, ${data.sisaHari} hari tersisa)`;
  }
  return line;
}

// Format output setelah transaksi berhasil
function formatOutputTransaksi(tipe, jumlah, catatan, kategori, sumber, data) {
  const emoji = tipe === 'masuk' ? '💰' : '💸';
  const tipeName = tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran';

  const sumberLabel = {
    cash: '💵 Cash',
    bca: '🔵 BCA',
    mandiri: '🟡 Mandiri'
  }[sumber] || sumber;

  let output = `${emoji} *TRANSAKSI BERHASIL DITAMBAH*\n\n`;
  output += `📝 Jenis: ${tipeName}\n`;
  output += `💵 Jumlah: Rp ${parseInt(jumlah).toLocaleString('id-ID')}\n`;
  output += `📋 Catatan: ${catatan.toUpperCase()}\n`;
  output += `🏷️ Kategori: ${kategori}\n`;
  output += `💳 Sumber: ${sumberLabel}\n`;
  output += `📅 Periode: ${data.periode}\n\n`;

  output += `💰 *SALDO AKHIR: Rp ${rp(data.saldoAkhir)}*\n`;
  output += `${formatStatusLine(data)}\n\n`;

  // Saldo per sumber
  if (data.saldoSumber) {
    output += `📊 *SALDO PER SUMBER*\n`;
    output += `💵 Cash     : Rp ${rp(data.saldoSumber.cash)}\n`;
    output += `🔵 BCA      : Rp ${rp(data.saldoSumber.bca)}\n`;
    output += `🟡 Mandiri  : Rp ${rp(data.saldoSumber.mandiri)}\n`;
  }

  if (data.transaksiTerbaru && data.transaksiTerbaru.length > 0) {
    output += `\n📋 *TRANSAKSI TERBARU*\n`;
    data.transaksiTerbaru.forEach((trx, index) => {
      const tanda = trx.tipe === 'masuk' ? '+' : '-';
      output += `${index + 1}. ${trx.catatan} | ${tanda}Rp ${rp(trx.jumlah)} | ${trx.tanggal || ''}\n`;
    });
  }

  return output;
}

// Format output cek saldo
function formatOutputSaldo(data) {
  let output = `💰 *LAPORAN KEUANGAN ${data.periode.toUpperCase()}*\n\n`;

  output += `💰 *SALDO AKHIR: Rp ${rp(data.saldoAkhir)}*\n`;
  output += `${formatStatusLine(data)}\n`;
  if (data.jumlahTransaksi != null) {
    output += `🧾 ${data.jumlahTransaksi} transaksi bulan ini\n`;
  }
  output += `\n`;

  // Saldo per sumber (utama yang diminta)
  output += `📊 *SALDO PER SUMBER*\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `💵 Cash     : Rp ${rp(data.saldoSumber?.cash ?? 0)}\n`;
  output += `🔵 BCA      : Rp ${rp(data.saldoSumber?.bca ?? 0)}\n`;
  output += `🟡 Mandiri  : Rp ${rp(data.saldoSumber?.mandiri ?? 0)}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // Ringkasan tambahan kalau masih ada datanya
  if (data.saldoSebelumnya || data.gaji || data.pemasukan || data.pengeluaran) {
    output += `\n📈 *RINGKASAN*\n`;
    if (data.saldoSebelumnya) output += `💳 Saldo Sebelumnya: Rp ${rp(data.saldoSebelumnya)}\n`;
    if (data.gaji) output += `💼 Gaji Bulan Ini: Rp ${rp(data.gaji)}\n`;
    if (data.pemasukan) output += `📈 Total Pemasukan: Rp ${rp(data.pemasukan)}\n`;
    if (data.pengeluaran) output += `📉 Total Pengeluaran: Rp ${rp(data.pengeluaran)}\n`;
  }

  if (data.transaksiTerbaru && data.transaksiTerbaru.length > 0) {
    output += `\n📋 *TRANSAKSI TERBARU*\n`;
    data.transaksiTerbaru.forEach((trx, index) => {
      const tanda = trx.tipe === 'masuk' ? '+' : '-';
      output += `${index + 1}. ${trx.catatan}\n   ${tanda}Rp ${rp(trx.jumlah)} | ${trx.tanggal || ''}\n`;
    });
  }

  output += `\n📱 Akses lengkap: ${KEUANGAN_URL}/`;

  return output;
}

// Format output tarik tunai
function formatOutputTarikTunai(jumlah, sumberTarik, data) {
  const sumberLabel = {
    bca: '🔵 BCA',
    mandiri: '🟡 Mandiri'
  }[sumberTarik] || sumberTarik;

  let output = `🏧 *TARIK TUNAI BERHASIL*\n\n`;
  output += `💵 Jumlah: Rp ${rp(jumlah)}\n`;
  output += `📤 Dari  : ${sumberLabel}\n`;
  output += `📥 Ke    : 💵 Cash\n`;
  output += `📅 Periode: ${data.periode}\n\n`;

  output += `📊 *SALDO PER SUMBER*\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `💵 Cash     : Rp ${rp(data.saldoSumber?.cash ?? 0)}\n`;
  output += `🔵 BCA      : Rp ${rp(data.saldoSumber?.bca ?? 0)}\n`;
  output += `🟡 Mandiri  : Rp ${rp(data.saldoSumber?.mandiri ?? 0)}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return output;
}

// Format output setor tunai
function formatOutputSetorTunai(jumlah, tujuanSetor, data) {
  const tujuanLabel = {
    bca: '🔵 BCA',
    mandiri: '🟡 Mandiri'
  }[tujuanSetor] || tujuanSetor;

  let output = `🏦 *SETOR TUNAI BERHASIL*\n\n`;
  output += `💵 Jumlah: Rp ${rp(jumlah)}\n`;
  output += `📤 Dari  : 💵 Cash\n`;
  output += `📥 Ke    : ${tujuanLabel}\n`;
  output += `📅 Periode: ${data.periode}\n\n`;

  output += `📊 *SALDO PER SUMBER*\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `💵 Cash     : Rp ${rp(data.saldoSumber?.cash ?? 0)}\n`;
  output += `🔵 BCA      : Rp ${rp(data.saldoSumber?.bca ?? 0)}\n`;
  output += `🟡 Mandiri  : Rp ${rp(data.saldoSumber?.mandiri ?? 0)}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return output;
}

/**
 * Handle transaksi keuangan (form baru: tipe, jumlah, catatan, kategori, sumber, tanggal)
 */
export async function handleTransaksiKeuangan(tipe, jumlah, catatan, kategori, sumber) {
  if (!SUMBER_VALID.includes(sumber)) {
    throw new Error(`Sumber dana tidak valid: "${sumber}".`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS,
  });

  const page = await browser.newPage();
  const dialogState = pantauDialog(page);

  try {
    await login(page);

    // Pastikan berada di dashboard bulan berjalan (index.php redirect ke ?bulan&tahun)
    await bukaDashboard(page);
    const jumlahSebelum = await bacaJumlahTransaksi(page);

    console.log(`💰 Menambah transaksi ${tipe}...`);

    // Pilih tipe
    await selectAndVerify(page, 'select[name="tipe"]', tipe, 'Tipe');

    // Isi jumlah
    const jumlahInput = await page.$('input[name="jumlah"]');
    if (jumlahInput) {
      await jumlahInput.click({ clickCount: 3 });
      await jumlahInput.type(jumlah.toString(), { delay: 20 });
    } else {
      await page.type('input[name="jumlah"]', jumlah.toString());
    }

    // Isi catatan
    await page.type('input[name="catatan"]', catatan);

    // Set tanggal hari ini
    const tanggal = todayISO();
    await page.evaluate((tgl) => {
      const el = document.querySelector('input[name="tanggal"]');
      if (el) {
        el.value = tgl;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, tanggal);

    // Pilih kategori
    await selectAndVerify(page, 'select[name="kategori"]', kategori, 'Kategori');

    // Pilih sumber — pakai select[name="kategori"] sebagai jangkar karena
    // ada select[name="sumber"] lain di form "Update Gaji" pada halaman
    // yang sama.
    await selectAndVerify(page, 'select[name="sumber"]', sumber, 'Sumber dana', 'select[name="kategori"]');

    // Submit (kalau validasi client-side menolak, klikSubmit melempar pesan alert-nya)
    await klikSubmit(page, 'button[name="submit_transaksi"]', dialogState);

    // Tunggu sebentar biar data refresh
    await new Promise(r => setTimeout(r, 1500));

    const dataKeuangan = await ambilDataKeuangan(page);

    // Kalau PHP redirect balik dengan pesan error (misal saldo gak cukup),
    // transaksi PASTI tidak tersimpan — jangan lapor sukses.
    if (dataKeuangan.errorMessage) {
      throw new Error(dataKeuangan.errorMessage);
    }

    // Pastikan jumlah transaksi benar-benar bertambah 1
    if (jumlahSebelum !== null && dataKeuangan.jumlahTransaksi !== jumlahSebelum + 1) {
      throw new Error(
        `Transaksi kemungkinan tidak tersimpan (jumlah transaksi ${jumlahSebelum} → ${dataKeuangan.jumlahTransaksi}). Cek manual di web.`
      );
    }

    // ===== VERIFIKASI ANTI "RANDOM" =====
    // DOM select yang benar TIDAK menjamin PHP menyimpan value yang sama persis
    // (index.php diam-diam fallback ke default kalau $_POST['sumber']/['kategori']
    // gak match array_key_exists). Makanya kita cek ulang transaksi yang BARU MASUK
    // (baris teratas riwayat) beneran sesuai sama yang diminta. Kalau tidak,
    // kita anggap ini kegagalan dan kasih tau jelas, bukan lapor sukses palsu.
    const top = dataKeuangan.transaksiTerbaru?.[0];
    if (top) {
      const mismatches = [];
      if (top.tipe !== tipe) mismatches.push(`tipe (minta "${tipe}", tersimpan "${top.tipe}")`);
      if (String(top.jumlah) !== String(parseInt(jumlah, 10))) mismatches.push(`jumlah (minta ${jumlah}, tersimpan ${top.jumlah})`);
      if (top.kategori && top.kategori !== kategori) mismatches.push(`kategori (minta "${kategori}", tersimpan "${top.kategori}")`);
      if (top.sumber && top.sumber !== sumber) mismatches.push(`sumber (minta "${sumber}", tersimpan "${top.sumber}")`);

      if (mismatches.length > 0) {
        throw new Error(
          `Transaksi kesimpen tapi datanya BEDA dari yang diminta: ${mismatches.join(', ')}. ` +
          `Cek & benerin manual di web, lalu coba lagi.`
        );
      }
    }

    console.log('✅ Transaksi berhasil ditambahkan & terverifikasi sesuai');
    return formatOutputTransaksi(tipe, jumlah, catatan, kategori, sumber, dataKeuangan);

  } catch (err) {
    console.error('[ERROR transaksi keuangan]', err.message);
    throw new Error(`Gagal memproses transaksi: ${err.message}`);
  } finally {
    await browser.close();
  }
}

/**
 * Proses umum transfer tunai lewat form di dashboard.
 * Dipakai oleh tarik tunai (BCA/Mandiri -> Cash) dan setor tunai (Cash -> BCA/Mandiri).
 * Keduanya bikin 2 baris transaksi kategori "Transfer Internal" (keluar + masuk).
 */
async function prosesTransferTunai({ jumlah, akun, inputName, selectName, buttonName, labelSelect, catatanPrefix, cekPasangan }) {
  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS
  });

  const page = await browser.newPage();
  const dialogState = pantauDialog(page);

  try {
    await login(page);
    await bukaDashboard(page);
    const jumlahSebelum = await bacaJumlahTransaksi(page);

    // Isi nominal
    await page.waitForSelector(`input[name="${inputName}"]`, { timeout: 10000, visible: true });
    const jumlahInput = await page.$(`input[name="${inputName}"]`);
    await jumlahInput.click({ clickCount: 3 });
    await jumlahInput.type(jumlah.toString(), { delay: 20 });

    // Pilih akun (sumber tarik / tujuan setor)
    await selectAndVerify(page, `select[name="${selectName}"]`, akun, labelSelect);

    // Submit
    await klikSubmit(page, `button[name="${buttonName}"]`, dialogState);
    await new Promise(r => setTimeout(r, 1500));

    const dataKeuangan = await ambilDataKeuangan(page);

    if (dataKeuangan.errorMessage) {
      throw new Error(dataKeuangan.errorMessage);
    }

    // Verifikasi 1: jumlah transaksi harus bertambah 2 (keluar + masuk)
    if (jumlahSebelum !== null && dataKeuangan.jumlahTransaksi !== jumlahSebelum + 2) {
      throw new Error(
        `Transfer kemungkinan gagal tersimpan (jumlah transaksi ${jumlahSebelum} → ${dataKeuangan.jumlahTransaksi}). Cek manual di web, lalu coba lagi.`
      );
    }

    // Verifikasi 2: 2 baris teratas harus pasangan keluar/masuk Transfer Internal
    // dengan akun & nominal yang benar. (Urutan riwayat: tanggal DESC, id DESC,
    // jadi baris "masuk" (insert kedua) tampil di atas baris "keluar".)
    const [a, b] = dataKeuangan.transaksiTerbaru || [];
    const semuaTransferInternal = [a, b].every(t =>
      t && t.kategori === 'Transfer Internal' &&
      String(t.catatan || '').toUpperCase().startsWith(catatanPrefix) &&
      String(t.jumlah) === String(parseInt(jumlah, 10))
    );
    if (!semuaTransferInternal || !cekPasangan(a, b, akun)) {
      throw new Error(
        'Transfer kemungkinan tersimpan tidak sesuai — 2 transaksi terbaru tidak cocok dengan yang diminta. Cek manual di web.'
      );
    }

    return dataKeuangan;
  } finally {
    await browser.close();
  }
}

/**
 * Handle tarik tunai (BCA/Mandiri -> Cash), pakai form "Tarik Tunai" di halaman utama
 */
export async function handleTarikTunai(jumlah, sumberTarik) {
  if (!TARIK_SUMBER_VALID.includes(sumberTarik)) {
    throw new Error(`Sumber dana tarik tunai tidak valid: "${sumberTarik}". Pilih bca atau mandiri.`);
  }

  try {
    console.log(`🏧 Menarik tunai dari ${sumberTarik} ke cash...`);
    const data = await prosesTransferTunai({
      jumlah,
      akun: sumberTarik,
      inputName: 'jumlah_tarik',
      selectName: 'sumber_tarik',
      buttonName: 'tarik_uang',
      labelSelect: 'Sumber tarik tunai',
      catatanPrefix: 'TARIK TUNAI DARI',
      // masuk ke cash + keluar dari akun asal
      cekPasangan: (a, b, akun) =>
        a.tipe === 'masuk' && a.sumber === 'cash' && b.tipe === 'keluar' && b.sumber === akun
    });
    console.log('✅ Tarik tunai berhasil & terverifikasi');
    return formatOutputTarikTunai(jumlah, sumberTarik, data);
  } catch (err) {
    console.error('[ERROR tarik tunai]', err.message);
    throw new Error(`Gagal tarik tunai: ${err.message}`);
  }
}

/**
 * Handle setor tunai (Cash -> BCA/Mandiri), pakai form "Setor Tunai" di halaman utama
 */
export async function handleSetorTunai(jumlah, tujuanSetor) {
  if (!SETOR_TUJUAN_VALID.includes(tujuanSetor)) {
    throw new Error(`Tujuan setor tunai tidak valid: "${tujuanSetor}". Pilih bca atau mandiri.`);
  }

  try {
    console.log(`💵 Setor tunai dari cash ke ${tujuanSetor}...`);
    const data = await prosesTransferTunai({
      jumlah,
      akun: tujuanSetor,
      inputName: 'jumlah_setor',
      selectName: 'tujuan_setor',
      buttonName: 'setor_tunai',
      labelSelect: 'Tujuan setor tunai',
      catatanPrefix: 'SETOR TUNAI KE',
      // masuk ke akun tujuan + keluar dari cash
      cekPasangan: (a, b, akun) =>
        a.tipe === 'masuk' && a.sumber === akun && b.tipe === 'keluar' && b.sumber === 'cash'
    });
    console.log('✅ Setor tunai berhasil & terverifikasi');
    return formatOutputSetorTunai(jumlah, tujuanSetor, data);
  } catch (err) {
    console.error('[ERROR setor tunai]', err.message);
    throw new Error(`Gagal setor tunai: ${err.message}`);
  }
}

/**
 * Handle cek saldo
 */
export async function handleCekSaldo() {
  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS
  });

  const page = await browser.newPage();

  try {
    await login(page);

    console.log('📊 Mengambil data keuangan...');
    // Pastikan di halaman utama (bulan berjalan)
    await bukaDashboard(page);

    const dataKeuangan = await ambilDataKeuangan(page);

    console.log('✅ Data keuangan berhasil diambil');
    return formatOutputSaldo(dataKeuangan);

  } catch (err) {
    console.error('[ERROR cek saldo]', err.message);
    throw new Error(`Gagal mengambil saldo: ${err.message}`);
  } finally {
    await browser.close();
  }
}