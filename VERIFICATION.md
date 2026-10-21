# Verifikasi implementasi

Tanggal: 12 Oktober 2026 (WIB). Proyek dibuat dari workspace kosong.

## Pengujian otomatis

Build produksi Next.js berhasil. Typecheck dan lint berhasil. Berkas `next-env.d.ts` yang dihasilkan Next.js dikecualikan dari lint, sementara kode aplikasi tetap diperiksa. `npm audit --omit=dev`: 0 kerentanan produksi. Audit seluruh dependensi masih melaporkan 5 temuan pada rantai ESLint → fast-glob → micromatch → braces (tool pengembangan); versi braces terbaru yang tersedia saat pemeriksaan masih 3.0.3. Tidak dilakukan downgrade lint atau `audit fix --force` yang mengubah versi mayor secara otomatis.

`npm test`: **10 tes lulus**.

- Dua ruang, dua sensor unik, 500 karung, 720 pembacaan historis per ruang.
- Pengaturan suhu dan alarm CS-01 / CS-02 independen.
- Sensor offline/stale tidak membuat pembacaan baru palsu.
- QR menyelesaikan ID karung yang benar.
- Batch wajib diverifikasi, karung wajib disegel, lokasi terisi ditolak.
- Stok diperbarui saat penempatan; persiapan pemuatan tidak mengurangi stok.
- Pengiriman memerlukan laporan; pemanggilan konfirmasi ulang tidak menggandakan pengurangan atau ledger.
- Ledger demo direkonsiliasi dengan inventori PCS dan KG.
- Override kedaluwarsa produk, validasi ambang, seluruh skenario dan pause.
- Migrasi dan seed dijalankan pada PostgreSQL WASM (PGlite); RLS dan peran diuji menggunakan shim Auth.
- Anonim / akun tanpa profil / role salah / update langsung ditolak; snapshot dan simulasi RPC diuji.
- Gateway menolak konfigurasi kosong, tanda tangan salah/kedaluwarsa, JSON salah, dan payload terlalu besar.
- Ingest hardware memerlukan ruang non-demo dan perangkat terverifikasi; event berulang tidak menggandakan pembacaan.

## Pengujian antarmuka browser

Dilakukan pada browser dalam aplikasi, melalui kontrol UI:

1. Dashboard menampilkan dua ruang, 6.000 PCS, 10.250 KG, 500 karung.
2. CS-01 diatur −8°C dan menjadi Kritis; CS-02 tetap normal.
3. CS-02 diatur −21,5°C; CS-01 tetap −8°C. Kedua nilai terlihat pada dashboard dan label Digital Twin.
4. QR `CSMS:KRG-00300` membuka karung pada CS-02, rak 1, level 3, slot 10 dengan QR dan detail produk.
5. Produk karung yang tidak sesuai pesanan ditolak pada pemuatan.
6. Sepuluh karung sesuai pesanan dipindai, laporan dikirim, Office mengonfirmasi; stok menjadi 490 karung, 5.880 PCS, 10.045 KG.
7. Batch baru dibuat; persiapan sebelum verifikasi ditolak. Setelah verifikasi: karung disiapkan, dikemas 12 PCS, ditimbang 20 KG, disegel, dan ditempatkan. Stok menjadi 491 karung, 5.892 PCS, 10.065 KG.
8. Reset demo melalui dialog konfirmasi mengembalikan 500 karung awal.
9. Masalah label 3D pada implementasi awal ditemukan dan diperbaiki. Tidak ada error console baru pada rangkaian pengujian setelah perbaikan.
10. Build produksi dijalankan dengan `npm run start` pada 127.0.0.1:3000; dashboard dan Digital Twin diperiksa kembali tanpa error console baru. Screenshot disimpan di `artifacts/dashboard.jpg` dan `artifacts/digital-twin.jpg`.

## Batas bukti

- PGlite bukan project Supabase hosted. Auth provider, websocket Realtime lintas perangkat, deployment, dan koneksi gateway fisik belum diuji.
- Tidak ada manual PTA8D08 atau model timbangan terverifikasi; transport serial tetap scaffold.
- Tidak ada kode lama untuk regresi karena workspace awal kosong.
- Tata letak merupakan ilustrasi yang dapat dikonfigurasi, bukan hasil pengukuran pabrik.
- Browser diuji pada viewport desktop yang tersedia; breakpoint mobile belum diperiksa secara visual.

AI assistant / insight update: added snapshot-based read-only chat, inventory grouping and exact sack lookup, complete persisted evaluation reports and intervention table. 16 automated tests pass, including chat validation, data grouping and mocked OpenAI responses. Live browser/API checks are recorded below after verification.
Live verification completed: production build passed; browser chat answered 250 sacks/3000 PCS/5125 KG per room, located KRG-00001 in CS-01 rack 1 level 1 slot 1 and identified temperature as SIMULATED. A live 34-second evaluation returned score 100, displayed insight/recommendations/three intervention comparisons, and persisted after navigating away/back. Chat successfully explained that saved evaluation using the OpenAI API. No inventory or hardware mutations were performed.

## EAM petugas dan cetak — 2026-10-14
- `npm run build`: berhasil, termasuk pemeriksaan lint dan TypeScript.
- `npm test`: 22/22 lulus, mencakup pembatasan role packing/loading, RLS, konflik revisi, pembatalan dan dispatch idempotent.
- Browser: searchable product menyaring PRD-002; expired terlihat; role packing hanya dua menu dan tidak menampilkan putaway/verifikasi; role loading hanya Pemuatan/Inventori.
- Pratinjau label diperiksa visual: QR, owner, produk/kode, nomor karung, PCS/KG, tanggal produksi/expired. Cetak fisik belum diuji.
- Akun produksi belum dibuat (email petugas belum diberikan). Migrasi Supabase EAM belum diterapkan jarak jauh; pengujian SQL/RLS dilakukan pada PostgreSQL lokal PGlite.

## Login role — 15 Oktober 2026
- Build production lulus (lint dan TypeScript).
- Tujuh akun Supabase: login, kecocokan profil role, dan logout lokal lulus.
- Browser: login Packing menampilkan Operasional/Inventori; logout kembali ke login; login Loading menampilkan Pemuatan/Inventori; setelah logout, membuka /eam kembali diarahkan ke /login.
- Halaman /login HTTP 200; screenshot tersimpan lokal di .data/login-preview.png.

## Kamera — 15 Oktober 2026
Build lulus. 23/23 tes lulus termasuk decoder QR EAM dan resolusi target palet/karung tanpa perubahan stok. Browser dengan akun Packing dan Loading memperlihatkan tombol kamera dan popup sesuai target; popup dapat ditutup. Akses kamera menunggu izin/perangkat, sehingga pemindaian fisik end-to-end belum diverifikasi. Implementasi menghentikan stream saat unmount/hasil diterima/halaman tersembunyi. Screenshot tombol tersimpan di .data/packing-camera-buttons.png dan .data/loading-camera-buttons.png.

## Verifikasi migrasi dispatch produksi
Setelah pengguna mengonfirmasi migrasi, probe eam_commit memakai UUID workspace yang tidak ada: ADMIN_LOADING melewati pemeriksaan izin dan mengembalikan Unknown workspace; ADMIN_PACKING tetap Forbidden. Ini memverifikasi aturan izin remote sudah diperbarui tanpa menyentuh workspace/inventori. Dispatch riil belum dijalankan dalam pemeriksaan ini.
