import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../config/.env') });

// Mapping kode jenis ke nama paket Kids di sistem
const jenisMap = {
  NJM: 'FUN NJM Kids',
  RENEW: 'FUN Renewal Kids',
  DPN: 'FUN DP NJM Kids',
  DPR: 'FUN DP Renewal Kids',
  UPSC: 'FUN Upgrade SC Kids',
  UPAC: 'FUN Upgrade AC Kids',
  CUT: 'FUN Freeze Kids',
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
  if (kodeJenis === 'DPN' || kodeJenis === 'DPR') {
    return 1;
  }
  
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
export default async function handleReqPaketMemKids(cabang, kodeJenis, durasiInput, hargaInput) {
  console.log(`[PROCESS] Request Paket Member Kids: Cabang=${cabang}, Jenis=${kodeJenis}, Durasi=${durasiInput}, Harga=${hargaInput}`);
  
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
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Login dengan evaluate untuk performa optimal
    await page.evaluate((username, password) => {
      return new Promise((resolve) => {
        const usernameInput = document.querySelector('input[name="namapengguna"]');
        const passwordInput = document.querySelector('input[name="katasandi"]');
        
        if (usernameInput && passwordInput) {
          usernameInput.value = username;
          passwordInput.value = password;
          
          const form = usernameInput.closest('form') || passwordInput.closest('form');
          if (form) {
            setTimeout(() => {
              form.submit();
              resolve();
            }, 100);
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

    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

    // ================== PILIH CABANG ==================
    console.log(`[STEP] Masuk ke cabang: ${cabang.toUpperCase()}`);
    await page.goto(
      `https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, 
      { waitUntil: 'domcontentloaded' }
    );

    // ================== BUKA HALAMAN TAMBAH PAKET KIDS ==================
    console.log('[STEP] Masuk ke halaman tambah paket member kids...');
    await page.goto(
      'https://houseofmetamorfit.ampabatech.com/menu.php?open=paket-kids-add', 
      { waitUntil: 'domcontentloaded' }
    );

    // ================== PERSIAPAN DATA ==================
    const jumlahHari = hitungJumlahHari(kodeJenis, durasiInput);
    const namaPaket = generateNamaPaket(kodeJenis, durasiInput);
    const hargaClean = hargaInput.replace(/\D/g, '');

    console.log(`[DATA] Nama Paket: ${namaPaket}`);
    console.log(`[DATA] Jumlah Hari: ${jumlahHari}`);
    console.log(`[DATA] Harga: ${hargaClean}`);
    console.log(`[DATA] Jenis: ${jenisPaket}`);

    // ================== ISI FORM ==================
    console.log('[STEP] Isi form paket membership kids...');
    
    // Isi form menggunakan evaluate untuk performa maksimal
    const formFilled = await page.evaluate((data) => {
      return new Promise((resolve, reject) => {
        const checkElements = () => {
          const namapaketInput = document.querySelector('input[name="namapaket"]');
          const jumlahHariInput = document.querySelector('input[name="jumlahhari"]');
          const hargaBulananInput = document.querySelector('input[name="hargabulanan"]');

          if (namapaketInput && jumlahHariInput && hargaBulananInput) {
            namapaketInput.value = data.namaPaket;
            namapaketInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            jumlahHariInput.value = data.jumlahHari;
            jumlahHariInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            hargaBulananInput.value = data.hargaClean;
            hargaBulananInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            resolve(true);
          } else {
            setTimeout(checkElements, 100);
          }
        };
        
        checkElements();
        
        setTimeout(() => {
          reject(new Error('Form elements not found'));
        }, 5000);
      });
    }, {
      namaPaket,
      jumlahHari: jumlahHari.toString(),
      hargaClean
    });

    if (!formFilled) {
      throw new Error('Gagal mengisi form');
    }

    // ================== PILIH JENIS PAKET ==================
    console.log(`[STEP] Pilih jenis paket: ${jenisPaket}`);
    
    // Coba cari select biasa atau dropdown bootstrap
    const dropdownFound = await page.evaluate((targetJenis) => {
      const jenisSelect = document.querySelector('select[name="jenis"]');
      if (jenisSelect) {
        // Ini adalah select biasa, bukan bootstrap dropdown
        jenisSelect.value = targetJenis;
        jenisSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return 'select';
      }
      
      // Fallback: cari bootstrap dropdown
      const dropdowns = document.querySelectorAll('button.dropdown-toggle');
      if (dropdowns[1]) {
        dropdowns[1].click();
        return 'dropdown';
      }
      return false;
    }, jenisPaket);

    if (dropdownFound === 'dropdown') {
      // Wait untuk dropdown terbuka
      await new Promise(resolve => setTimeout(resolve, 500));

      // Ketik dan pilih dengan evaluate
      const optionSelected = await page.evaluate((targetJenis) => {
        const searchBox = document.querySelector('.bs-searchbox input');
        if (!searchBox) return false;
        
        searchBox.value = targetJenis;
        searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        
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
        // Fallback
        const searchBoxExists = await page.$('.bs-searchbox input');
        if (searchBoxExists) {
          await page.type('.bs-searchbox input', jenisPaket);
          await page.keyboard.press('Enter');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } else if (!dropdownFound) {
      throw new Error('Dropdown jenis paket tidak ditemukan');
    }

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
      const saveBtnExists = await page.$('button[name="simpan"]');
      if (saveBtnExists) {
        await page.click('button[name="simpan"]');
      } else {
        throw new Error('Tombol simpan tidak ditemukan');
      }
    }

    await page.waitForNavigation({ 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    console.log(`[SUCCESS] ✅ Paket Kids ${namaPaket} berhasil ditambahkan di ${cabang.toUpperCase()}!`);
    
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