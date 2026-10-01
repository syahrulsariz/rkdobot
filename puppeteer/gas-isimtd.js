// puppeteer/gas-isimtd.js
import puppeteer from 'puppeteer';
const delay = ms => new Promise(res => setTimeout(res, ms));

async function handleIsiMTD(dataMTD) {
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',        // pakai /tmp daripada /dev/shm
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
  await page.goto("https://rkdosystem.com/hom/", {
    waitUntil: "networkidle2"
  });

  // ============ RESET MTD ============
  console.log("🗑️ Klik reset MTD...");
  await page.click('button[onclick="resetMTD()"]');
  await delay(1000);
  await page.click("#modalYes");
  console.log("✅ Konfirmasi Reset MTD (YA)");
  await delay(1500);

  // ============ INPUT DATA ============
  for (const [club, mtdValue] of Object.entries(dataMTD)) {
    console.log(`🔎 Cari club: ${club} | nilai: ${mtdValue}`);
    let found = false;

    const rows = await page.$$("table tr");
    for (const row of rows) {
      const cells = await row.$$("td");
      if (cells.length > 1) {
        const clubName = await page.evaluate(el => el.innerText.trim().toLowerCase(), cells[1]);

        if (clubName === club.toLowerCase()) {
          const input = await cells[3].$("input");
          if (input) {
            // langsung set value tanpa ngetik manual
            await page.evaluate((el, val) => {
              el.value = val;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }, input, mtdValue);

            console.log(`✅ ${club} berhasil isi MTD (${parseInt(mtdValue).toLocaleString("id-ID")})`);
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      console.warn(`❌ CLUB tidak ditemukan: ${club}`);
    }
  }

  // ============ SAVE TO SERVER ============
  console.log("💾 Klik Simpan ke Server...");
  await page.click('button[onclick="saveToServer()"]');
  await delay(1000);
  await page.click("#modalYes");
  console.log("✅ Data berhasil disimpan ke server");

  await delay(2000);
  await browser.close();

  return "Proses isi MTD selesai ✅";
}

export { handleIsiMTD };
