# 🚀 NgAppID Editor

**NgAppID Editor** adalah code editor desktop ringan, modern, dan *feature-rich* yang dirancang khusus untuk para developer yang menginginkan pengalaman ngoding cepat tanpa ribet. Dibangun menggunakan teknologi web modern di sisi antarmuka dan performa tinggi di backend.

---

## 🛠 Tech Stack
* **Frontend:** HTML5, Tailwind CSS, Monaco Editor (core engine yang sama seperti VS Code).
* **Backend:** Go (Golang) untuk performa eksekusi sistem dan operasi *file/git*.
* **Bridge:** Wails Framework (menghubungkan Go dan Web Frontend secara native).

---

## ✨ Fitur Unggulan

### 1. 📁 File & Project Management
* **Open & Save File:** Mendukung pembukaan dan penyimpanan file kode secara langsung.
* **Explorer Sidebar:** Navigasi folder project lengkap dengan ikon teknologi file (Go, PHP, JS, HTML, CSS, dll.).
* **Git Status Color Coding:** File yang dimodifikasi (`Modified`) atau file baru (`Untracked`) langsung diberi warna khusus di sidebar secara *real-time*.
* **File Operations:** Buat file/folder baru, *rename*, dan hapus file langsung dari editor.

### 2. 🔀 Smart Git Integration (Ramah Pemula)
Editor ini dirancang dengan alur otomatis di balik layar untuk menghindari error umum Git (seperti *exit status 128* atau kebingungan *HEAD*):
* **Git Setup Wizard:** Konfigurasi *username* dan *email* Git langsung interaktif melalui terminal bawah (tanpa pop-up modal yang mengganggu).
* **Auto-Init & Auto-Commit:** Sistem secara cerdas mendeteksi jika folder belum memiliki *repository* atau riwayat *commit* (`HEAD`), lalu membuatnya secara otomatis di *background*.
* **One-Click Git Push & Pull:** Proses `add`, `commit`, dan `push` diringkas ke dalam alur yang mulus.
* **Interactive Git Reset:** Tombol panik untuk mengembalikan kode ke *commit* terakhir dengan konfirmasi aman via terminal.

### 3. 💻 Integrated Terminal Panel
* Panel terminal bawah interaktif yang mendukung perintah sistem operasi (`cmd` / `sh`).
* Semua log aktivitas Git, *error*, maupun status sukses tercetak transparan dan berwarna di dalam terminal.
* Tombol pintasan untuk menutup atau membuka terminal sesuai kebutuhan.

### 4. 🛡 Clean UX (No Annoying Dialogs)
* Sistem notifikasi error dan sukses terpusat sepenuhnya di dalam log terminal.
* Pemblokiran klik kanan bawaan browser di luar area editor demi menjaga *feel* seperti aplikasi IDE profesional.

---

## ⚙️ Cara Menjalankan Project (Development)

Pastikan di komputer lu sudah terinstal **Go** dan **Wails CLI**.

1. Clone atau buka folder project ini di terminal/command prompt.
2. Jalankan perintah *dev mode* Wails:
   ```bash
   wails dev