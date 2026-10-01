import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../config/.env') });

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

// Main function
export default async function handleReqHapusMemKids({ cabang, namaPaketTarget }) {
  // Parse multiple targets - bisa array atau string dengan koma
  let targetList = [];
  if (Array.isArray(namaPaketTarget)) {
    targetList = namaPaketTarget.map(target => target.toString().trim()).filter(t => t);
  } else if (typeof namaPaketTarget === 'string') {
    // Split by comma dan clean up
    targetList = namaPaketTarget.split(',').map(target => target.trim()).filter(t => t);
  } else {
    throw new Error('namaPaketTarget harus berupa string atau array');
  }

  if (targetList.length === 0) {
    throw new Error('Tidak ada target paket yang valid');
  }

  console.log(`[PROCESS] Bulk Delete Multiple Paket Kids:`);
  console.log(`- Cabang: ${cabang}`);
  console.log(`- Target Paket: [${targetList.join(', ')}] (${targetList.length} targets)`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS,
  });

  const page = await browser.newPage();

  // Auto-accept dialogs
  page.on('dialog', async dialog => {
    console.log('⚠️ Dialog muncul:', dialog.message());
    await dialog.accept();
  });

  try {
    // ================== VALIDASI INPUT ==================
    const cabangId = cabangMap[cabang.toLowerCase()];
    if (!cabangId) {
      throw new Error(`Kode cabang tidak valid: ${cabang}`);
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

    // ================== BUKA HALAMAN VIEW PAKET KIDS ==================
    console.log('[STEP] Masuk ke halaman view paket kids...');
    await page.goto(
      'https://houseofmetamorfit.ampabatech.com/menu.php?open=paket-kids-view',
      { waitUntil: 'networkidle2' }
    );

    // ================== STATISTIK TRACKING ==================
    const stats = {
      totalDeleted: 0,
      byTarget: {},
      totalAttempts: 0,
      consecutiveFailures: 0
    };

    // Initialize stats untuk setiap target
    targetList.forEach(target => {
      stats.byTarget[target] = { deleted: 0, attempts: 0 };
    });

    const maxConsecutiveFailures = 5;
    const maxTotalAttempts = 300;
    let currentTargetIndex = 0;
    let cycleCompleted = false;

    console.log(`[STEP] Mulai mencari dan menghapus paket untuk ${targetList.length} target...`);

    // ================== LOOP DELETE ==================
    while (stats.totalAttempts < maxTotalAttempts && 
           stats.consecutiveFailures < maxConsecutiveFailures && 
           !cycleCompleted) {
      
      stats.totalAttempts++;
      let currentLoopSuccess = false;
      
      // Ambil target saat ini (rotate)
      const currentTarget = targetList[currentTargetIndex];
      stats.byTarget[currentTarget].attempts++;
      
      try {
        console.log(`[LOOP ${stats.totalAttempts}] Target: "${currentTarget}" (${currentTargetIndex + 1}/${targetList.length})`);

        // Refresh halaman setiap 15 kali
        if (stats.totalAttempts % 15 === 0) {
          console.log(`[REFRESH] Refresh halaman setelah ${stats.totalAttempts} attempts...`);
          await page.goto(
            'https://houseofmetamorfit.ampabatech.com/menu.php?open=paket-kids-view',
            { waitUntil: 'networkidle2' }
          );
          await new Promise(r => setTimeout(r, 1000));
        }

        // Click dropdown untuk search
        let dropdownClicked = false;
        for (let i = 0; i < 3; i++) {
          dropdownClicked = await page.evaluate(() => {
            const dropdown = document.querySelector('button.dropdown-toggle.btn-default');
            if (dropdown && dropdown.offsetParent !== null) {
              dropdown.click();
              return true;
            }
            return false;
          });
          
          if (dropdownClicked) break;
          await new Promise(r => setTimeout(r, 500));
        }

        if (!dropdownClicked) {
          console.log(`[INFO] Dropdown tidak ditemukan untuk target "${currentTarget}"`);
          currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
          if (currentTargetIndex === 0) stats.consecutiveFailures++;
          continue;
        }

        await new Promise(r => setTimeout(r, 200));

        // Clear dan ketik search term
        const searchTyped = await page.evaluate((target) => {
          const searchInput = document.querySelector('.bs-searchbox input.form-control');
          if (searchInput && searchInput.offsetParent !== null) {
            searchInput.value = '';
            searchInput.focus();
            searchInput.value = target;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
            return true;
          }
          return false;
        }, currentTarget);

        if (!searchTyped) {
          console.log(`[WARNING] Search input tidak dapat diakses untuk "${currentTarget}"`);
          currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
          if (currentTargetIndex === 0) stats.consecutiveFailures++;
          continue;
        }

        await new Promise(r => setTimeout(r, 400));

        // Cari dan klik option yang match
        const optionFound = await page.evaluate((nama) => {
          const items = [...document.querySelectorAll('.dropdown-menu.inner li a')];
          const lowerNama = nama.toLowerCase();
          
          const match = items.find(el => {
            const text = el.innerText.toLowerCase().trim();
            return text.includes(lowerNama) && 
                   !text.includes('tidak ada') && 
                   !text.includes('tidak ditemukan') &&
                   el.offsetParent !== null;
          });
          
          if (match) {
            match.click();
            return true;
          }
          return false;
        }, currentTarget);

        if (!optionFound) {
          console.log(`[INFO] Target "${currentTarget}" tidak ditemukan lagi`);
          currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
          
          if (currentTargetIndex === 0) {
            if (!currentLoopSuccess) stats.consecutiveFailures++;
            
            const allTargetsEmpty = targetList.every(target => {
              return stats.byTarget[target].attempts > stats.byTarget[target].deleted * 3;
            });
            
            if (allTargetsEmpty && stats.consecutiveFailures >= 2) {
              console.log('[INFO] Semua target sepertinya sudah habis');
              cycleCompleted = true;
              break;
            }
          }
          continue;
        }

        await new Promise(r => setTimeout(r, 500));

        // Klik tombol Pencarian
        let searchButtonClicked = false;
        for (let i = 0; i < 3; i++) {
          searchButtonClicked = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button'))
              .find(b => b.innerText.trim().toLowerCase() === 'pencarian' && b.offsetParent !== null);
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          });
          
          if (searchButtonClicked) break;
          await new Promise(r => setTimeout(r, 300));
        }

        if (!searchButtonClicked) {
          console.log(`[WARNING] Tombol pencarian tidak ditemukan untuk "${currentTarget}"`);
          currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
          if (currentTargetIndex === 0) stats.consecutiveFailures++;
          continue;
        }

        await new Promise(r => setTimeout(r, 600));

        // Cek tombol hapus
        const trashFound = await page.evaluate(() => {
          const trashBtns = Array.from(document.querySelectorAll('button, a'))
            .filter(el => el.innerHTML.includes('fa-trash') && el.offsetParent !== null);
          return trashBtns.length > 0;
        });

        if (!trashFound) {
          console.log(`[INFO] Tidak ada data untuk dihapus pada "${currentTarget}"`);
          currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
          if (currentTargetIndex === 0) stats.consecutiveFailures++;
          continue;
        }

        // Klik ikon hapus
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
          console.log(`[WARNING] Gagal klik tombol hapus untuk "${currentTarget}"`);
          currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
          if (currentTargetIndex === 0) stats.consecutiveFailures++;
          continue;
        }

        await new Promise(r => setTimeout(r, 400));

        // Klik "Ya" di popover
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
          console.log(`[WARNING] Gagal konfirmasi hapus untuk "${currentTarget}"`);
          currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
          if (currentTargetIndex === 0) stats.consecutiveFailures++;
          continue;
        }

        await new Promise(r => setTimeout(r, 600));

        // Success!
        stats.totalDeleted++;
        stats.byTarget[currentTarget].deleted++;
        currentLoopSuccess = true;
        stats.consecutiveFailures = 0;
        
        console.log(`[SUCCESS] "${currentTarget}" ke-${stats.byTarget[currentTarget].deleted} berhasil dihapus! (Total: ${stats.totalDeleted})`);

        // Move to next target
        currentTargetIndex = (currentTargetIndex + 1) % targetList.length;

        await new Promise(r => setTimeout(r, 300));

      } catch (loopError) {
        console.log(`[ERROR] Error untuk target "${currentTarget}": ${loopError.message}`);
        currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
        if (currentTargetIndex === 0) stats.consecutiveFailures++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // ================== FINAL REPORT ==================
    console.log('\n=== LAPORAN HASIL ===');
    console.log(`Total keseluruhan dihapus: ${stats.totalDeleted}`);
    console.log(`Total attempts: ${stats.totalAttempts}`);
    
    console.log('\nBreakdown per target:');
    targetList.forEach(target => {
      const targetStats = stats.byTarget[target];
      console.log(`- "${target}": ${targetStats.deleted} dihapus (${targetStats.attempts} attempts)`);
    });

    if (stats.totalDeleted === 0) {
      console.log('\n[INFO] Tidak ada paket yang ditemukan untuk semua target');
    } else if (stats.consecutiveFailures >= maxConsecutiveFailures) {
      console.log(`\n[WARNING] Berhenti karena ${maxConsecutiveFailures} kegagalan berturut-turut`);
    } else if (stats.totalAttempts >= maxTotalAttempts) {
      console.log(`\n[WARNING] Mencapai batas maksimal ${maxTotalAttempts} attempts`);
    } else if (cycleCompleted) {
      console.log('\n[SUCCESS] Proses selesai - semua target sudah diproses optimal');
    } else {
      console.log('\n[SUCCESS] Bulk delete multiple targets selesai!');
    }

    return {
      success: true,
      cabang: cabang.toUpperCase(),
      totalDeleted: stats.totalDeleted,
      byTarget: stats.byTarget
    };

  } catch (err) {
    console.error(`[FAILED] Proses Bulk Delete Error: ${err.message}`);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
  }
}