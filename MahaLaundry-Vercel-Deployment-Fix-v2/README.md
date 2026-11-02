# Maha Laundry POS Pro — panduan VS Code

Aplikasi ini menggunakan Node.js + Express + MySQL. Fitur: login admin/kasir, harga layanan, layanan kiloan dan satuan, transaksi tersimpan di MySQL, laporan pendapatan, dan integrasi WhatsApp Cloud API saat status menjadi **Selesai**.

## A. Persiapan software

Install:
1. Node.js versi LTS: https://nodejs.org/
2. MySQL Community Server + MySQL Workbench (atau XAMPP jika MySQL/MariaDB sudah tersedia).
3. Visual Studio Code: https://code.visualstudio.com/

## B. Buka proyek
1. Ekstrak ZIP.
2. VS Code → File → Open Folder → pilih folder `laundry-pos-pro`.
3. VS Code → Terminal → New Terminal.

## C. Buat database
1. Jalankan MySQL Server.
2. Buka MySQL Workbench, hubungkan ke server lokal.
3. Buka file `database.sql`.
4. Klik ikon petir / Execute untuk menjalankan seluruh SQL.
   File ini membuat database `laundry_pos`, tabel pengguna, layanan, pelanggan, transaksi, dan detail transaksi, serta layanan awal.

## D. Konfigurasi aplikasi
Di terminal VS Code, jalankan:

```bash
npm install
```

Salin `.env.example` menjadi `.env`:
- Windows PowerShell: `Copy-Item .env.example .env`
- Command Prompt: `copy .env.example .env`

Buka `.env`, sesuaikan DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME sesuai konfigurasi MySQL Anda. Atur JWT_SECRET dengan string acak panjang minimal 32 karakter. Jangan bagikan file `.env`.

## E. Buat akun admin pertama

```bash
npm run seed
```

Akun awal:
- Username: `admin`
- Password: `Admin123!`

Segera buat akun admin pribadi/kasir dari menu Pengguna. Jangan gunakan password awal untuk operasional dan jangan membagikan akun admin kepada kasir.

## F. Jalankan aplikasi

```bash
npm run dev
```

Buka browser: http://localhost:3000

Untuk menghentikan server, tekan `Ctrl + C` pada terminal.

## G. Alur penggunaan
1. Login sebagai admin.
2. Buka Pengaturan Harga, tambahkan/ubah layanan dan tarif.
3. Buka Pengguna, buat akun kasir.
4. Logout, login sebagai kasir.
5. Buat transaksi, pilih satu atau beberapa layanan kiloan/satuan.
6. Buka Transaksi dan ubah status menjadi Selesai. Backend akan mencoba mengirim notifikasi WhatsApp bila integrasi sudah diaktifkan.
7. Admin membuka Laporan untuk memilih harian, mingguan, atau bulanan.

## H. Integrasi WhatsApp Cloud API

Pengiriman WhatsApp tidak bisa dilakukan hanya dengan nomor WhatsApp biasa. Anda memerlukan akun Meta Developer, aplikasi Meta, WhatsApp Business Account, nomor bisnis, access token, dan Phone Number ID.

1. Ikuti dokumentasi resmi Meta WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
2. Siapkan WhatsApp Business Platform dan nomor pengirim.
3. Di WhatsApp Manager, buat template pesan bernama `laundry_selesai`, bahasa Indonesia (`id`), kategori Utility, dengan isi misalnya:
   `Halo {{1}}, laundry dengan nota {{2}} sudah selesai. Total pembayaran {{3}}. Silakan ambil di Maha Laundry. Terima kasih.`
4. Ajukan template untuk persetujuan Meta.
5. Isi `.env`:
   `WHATSAPP_ENABLED=true`
   `WHATSAPP_TOKEN=...`
   `WHATSAPP_PHONE_NUMBER_ID=...`
   `WHATSAPP_API_VERSION=v23.0` (sesuaikan versi Graph API yang didukung akun Meta Anda)
   `WHATSAPP_TEMPLATE_NAME=laundry_selesai`
   `WHATSAPP_TEMPLATE_LANGUAGE=id`
6. Restart server setelah mengubah `.env`.
7. Uji dengan nomor penerima yang telah memberi persetujuan menerima pesan.

PENTING:
- `src/whatsapp.js` mengirim template yang sudah disetujui Meta. Nama template, bahasa, dan jumlah/urutan parameter harus sama persis dengan template yang dibuat di WhatsApp Manager.
- Pesan status selesai dipicu oleh perubahan status pertama kali menjadi `Selesai`. Jika API gagal, status transaksi tetap tersimpan dan detail error ditampilkan di terminal server.
- WhatsApp Cloud API memiliki aturan opt-in pelanggan dan kebijakan template. Ikuti kebijakan Meta dan jangan mengirim pesan tanpa persetujuan.
- Token produksi harus disimpan sebagai secret, jangan dimasukkan ke frontend atau GitHub.

## I. Catatan keamanan dan batasan versi awal
- Password di-hash dengan bcrypt; sesi memakai JWT di cookie HttpOnly.
- Ganti JWT_SECRET dan password admin awal.
- Gunakan HTTPS, backup MySQL, dan konfigurasi server yang aman sebelum dipakai online.
- Laporan tersedia untuk admin saja.
- Admin dapat menghapus transaksi yang salah dari menu Transaksi. Penghapusan bersifat permanen dan detail item ikut terhapus. Kasir tidak memiliki akses menghapus transaksi.\n- Versi ini belum menyediakan reset password, edit transaksi, multi-cabang, audit log, cetak thermal, dan mekanisme retry antrean WhatsApp.
- Untuk penggunaan produksi, tambahkan CSRF protection sesuai arsitektur deployment, validasi input lebih ketat, logging, backup terjadwal, dan manajemen token yang aman.
- Data tersimpan di MySQL, bukan localStorage. Pastikan database di-backup secara rutin.


## J. Catatan revisi versi 3

- Formulir harga dipakai bersama untuk menambah dan mengubah layanan, dengan tombol **Simpan perubahan** dan **Batal**. Tidak memakai `prompt()` atau `confirm()`.
- Endpoint perubahan harga tetap dilindungi `requireAuth` dan `requireAdmin` di server.
- Cookie sesi dikirim untuk same-origin request dan konfigurasi `Secure` mengikuti koneksi HTTPS (termasuk header `X-Forwarded-Proto` pada reverse proxy). Pastikan proxy tepercaya Anda mengatur header tersebut dengan benar.
- Revisi kode ini tidak menjalankan SQL migrasi, tidak menghapus database, tidak mereset akun admin, dan tidak mengubah transaksi lama.
- Sebelum mengganti file di server operasional, buat backup database MySQL terlebih dahulu. Salin kode revisi ke folder aplikasi yang sudah ada tanpa menimpa `.env`.
