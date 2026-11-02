# Publish Maha Laundry secara gratis (Render + TiDB Cloud)

Panduan ini menyiapkan aplikasi agar bisa dibuka lewat internet. Saya tidak dapat membuat akun atau menerbitkannya langsung dari sini karena prosesnya memerlukan login dan persetujuan Anda di layanan hosting. Setelah langkah di bawah selesai, Anda akan memperoleh alamat `https://...onrender.com`.

> **Catatan penting:** paket gratis cocok untuk uji coba/operasional kecil, bukan jaminan layanan bisnis tanpa gangguan. Render Free tidur setelah 15 menit tanpa trafik sehingga pembukaan pertama bisa lambat. Buat backup data secara berkala.

## 1. Buat database MySQL-compatible gratis

1. Daftar/login ke [TiDB Cloud](https://tidbcloud.com/). Pilih **Create Cluster** lalu pilih **Starter / Free** dengan kompatibilitas MySQL.
2. Buat password database dan izinkan koneksi dari aplikasi/akses publik sesuai petunjuk TiDB. Simpan host, port, username, dan password yang ditampilkan. Jangan bagikan password tersebut.
3. Buka SQL Editor di cluster itu dan jalankan isi file `database.sql`. Jika SQL Editor menolak perintah `CREATE DATABASE` atau `USE`, pilih database yang dibuat melalui dashboard lalu jalankan ulang isi file mulai dari `CREATE TABLE ...` (jangan jalankan baris `CREATE DATABASE` dan `USE`).
4. Pastikan tabel `users`, `services`, `customers`, `orders`, dan `order_items` telah terbentuk.

## 2. Upload kode ke GitHub

1. Daftar/login ke [GitHub](https://github.com/).
2. Buat repository baru bernama `maha-laundry`, pilih **Private** jika tidak ingin kode terlihat publik.
3. Ekstrak ZIP ini. Unggah isi folder `laundry-pos-pro` ke repository (file `package.json` harus berada di root repository, bukan di subfolder tambahan). Jangan pernah mengunggah file `.env` atau password database.

## 3. Deploy aplikasi di Render

1. Daftar/login di [Render](https://render.com/) dan hubungkan akun GitHub.
2. Di Render pilih **New + → Blueprint**, lalu pilih repository `maha-laundry` yang baru dibuat. Render akan membaca `render.yaml`.
3. Saat diminta mengisi environment variables, masukkan nilai dari TiDB untuk `DB_HOST`, `DB_USER`, dan `DB_PASSWORD`. Pastikan `DB_PORT` sesuai port TiDB (biasanya `4000`) dan `DB_NAME` sesuai nama database yang dipakai. `JWT_SECRET` dibuat otomatis oleh Blueprint. `DB_SSL=true` harus tetap aktif.
4. Pilih paket **Free** dan jalankan deploy. Tunggu hingga status deploy berhasil.
5. Buka URL layanan Render, misalnya `https://maha-laundry.onrender.com`. Nama URL yang sebenarnya ditentukan saat pembuatan layanan.

## 4. Buat akun admin pertama

Setelah database dan aplikasi terhubung, jalankan script seed **satu kali** dari terminal yang memiliki variabel database yang sama: `npm run seed`. Pada paket Render Free, shell/one-off job tidak tersedia, jadi cara paling mudah adalah menjalankan perintah ini dari komputer Anda setelah mengisi `.env` lokal dengan detail TiDB, atau gunakan SQL/alat database untuk membuat pengguna melalui metode hash yang aman.

Di komputer lokal:
1. Salin `.env.example` menjadi `.env`.
2. Isi `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, set `DB_SSL=true`, dan buat `JWT_SECRET` acak yang panjang.
3. Jalankan `npm install`, lalu `npm run seed`.
4. Akun awal setelah seed: username `admin`, password `Admin123!`. Login dan buat akun admin baru dengan password kuat; jangan gunakan password awal untuk operasional.
5. Jangan unggah file `.env` ke GitHub.

Jika komputer Anda belum terpasang Node.js, instal versi LTS dari [situs resmi Node.js](https://nodejs.org/).

## 5. Batasan gratis

- Render Free dapat tidur setelah 15 menit tanpa trafik; permintaan pertama setelah tidur bisa menunggu sekitar satu menit.
- Kuota gratis TiDB memiliki batas penggunaan. Ketika kuota habis, koneksi bisa ditolak sampai kuota pulih atau paket diubah. Periksa kuota dan kebijakan terbaru di dashboard/provider.
- Ini bukan paket dengan uptime/backup terjamin. Sebelum dipakai untuk transaksi pelanggan sungguhan, lakukan uji login admin/kasir, transaksi, laporan, dan pemulihan backup.
- Integrasi WhatsApp dinonaktifkan secara default; aplikasi tetap dapat dipakai tanpa mengatur WhatsApp.

Dokumentasi resmi: [Render free services](https://render.com/docs/free), [Render first deploy](https://render.com/docs/your-first-deploy), [TiDB Cloud Starter](https://docs.pingcap.com/tidbcloud/select-cluster-tier/).
