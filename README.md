# CSMS — Cirebon Frozen Food

Aplikasi Next.js / TypeScript dengan dashboard Bahasa Indonesia, dua ruang penyimpanan dingin, simulator suhu independen, operasional karung, dan Digital Twin React Three Fiber / Three.js.

## Jalankan lokal

```powershell
npm install
npm run dev
```

Buka http://127.0.0.1:3000. Demo langsung berjalan tanpa Supabase atau perangkat keras. Data disimpan di localStorage dan disinkronkan antartab pada origin yang sama. Web Locks melindungi penulisan bersamaan. Gunakan tombol **Ekspor data** untuk menyimpan snapshot JSON. **Simulator → Reset seluruh data demo** meminta konfirmasi.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Tes database memakai PostgreSQL WASM (PGlite), menyiapkan shim `auth.uid()` / roles Supabase, lalu menjalankan migrasi dan seed sebenarnya. Ekstensi pgcrypto dilewati pada pengujian karena `gen_random_uuid()` tersedia di PostgreSQL core. Pengujian ini tidak membuktikan konfigurasi Auth, Realtime, jaringan, maupun deployment Supabase hosted.

## Data demonstrasi

- CS-01 dan CS-02, masing-masing satu sensor; 500 karung, 6.000 PCS, kuantitas KG hasil seed.
- PTA8D08-DEMO-01: CH1 → TEMP-CS-01; CH2 → TEMP-CS-02; CH3–CH8 tidak dialokasikan.
- 30 hari riwayat per ruang dengan interval satu jam; simulator aktif memperbarui setiap tiga detik.
- Lima rak, tiga level, dua puluh slot per level per ruang hanyalah konfigurasi demonstrasi.
- ABF: satu unit demonstrasi, target −40°C, durasi 13 jam. Jumlah, target, dan durasi dapat diubah. Tidak ada sensor ABF fisik.
- Semua nama perusahaan, dimensi, target suhu, kapasitas, dan stok adalah fiktif.

## Alur operasional

1. **Operasional**: catat batch/PCS hasil bongkar ABF.
2. Admin Office memverifikasi jumlah batch.
3. Siapkan karung dari batch terverifikasi, pemilik, dan tanggal produksi. Kedaluwarsa menggunakan masa simpan produk atau bawaan 365 hari.
4. Catat PCS, timbang manual atau gunakan timbangan MOCK, lalu jahit/segel. Operator dan waktu dicatat.
5. Tempatkan karung tersegel ke ruang/rak/level/slot kosong. Contoh slot kosong awal: CS-01, rak 5, level 1, slot 11.
6. **Pemuatan**: buat pesanan, pilih produk dan target minimum PCS/KG, lalu pindai QR HID atau ketik ID dan Enter.
7. Admin Loading mengirim laporan setelah kedua target terpenuhi. Kelebihan muatan ditampilkan untuk diperiksa.
8. Admin Office mengonfirmasi pengiriman. Karung dimuat masih dihitung sebagai stok; stok berkurang tepat satu kali pada konfirmasi.

Contoh QR: `CSMS:KRG-00001`. Karung ganjil adalah kepala ikan; karung genap adalah daging ikan tanpa tulang. Sepuluh karung ganjil pertama memenuhi pesanan EXP-2026-001.

## Digital Twin

Geometri prosedural tanpa model berbayar: ABF, pengemasan, timbangan, penjahitan, dua cold storage dengan rak/karung, pendingin, forklift, truk, kantor. Orbit/zoom/pan, tampak atas, isometrik, reset, atap/dinding, klik ruang/rak/karung, dan pencarian ID/QR. Karung terpilih berwarna jingga. Warna ruang mengikuti status pemantauan, bukan simulasi termal. Animasi bertanda DEMO bergerak satu arah sampai truk dan tidak memanggil mutasi stok.

## Mengaktifkan Supabase

1. Siapkan project Supabase milik Anda. Belum ada project cloud yang dibuat atau dimodifikasi oleh aplikasi ini.
2. Jalankan berurutan di SQL Editor: `supabase/migrations/202610120001_csms.sql`, kemudian `202610120002_snapshot_simulation.sql`.
3. Untuk database **demo kosong**, jalankan `supabase/seed.sql`. Seed menolak database dengan ruang atau karung yang sudah ada. Jangan menjalankan seed ke produksi.
4. Buat pengguna Auth melalui dashboard Supabase. Tambahkan profil menggunakan SQL Editor dengan UUID pengguna tersebut:

