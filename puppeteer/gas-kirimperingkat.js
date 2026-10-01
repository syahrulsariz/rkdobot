import puppeteer from 'puppeteer';

const delay = ms => new Promise(res => setTimeout(res, ms));

export async function handleKirimPeringkat(dateStr) {
  const [d, m, y] = dateStr.split('-').map(s => parseInt(s, 10));
  const tahunFull = 2000 + y; // misal '25' -> 2025
  
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
    await page.goto("https://rkdosystem.com/hom/gasreport.html", { 
      waitUntil: "networkidle2" 
    });
    
    // ============ SET DROPDOWN TANGGAL/BULAN/TAHUN ============
    await page.select('#tanggal', String(d));
    await page.select('#bulan', String(m - 1)); // 0-indexed
    await page.select('#tahun', String(tahunFull));
    
    // Tunggu data pre muncul
    await page.waitForSelector('pre.club');
    await delay(1000); // tunggu render stabil
    
    // ============ AMBIL TEKS DARI WEB ============
    const teks = await page.evaluate(() => {
      const judul = document.getElementById('judul-peringkat').textContent;
      const preClub = Array.from(document.querySelectorAll('pre.club'))
        .map(pre => pre.textContent.trim())
        .join("\n\n"); // 1 baris antar club
      const preTotalEl = document.querySelector('pre.total');
      const preTotal = preTotalEl ? "\n\n" + preTotalEl.textContent.trim() : ""; // 2 baris sebelum total
      
      let hasil = judul + "\n\n" + preClub + preTotal; // judul → club pertama = 1 baris
      
      // Hapus baris tanggal
      hasil = hasil.replace(/Tanggal:[\s\S]*?\n/g, "");
      
      return hasil.trim();
    });
    
    return teks;
  } catch (err) {
    console.error('[ERROR gas-kirimperingkat]', err.message);
    throw err;
  } finally {
    await browser.close();
  }
}