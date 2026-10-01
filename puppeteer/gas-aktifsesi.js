import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../config/.env') });

// ---------- helpers tanggal (format dd-mm-yyyy) ----------
function parseDDMMYYYY(str) {
  if (!str) return null;
  const match = str.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
}

function formatDDMMYYYY(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function diffInDays(dateA, dateB) {
  const ms = dateB.getTime() - dateA.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export async function handleAktifSesiCommand(cabang, link, sock) {
  console.log(`[PROCESS] AktifSesi : Cabang=${cabang}, Link=${link}`);

  if (!link.includes('sesi-pelatih-view-detail')) {
    return '❌ Link salah, harus link "sesi-pelatih-view-detail" (halaman detail sesi PT).';
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
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
    ],
  });

  const page = await browser.newPage();

  page.on('dialog', async dialog => {
    // confirm() "You sure...?" dan alert() "PROSES SELESAI" -> tinggal klik OK aja
    await dialog.accept();
  });

  try {
    console.log('[STEP] Login ke sistem...');
    await page.goto('https://houseofmetamorfit.ampabatech.com/index.php', { waitUntil: 'networkidle2' });
    await page.type('input[name="namapengguna"]', process.env.USERNAME);
    await page.type('input[name="katasandi"]', process.env.PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const cabangId = cabangMap[cabang.toLowerCase()];
    console.log(`[INFO] Cabang ID: ${cabangId}`);

    await page.goto(`https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, { waitUntil: 'networkidle2' });

    // ---------- STEP 1: buka halaman detail sesi ----------
    console.log('[STEP] Membuka halaman detail sesi...');
    await page.goto(link, { waitUntil: 'networkidle2' });

    const detail = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const result = {};
      for (const row of rows) {
        const tds = row.querySelectorAll('td');
        if (tds.length < 2) continue;
        const label = tds[0].textContent.trim().toLowerCase();
        const value = tds[1].textContent.trim();
        if (label.includes('tanggal transaksi')) result.tanggalTransaksi = value;
        if (label.includes('jumlah sesi')) result.jumlahSesi = value;
        if (label.includes('sisa sesi')) result.sisaSesi = value;
        if (label.includes('nama member')) result.namaMember = value;
      }
      return result;
    });

    console.log('[INFO] Detail sesi:', detail);

    if (!detail.tanggalTransaksi || detail.jumlahSesi === undefined || detail.sisaSesi === undefined) {
      await browser.close();
      return '❌ Gagal baca data sesi dari halaman, cek link-nya ya.';
    }

    const jumlahSesi = parseInt(detail.jumlahSesi, 10);
    const sisaSesi = parseInt(detail.sisaSesi, 10);
    const tanggalTransaksi = parseDDMMYYYY(detail.tanggalTransaksi);

    if (!tanggalTransaksi) {
      await browser.close();
      return `❌ Gagal parse Tanggal Transaksi (${detail.tanggalTransaksi})`;
    }

    // Aturan: sisa sesi harus SAMA dengan jumlah sesi (belum kepake sama sekali). Kalau kurang = tolak.
    if (sisaSesi < jumlahSesi) {
      await browser.close();
      return `❌ *${detail.namaMember || ''}*\nSesi expired, silahkan minta manual ke grup.\n(Sisa ${sisaSesi}/${jumlahSesi})`;
    }

    // ---------- STEP 2: buka halaman extend (ex) ----------
    const exLink = link.replace('sesi-pelatih-view-detail', 'sesi-pelatih-ex');
    console.log('[STEP] Membuka halaman extend sesi...', exLink);
    await page.goto(exLink, { waitUntil: 'networkidle2' });

    await page.waitForSelector('input[name="mulaiaktif"]', { timeout: 15000 });
    const mulaiAktifValue = await page.$eval('input[name="mulaiaktif"]', el => el.value);
    console.log('[INFO] Nilai mulaiaktif saat ini:', mulaiAktifValue);

    const mulaiAktifDate = parseDDMMYYYY(mulaiAktifValue);
    if (!mulaiAktifDate) {
      await browser.close();
      return `❌ Gagal parse tanggal "Mulai Aktif" (${mulaiAktifValue})`;
    }

    const selisihHari = diffInDays(tanggalTransaksi, mulaiAktifDate);
    console.log(`[INFO] Selisih hari (mulaiaktif - tanggal transaksi): ${selisihHari}`);

    if (selisihHari > 90) {
      await browser.close();
      return `❌ *${detail.namaMember || ''}*\nSudah lewat delay 3 bulan, silahkan minta manual ke grup.\n(Tanggal transaksi: ${detail.tanggalTransaksi}, Mulai aktif: ${mulaiAktifValue}, selisih ${selisihHari} hari)`;
    }

    // ---------- STEP 3: belum lewat 90 hari -> update tanggal ke hari ini ----------
    const today = new Date();
    const todayStr = formatDDMMYYYY(today);
    console.log(`[STEP] Update tanggal mulaiaktif ke hari ini: ${todayStr}`);

    await page.evaluate((value) => {
      const el = document.querySelector('input[name="mulaiaktif"]');
      if (!el) return;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.datepicker) {
        try { window.jQuery(el).datepicker('update', value); } catch (e) { /* ignore */ }
      }
    }, todayStr);

    // ---------- STEP 4: klik Simpan (akan trigger confirm() lalu alert()) ----------
    console.log('[STEP] Klik tombol Simpan...');
    const simpanBtn = await page.$('button[name="simpan"]');
    if (!simpanBtn) {
      await browser.close();
      return '❌ Tombol Simpan tidak ditemukan!';
    }

    await simpanBtn.click();

    // Klik Simpan -> confirm() muncul -> auto accept -> submit -> alert() "PROSES SELESAI" -> auto accept -> selesai
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    } catch (navError) {
      // Beberapa kasus submit via AJAX tanpa full navigation, jadi ini bukan fatal error
      console.log('[INFO] Tidak ada navigasi penuh setelah simpan (mungkin AJAX):', navError.message);
    }

    console.log('[INFO] Proses simpan selesai.');
    await browser.close();

    return {
      cabangName: cabang.toUpperCase(),
      namaMember: detail.namaMember || '',
      tanggalTransaksi: detail.tanggalTransaksi,
      jumlahSesi,
      sisaSesi,
      tanggalBaru: todayStr,
      success: true
    };

  } catch (err) {
    console.error('❌ Error handleAktifSesiCommand:', err.message);
    if (browser) await browser.close();
    return `❌ Error: ${err.message}`;
  }
}