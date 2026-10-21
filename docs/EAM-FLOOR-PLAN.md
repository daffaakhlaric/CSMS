# Interpretasi denah EAM v4

Sumber primer: foto denah evakuasi PT Ender Agro Mitra yang dilampirkan pengguna, 13 Oktober 2026. Foto adalah diagram evakuasi dengan perspektif, bukan gambar ukur. Tidak ada ukuran meter yang disimpulkan. Koordinat X kanan dan Z ke bawah mengikuti foto; rentang kira-kira 0–100 unit normalisasi. File `lib/eam/layout.ts` menjadi layout awal, lalu konfigurasi per run disimpan database.

Di kiri: Dirty Area, Unloading, Ruang Tunggu Ayam. Di atas/tengah: Screw Chiller, Clean Area, Sanitasi, Bak Limbah, Ice Flake Room. ABF 1–5 tersusun vertikal di sebelah kiri Anteroom; mesin ABF dan loker karyawan terpisah. Dua ruang Cold Storage Besar dan Kecil berada di kanan Anteroom, kemudian MDM, Packing dan Loading ke bawah. Office, workshop, listrik, gudang, kantin, IPAL berada di bagian kanan. Mushola/WC di kiri bawah, security/kolam di kanan bawah.

Tulisan kecil di atas ABF 1 ambigu: dipertahankan sebagai `Mesin ABF 1+2 / Anteroom / CS kecil (?)`, menunggu verifikasi. Bangunan besar berwarna merah muda di bawah tidak berlabel: tidak diberi fungsi produksi. Jumlah ruang/mesin fisik ABF dan kanal sensor adalah konfigurasi terpisah.

Hanya satu kanal/logical room CS-01 aktif. Pemetaan ke Cold Storage Besar/Kecil awalnya **belum ditentukan**. Admin harus memilihnya sebelum putaway/simulasi yang membutuhkan lokasi fisik. Ruang lain tetap digambar, berlabel tidak aktif. Penentuan ini bukan klaim kondisi aktual pabrik.

Asumsi visual: tebal/tinggi dinding, bukaan pintu, rak, kapasitas slot, meja timbang/jahit, worker paths, parkir dan peralatan adalah ilustrasi demo. Pintu asumsi menghubungkan ABF dan area packing/cold storage melalui Anteroom. Graf transport operasional terpisah dari layer evakuasi. Panah hijau yang ditampilkan sebagai layer evakuasi adalah sketsa referensi, bukan jalur keselamatan tervalidasi. Jangan gunakan sebagai panduan darurat aktual.

Layout dapat diedit admin melalui formulir zona X/Z/lebar/kedalaman; koordinat harus tetap dalam batas model. Navigasi diproyeksikan ulang dari pusat zona dan koridor Anteroom. Penataan ulang besar perlu verifikasi konektivitas pintu di lokasi nyata.
