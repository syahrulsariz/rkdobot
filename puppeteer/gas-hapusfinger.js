import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../config/.env') });

export default async function handleHapusFinger(cabang, jenis, namaMember) {
  console.log(`[PROCESS] Hapus Finger: Cabang=${cabang}, Jenis=${jenis}, Nama=${namaMember}`);
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',        // pakai /tmp daripada /dev/shm
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

    console.log(`[STEP] Pilih cabang: ${cabang.toUpperCase()}`);
    await page.goto(`https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, { waitUntil: 'networkidle2' });

    console.log(`[STEP] Navigasi ke halaman member (jenis ${jenis.toUpperCase()})`);
    let targetURL;
    if (jenis.toUpperCase() === 'SC') {
      targetURL = `https://houseofmetamorfit.ampabatech.com/menu.php?open=anggota-view&tipe=Single%20Club%20-%20${cabang.toUpperCase()}&kategori=All%20Member`;
    } else if (jenis.toUpperCase() === 'AC') {
      targetURL = `https://houseofmetamorfit.ampabatech.com/menu.php?open=anggota-view&tipe=174459764967fc729178c96&kategori=All%20Member`;
    } else if (jenis.toUpperCase() === 'CCB') {
      targetURL = `https://houseofmetamorfit.ampabatech.com/menu.php?open=anggota-view&tipe=1747658915682b28a3cef98&kategori=All%20Member`;
    } else {
      throw new Error('tipe club gak valid, harus SC/AC/CCB');
    }

    await page.goto(targetURL, { waitUntil: 'networkidle2' });

    console.log('[STEP] Buka dropdown pencarian nama member...');
    await page.waitForSelector('.filter-option', { timeout: 5000 });
    await page.click('.filter-option');

    await page.waitForSelector('.bs-searchbox input', { timeout: 5000 });
    await page.type('.bs-searchbox input', namaMember);
    await page.keyboard.press('Enter');

    console.log('[STEP] Klik tombol search...');
    await page.waitForSelector('button[name="search"]', { timeout: 5000 });
    await page.click('button[name="search"]');
    
    // Wait for search results to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('[STEP] Cari tombol "Lihat Member Detail"...');
    
    // Method 1: Cari dengan evaluate (compatible dengan semua versi)
    const linkFound = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.innerText && link.innerText.includes('Lihat Member Detail')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (linkFound) {
      console.log('[STEP] Tombol detail ditemukan, navigasi...');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    } else {
      // Method 2: Fallback - auto scroll and search
      console.log('[STEP] Method evaluate gagal, auto scroll...');
      
      let found = false;
      let scrollCount = 0;
      const maxScrolls = 5;
      
      while (!found && scrollCount < maxScrolls) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const detailFound = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.innerText && link.innerText.includes('Lihat Member Detail')) {
              link.click();
              return true;
            }
          }
          return false;
        });

        if (detailFound) {
          await page.waitForNavigation({ waitUntil: 'networkidle2' });
          found = true;
        }
        scrollCount++;
      }
      
      if (!found) {
        throw new Error('nama member gak ada di data member');
      }
    }

    console.log('[STEP] Ambil ID dari URL member detail...');
    
    // Ambil current URL dan extract ID
    const currentURL = page.url();
    console.log(`[DEBUG] Current URL: ${currentURL}`);
    
    // Extract ID dari URL pattern: menu.php?open=anggota-view-detail&id=174463374167fcff8d8ad56&tipe=...
    const urlParams = new URL(currentURL).searchParams;
    const memberId = urlParams.get('id');
    
    if (!memberId) {
      throw new Error('ID member tidak ditemukan di URL');
    }
    
    console.log(`[DEBUG] Member ID ditemukan: ${memberId}`);
    
    console.log('[STEP] Navigasi ke halaman hapus finger...');
    const hapusFingerURL = `https://houseofmetamorfit.ampabatech.com/finger-hapus.php?open=akunmember&id=${memberId}`;
    
    await page.goto(hapusFingerURL, { waitUntil: 'networkidle2' });
    
    console.log('[SUCCESS] Berhasil membuka halaman hapus finger!');
    console.log(`[INFO] URL: ${hapusFingerURL}`);
    
    // Tunggu sebentar untuk memastikan halaman ter-load sempurna
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      memberId: memberId,
      hapusFingerURL: hapusFingerURL
    };
    
  } catch (err) {
    console.error(`[FAILED] Proses Hapus Finger Error: ${err.message}`);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
  }
};