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

// namaKelas bisa string tunggal atau string dengan koma atau array
export default async function handleReqKelas(cabang, namaKelas) {
  // Parse ke array
  let kelasList = [];
  if (Array.isArray(namaKelas)) {
    kelasList = namaKelas.map(k => k.trim().toUpperCase()).filter(k => k);
  } else {
    kelasList = namaKelas.split(',').map(k => k.trim().toUpperCase()).filter(k => k);
  }

  if (kelasList.length === 0) throw new Error('Tidak ada nama kelas yang valid');

  console.log(`[PROCESS] Request Kelas: Cabang=${cabang}, Kelas=[${kelasList.join(', ')}]`);

  const cabangId = cabangMap[cabang.toLowerCase()];
  if (!cabangId) throw new Error(`Kode cabang tidak valid: ${cabang}`);

  const browser = await puppeteer.launch({ headless: true, args: BROWSER_ARGS });
  const page = await browser.newPage();

  page.on('dialog', async dialog => {
    console.log('⚠️ Dialog:', dialog.message());
    await dialog.accept();
  });

  try {
    // ================== LOGIN ==================
    console.log('[STEP] Login ke sistem...');
    await page.goto('https://houseofmetamorfit.ampabatech.com/index.php', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.evaluate((username, password) => {
      return new Promise((resolve) => {
        const usernameInput = document.querySelector('input[name="namapengguna"]');
        const passwordInput = document.querySelector('input[name="katasandi"]');
        if (usernameInput && passwordInput) {
          usernameInput.value = username;
          passwordInput.value = password;
          const form = usernameInput.closest('form') || passwordInput.closest('form');
          if (form) {
            setTimeout(() => { form.submit(); resolve(); }, 100);
          } else {
            passwordInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }));
            setTimeout(resolve, 100);
          }
        } else {
          resolve();
        }
      });
    }, process.env.USERNAME, process.env.PASSWORD);

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });

    // ================== PILIH CABANG ==================
    console.log(`[STEP] Masuk ke cabang: ${cabang.toUpperCase()}`);
    await page.goto(
      `https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );

    // ================== LOOP SEMUA KELAS ==================
    const results = { success: [], failed: [] };

    for (const kelas of kelasList) {
      try {
        console.log(`[STEP] Tambah kelas: ${kelas}`);

        await page.goto(
          'https://houseofmetamorfit.ampabatech.com/menu.php?open=tambah-kelas',
          { waitUntil: 'domcontentloaded', timeout: 30000 }
        );
        await new Promise(r => setTimeout(r, 500));

        const inputSelector = 'input[name="namakelas"]';
        const inputExists = await page.$(inputSelector);
        if (!inputExists) throw new Error('Input nama kelas tidak ditemukan');

        // Clear dulu biar aman, lalu isi
        await page.$eval(inputSelector, el => el.value = '');
        await page.type(inputSelector, kelas);

        const buttonSelector = 'button[name="simpan"]';
        const buttonExists = await page.$(buttonSelector);
        if (!buttonExists) throw new Error('Tombol simpan tidak ditemukan');

        await page.click(buttonSelector);
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });

        console.log(`[SUCCESS] ✅ ${kelas} berhasil ditambahkan`);
        results.success.push(kelas);

      } catch (kelasErr) {
        console.error(`[FAILED] ❌ ${kelas}: ${kelasErr.message}`);
        results.failed.push({ kelas, error: kelasErr.message });
      }
    }

    console.log(`\n=== LAPORAN REQKELAS ===`);
    console.log(`Berhasil : ${results.success.length} (${results.success.join(', ')})`);
    console.log(`Gagal    : ${results.failed.length}${results.failed.length ? ` (${results.failed.map(f => f.kelas).join(', ')})` : ''}`);

    return results;

  } catch (err) {
    console.error(`[FAILED] Error reqkelas: ${err.message}`);
    throw new Error(err.message);
  } finally {
    await browser.close();
  }
}