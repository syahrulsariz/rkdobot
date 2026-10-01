import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../config/.env') });

// Mapping sesi ke hari
const sesiHariMap = {
  5: 30, 7: 30, 10: 60,  14: 90, 17: 105, 20: 120, 25: 150, 30: 180,
  40: 210, 50: 240, 60: 270, 70: 300,
  80: 330, 90: 360, 100: 390
};

// Mapping jenis PT ke dropdown
const ptDropdownMap = {
  reg: 'PT Reguler',
  pos: 'PT POS',
  ptdp: 'PT DP'
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

// Helper: Title Case
function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Helper: Format nama paket dengan custom logic
function formatNamaPaketCustom(namaPaket, dropdownJenis) {
  const ptPrefixes = ['PT REG', 'PT POS', 'PT DP'];
  const upperNama = namaPaket.toUpperCase();

  // Khusus PT DP
  if (dropdownJenis === 'PT DP') {
    const tipeMatch = upperNama.match(/\b(POS|REG)\b/);
    const jumlahSesiMatch = upperNama.match(/(\d+)\s*SESI/i);

    const tipe = tipeMatch ? tipeMatch[1] : 'REG'; // default ke REG
    const jumlahSesi = jumlahSesiMatch ? jumlahSesiMatch[1] : '';

    // Ambil teks setelah "Sesi" (optional remarks)
    let remarks = '';
    const sesiIndex = upperNama.indexOf('SESI');
    if (sesiIndex !== -1) {
      remarks = namaPaket.slice(sesiIndex + 4).trim();
    }

    const remarksFormatted = remarks
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    return `DP PT ${tipe} ${jumlahSesi} Sesi${remarks ? ' ' + remarksFormatted : ''}`;
  }

  // Cek apakah dimulai dengan prefix PT
  const foundPrefix = ptPrefixes.find(prefix => upperNama.startsWith(prefix));
  if (foundPrefix) {
    const sisa = namaPaket.slice(foundPrefix.length).trim();
    const sisaFormatted = sisa.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    return `${foundPrefix} ${sisaFormatted}`;
  }

  // Fallback: Title case dengan preserve REG/POS/DP
  const kataArray = namaPaket.split(' ').map(word => {
    const upper = word.toUpperCase();
    if (['REG', 'POS', 'DP'].includes(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return kataArray.join(' ');
}

// Helper: Validasi harga
function isHargaValid({ dropdownJenis, jumlahSesi, harga, namaPaket }) {
  const hargaAngka = parseInt(harga.replace(/\D/g, ''), 10);
  const lowerNama = namaPaket.toLowerCase();

  // Kecualian untuk pilates, couple, dan promo (bebas harga)
  if (lowerNama.includes('pilates') || lowerNama.includes('couple') || lowerNama.includes('promo')) {
    return true;
  }

  // Validasi khusus PT DP: minimal 500rb total
  if (dropdownJenis === 'PT DP') {
    return hargaAngka >= 500000;
  }

  // Validasi PT Reguler & PT POS: harga per sesi harus 200rb - 350rb
  const hargaPerSesi = hargaAngka / parseInt(jumlahSesi);
  
  if (hargaPerSesi < 180000 || hargaPerSesi > 350000) {
    return false;
  }

  return true;
}

// Main function
export default async function handleReqPaketPt({ cabang, namaPaket, dropdownJenis, jumlahSesi, harga }) {
  console.log(`[PROCESS] Request Paket PT: Cabang=${cabang}, Nama=${namaPaket}, Jenis=${dropdownJenis}, Sesi=${jumlahSesi}, Harga=${harga}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS,
  });

  const page = await browser.newPage();

  // Auto-accept dialogs
  page.on('dialog', async dialog => {
    const message = dialog.message();
    console.log('⚠️ Dialog muncul:', message);
    await dialog.accept();
  });

  try {
    // ================== VALIDASI INPUT ==================
    const cabangId = cabangMap[cabang.toLowerCase()];
    if (!cabangId) {
      throw new Error(`Kode cabang tidak valid: ${cabang}`);
    }

    const formattedNamaPaket = formatNamaPaketCustom(namaPaket, dropdownJenis);
    const jumlahHari = sesiHariMap[parseInt(jumlahSesi)] || 1;
    const hargaClean = harga.replace(/\D/g, '');

    console.log(`[DATA] Nama Paket: ${formattedNamaPaket}`);
    console.log(`[DATA] Jenis: ${dropdownJenis}`);
    console.log(`[DATA] Sesi: ${jumlahSesi}, Hari: ${jumlahHari}`);
    console.log(`[DATA] Harga: ${hargaClean}`);

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

    // ================== BUKA HALAMAN TAMBAH PAKET PT ==================
    console.log('[STEP] Masuk ke halaman tambah paket PT...');
    await page.goto(
      'https://houseofmetamorfit.ampabatech.com/menu.php?open=paket-pt-add', 
      { waitUntil: 'domcontentloaded' }
    );

    // ================== ISI FORM BASIC ==================
    console.log('[STEP] Isi form nama paket dan jumlah sesi...');
    
    const basicFormFilled = await page.evaluate((data) => {
      return new Promise((resolve, reject) => {
        const checkElements = () => {
          const namapaketInput = document.querySelector('input[name="namapaket"]');
          const jumlahSesiInput = document.querySelector('input[name="jumlahsesi"]');

          if (namapaketInput && jumlahSesiInput) {
            namapaketInput.value = data.formattedNamaPaket;
            namapaketInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            jumlahSesiInput.value = data.jumlahSesi;
            jumlahSesiInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            resolve(true);
          } else {
            setTimeout(checkElements, 100);
          }
        };
        
        checkElements();
        
        setTimeout(() => {
          reject(new Error('Basic form elements not found'));
        }, 5000);
      });
    }, {
      formattedNamaPaket,
      jumlahSesi: jumlahSesi.toString()
    });

    if (!basicFormFilled) {
      throw new Error('Gagal mengisi form basic');
    }

    // ================== PILIH DROPDOWN JENIS PT ==================
    console.log(`[STEP] Pilih dropdown jenis PT: ${dropdownJenis}`);
    
    const jenisDropdownSelected = await page.evaluate((targetJenis) => {
      return new Promise((resolve) => {
        const dropdowns = document.querySelectorAll('button.dropdown-toggle');
        if (dropdowns[0]) {
          dropdowns[0].click();
          
          setTimeout(() => {
            const items = Array.from(document.querySelectorAll('.dropdown-menu.inner li a'));
            const target = items.find(el => el.textContent.trim().toLowerCase() === targetJenis.toLowerCase());
            if (target) {
              target.click();
              resolve(true);
            } else {
              resolve(false);
            }
          }, 300);
        } else {
          resolve(false);
        }
      });
    }, dropdownJenis);

    if (!jenisDropdownSelected) {
      throw new Error('Gagal memilih dropdown jenis PT');
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    // ================== PILIH MASA AKTIF: ADA ==================
    console.log('[STEP] Pilih masa aktif: Ada');
    
    const masaAktifSelected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const dropdowns = document.querySelectorAll('button.dropdown-toggle');
        if (dropdowns[1]) {
          dropdowns[1].click();
          
          setTimeout(() => {
            const items = Array.from(document.querySelectorAll('.dropdown-menu.inner li a'));
            const target = items.find(el => el.textContent.trim().toLowerCase() === 'ada');
            if (target) {
              target.click();
              resolve(true);
            } else {
              resolve(false);
            }
          }, 300);
        } else {
          resolve(false);
        }
      });
    });

    if (!masaAktifSelected) {
      throw new Error('Gagal memilih masa aktif');
    }

    // ================== ISI JUMLAH HARI ==================
    console.log('[STEP] Menunggu input jumlah hari muncul dan mengisinya...');
    
    const jumlahHariFilled = await page.evaluate((hari) => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 20; // 20 attempts x 200ms = 4 seconds max
        
        const checkJumlahHari = () => {
          const jumlahHariInput = document.querySelector('input[name="jumlahhari"]');
          
          if (jumlahHariInput && jumlahHariInput.offsetParent !== null) {
            // Element found and visible
            jumlahHariInput.focus();
            jumlahHariInput.select();
            jumlahHariInput.value = hari;
            jumlahHariInput.dispatchEvent(new Event('input', { bubbles: true }));
            resolve(true);
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(checkJumlahHari, 200);
            } else {
              reject(new Error('Input jumlah hari tidak muncul setelah timeout'));
            }
          }
        };
        
        // Start checking after small delay
        setTimeout(checkJumlahHari, 300);
      });
    }, jumlahHari.toString());

    if (!jumlahHariFilled) {
      throw new Error('Gagal mengisi jumlah hari');
    }

    // ================== ISI HARGA ==================
    console.log('[STEP] Isi harga...');
    
    const hargaFilled = await page.evaluate((hargaClean) => {
      return new Promise((resolve, reject) => {
        const checkHarga = () => {
          const hargaInput = document.querySelector('input[name="hargabulanan"]');
          if (hargaInput) {
            hargaInput.value = hargaClean;
            hargaInput.dispatchEvent(new Event('input', { bubbles: true }));
            resolve(true);
          } else {
            setTimeout(checkHarga, 100);
          }
        };
        
        checkHarga();
        
        setTimeout(() => {
          reject(new Error('Input harga tidak ditemukan'));
        }, 3000);
      });
    }, hargaClean);

    if (!hargaFilled) {
      throw new Error('Gagal mengisi harga');
    }

    // ================== VALIDASI HARGA ==================
    console.log('[STEP] Validasi harga...');
    
    if (!isHargaValid({ dropdownJenis, jumlahSesi, harga, namaPaket })) {
      throw new Error('Harga tidak valid, cek manual');
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

    console.log(`[SUCCESS] ✅ Paket PT ${formattedNamaPaket} berhasil ditambahkan di ${cabang.toUpperCase()}!`);
    
    return {
      success: true,
      cabang: cabang.toUpperCase(),
      namaPaket: formattedNamaPaket,
      jumlahSesi,
      jumlahHari,
      harga: hargaClean
    };
    
  } catch (err) {
    console.error(`[FAILED] ❌ Error di cabang ${cabang.toUpperCase()}:`, err.message);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
  }
}