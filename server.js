const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const scrypt = require('node:util').promisify(crypto.scrypt);
const categories = ['PKKMB','Dies Natalis','Seminar','Rapat Kerja','Kegiatan Rohani','Perlombaan','Kegiatan Sosial','Kegiatan Internal IKM'];
const MAX_IMAGE = 3 * 1024 * 1024;
function save(file, value) { fs.writeFileSync(file + '.tmp', JSON.stringify(value), { mode: 0o600 }); fs.renameSync(file + '.tmp', file); }
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
async function body(req, limit = MAX_IMAGE * 1.4 + 16384) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Format permintaan harus JSON.');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) fail(413, 'Ukuran unggahan melebihi batas.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { fail(400, 'Data tidak valid.'); }
}
function validateAlbum(input) {
  if (!input || typeof input !== 'object') fail(400, 'Data tidak valid.');
  const { title, category, date, driveUrl, thumbnail } = input;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) fail(400, 'Nama kegiatan harus 1–120 karakter.');
  if (!categories.includes(category)) fail(400, 'Kategori tidak valid.');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) fail(400, 'Tanggal kegiatan tidak valid.');
  let drive; try { drive = new URL(driveUrl); } catch { fail(400, 'Masukkan tautan folder Google Drive yang valid.'); }
  if (drive.protocol !== 'https:' || drive.hostname !== 'drive.google.com' || drive.port || drive.username || drive.password || !/^\/drive\/(?:u\/\d+\/)?folders\/[a-zA-Z0-9_-]+\/?$/.test(drive.pathname)) fail(400, 'Gunakan tautan folder https://drive.google.com/drive/folders/...');
  const match = typeof thumbnail === 'string' && thumbnail.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) fail(400, 'Thumbnail harus JPG, PNG, atau WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_IMAGE) fail(413, 'Thumbnail maksimal 3 MB.');
  const valid = (match[1] === 'png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (match[1] === 'jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) || (match[1] === 'webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP');
  if (!valid) fail(400, 'Isi file thumbnail tidak sesuai format gambar.');
  return { id: crypto.randomUUID(), title: title.trim(), category, date, driveUrl: drive.href, thumbnail, createdAt: new Date().toISOString() };
}
const MAX_ATTACHMENT = 5 * 1024 * 1024;
function validateInformation(input) {
  if (!input || typeof input !== 'object') fail(400, 'Data tidak valid.');
  const { title, content, attachment } = input;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) fail(400, 'Judul harus 1–120 karakter.');
  if (typeof content !== 'string' || !content.trim() || content.trim().length > 10000) fail(400, 'Isi informasi harus 1–10.000 karakter.');
  let file = null;
  if (attachment != null) {
    if (typeof attachment.name !== 'string' || !attachment.name.trim() || attachment.name.length > 180) fail(400, 'Nama lampiran tidak valid.');
    const match = typeof attachment.data === 'string' && attachment.data.match(/^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) fail(400, 'Lampiran harus PDF, JPG, PNG, atau WebP.');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > MAX_ATTACHMENT) fail(413, 'Lampiran maksimal 5 MB.');
    const valid = (match[1] === 'application/pdf' && bytes.toString('ascii',0,5) === '%PDF-') ||
      (match[1] === 'image/png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
      (match[1] === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
      (match[1] === 'image/webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP');
    if (!valid) fail(400, 'Isi lampiran tidak sesuai format file.');
    file = { name: attachment.name.trim(), type: match[1], size: bytes.length, data: bytes.toString('base64') };
  }
  return { id: crypto.randomUUID(), title: title.trim(), content: content.trim(), attachment: file, createdAt: new Date().toISOString() };
}
function publicInformation(item) {
  return { ...item, attachment: item.attachment ? { name: item.attachment.name, type: item.attachment.type, size: item.attachment.size, url: `/api/information/${item.id}/attachment` } : null };
}
async function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.IKM_DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const adminFile = path.join(dataDir, 'admin.json'); const albumFile = path.join(dataDir, 'albums.json');
  if (!fs.existsSync(adminFile)) {
    const password = crypto.randomBytes(18).toString('base64url'); const salt = crypto.randomBytes(16).toString('hex');
    save(adminFile, { username: 'admin', salt, hash: (await scrypt(password, salt, 64)).toString('hex') });
    fs.writeFileSync(path.join(dataDir, 'initial-admin.txt'), `Username: admin\nPassword: ${password}\n\nSimpan kredensial ini secara pribadi. File ini tidak dilayani oleh website.\n`, { mode: 0o600 });
  }
  if (!fs.existsSync(albumFile)) save(albumFile, []);
  const informationFile = path.join(dataDir, 'information.json');
  if (!fs.existsSync(informationFile)) save(informationFile, []);
  let information = JSON.parse(fs.readFileSync(informationFile, 'utf8'));
  const admin = JSON.parse(fs.readFileSync(adminFile, 'utf8')); let albums = JSON.parse(fs.readFileSync(albumFile, 'utf8'));
  const sessions = new Map(); const attempts = new Map();
  const cookie = (token, age) => `ikm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.PUBLIC_ORIGIN?.startsWith('https:') ? '; Secure' : ''}`;
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin'); res.setHeader('X-Frame-Options','DENY');
    const json = (status, value) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }); res.end(JSON.stringify(value)); };
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.startsWith('/api/')) {
        const now = Date.now();
        for (const [key, expiry] of sessions) if (expiry < now) sessions.delete(key);
        for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
        const token = /(?:^|;\s*)ikm_session=([^;]*)/.exec(req.headers.cookie || '')?.[1];
        const authenticated = !!token && sessions.has(token);
        if (!['GET','HEAD'].includes(req.method) && (req.headers['x-ikm-request'] !== '1' || (req.headers.origin && req.headers.origin !== (process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`)))) fail(403, 'Permintaan tidak diizinkan. Muat ulang halaman.');
        if (pathname === '/api/session' && req.method === 'GET') return json(200, { authenticated, username: authenticated ? admin.username : null });
        if (pathname === '/api/login' && req.method === 'POST') {
          const key = req.socket.remoteAddress; const attempt = attempts.get(key) || { count:0, until:now + 15 * 60 * 1000 };
          if (attempt.count >= 10) fail(429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
          attempt.count++; attempts.set(key, attempt);
          const input = await body(req);
          if (!input || typeof input.password !== 'string' || input.password.length > 256) fail(401, 'Username atau password salah.');
          const derived = await scrypt(input.password, admin.salt, 64);
          if (!crypto.timingSafeEqual(derived, Buffer.from(admin.hash, 'hex')) || input.username !== admin.username) fail(401, 'Username atau password salah.');
          attempts.delete(key); if (token) sessions.delete(token);
          const next = crypto.randomBytes(32).toString('hex'); sessions.set(next, now + 8 * 60 * 60 * 1000);
          res.setHeader('Set-Cookie',cookie(next, 8 * 60 * 60)); return json(200, { authenticated:true, username:admin.username });
        }
        if (pathname === '/api/logout' && req.method === 'POST') { sessions.delete(token); res.setHeader('Set-Cookie',cookie('',0)); return json(200,{ ok:true }); }
        if (pathname === '/api/information' && req.method === 'GET') return json(200, { information: information.map(publicInformation) });
        if (pathname === '/api/information' && req.method === 'POST') {
          if (!authenticated) fail(401, 'Sesi berakhir. Silakan login kembali.');
          const item = validateInformation(await body(req, MAX_ATTACHMENT * 1.4 + 100000));
          const next = [item, ...information]; save(informationFile, next); information = next;
          return json(201, { information: publicInformation(item) });
        }
        const attachmentRoute = /^\/api\/information\/([^/]+)\/attachment$/.exec(pathname);
        if (attachmentRoute && ['GET', 'HEAD'].includes(req.method)) {
          const file = information.find(item => item.id === attachmentRoute[1])?.attachment;
          if (!file) fail(404, 'Lampiran tidak ditemukan.');
          const extension = { 'application/pdf':'pdf', 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' }[file.type];
          res.writeHead(200, { 'Content-Type': file.type, 'Content-Disposition': `attachment; filename="informasi.${extension}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}`, 'Cache-Control':'no-store', 'Content-Security-Policy':"sandbox; default-src 'none'" });
          return res.end(req.method === 'HEAD' ? undefined : Buffer.from(file.data, 'base64'));
        }
        if (/^\/api\/information\/[^/]+$/.test(pathname) && req.method === 'DELETE') {
          if (!authenticated) fail(401, 'Sesi berakhir. Silakan login kembali.');
          const id = pathname.split('/')[3];
          if (!information.some(item => item.id === id)) fail(404, 'Informasi tidak ditemukan.');
          const next = information.filter(item => item.id !== id); save(informationFile, next); information = next;
          return json(200, { ok:true });
        }
        if (pathname === '/api/albums' && req.method === 'GET') return json(200, { albums });
        if (pathname === '/api/albums' && req.method === 'POST') {
          if (!authenticated) fail(401, 'Sesi berakhir. Silakan login kembali.');
          const album = validateAlbum(await body(req)); const next = [album,...albums]; save(albumFile,next); albums = next; return json(201,{ album });
        }
        if (pathname.startsWith('/api/albums/') && req.method === 'DELETE') {
          if (!authenticated) fail(401, 'Sesi berakhir. Silakan login kembali.');
          const id = pathname.slice('/api/albums/'.length);
          if (!albums.some(a => a.id === id)) fail(404,'Album tidak ditemukan.');
          const next = albums.filter(a => a.id !== id); save(albumFile,next); albums = next; return json(200,{ ok:true });
        }
        return json(404,{ error:'Endpoint tidak ditemukan.' });
      }
      if (!['GET','HEAD'].includes(req.method)) fail(405,'Metode tidak diizinkan.');
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!['index.html','app.js','motion.js','styles.css','supabase-config.js'].includes(relative) && !/^assets\/[a-zA-Z0-9_-]+\.(svg|png|jpg|jpeg|webp)$/.test(relative)) fail(404,'Tidak ditemukan.');
      const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' };
      let data; try { data = await fs.promises.readFile(path.join(__dirname,relative)); } catch { fail(404,'Tidak ditemukan.'); }
      res.writeHead(200,{ 'Content-Type':types[path.extname(relative)] }); res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { if (!res.headersSent) json(error.status || 500,{ error:error.status ? error.message : 'Terjadi kesalahan server. Silakan coba lagi.' }); }
  });
}
if (require.main === module) createApp().then(server => server.listen(Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1', () => {
  console.log(`IKM tersedia di http://localhost:${server.address().port}`);
  console.log('Kredensial admin awal tersimpan di data/initial-admin.txt (file pribadi).');
})).catch(error => { console.error('Server gagal dimulai:',error.message); process.exitCode = 1; });
module.exports = { createApp };
