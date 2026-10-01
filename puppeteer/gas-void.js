import puppeteer from 'puppeteer';
import cabangMap from '../utils/cabang-map.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../config/.env') });

export async function handleVoidCommand(cabang, jenis, noMember, sock) {
  console.log(`[PROCESS] Void : Cabang=${cabang}, Jenis=${jenis}, NoMember=${noMember}`);
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
    console.log('[STEP] Login ke sistem...');
    await page.goto('https://houseofmetamorfit.ampabatech.com/index.php', { waitUntil: 'networkidle2' });
    await page.type('input[name="namapengguna"]', process.env.USERNAME);
    await page.type('input[name="katasandi"]', process.env.PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const cabangId = cabangMap[cabang.toLowerCase()];
    console.log(`[INFO] Cabang ID: ${cabangId}`);

    await page.goto(`https://houseofmetamorfit.ampabatech.com/secure_login2.php?id=${cabangId}`, { waitUntil: 'networkidle2' });

    const jenisURLMap = {
      mem: 'approval-member-view',
      memkids: 'approval-member-kids-view',
      pt: 'approval-pt-view&link=reguler',
      ptkids: 'approval-pt-kids-view'
    };
    const urlPath = jenisURLMap[jenis];
    if (!urlPath) throw new Error('Jenis tidak dikenali');

    await page.goto(`https://houseofmetamorfit.ampabatech.com/menu.php?open=${urlPath}`, { waitUntil: 'networkidle2' });

    return await handleSingleVoid(page, jenis, cabang, noMember, browser);

  } catch (err) {
    console.error('❌ Error handleVoidCommand:', err.message);
    if (browser) await browser.close();
    return 'ulangi sekali lagi';
  }
}

// Cari member (via dropdown search, sama seperti approve), lalu klik Void Transaction -> konfirmasi Ya
async function handleSingleVoid(page, jenis, cabang, noMember, browser) {
  try {
    console.log(`🔍 Mencari member No.${noMember} untuk di-void...`);

    await page.waitForSelector('.filter-option');
    await page.click('.filter-option');

    await page.waitForSelector('.bs-searchbox input', { visible: true });
    await page.type('.bs-searchbox input', noMember);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const dropdownItems = await page.$$('.dropdown-menu.inner li:not(.hidden) a');
    console.log(`[DEBUG] Jumlah dropdown item yang tidak hidden: ${dropdownItems.length}`);

    let found = false;
    for (const item of dropdownItems) {
      const text = await item.evaluate(el => el.textContent.trim().toLowerCase());
      if (text.includes(noMember.toLowerCase())) {
        await item.hover();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await item.click();
        found = true;
        break;
      }
    }

    if (!found) {
      console.log(`[DEBUG] Tidak ada match untuk noMember="${noMember.toLowerCase()}"`);
      await browser.close();
      return `gak ada no member ${noMember} di data approval`;
    }

    // Klik search button
    if (jenis === 'mem' || jenis === 'memkids') {
      await page.waitForSelector('button[name="search"]');
      await page.click('button[name="search"]');
    } else {
      await page.waitForSelector('button[name="search2"]');
      await page.click('button[name="search2"]');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Ambil invoice & nama asli dari hasil pencarian
    const { noInvoice, namaAsli } = await page.evaluate(() => {
      const row = document.querySelector('table tbody tr');
      if (!row) return { noInvoice: '', namaAsli: '' };
      const tds = row.querySelectorAll('td');
      const invoice = tds[2]?.textContent.trim().toUpperCase() || '';
      const nama = tds[4]?.textContent.trim() || '';
      return { noInvoice: invoice, namaAsli: nama };
    });

    if (!namaAsli) {
      await browser.close();
      return `❌ Gagal ambil nama member dari hasil pencarian no ${noMember}`;
    }

    console.log(`[INFO] Ditemukan: ${namaAsli} | Invoice: ${noInvoice}`);

    // Scroll kanan supaya tombol Void Transaction kelihatan
    await page.evaluate(() => {
      const container = document.querySelector('.table-responsive');
      if (container) container.scrollLeft = container.scrollWidth;
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cari tombol "Void Transaction" berdasarkan teksnya (lebih aman daripada urutan class)
    const voidBtnHandle = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('a[data-toggle="confirmation"]'));
      return links.find(a => a.textContent.toLowerCase().includes('void')) || null;
    });
    const voidBtn = voidBtnHandle.asElement();

    if (!voidBtn) {
      await browser.close();
      return '❌ Tombol Void Transaction tidak ditemukan!';
    }

    await voidBtn.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await voidBtn.click();

    // Tunggu popup konfirmasi muncul (data-apply="confirmation" -> tombol "Ya")
    try {
      await page.waitForSelector('a[data-apply="confirmation"]', { visible: true, timeout: 10000 });
    } catch (waitErr) {
      await browser.close();
      return '❌ Popup konfirmasi void tidak muncul!';
    }
    await new Promise(resolve => setTimeout(resolve, 500));

    const yaBtnHandle = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('a[data-apply="confirmation"]'));
      return links.find(a => a.textContent.trim().toLowerCase() === 'ya') || links[0] || null;
    });
    const yaBtn = yaBtnHandle.asElement();

    if (!yaBtn) {
      await browser.close();
      return '❌ Tombol konfirmasi "Ya" tidak ditemukan!';
    }

    await yaBtn.click();

    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    } catch (navError) {
      console.error(`Navigation error setelah konfirmasi void untuk ${namaAsli}:`, navError.message);
      await browser.close();
      return `⚠️ Void mungkin berhasil untuk *${namaAsli}* tapi gagal verifikasi halaman setelahnya, cek manual ya.`;
    }

    console.log(`✅ Void berhasil untuk ${namaAsli}`);
    await browser.close();

    return {
      cabangName: cabang.toUpperCase(),
      nama: namaAsli.toUpperCase(),
      noInvoice,
      voided: true
    };

  } catch (err) {
    console.error(`❌ Error handleSingleVoid:`, err.message);
    if (browser) await browser.close();
    return `❌ Error saat void: ${err.message}`;
  }
}