import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env dari folder config
dotenv.config({ path: path.join(__dirname, '../config/.env') });

export default async function handleAmbilBarcode(cabang, namaMember) {
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
  
  try {
    page.on('dialog', async dialog => {
      const message = dialog.message();
      await dialog.accept();
    });

    // Login
    console.log('✅ Berhasil login ke sistem...');
    await page.goto('https://houseofmetamorfit.ampabatech.com/index.php', { waitUntil: 'networkidle2' });
    await page.type('input[name="namapengguna"]', process.env.USERNAME);
await page.type('input[name="katasandi"]', process.env.PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Pilih cabang
const cabangId = cabangMap[cabang.toLowerCase()];
console.log(`[INFO] Cabang ID: ${cabangId}`);
await page.goto(`https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, {
      waitUntil: 'networkidle2'
    });

    // Akses halaman running sesi
    await page.goto('https://houseofmetamorfit.ampabatech.com/menu.php?open=running-sesi', {
      waitUntil: 'networkidle2'
    });

    // Tunggu beberapa detik untuk load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Klik dropdown filter
    await page.waitForSelector('.filter-option');
    await page.click('.filter-option');
    await page.waitForSelector('.bs-searchbox input');
    await page.type('.bs-searchbox input', namaMember);
    await page.keyboard.press('Enter');

    // Klik tombol pencarian
    await page.click('button[name="search"]');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scroll horizontal dulu biar kolom "Check In Barcode" muncul
    await page.evaluate(() => {
      const runningTableWrapper = document.querySelector('.dataTables_scrollBody') || document.querySelector('.table-responsive');
      if (runningTableWrapper) {
        runningTableWrapper.scrollLeft = runningTableWrapper.scrollWidth;
      } else {
        window.scrollBy(500, 0);
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Ambil semua link "Check In Barcode"
    await page.waitForSelector('a[href*="sesi-pelatih-checkin-barcode"]', { timeout: 10000 });
    
    const barcodeLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const targets = links.filter(link =>
        link.textContent.trim().toLowerCase().includes('check in barcode')
      );
      return targets.map(link => link.href);
    });

    if (barcodeLinks.length === 0) {
      throw new Error('Tidak ada sesi yang ditemukan untuk member ini');
    }

    console.log(`✅ Ditemukan ${barcodeLinks.length} sesi untuk ${namaMember}`);

    // Array untuk menyimpan semua barcode
    const barcodes = [];

    // Loop untuk ambil barcode dari setiap sesi
    for (let i = 0; i < barcodeLinks.length; i++) {
      console.log(`📝 Mengambil barcode sesi ${i + 1}...`);
      
      await page.goto(barcodeLinks[i], { waitUntil: 'networkidle2' });
      
      // Tunggu field barcode muncul dan ambil valuenya
      await page.waitForSelector('input[name="barcode"]', { timeout: 10000 });
      
      const sessionData = await page.evaluate(() => {
        const barcodeInput = document.querySelector('input[name="barcode"]');
        
        // Ambil info tambahan dari halaman (tanggal, waktu, dll)
        const getTextContent = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.textContent.trim() : '';
        };
        
        return {
          barcode: barcodeInput ? barcodeInput.value : null,
          // Tambahkan info lain jika tersedia di halaman
          waktu: getTextContent('.session-time') || '',
          trainer: getTextContent('.trainer-name') || ''
        };
      });

      if (sessionData.barcode) {
        barcodes.push({
          sesi: i + 1,
          barcode: sessionData.barcode,
          waktu: sessionData.waktu,
          trainer: sessionData.trainer
        });
        console.log(`✅ Barcode sesi ${i + 1}: ${sessionData.barcode}`);
      }
      
      // Kembali ke halaman running sesi untuk ambil link berikutnya
      if (i < barcodeLinks.length - 1) {
        await page.goBack({ waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (barcodes.length === 0) {
      throw new Error('Tidak ada barcode yang berhasil diambil');
    }

    console.log(`✅ Total ${barcodes.length} barcode berhasil diambil`);
    
    return {
      success: true,
      member: namaMember,
      cabang: cabang,
      totalSesi: barcodes.length,
      barcodes: barcodes
    };

  } catch (err) {
    console.error('❌ Terjadi error:', err.message);
    throw err;
  } finally {
    await browser.close();
  }
};