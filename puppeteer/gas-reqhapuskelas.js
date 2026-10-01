import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../config/.env') });

async function hapusSemuaKelasFromUrl({ page, url, label }) {
  const stats = {
    totalDeleted: 0,
    totalAttempts: 0,
    consecutiveFailures: 0
  };

  const maxConsecutiveFailures = 5;
  const maxTotalAttempts = 500;

  console.log(`[STEP] Mulai hapus semua kelas - ${label}...`);

  while (stats.totalAttempts < maxTotalAttempts && stats.consecutiveFailures < maxConsecutiveFailures) {
    stats.totalAttempts++;

    try {
      console.log(`[LOOP ${stats.totalAttempts}] [${label}] Masuk halaman kelas...`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await new Promise(r => setTimeout(r, 800));

      // Cek apakah ada data
      const trashFound = await page.evaluate(() => {
        const trashBtns = Array.from(document.querySelectorAll('button, a'))
          .filter(el => el.innerHTML.includes('fa-trash') && el.offsetParent !== null);
        return trashBtns.length > 0;
      });

      if (!trashFound) {
        console.log(`[INFO] [${label}] Tidak ada kelas tersisa`);
        stats.consecutiveFailures++;
        break;
      }

      // Klik tombol hapus pertama
      const trashClicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, a'))
          .find(el => el.innerHTML.includes('fa-trash') && el.offsetParent !== null);
        if (btn) {
          btn.scrollIntoView();
          btn.click();
          return true;
        }
        return false;
      });

      if (!trashClicked) {
        console.log(`[WARNING] [${label}] Gagal klik tombol hapus`);
        stats.consecutiveFailures++;
        continue;
      }

      await new Promise(r => setTimeout(r, 400));

      // Konfirmasi "Ya"
      const confirmClicked = await page.evaluate(() => {
        const yaBtn = [...document.querySelectorAll('.popover-content a.btn-success')]
          .find(el => el.innerText.trim().toLowerCase() === 'ya' && el.offsetParent !== null);
        if (yaBtn) {
          yaBtn.click();
          return true;
        }
        return false;
      });

      if (!confirmClicked) {
        console.log(`[WARNING] [${label}] Gagal konfirmasi hapus`);
        stats.consecutiveFailures++;
        continue;
      }

      await new Promise(r => setTimeout(r, 600));

      stats.totalDeleted++;
      stats.consecutiveFailures = 0;
      console.log(`[SUCCESS] [${label}] Kelas ke-${stats.totalDeleted} berhasil dihapus!`);

    } catch (loopError) {
      console.log(`[ERROR] [${label}] ${loopError.message}`);
      stats.consecutiveFailures++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== LAPORAN ${label} ===`);
  console.log(`Total dihapus: ${stats.totalDeleted}`);
  console.log(`Total attempts: ${stats.totalAttempts}`);

  return stats;
}

export default async function handleReqHapusKelas({ cabang }) {
  console.log(`[PROCESS] Hapus Semua Kelas (Regular + Kids):`);
  console.log(`- Cabang: ${cabang}`);

  const browser = await puppeteer.launch({
    headless: false,
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
    console.log('⚠️ Dialog muncul:', dialog.message());
    await dialog.accept();
  });

  try {
    const cabangId = cabangMap[cabang.toLowerCase()];
    if (!cabangId) throw new Error('kode cabang gak valid');

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
            const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 });
            passwordInput.dispatchEvent(event);
            setTimeout(resolve, 100);
          }
        } else {
          resolve();
        }
      });
    }, process.env.USERNAME, process.env.PASSWORD);

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log(`[STEP] Masuk ke cabang: ${cabang.toUpperCase()}`);
    await page.goto(`https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Hapus kelas regular dulu
    const statsRegular = await hapusSemuaKelasFromUrl({
      page,
      url: 'https://houseofmetamorfit.ampabatech.com/menu.php?open=nama-kelas',
      label: 'REGULAR'
    });

    // Lanjut hapus kelas kids
    const statsKids = await hapusSemuaKelasFromUrl({
      page,
      url: 'https://houseofmetamorfit.ampabatech.com/menu.php?open=nama-kelas-kids',
      label: 'KIDS'
    });

    const totalAll = statsRegular.totalDeleted + statsKids.totalDeleted;

    console.log('\n=== LAPORAN TOTAL KESELURUHAN ===');
    console.log(`Regular: ${statsRegular.totalDeleted} kelas dihapus`);
    console.log(`Kids   : ${statsKids.totalDeleted} kelas dihapus`);
    console.log(`Total  : ${totalAll} kelas dihapus`);

    return {
      totalDeleted: totalAll,
      regular: statsRegular,
      kids: statsKids
    };

  } catch (err) {
    console.error(`[FAILED] Hapus Kelas Error: ${err.message}`);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
  }
}
