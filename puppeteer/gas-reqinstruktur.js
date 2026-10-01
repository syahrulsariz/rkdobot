import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../config/.env') });

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

const genderMap = {
  cowok: 'Laki-Laki', cowo: 'Laki-Laki', cwo: 'Laki-Laki',
  laki: 'Laki-Laki', pria: 'Laki-Laki',
  cewek: 'Perempuan', cewe: 'Perempuan', cwe: 'Perempuan',
  perempuan: 'Perempuan', wanita: 'Perempuan'
};

// namaList bisa array atau string dengan koma
export default async function handleReqInstruktur(cabang, namaList, gender = 'cowok') {
  // Normalize ke array
  if (!Array.isArray(namaList)) {
    namaList = namaList.split(',').map(n => n.trim().toUpperCase()).filter(n => n);
  } else {
    namaList = namaList.map(n => n.trim().toUpperCase()).filter(n => n);
  }

  if (namaList.length === 0) throw new Error('Tidak ada nama instruktur yang valid');

  const cabangId = cabangMap[cabang.toLowerCase()];
  if (!cabangId) throw new Error(`Kode cabang tidak valid: ${cabang}`);

  const genderValue = genderMap[gender.toLowerCase()] ?? 'Laki-Laki';

  console.log(`[PROCESS] Request Instruktur: Cabang=${cabang}, Gender=${genderValue}, Nama=[${namaList.join(', ')}]`);

  const browser = await puppeteer.launch({ headless: true, args: BROWSER_ARGS });
  const page = await browser.newPage();

  page.on('dialog', async dialog => {
    console.log('⚠️ Dialog:', dialog.message());
    await dialog.accept();
  });

  try {
    // ===== LOGIN =====
    console.log('[STEP] Login ke sistem...');
    await page.goto('https://houseofmetamorfit.ampabatech.com/index.php', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.type('input[name="namapengguna"]', process.env.USERNAME);
    await page.type('input[name="katasandi"]', process.env.PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });

    // ===== PILIH CABANG =====
    console.log(`[STEP] Masuk ke cabang: ${cabang.toUpperCase()}`);
    await page.goto(
      `https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );

    // ===== LOOP SEMUA NAMA =====
    const results = { success: [], failed: [] };

    for (const nama of namaList) {
      try {
        console.log(`[STEP] Tambah instruktur: ${nama}`);

        await page.goto(
          'https://houseofmetamorfit.ampabatech.com/menu.php?open=pegawai-add&ket=Instruktur',
          { waitUntil: 'domcontentloaded', timeout: 30000 }
        );

        await page.waitForSelector('input[name="nama"]', { timeout: 10000 });
        await page.$eval('input[name="nama"]', el => el.value = '');
        await page.type('input[name="nama"]', nama);

        await page.select('select[name="jeniskelamin"]', genderValue);
        await new Promise(r => setTimeout(r, 500));

        const simpanBtn = await page.$('button[name="simpan"]');
        if (!simpanBtn) throw new Error('Tombol simpan tidak ditemukan');

        await simpanBtn.click();
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log(`[SUCCESS] ✅ ${nama} berhasil ditambahkan`);
        results.success.push(nama);

      } catch (err) {
        console.error(`[FAILED] ❌ ${nama}: ${err.message}`);
        results.failed.push({ nama, error: err.message });
      }
    }

    console.log(`\n=== LAPORAN REQINS ===`);
    console.log(`Berhasil : ${results.success.length}${results.success.length ? ` (${results.success.join(', ')})` : ''}`);
    console.log(`Gagal    : ${results.failed.length}${results.failed.length ? ` (${results.failed.map(f => f.nama).join(', ')})` : ''}`);

    return results;

  } catch (err) {
    console.error(`[FAILED] Error reqins: ${err.message}`);
    throw new Error(err.message);
  } finally {
    await browser.close();
  }
}