```sql
insert into public.profiles (id, display_name, role)
values ('UUID-PENGGUNA-AUTH', 'Nama operator', 'admin');
```

Peran tersedia: `admin`, `packing`, `office`, `loading`, `viewer`. Profil tidak dapat dinaikkan hak aksesnya oleh browser. Buat akun terpisah untuk pembatasan peran sebenarnya; mode lokal hanya memperagakan semua peran.

5. Salin `.env.example` ke `.env.local`, isi URL project dan anon key, lalu jalankan ulang server.
6. **Pengaturan → Koneksi backend Supabase**: masuk menggunakan akun staf. Data lokal tidak diunggah otomatis. UI membaca snapshot backend dan mutasi menggunakan RPC yang memeriksa peran.

RLS membatasi pembacaan ke staf terdaftar; akses langsung menulis tabel ditolak. Fungsi `csms_operate` memeriksa peran dan tahap alur. `confirm_dispatch` mengunci pesanan dan karung, membuat dispatch unik dan ledger, serta mengurangi stok dalam transaksi yang sama. Pemanggilan ulang mengembalikan dispatch yang sama.

Realtime publication mencakup suhu, alarm, simulator, stok, ledger, pesanan, batch, dan konfigurasi. Simulator backend hanya berjalan saat akun admin membuka halaman yang terlihat. Untuk operasi terus-menerus diperlukan worker/gateway terjadwal; simulator browser bukan daemon 24/7. Pengguna perlu masuk kembali untuk memilih mode Supabase setelah memuat ulang halaman.

## Integrasi perangkat keras

`lib/adapters.ts` menyediakan SimulatorAdapter, MockScaleAdapter, dan scaffold PTA8D08Adapter. Register, baud rate, slave ID, dan decoder harus berasal dari manual resmi. Scaffold sengaja menolak membaca serial karena transport gateway belum dipasang. Browser tidak mengakses RS485.

Endpoint backend `POST /api/telemetry` menerima JSON:

```json
{"sensor":"TEMP-CS-01","temperature":-20.1,"at":"2026-10-12T02:00:00.000Z","eventId":"00000000-0000-4000-8000-000000000001"}
```

Gateway menandatangani `timestamp + '.' + rawJson` dengan HMAC SHA-256 menggunakan `CSMS_GATEWAY_SECRET`. Header: `x-csms-timestamp` (Unix milidetik), `x-csms-signature` (hex). Endpoint membatasi payload 4 KB, jendela tanda tangan lima menit, lalu menggunakan service role **server-only** ke RPC ingest. `eventId` unik mencegah duplikasi replay. Jangan menaruh service role di frontend atau gateway. Gunakan HTTPS ketika di-host. Rotasi dan penyimpanan rahasia gateway menjadi bagian konfigurasi deployment.

## Batas implementasi dan verifikasi lapangan

- Tata letak 3D bersifat ilustrasi. Gambar/layout pabrik sebenarnya belum tersedia; ukuran ruang, jarak ruang, lantai, dan dimensi rak tersedia di `lib/factory-layout.ts`; posisi area di `components/twin.tsx`, jumlah rak/level/slot di Pengaturan. Tidak mengklaim kesesuaian ukuran pabrik.
- Belum ada pengujian pada perangkat PTA8D08, timbangan fisik, atau scanner fisik. Input HID dapat diuji dengan keyboard.
- Ingest hardware ditolak untuk ruang demo atau perangkat dengan `configuration.manual_verified` bukan `true`. Setelah verifikasi fisik, admin database dapat menonaktifkan `chambers.is_demo` dan menandai manual terverifikasi. UI membedakan SIMULATED / HARDWARE dan menandai pembacaan kedaluwarsa; uji gateway end-to-end tetap diperlukan. Jangan menandai perangkat terverifikasi sebelum manual dan pemasangan diperiksa.
- Distribusi hak akses Auth dan Realtime perlu smoke test pada project Supabase pengguna setelah konfigurasi.
- Belum ada deployment publik. Server preview hanya bind ke 127.0.0.1.
- Rancangan awal ini belum mencakup pembatalan alokasi pemuatan, retur pengiriman, atau pengeditan data historis; alur tersebut perlu transaksi bisnis tersendiri.

