-- IKM Website — Supabase Schema Setup
-- Jalankan SQL di bawah di Supabase SQL Editor

-- 1. Buat tabel albums
create table albums (
  id uuid default gen_random_uuid() primary key,
  title text not null check (length(trim(title)) > 0),
  category text not null,
  date text not null,
  drive_url text not null,
  thumbnail_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Buat tabel information
create table information (
  id uuid default gen_random_uuid() primary key,
  title text not null check (length(trim(title)) > 0),
  content text not null check (length(trim(content)) > 0),
  attachment_name text,
  attachment_type text,
  attachment_size bigint,
  attachment_storage_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security
alter table albums enable row level security;
alter table information enable row level security;

-- 4. Security Policies
-- Publik bisa baca, hanya pengguna terautentikasi yang bisa create/update/delete
create policy "Public read" on albums for select using (true);
create policy "Admin write" on albums for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Public read" on information for select using (true);
create policy "Admin write" on information for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- 5. Storage bucket untuk gambar & lampiran
insert into storage.buckets (id, name, public) values ('assets', 'assets', true);

-- 6. Storage Security Policies
create policy "Public read" on storage.objects for select using (bucket_id = 'assets');
create policy "Admin write" on storage.objects for all using (auth.uid() is not null and bucket_id = 'assets') with check (auth.uid() is not null and bucket_id = 'assets');

-- 7. Buat akun admin pertama di Authentication -> Users
--    (gunakan email & password, lalu login di menu Dokumentasi/Informasi -> Login admin)
