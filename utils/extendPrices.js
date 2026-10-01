// utils/extendPrices.js

// Mapping hari -> harga (buat pesan ke user) & label nominal di topup.ebelanja.id/dana
// PENTING: `nominalLabel` harus PERSIS sama dengan teks yang ditampilkan di card nominal
// situs (mis. "10k"). `price` di sini cuma dipakai buat pesan "Memproses..." awal —
// harga FINAL yang beneran ditagih diambil langsung dari halaman QR (bisa beda dikit
// karena markup dinamis situs), lihat `totalAmount` dari initiateTopup().
//
// TODO: konfirmasi ulang apakah SEMUA label di bawah ini beneran ada di grid nominal
// topup.ebelanja.id/dana. Kalau ada yang nggak ada (mis. gak ada "3k" atau "75k"),
// ganti nominalLabel-nya ke denominasi terdekat yang tersedia.
export const EXTEND_PRICES = {
  7:   { price: 10000,  nominalLabel: '10k',  label: '10K' },
  14:  { price: 20000,  nominalLabel: '20k',  label: '20K' },
  21:  { price: 25000,  nominalLabel: '25k',  label: '25K' },
  30:  { price: 30000,  nominalLabel: '30k',  label: '30K' },
  45:  { price: 35000,  nominalLabel: '35k',  label: '35K' },
  60:  { price: 40000,  nominalLabel: '40k',  label: '40K' },
  75:  { price: 45000,  nominalLabel: '45k',  label: '45K' },
  90:  { price: 50000,  nominalLabel: '50k',  label: '50K' },
  105: { price: 55000,  nominalLabel: '55k',  label: '55K' },
  120: { price: 60000,  nominalLabel: '60k',  label: '60K' },
  135: { price: 65000,  nominalLabel: '65k',  label: '65K' },
  150: { price: 70000,  nominalLabel: '70k',  label: '70K' },
  165: { price: 75000,  nominalLabel: '75k',  label: '75K' },
  180: { price: 80000,  nominalLabel: '80k',  label: '80K' },
  195: { price: 85000,  nominalLabel: '85k',  label: '85K' },
  210: { price: 90000,  nominalLabel: '90k',  label: '90K' },
  225: { price: 95000,  nominalLabel: '95k',  label: '95K' },
  240: { price: 100000, nominalLabel: '100k', label: '100K' },
  300: { price: 150000, nominalLabel: '150k', label: '150K' },
  360: { price: 200000, nominalLabel: '200k', label: '200K' },
};

export function getExtendOption(days) {
  return EXTEND_PRICES[Number(days)] || null;
}