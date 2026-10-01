import puppeteer from 'puppeteer';

// Helper function untuk delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function handleAkun(namaMember) {
  console.log(`[PROCESS] Cari Akun Member: ${namaMember}`);

  const namaSebenarnya = namaMember.trim();

  if (!namaSebenarnya) {
    throw new Error('Nama member tidak boleh kosong! Contoh: !reset John Doe');
  }

  console.log(`[INFO] Nama Member: ${namaSebenarnya}`);

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
    await dialog.accept();
  });

  try {
    // STEP 1: Login
    console.log('[STEP 1] Buka halaman login...');
    await page.goto('https://admin.homgym.my.id/auth/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('[STEP 2] Input username dan password...');
    await page.waitForSelector('input[type="email"], input[type="text"]', { timeout: 10000 });
    await page.type('input[type="email"], input[type="text"]', 'adminqc@mail.com');
    await page.type('input[type="password"]', 'qcadmin123#');

    console.log('[STEP 3] Klik Sign In...');
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    console.log('[STEP 4] Tunggu 2 detik...');
    await delay(500);

    // STEP 2: Masuk ke halaman customer
    console.log('[STEP 5] Buka halaman customer...');
    await page.goto('https://admin.homgym.my.id/customer', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('[STEP 6] Tunggu 2 detik...');
    await delay(500);

    // STEP 3: Klik search box
    console.log('[STEP 7] Klik search box...');

    const searchInputId = await page.evaluate(() => {
      const labels = document.querySelectorAll('label.v-label.v-field-label');
      for (let label of labels) {
        if (label.textContent.includes('Search') && !label.textContent.includes('Select')) {
          return label.getAttribute('for');
        }
      }
      return null;
    });

    if (!searchInputId) {
      throw new Error('Input "Search" tidak ditemukan');
    }

    await page.click(`#${searchInputId}`);
    await delay(500);

    // STEP 4: Ketik nama member
    console.log(`[STEP 8] Ketik nama member: ${namaSebenarnya}...`);
    for (let char of namaSebenarnya) {
      await page.keyboard.type(char, { delay: 50 });
    }

    // STEP 5: Tunggu hasil pencarian
    console.log('[STEP 9] Tunggu 2 detik untuk hasil pencarian...');
    await delay(2000);

    // STEP 6: Klik icon eye untuk detail
    console.log('[STEP 10] Cari nama member di table...');
    await page.waitForSelector('svg.icon-tabler-eye', { timeout: 10000 });

    const eyeClicked = await page.evaluate((searchName) => {
      const rows = document.querySelectorAll('tbody tr');

      if (rows.length === 0) {
        return { success: false, reason: 'Tidak ada data di table' };
      }

      // Kalau cuma 1 hasil, langsung klik
      if (rows.length === 1) {
        const nameCell = rows[0].querySelectorAll('td')[2];
        const eyeIcon = rows[0].querySelector('svg.icon-tabler-eye');
        const button = eyeIcon?.closest('a, button');

        if (button) {
          console.log('[MATCH] Cuma 1 hasil, langsung klik:', nameCell?.textContent.trim());
          button.click();
          return {
            success: true,
            name: nameCell?.textContent.trim() || 'Unknown',
            type: 'single-result'
          };
        }
      }

      // Kalau banyak hasil, cari exact match dulu
      const searchNameUpper = searchName.trim().toUpperCase();
      let exactMatch = null;
      let firstRow = null;

      for (let row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const nameCell = cells[2];
          const nameCellText = nameCell.textContent.trim().toUpperCase();
          const eyeIcon = row.querySelector('svg.icon-tabler-eye');

          if (!eyeIcon) continue;

          const button = eyeIcon.closest('a, button');
          if (!button) continue;

          if (!firstRow) {
            firstRow = { button, name: nameCell.textContent.trim() };
          }

          if (nameCellText === searchNameUpper) {
            exactMatch = { button, name: nameCell.textContent.trim() };
            break;
          }
        }
      }

      if (exactMatch) {
        console.log('[MATCH] Exact match ditemukan:', exactMatch.name);
        exactMatch.button.click();
        return { success: true, name: exactMatch.name, type: 'exact-match' };
      }

      if (firstRow) {
        console.log('[MATCH] Tidak ada exact match, pilih paling atas (no. 1):', firstRow.name);
        firstRow.button.click();
        return { success: true, name: firstRow.name, type: 'first-row' };
      }

      return { success: false, reason: 'Tidak ada tombol eye yang bisa diklik' };
    }, namaSebenarnya);

    if (!eyeClicked.success) {
      throw new Error(`Member dengan nama "${namaSebenarnya}" tidak ditemukan. ${eyeClicked.reason || ''}`);
    }

    console.log(`[INFO] Member ditemukan (${eyeClicked.type}): ${eyeClicked.name}`);

    // STEP 7: Tunggu halaman detail muncul
    console.log('[STEP 11] Tunggu halaman detail member...');
    await page.waitForSelector('.text-h5', { timeout: 10000 });
    await delay(2000);

    // STEP 8: Klik tombol Regenerate Password
    console.log('[STEP 12] Klik tombol Regenerate Password...');
    const regenerateClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const regenerateBtn = buttons.find(btn => {
        const svg = btn.querySelector('.icon-tabler-circle-key');
        const text = btn.textContent.includes('Regenerate Password');
        return svg && text;
      });

      if (regenerateBtn) {
        regenerateBtn.click();
        return true;
      }
      return false;
    });

    if (!regenerateClicked) {
      throw new Error('Tombol Regenerate Password tidak ditemukan');
    }

    console.log('[INFO] Tombol Regenerate Password berhasil diklik');
    await delay(1000);

    // STEP 9: Klik tombol Confirm
    console.log('[STEP 13] Klik tombol Confirm...');
    const confirmClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirmBtn = buttons.find(btn =>
        btn.textContent.trim() === 'Confirm' &&
        btn.classList.contains('text-success')
      );

      if (confirmBtn) {
        confirmBtn.click();
        return true;
      }
      return false;
    });

    if (!confirmClicked) {
      throw new Error('Tombol Confirm tidak ditemukan');
    }

    console.log('[INFO] Tombol Confirm berhasil diklik');
    await delay(1500);

    console.log('[SUCCESS] Password berhasil di-regenerate!');

    return {
      success: true,
      message: 'Password berhasil di-regenerate'
    };

  } catch (err) {
    console.error(`[FAILED] Proses Regenerate Password Error: ${err.message}`);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
  }
};