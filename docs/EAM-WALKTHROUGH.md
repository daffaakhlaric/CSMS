# Demo walkthrough EAM v4

1. Open `/eam`. Seed: 3 fictional owners, 30 master products, 100 sacks, 10 pallets, five ABF channels, one CS channel, seven role profiles. PLT-001 starts with 30 sacks. Default physical CS mapping is unset.
2. In Konfigurasi as SUPER_ADMIN, choose the verified demo physical space (Cold Storage Besar or Kecil). This is an explicit demo choice, not a statement of actual factory scope. Physical ABF machine count can differ from the fixed five monitoring points.
3. Overview: choose scenario; Start/Pause, Step, speed 1/2/5/10, Reset and Replay. Scenario 1 is the combined ABF → packing/palletization → partial loading/cancel/dispatch walkthrough; other scenarios demonstrate each stage independently. Reset before selecting a different scenario.
4. For the exact 30→20→21→9 example, select Final Dispatch scenario at 1× and observe PLT-001, loading list and timeline. Ten individual sacks load. At 38s sack SK-00010 returns, leaving 21 on pallet/9 in order. At 45s nine dispatch, leaving 91 original physical sacks. Combined scenario also creates five new sacks, so its total differs by five.
5. Manual workflow: Admin Packing chooses verified batch/product, master PCS is read-only, enters KG and date, confirms packing then sealing. Generated QR appears only after sealing. CS Operator creates/scans pallet, scans sealed sacks, confirms pallet and assigns rack-level-slot.
6. Admin Loading selects order, searches/scans individual sack code or QR, reviews details and confirms. Scanning a LOADING sack exposes cancellation with confirmation. Admin Office/Supervisor finalizes dispatch and prints Surat Jalan. Pallet QR cannot load sacks.
7. Inventory table is FEFO ordered. Scan stock opname under CS Operator, close under Supervisor. Authorized PCS discrepancy requires a reason and ledger adjustment; master updates do not rewrite existing sack snapshots.
8. Temperature: five ABF plus CS-01. Edit target/threshold and above/below direction. Temperature Alert scenario crosses the configured direction, marks the zone, logs an event and tasks the monitoring NPC. Disconnected channels do not produce new readings.
9. Click zones/racks/pallets/sacks/workers, search QR and inspect details. Worker histories show simulated tasks; never represent actual employees. Enable the separate evacuation layer only as an illustrative reference.
10. Ask Asisten AI EAM about inventory or loading. It receives a current snapshot and cannot perform transactions. Old AI temperature evaluation and earlier CSMS remain at `/legacy`.

## Database and replay

The demo run persists in PostgreSQL `.data/eam`. Refreshing the page retains state. Reset/replay recreates deterministic domain state from the seed, retaining backend command audit. There are no animation callbacks that modify stock. Production mode never runs scripted scenarios. Migration, actual Supabase user provisioning and verified master-data entry are prerequisites for controlled operational use.

## Pembaruan alur petugas — 14 Oktober 2026
- UI EAM menggunakan navigasi putih/teal mengikuti CSMS sebelumnya.
- Master Data (produk/pemilik/batch) dan Master Palet berada di menu tersendiri.
- Packing memilih master melalui pencarian kode/nama; expired dihitung dari tanggal produksi dan masa simpan master, lalu disimpan sebagai snapshot karung.
- ADMIN_PACKING hanya memiliki menu Operasional dan Inventori. Dapat packing, segel, scan/assign karung ke palet yang sudah ada, dan konfirmasi palletisasi; tidak dapat membuat master palet, putaway atau dispatch.
- ADMIN_LOADING hanya memiliki menu Pemuatan dan Inventori, termasuk scan QR karung dan pembatalan sebelum dispatch.
- Input scan menerima scanner QR USB/Bluetooth yang bertindak seperti keyboard, atau kode yang diketik. Kamera ponsel belum diintegrasikan.
- Label karung dan palet: QR asli, pratinjau, cetak 100 × 70 mm. Surat jalan: A4 landscape dengan rincian dispatch, total dan empat kolom tanda tangan. Pilih Cetak / Simpan PDF dari pratinjau.
- Akun petugas memakai Supabase produksi. Email masing-masing petugas masih menunggu dari pengguna; akun belum dibuat. Jalankan migrasi EAM sebelum memberi tujuh role baru.
- Semua petugas memakai workspace produksi yang sama: 00000000-0000-4000-8000-00000000ea01. Super Admin membuat workspace kosong setelah migrasi; inventori demo tidak disalin.
- Peran produksi berasal dari profiles di server, bukan pilihan peran demo. Sesi Supabase dipulihkan saat refresh dan token diperbarui mengikuti sesi.

