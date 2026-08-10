# VetCore Systems (PHP)

Aplikasi manajemen pasien hewan sederhana — PHP native + MySQL.

## Struktur file
```
vetcore-php/
├── config.php          # koneksi database + fungsi bantuan
├── schema.sql          # skema tabel + data contoh
├── index.php           # daftar pasien + pencarian
├── patient.php         # detail pasien, tambah catatan & obat
├── add_patient.php     # form pendaftaran pasien baru
└── includes/
    ├── head.php         # Tailwind CDN + Lucide icons
    └── sidebar.php       # navigasi sidebar
```

## Cara menjalankan di VS Code

1. **Siapkan MySQL/MariaDB** (misalnya lewat XAMPP, Laragon, atau MAMP) dan pastikan servernya aktif.
2. **Import skema database**:
   ```bash
   mysql -u root -p < schema.sql
   ```
   atau buka file `schema.sql` lewat phpMyAdmin dan jalankan (Import).
3. **Sesuaikan kredensial** di `config.php` (host, nama database, user, password) kalau berbeda dari default.
4. **Jalankan PHP built-in server** dari dalam folder proyek:
   ```bash
   php -S localhost:8000
   ```
   (Kalau pakai XAMPP/Laragon, cukup taruh folder ini di `htdocs`/`www` lalu akses lewat `localhost/vetcore-php`.)
5. Buka `http://localhost:8000` di browser.

## Fitur
- Daftar pasien dengan pencarian nama/pemilik/ras
- Detail pasien: riwayat klinis, tanda vital, data pemilik, obat aktif
- Tambah pasien baru lewat form
- Tambah catatan klinis baru langsung dari halaman detail
- Tambah & hapus obat aktif langsung dari halaman detail

## Ekstensi VS Code yang disarankan
- PHP Intelephense
- PHP Server (atau jalankan manual lewat terminal seperti langkah di atas)
