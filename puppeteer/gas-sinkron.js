// puppeteer/sync-member.js
import puppeteer from 'puppeteer';

// Helper function untuk delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function syncMember(nomorAnggota) {
  console.log(`[PROCESS] Sync Member: ${nomorAnggota}`);

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

    console.log('[STEP 4] Tunggu load...');
    await delay(500);

    // STEP 2: Masuk ke halaman customer
    console.log('[STEP 5] Buka halaman customer...');
    await page.goto('https://admin.homgym.my.id/customer', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('[STEP 6] Tunggu load...');
    await delay(1000);

    // STEP 3: Klik button "Sync Data"
    console.log('[STEP 7] Klik tombol Sync Data...');
    
    const syncButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.bg-primary');
      for (let button of buttons) {
        const content = button.textContent.trim();
        if (content.includes('Sync Data')) {
          button.click();
          return true;
        }
      }
      return false;
    });

    if (!syncButtonClicked) {
      throw new Error('Tombol "Sync Data" tidak ditemukan');
    }

    await delay(1000);

    // STEP 4: Ketik nomor anggota
    console.log(`[STEP 8] Ketik nomor anggota: ${nomorAnggota}...`);
    
    const inputId = await page.evaluate(() => {
      const labels = document.querySelectorAll('label.v-label.v-field-label');
      for (let label of labels) {
        if (label.textContent.includes('Nomor anggota')) {
          return label.getAttribute('for');
        }
      }
      return null;
    });

    if (!inputId) {
      throw new Error('Input "Nomor anggota" tidak ditemukan');
    }

    await page.click(`#${inputId}`);
    await delay(300);
    
    // Ketik nomor anggota
    await page.type(`#${inputId}`, nomorAnggota, { delay: 50 });
    await delay(500);

    // STEP 5: Klik button "Check data"
    console.log('[STEP 9] Klik tombol Check data...');
    
    const checkButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.bg-primary');
      for (let button of buttons) {
        const content = button.textContent.trim();
        if (content.includes('Check data')) {
          button.click();
          return true;
        }
      }
      return false;
    });

    if (!checkButtonClicked) {
      throw new Error('Tombol "Check data" tidak ditemukan');
    }

    // STEP 6: Tunggu 5 detik
    console.log('[STEP 10] Tunggu 5 detik...');
    await delay(5000);

    // STEP 7: Klik button "Save"
    console.log('[STEP 11] Klik tombol Save...');
    
    const saveButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.text-primary.v-btn--variant-outlined');
      for (let button of buttons) {
        const content = button.textContent.trim();
        if (content.includes('Save')) {
          button.click();
          return true;
        }
      }
      return false;
    });

    if (!saveButtonClicked) {
      throw new Error('Tombol "Save" tidak ditemukan');
    }

    // STEP 8: Tunggu 5 detik
    console.log('[STEP 12] Tunggu 5 detik sebelum close...');
    await delay(5000);

    console.log('[SUCCESS] Sync member berhasil!');
    
    return {
      success: true,
      message: `Member ${nomorAnggota} berhasil di-syncron`
    };

  } catch (err) {
    console.error(`[FAILED] Proses Sync Member Error: ${err.message}`);
    throw new Error(`${err.message}`);
  } finally {
    await browser.close();
    console.log('[INFO] Browser closed.');
  }
};