## Master Data tabel dan popup — 14 Oktober 2026
Master Data kini memiliki tab Produk, Pemilik, dan Batch, masing-masing dengan tabel dan pencarian. Tombol Tambah membuka popup; Edit produk membuka popup berisi nilai saat ini. Kode produk yang sudah ada tidak dapat dibuat ulang melalui Tambah. Popup hanya ditutup setelah server menyatakan penyimpanan berhasil; kegagalan mempertahankan isian. Batas izin peran tetap diperiksa di server.

## Login dan logout — 15 Oktober 2026
Halaman `/login` menyediakan email/password, tombol tampilkan password, dan pemilih email dummy (password tidak ditanam dalam aplikasi). Mode simulasi aktif secara default untuk tes role; nonaktifkan untuk workspace operasional. Dashboard `/eam` memeriksa sesi dan profil sebelum menampilkan menu. Tombol Logout mengakhiri sesi pada perangkat ini dan kembali ke login. Pilihan role di dashboard terkunci untuk akun yang sudah login.

## Scan kamera — 15 Oktober 2026
- Packing: Scan kamera palet memilih palet tujuan; Scan kamera untuk isi palet mengisi karung, kemudian konfirmasi Assign. Scan kamera karung juga tersedia pada form segel.
- Loading: Scan kamera loading membuka karung yang cocok; gunakan Konfirmasi scan loading atau Batalkan Loading bila statusnya LOADING dan belum dispatch.
- Izinkan kamera saat popup dibuka. Pilih kamera bila perangkat mempunyai beberapa kamera. Kamera dihentikan saat popup ditutup, hasil diterima, atau halaman tidak aktif; Coba lagi mengaktifkan ulang.
- Pembacaan memakai ZXing lokal (QR dan barcode 1D yang memuat kode EAM terdaftar). Video tidak diunggah. Kode yang salah jenis/tidak dikenal ditolak dan scanner tetap terbuka.
- Browser membutuhkan localhost atau HTTPS untuk kamera; alamat HTTP LAN pada ponsel tidak cukup. Jika izin ditolak/tidak ada kamera, gunakan input manual/scanner USB.
- Tes decoder menggunakan piksel QR dari label EAM, termasuk validasi target palet/karung dan memastikan pembacaan tidak mengubah inventori. Pengujian kamera fisik memerlukan perangkat pengguna.

## Dispatch oleh Admin Loading — 15 Oktober 2026
ADMIN_LOADING kini boleh finalisasi dispatch di engine/API, selain Admin Office, Supervisor dan Super Admin. Admin Packing tetap tidak boleh. Tombol bernama Finalisasi dispatch. Konfirmasi, pengurangan stok sekali saja, dokumen surat jalan dan larangan pembatalan sesudah dispatch tetap berlaku.
Untuk Supabase produksi, jalankan supabase/migrations/202610150001_loading_dispatch.sql pada SQL Editor. Migrasi mengganti fungsi eam_commit dan hanya menambahkan dispatch pada izin loading; tidak memberikan izin verifikasi/master. Pemeriksaan remote saat implementasi masih mengembalikan Forbidden untuk role loading. Koneksi SQL/management tidak tersedia dari environment, sehingga migrasi belum diterapkan remote.

## Finalisasi dari kartu loading
Tombol Finalisasi / konfirmasi loading tersedia langsung di kartu daftar order untuk role yang berhak (termasuk ADMIN_LOADING). Popup menampilkan order/truk/pemilik/tujuan, karung aktif, PCS dan KG, lalu tombol Ya, finalisasi & terbitkan surat jalan. Popup tetap terbuka bila transaksi gagal. Tombol dinonaktifkan bila kosong, sudah dispatch, mode hanya baca, sedang menyimpan, atau role tidak berhak; status item sesudah dispatch ditampilkan TERKIRIM.

## Scan otomatis
Scan kamera Loading langsung menjalankan transaksi load; kamera isi palet langsung assign ke palet terpilih. Scanner keyboard/manual memicu transaksi dengan Enter. Tombol konfirmasi per-karung dihapus; finalisasi order, konfirmasi akhir palet, segel dan pembatalan tetap terpisah. Decoder menunggu hasil penyimpanan, menolak frame berulang saat memproses, dan mempertahankan popup bila gagal. Scan ulang barang LOADING atau sudah berada di palet tujuan tidak membuat transaksi duplikat.
