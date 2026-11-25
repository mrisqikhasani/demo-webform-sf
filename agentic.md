# Task: Debug & Fix Mirae Asset Reservation Frontend + Vercel Serverless Proxy + Salesforce Apex REST Integration

Tolong audit, diagnosis, dan perbaiki proyek web di workspace ini sampai aplikasi berjalan end-to-end (frontend berhasil memuat data dari Salesforce dan berhasil melakukan POST reservasi).

## 1. Arsitektur Sistem
- **Frontend (`public/index.html`)**: Single-page Vanilla HTML/CSS/JS yang melakukan `fetch()` ke relative path `/api/reservation/v1/*` tanpa token di client-side.
- **Backend Proxy (`api/proxy.js` + `vercel.json` atau `api/reservation/v1/[...path].js`)**: Vercel Serverless Function (Node.js) yang bertugas:
  1. Mengambil OAuth 2.0 Access Token dari Salesforce (`POST ${SF_INSTANCE_URL}/services/oauth2/token` dengan `grant_type=client_credentials`, `client_id`, `client_secret`) dan menyimpannya di memory cache.
  2. Meneruskan request (method, query params, JSON body) ke `${SF_INSTANCE_URL}/services/apexrest/reservation/v1/...` dengan header `Authorization: Bearer <access_token>`.
- **Salesforce Apex REST Backend (Sudah selesai & ter-deploy di org)**:
  - `GET /services/apexrest/reservation/v1/options` -> mengembalikan `{ data: { domiciles, investmentGoals, eventTypes, ... } }`
  - `GET /services/apexrest/reservation/v1/branches?q=&city=&type=&limit=&cursor=` -> mengembalikan `{ data: [ { publicCode, name, city, type, address, phone, latitude, longitude } ], meta: ... }`
  - `GET /services/apexrest/reservation/v1/branches/{publicCode}/slots?from=YYYY-MM-DD&to=YYYY-MM-DD` -> mengembalikan `{ data: [ { id, date, start, end, capacity, remaining, bookable } ] }`
  - `GET /services/apexrest/reservation/v1/branches/{publicCode}/events?from=YYYY-MM-DD&to=YYYY-MM-DD` -> mengembalikan `{ data: [ { id, name, type, description, date, timeRange, capacity, remaining, bookable } ] }`
  - `POST /services/apexrest/reservation/v1/reservations` -> menerima payload `{ submissionId, applicant: { firstName, lastName, email, domicile }, investmentGoals, branchCode, visit: { slotId } | null, events: [campaignId], consent }` dan mengembalikan HTTP 201/200 `{ data: { submissionId, reservations: [...] } }`.

## 2. Gejala Masalah Saat Ini
Halaman web sudah muncul secara visual, tetapi data dari Salesforce tidak tampil (stuck di state loading / kosong / error saat hit API).

## 3. Langkah Inspeksi & Debugging yang Harus Kamu Lakukan
1. **Periksa Struktur Folder & Konfigurasi Vercel**:
   - Cek struktur direktori root, lokasi `index.html` (`public/index.html` vs root `index.html`), file di folder `api/`, `vercel.json`, dan `package.json` (jika ada).
   - Pastikan tidak ada konflik antara ES Module (`export default`) dan CommonJS (`module.exports`).
   - Pastikan aturan `rewrites` di `vercel.json` cocok dengan path yang dipanggil frontend (`/api/reservation/v1/...`) dan tidak menghilangkan atau merusak query parameters (`?limit=100`, `?from=...&to=...`).
2. **Periksa Environment Variables (`.env`)**:
   - Cek apakah file `.env` ada dan memiliki key `SF_INSTANCE_URL`, `SF_CLIENT_ID`, dan `SF_CLIENT_SECRET` (jangan tampilkan nilai secret ke output log).
   - Pastikan `SF_INSTANCE_URL` tidak memiliki trailing slash (`/`) dan menggunakan domain My Domain Salesforce yang valid (`https://...my.salesforce.com`).
3. **Uji Koneksi API secara Langsung**:
   - Jalankan local dev server (`npx vercel dev` atau server yang sesuai) atau tes fungsi proxy secara terisolasi untuk melihat exact HTTP status code dan raw response body dari:
     - `POST ${SF_INSTANCE_URL}/services/oauth2/token` (cek apakah OAuth Client Credentials berhasil atau mengembalikan error seperti `invalid_grant` / `invalid_client`).
     - `GET /api/reservation/v1/options` dan `GET /api/reservation/v1/branches?limit=100` (cek apakah mengembalikan JSON valid atau HTML 404/500).
4. **Periksa Error Handling di `public/index.html`**:
   - Pastikan `API_CONFIG.baseUrl` mengarah ke `/api/reservation/v1`.
   - Jika terjadi error dari backend/proxy, pastikan UI menampilkan pesan error yang jelas (bukan diam/kosong).

## 4. Output yang Diharapkan
- Jelaskan akar masalah (*root cause*) yang kamu temukan dari hasil pengecekan file & pengujian endpoint.
- Langsung terapkan perbaikan pada file terkait (`vercel.json`, `api/*`, `public/index.html`).
- Verifikasi bahwa `GET /api/reservation/v1/options` dan `GET /api/reservation/v1/branches` mengembalikan HTTP 200 dengan data JSON dari Salesforce.