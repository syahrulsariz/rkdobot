import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../config/.env') });

export default async function handleReqHapusMem({ cabang, namaPaketTarget }) {
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

  console.log(`[PROCESS] Bulk Delete Multiple Paket Member:`);
  console.log(`- Cabang: ${cabang}`);
  console.log(`- Target Paket: [${targetList.join(', ')}] (${targetList.length} targets)`);
  
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

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log(`[STEP] Masuk ke cabang: ${cabang.toUpperCase()}`);
    await page.goto(`https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    console.log('[STEP] Masuk ke halaman view paket member...');
    await page.goto('https://houseofmetamorfit.ampabatech.com/menu.php?open=paket-member-view', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Statistik tracking
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

    while (stats.totalAttempts < maxTotalAttempts && stats.consecutiveFailures < maxConsecutiveFailures && !cycleCompleted) {
      stats.totalAttempts++;
      let currentLoopSuccess = false;
      
      // Ambil target saat ini (rotate)
      const currentTarget = targetList[currentTargetIndex];
      stats.byTarget[currentTarget].attempts++;
      
      try {
        console.log(`[LOOP ${stats.totalAttempts}] Target: "${currentTarget}" (${currentTargetIndex + 1}/${targetList.length})`);

        // Refresh halaman setiap 15 kali untuk avoid cache/session issues
        if (stats.totalAttempts % 15 === 0) {
          console.log(`[REFRESH] Refresh halaman setelah ${stats.totalAttempts} attempts...`);
          await page.goto('https://houseofmetamorfit.ampabatech.com/menu.php?open=paket-member-view', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          await new Promise(r => setTimeout(r, 1000));
        }

        // Click dropdown untuk search dengan retry
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

        currentTargetIndex = (currentTargetIndex + 1) % targetList.length;

        await new Promise(r => setTimeout(r, 300));

      } catch (loopError) {
        console.log(`[ERROR] Error untuk target "${currentTarget}": ${loopError.message}`);
        currentTargetIndex = (currentTargetIndex + 1) % targetList.length;
        if (currentTargetIndex === 0) stats.consecutiveFailures++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Final report dengan breakdown per target
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

    // Return stats untuk digunakan di handler
    return stats;

  } catch (err) {
    console.error(`[FAILED] Proses Bulk Delete Error: ${err.message}`);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
  }
}