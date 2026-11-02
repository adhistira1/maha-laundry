# Maha Laundry POS — Vercel deployment fix

## Perbaikan
- Menambahkan `index.js` di root sebagai entry point Express untuk Vercel.
- Mengubah `src/server.js` agar mengekspor aplikasi Express dan hanya menjalankan `app.listen()` saat dijalankan lokal.
- Memperbaiki path folder `public` agar absolut dan konsisten.
- Mempertahankan `public/index.html`, `app.js`, dan `style.css`.

## WAJIB: konfigurasi Vercel
1. Upload/commit seluruh isi folder ini ke repository GitHub (bukan folder pembungkus ZIP).
2. Di Vercel → Project → Settings → General → Root Directory:
   - Kosongkan / pilih `./` jika isi folder proyek berada di root repository.
   - Jika repository masih memiliki folder pembungkus, pilih folder yang berisi `package.json`, `index.js`, `vercel.json`, `src/`, dan `public/` (yaitu `laundry-pos-pro`).
3. Framework Preset: Other.
4. Build Command: kosongkan / Override OFF.
5. Output Directory: kosongkan / Override OFF.
6. Install Command: `npm install` (atau default).
7. Deploy ulang (Deployments → Redeploy, atau push commit baru).

## PENTING: database
Aplikasi ini menggunakan MySQL. Database `localhost` pada komputer Anda TIDAK dapat diakses oleh Vercel.
Anda wajib memakai MySQL yang dapat diakses dari internet (managed MySQL/cloud database), lalu isi Environment Variables di Vercel → Settings → Environment Variables:
- `DB_HOST` = hostname database cloud
- `DB_PORT` = port database
- `DB_USER` = username database
- `DB_PASSWORD` = password database
- `DB_NAME` = nama database
- `JWT_SECRET` = string acak panjang minimal 32 karakter
- `NODE_ENV` = `production`
- `WHATSAPP_ENABLED` = `false` (opsional; aktifkan hanya jika token Meta sudah disiapkan)

Import `database.sql` ke database cloud tersebut terlebih dahulu. Pastikan provider database mengizinkan koneksi dari Vercel (network access / allowlist sesuai ketentuan provider). Jangan isi DB_HOST dengan `localhost` atau `127.0.0.1`.

Setelah mengubah Environment Variables, lakukan Redeploy. Jangan pernah mengunggah `.env` atau membagikan password database/JWT secret.

## Tes setelah deploy
- Buka `https://domain-anda.vercel.app/` → harus muncul halaman login Maha Laundry.
- Buka `https://domain-anda.vercel.app/api/health` → harus menampilkan JSON `{"ok":true,"app":"Maha Laundry POS"}`.
- Login dan fitur transaksi baru bisa dipakai setelah koneksi database cloud berhasil.

## Jalankan lokal
```bash
npm install
npm start
```
Buka `http://localhost:3000`.
