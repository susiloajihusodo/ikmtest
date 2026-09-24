# Website IKM

Website responsif dengan empat menu: Home, Struktur Organisasi (termasuk enam sie dengan daftar anggota masing-masing), Dokumentasi, serta Informasi. Palet biru tua, merah, putih, emas, dan hitam. **Frontend statis** — semua data disimpan di **Supabase (PostgreSQL + Storage + Auth)**, login admin menggunakan **Supabase Authentication**. Tidak ada backend server.

## Cara Menjalankan (Lokal)

Gunakan Node.js 20 atau lebih baru. Jalankan server statis lokal:

```bash
npx serve .
# atau
npm install -g serve
serve
```

Buka http://localhost:3000. Login admin, dokumentasi, dan penyimpanan memerlukan koneksi internet (Supabase).

## Setup Supabase (Wajib)

### 1. Buat project Supabase
1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Klik **New project** → beri nama dan password database
3. Tunggu hingga project siap (~2-3 menit)

### 2. Dapatkan kredensial
Di project settings → **API** → **Project API keys**:
- **Project URL** (mis: `https://abcde12345.supabase.co`)
- **anon public** key

### 3. Ganti placeholder di `supabase-config.js`
```js
const supabaseUrl = "https://abcde12345.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsIn...";
```

### 4. Setup database schema
Buka **SQL Editor** → paste isi `schema.sql` → klik **Run**. Ini akan:
- Membuat tabel `albums` dan `information`
- Mengaktifkan Row Level Security (RLS)
- Membuat storage bucket `assets` (public)
- Mengatur security policies

### 5. Buat akun admin
Buka **Authentication → Users → Add user**:
- Isi email (mis: `admin@ikm.org`) dan password kuat
- Klik **Create user**

Simpan kredensial ini di password manager.

## Admin Dokumentasi

1. Buka **Dokumentasi → Login admin** (atau **Informasi → Login admin**)
2. Masukkan email dan password admin yang Anda daftarkan
3. Pilih **Tambah dokumentasi**. Isi nama, kategori, tanggal, link folder Google Drive, dan unggah thumbnail JPG/PNG/Webp maksimal 3 MB.
4. Atur izin folder Google Drive agi pengunjung dengan link dapat melihat isinya.
5. Album langsung tampil di galeri.

## Informasi & Pengumuman

Buka **Informasi → Login admin** dengan akun yang sama, lalu pilih **Tambah informasi**. Isi judul dan isi pengumuman; lampiran PDF, JPG, PNG, atau WebP bersifat opsional (maksimal 5 MB). Klik **Terbitkan informasi** untuk menampilkannya kepada semua pengunjung. Lampiran dapat diunduh tanpa login. Admin dapat menghapus informasi beserta lampirannya setelah konfirmasi.

## Publikasi ke GitHub Pages

```bash
git init
git add .
git commit -m "Deploy IKM website"
git branch -M main
git remote add origin https://github.com/username/ikm-website.git
git push -u origin main
```

Di GitHub → **Settings → Pages** → pilih branch `main`. Website langsung tersedia di `https://username.github.io/ikm-website/`.

## Migrasi dari versi sebelumnya (server.js / database file lokal)

| Komponen | Server.js (sebelumnya) | Supabase (sekarang) |
|---|---|---|
| Autentikasi admin | scrypt + cookie HttpOnly | Supabase Auth (email/password) |
| Session | memory Map di server | Supabase Auth (localStorage JWT) |
| Penyimpanan album | `data/albums.json` | Supabase PostgreSQL |
| Penyimpanan informasi | `data/information.json` | Supabase PostgreSQL |
| Upload gambar | base64 via API | Supabase Storage |
| Hosting | `node server.js` (port 3000) | Static hosting (GitHub Pages) |

> **Catatan**: `server.js` dan `server.test.js` tetap tersedia untuk referensi dan pengembangan lokal, tetapi **tidak lagi diperlukan** untuk deploy versi statis. Frontend (`app.js`) kini memanggil Supabase langsung dari browser.

## Keamanan

- Password diverifikasi oleh Supabase Auth (bukan aplikasi klien)
- Session disimpan di localStorage browser (JWT)
- Firestore/Storage access dikontrol oleh Row Level Security policies
- Semua query dari klien dilindungi oleh policies — publik hanya bisa `read`, hanya admin yang bisa `create/update/delete`
- Simpan `supabase-config.js` (anon key) boleh dipublikasikan; **private service_role key jangan pernah diekspose di client**
