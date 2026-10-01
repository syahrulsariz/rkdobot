import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../config/.env') });

// Mapping kode jenis ke nama paket di sistem
const jenisMap = {
  NJM: 'PIF NJM Member',
  RENEW: 'PIF Renewal Member',
  DPN: 'PIF DP NJM Member',
  DPR: 'PIF DP Renewal Member',
  UPSC: 'PIF Upgrade SC Member',
  UPAC: 'PIF Upgrade AC Member',
  CUT: 'PIF Freeze Member',
};

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

// Helper: Hitung jumlah hari dari durasi
function hitungJumlahHari(kodeJenis, durasiInput) {
  // DP paket cuma 1 hari
  if (kodeJenis === 'DPN' || kodeJenis === 'DPR') {
    return 1;
  }
  
  // Parse durasi format "12+3 Months" atau "12 Months"
  const durasiMatch = durasiInput.match(/^(\d+)(?:\+(\d+))?/);
  if (!durasiMatch) {
    throw new Error(`Format durasi tidak valid: ${durasiInput}`);
  }
  
  const bulan = parseInt(durasiMatch[1]);
  const bonus = parseInt(durasiMatch[2] || '0');
  
  return (bulan + bonus) * 30;
}

// Helper: Format nama paket dengan Title Case (preserve DP)
function toTitleCasePreserveDP(str) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bDp\b/g, 'DP');
}

// Helper: Generate nama paket
function generateNamaPaket(kodeJenis, durasiInput) {
  if (kodeJenis === 'DPN' || kodeJenis === 'DPR') {
    return toTitleCasePreserveDP(`DP Package ${durasiInput}`);
  } else if (kodeJenis === 'CUT') {
    return toTitleCasePreserveDP(`Freeze ${durasiInput}`);
  } else if (kodeJenis === 'UPSC' || kodeJenis === 'UPAC') {
    return toTitleCasePreserveDP(`Upgrade Package ${durasiInput}`);
  } else {
    return toTitleCasePreserveDP(`Package ${durasiInput}`);
  }
}

// Main function
export default async function handleReqPaketMem(cabang, kodeJenis, durasiInput, hargaInput) {
  console.log(`[PROCESS] Request Paket Member: Cabang=${cabang}, Jenis=${kodeJenis}, Durasi=${durasiInput}, Harga=${hargaInput}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS,
  });

  const page = await browser.newPage();

  // Auto-accept dialogs
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    // ================== VALIDASI INPUT ==================
    const cabangId = cabangMap[cabang.toLowerCase()];
    if (!cabangId) {
      throw new Error(`Kode cabang tidak valid: ${cabang}`);
    }

    const jenisPaket = jenisMap[kodeJenis.toUpperCase()];
    if (!jenisPaket) {
      throw new Error(`Jenis paket tidak valid: ${kodeJenis}. Valid: ${Object.keys(jenisMap).join(', ')}`);
    }

    // ================== LOGIN ==================
    console.log('[STEP] Login ke sistem...');
    await page.goto('https://houseofmetamorfit.ampabatech.com/index.php', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.type('input[name="namapengguna"]', process.env.USERNAME);
    await page.type('input[name="katasandi"]', process.env.PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // ================== PILIH CABANG ==================
    console.log(`[STEP] Masuk ke cabang: ${cabang.toUpperCase()}`);
    await page.goto(
      `https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, 
      { waitUntil: 'networkidle2' }
    );

    // ================== BUKA HALAMAN TAMBAH PAKET ==================
    console.log('[STEP] Masuk ke halaman tambah paket member...');
    await page.goto(
      'https://houseofmetamorfit.ampabatech.com/menu.php?open=paket-member-add', 
      { waitUntil: 'networkidle2' }
    );

    // ================== PERSIAPAN DATA ==================
    const jumlahHari = hitungJumlahHari(kodeJenis, durasiInput);
    const namaPaket = generateNamaPaket(kodeJenis, durasiInput);
    const hargaClean = hargaInput.replace(/\D/g, ''); // Hapus non-digit

    console.log(`[DATA] Nama Paket: ${namaPaket}`);
    console.log(`[DATA] Jumlah Hari: ${jumlahHari}`);
    console.log(`[DATA] Harga: ${hargaClean}`);
    console.log(`[DATA] Jenis: ${jenisPaket}`);

    // ================== ISI FORM ==================
    console.log('[STEP] Isi form paket membership...');
    
    await page.type('input[name="namapaket"]', namaPaket);
    await page.type('input[name="jumlahhari"]', jumlahHari.toString());
    await page.type('input[name="hargabulanan"]', hargaClean);

    // ================== PILIH JENIS PAKET ==================
    console.log(`[STEP] Pilih jenis paket: ${jenisPaket}`);
    
    // Klik dropdown (dropdown ke-2)
    const dropdownOpened = await page.evaluate(() => {
      const dropdowns = document.querySelectorAll('button.dropdown-toggle');
      if (dropdowns[1]) {
        dropdowns[1].click();
        return true;
      }
      return false;
    });

    if (!dropdownOpened) {
      throw new Error('Dropdown jenis paket tidak ditemukan');
    }

    // Wait untuk dropdown terbuka
    await new Promise(resolve => setTimeout(resolve, 500));

    // Ketik dan pilih option
    const optionSelected = await page.evaluate((targetJenis) => {
      const searchBox = document.querySelector('.bs-searchbox input');
      if (!searchBox) return false;
      
      // Ketik jenis paket
      searchBox.value = targetJenis;
      searchBox.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Tunggu sebentar lalu pilih
      return new Promise((resolve) => {
        setTimeout(() => {
          const options = document.querySelectorAll('.dropdown-menu li a span.text');
          for (const option of options) {
            if (option.textContent.trim() === targetJenis) {
              option.click();
              resolve(true);
              return;
            }
          }
          resolve(false);
        }, 300);
      });
    }, jenisPaket);

    if (!optionSelected) {
      // Fallback: ketik manual dan Enter
      console.log('[FALLBACK] Coba metode fallback untuk pilih jenis paket...');
      try {
        await page.waitForSelector('.bs-searchbox input', { timeout: 3000 });
        await page.type('.bs-searchbox input', jenisPaket);
        await page.keyboard.press('Enter');
      } catch (err) {
        throw new Error(`Gagal memilih jenis paket: ${jenisPaket}`);
      }
    }

    // Wait untuk selection tersimpan
    await new Promise(resolve => setTimeout(resolve, 500));

    // ================== SIMPAN ==================
    console.log('[STEP] Klik tombol simpan...');
    
    const saveClicked = await page.evaluate(() => {
      const saveBtn = document.querySelector('button[name="simpan"]');
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });

    if (!saveClicked) {
      // Fallback
      await page.click('button[name="simpan"]');
    }

    await page.waitForNavigation({ 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });

    console.log(`[SUCCESS] ✅ Paket ${namaPaket} berhasil ditambahkan di ${cabang.toUpperCase()}!`);
    
    return {
      success: true,
      cabang: cabang.toUpperCase(),
      namaPaket,
      jumlahHari,
      harga: hargaClean,
      jenisPaket
    };
    
  } catch (err) {
    console.error(`[FAILED] ❌ Error di cabang ${cabang.toUpperCase()}:`, err.message);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
  }
}