Status pengujian akhir dicatat di `VERIFICATION.md`.

## Skor efektivitas dan evaluator AI

Di halaman Simulator, mulai simulasi lalu pilih **Rekam sesi baru** untuk tiap ruang. Setelah minimal 20 detik (disarankan 60), pilih **Selesaikan sesi** lalu **Evaluasi dengan AI**. Skor dasar tetap tersedia tanpa API. Sesi pengamatan hanya berjalan saat panel terbuka, maksimal 300 pengamatan; mengganti skenario/ambang/derau atau keluar halaman memulai sesi baru. Lima ringkasan evaluasi AI terakhir per ruang disimpan di browser.

Tambahkan pada `.env` (server saja):

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Restart server setelah mengisi key. Jangan mengirim key melalui chat atau menggunakan awalan NEXT_PUBLIC_. Model dapat diganti dengan model Responses API yang mendukung function calling dan Structured Outputs.

Skor v1 = ketersediaan × (60 × fraksi waktu suhu di bawah peringatan + 25 × kedekatan target + 15). Kedekatan = max(0, 1 − deviasi absolut rata-rata / (peringatan − target)). Pengamatan tidak valid tidak menghasilkan kredit. Kriteria sama lintas skenario: skor rendah pada simulasi gangguan adalah kondisi pendinginan yang buruk, bukan kegagalan simulator. Tidak ada metrik konsumsi energi atau kesimpulan keamanan pangan.

Agent memakai dua panggilan Responses API: membaca metrik, memanggil tool compare_interventions (tiga rollout sintetis 120 detik), lalu menghasilkan analisis terstruktur. Prediksi mengasumsikan sensor pulih dan derau nol; tidak mengendalikan hardware. Skor numerik dihitung server, bukan dikarang model. Data yang dikirim hanya konfigurasi dan pengamatan suhu sesi, tanpa inventori/kredensial. API menggunakan store:false, timeout 45 detik, batas payload, satu evaluasi aktif per proses, serta jeda 10 detik. Endpoint sengaja hanya melayani origin localhost/127.0.0.1; deployment remote memerlukan autentikasi dan pembatasan biaya terdistribusi.

Referensi implementasi: https://developers.openai.com/api/docs/guides/structured-outputs

## Chat asisten dan hasil evaluasi

Tombol **Tanya Asisten AI** tersedia di kanan bawah semua halaman. Asisten menerima snapshot per pesan: agregat inventori menurut produk/pemilik/ruang/status, suhu dan sumber sensor, alarm aktif, pesanan, detail ID karung yang ditanyakan, serta evaluasi terakhir setiap ruang. Jawaban hanya bersifat baca; tidak mengubah perangkat maupun stok. Percakapan disimpan selama halaman terbuka. Data ringkasan tersebut dikirim ke OpenAI hanya saat mengirim pertanyaan. Riwayat dibatasi 12 pesan dan endpoint localhost membatasi ukuran permintaan serta satu panggilan aktif per proses.

Hasil evaluasi kini menyimpan insight lengkap beserta perbandingan intervensi dalam riwayat browser. Hasil terakhir otomatis muncul saat membuka Simulator; gunakan **Buka insight** untuk memilih hasil sebelumnya. Hasil bertanggal adalah snapshot sesi lampau, bukan skor kondisi ruang saat ini. Ringkasan lama yang dibuat sebelum fitur ini tidak memiliki insight lengkap; jalankan evaluasi baru.

## EAM v4 upgrade

The default page now opens `/eam`. The previous CSMS remains at `/legacy` with its existing data and AI evaluation features. New EAM demonstration data is isolated in local PostgreSQL `.data/eam` and never overwrites existing Supabase inventory.

Start here: [Demo walkthrough](docs/EAM-WALKTHROUGH.md), [architecture and Supabase setup](docs/EAM-ARCHITECTURE.md), [floor-plan interpretation](docs/EAM-FLOOR-PLAN.md), [implementation status](docs/EAM-IMPLEMENTATION-PLAN.md).

Before running a spatial scenario, an admin must choose the physical mapping for the one active CS-01. The initial value is deliberately unset. Five ABF monitoring channels are independent from physical machine count. Production Supabase requires the additive `202610130001_eam.sql` migration; it has not been executed remotely by this task.
