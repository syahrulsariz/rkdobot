import puppeteer from 'puppeteer';

// Helper function untuk delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function handleAkun(namaMember) {
  console.log(`[PROCESS] Cari Akun Member: ${namaMember}`);

  const namaSebenarnya = namaMember.trim();

  if (!namaSebenarnya) {
    throw new Error('Nama member tidak boleh kosong! Contoh: !akun John Doe');
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
    await delay(1500);

    // STEP 6: Klik icon eye untuk detail (REVISI - PILIH PALING ATAS ATAU EXACT MATCH)
    console.log('[STEP 10] Cari nama member di table...');
    await page.waitForSelector('svg.icon-tabler-eye', { timeout: 10000 });

    // Logika:
    // 1. Kalau cuma 1 hasil -> langsung klik
    // 2. Kalau banyak -> cari exact match dulu
    // 3. Kalau ga ada exact match -> pilih paling atas (no. 1)
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
          const nameCell = cells[2]; // Kolom "Name"
          const nameCellText = nameCell.textContent.trim().toUpperCase();
          const eyeIcon = row.querySelector('svg.icon-tabler-eye');

          if (!eyeIcon) continue;

          const button = eyeIcon.closest('a, button');
          if (!button) continue;

          // Simpan row pertama sebagai backup
          if (!firstRow) {
            firstRow = { button, name: nameCell.textContent.trim() };
          }

          // Cek exact match
          if (nameCellText === searchNameUpper) {
            exactMatch = { button, name: nameCell.textContent.trim() };
            break;
          }
        }
      }

      // Prioritas: exact match > first row
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

    // STEP 8: Ambil data Phone dan Birthdate
    console.log('[STEP 12] Ambil data Phone dan Birthdate...');
    const memberData = await page.evaluate(() => {
      const infoGrid = document.querySelector('.info-grid');

      if (infoGrid) {
        const labels = infoGrid.querySelectorAll('.label');
        const values = infoGrid.querySelectorAll('.value');

        let phoneValue = '';
        let birthdateValue = '';

        for (let i = 0; i < labels.length; i++) {
          const labelText = labels[i].textContent.trim();
          const valueText = values[i] ? values[i].textContent.trim() : '';

          if (labelText === 'Phone') {
            phoneValue = valueText;
          }

          if (labelText === 'Birthdate') {
            birthdateValue = valueText;
          }
        }

        return { phone: phoneValue, birthdate: birthdateValue };
      }

      // Fallback
      const rows = document.querySelectorAll('.v-row.px-6 .v-col');
      let phoneValue = '';
      let birthdateValue = '';

      for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent.trim();

        if (text === 'Phone' && rows[i + 1]) {
          phoneValue = rows[i + 1].textContent.trim();
        }

        if (text === 'Birthdate' && rows[i + 1]) {
          birthdateValue = rows[i + 1].textContent.trim();
        }
      }

      return { phone: phoneValue, birthdate: birthdateValue };
    });

    if (!memberData.phone || !memberData.birthdate) {
      throw new Error('Data member tidak lengkap, coba lagi');
    }

    console.log(`[DATA] Phone: ${memberData.phone}`);
    console.log(`[DATA] Birthdate: ${memberData.birthdate}`);

    // Format ID: +62 atau + 62 jadi 0
    let memberId = memberData.phone;
    if (memberId.includes('+62') || memberId.includes('+ 62')) {
      memberId = memberId.replace(/\+\s*62\s*/, '0');
    }
    memberId = memberId.replace(/\s+/g, '');

    // Format Password: 1978-03-21 jadi 19780321
    let memberPassword = memberData.birthdate.replace(/-/g, '');

    console.log('[SUCCESS] Data member berhasil didapat!');
    console.log(`[RESULT] ID: ${memberId}, PW: ${memberPassword}`);

    return {
      id: memberId,
      password: memberPassword
    };

  } catch (err) {
    console.error(`[FAILED] Proses Cari Akun Error: ${err.message}`);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
  }
};