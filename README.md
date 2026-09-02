# 🚀 NgAppID Code Editor

**NgAppID Code Editor** adalah code editor desktop ringan, modern, dan *feature-rich* yang dirancang khusus untuk para developer yang menginginkan pengalaman ngoding cepat tanpa ribet. Dibangun menggunakan teknologi web modern di sisi antarmuka dan performa tinggi di backend untuk menjamin eksekusi yang responsif.

---

## 🖼️ Tampilan Aplikasi

<p align="center">
  <img src="screenshoot.png" alt="NgAppID Code Editor Screenshot 1" width="48%" style="border-radius: 8px; margin-right: 1%;" />
  <img src="screenshoot1.png" alt="NgAppID Code Editor Screenshot 2" width="48%" style="border-radius: 8px;" />
</p>

---

## 🛠 Tech Stack
* **Frontend:** 
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Monaco_Editor-007ACC?style=flat&logo=visual-studio-code&logoColor=white" alt="Monaco Editor" />
* **Backend:** 
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js" />
* **Bridge:** 
  <img src="https://img.shields.io/badge/Wails-00B4AB?style=flat&logo=wails&logoColor=white" alt="Wails" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript" />

---

## ✨ Fitur Unggulan

### 1. 📁 File & Project Management
* **Open & Save File:** Mendukung pembukaan dan penyimpanan file kode secara langsung dengan integrasi *shortcut* keyboard (`Ctrl+S`).
* **Explorer Sidebar:** Navigasi folder project persisten yang mempertahankan status folder terbuka, lengkap dengan ikon teknologi spesifik (Go, PHP, JS, HTML, CSS, dll.).
* **Git Status Color Coding:** File yang dimodifikasi (`Modified` - Kuning) atau file baru (`Untracked` - Hijau) langsung di-*highlight* di sidebar secara *real-time*.
* **File Operations:** Buat file/folder baru, *rename*, dan hapus file langsung dari *interface* editor.

### 2. 🔀 Smart Git Integration (Ramah Pemula)
Alur otomatis di balik layar untuk mencegah *error* umum (seperti *exit status 128* atau *missing HEAD*):
* **Git Setup Wizard:** Konfigurasi *username*, *email*, dan URL *remote repository* secara interaktif melalui terminal bawah, tanpa *pop-up* yang mengganggu fokus.
* **Auto-Init & Auto-Commit:** Sistem secara cerdas mendeteksi jika folder belum memiliki *repository* atau riwayat *commit* awal, lalu membuatnya secara otomatis di *background* sebelum melakukan *push* atau *reset*.
* **One-Click Git Push & Pull:** Proses `add`, `commit`, dan `push` (beserta sinkronisasi *branch* `main`) diringkas dalam satu alur klik yang mulus.
* **Interactive Git Reset:** "Tombol panik" untuk mengembalikan kode ke *commit* terakhir secara aman dengan konfirmasi via terminal (`y/n`).

### 3. 💻 Integrated Terminal Panel
* Panel terminal bawah fungsional yang mendukung eksekusi perintah sistem operasi lokal (`cmd` / `sh`).
* Semua log aktivitas Git, *error*, maupun indikator sukses tercetak transparan dan berwarna di dalam terminal.
* Mengunci input otomatis saat memproses operasi *background* untuk mencegah penumpukan perintah.

### 4. 🛡 Clean UX (No Annoying Dialogs)
* Sistem notifikasi terpusat sepenuhnya di dalam log terminal agar layar tetap bersih.
* Pemblokiran klik kanan bawaan browser di area kosong untuk menjaga impresi dan fungsionalitas IDE profesional sejati.

---

## ⚙️ Cara Menjalankan Project (Development)

Pastikan di komputer kamu sudah terinstal **Go**, **Node.js**, dan **Wails CLI**.

1. *Clone* atau buka direktori project ini di terminal bawaan sistem kamu.
2. Jalankan perintah mode *development* Wails (mendukung *live reload*):
   ```bash
   wails dev
   ```

---

## 👨‍💻 Author, Support, & Dedication

Dikembangkan dengan ☕ oleh **YedinCoder** dan bersifat 100% *Open Source*.

* **Email:** yedincoder@gmail.com
* **WhatsApp:** 081802161315
* **Website:** [ngappid.com](https://ngappid.com) | [dev.ngappid.com](https://dev.ngappid.com)

> ❤️ **Spesial:** 
> *Sebuah karya untuk kemudahan developer di seluruh Nusantara. Didedikasikan dengan segenap cinta untuk **Zawjatii**, serta tiga pelita hati: **Shafa**, **Ra'uf**, dan si bungsu **Sa'ad**.*

*Dukungan pengembangan aplikasi secara sukarela (seikhlasnya) melalui QRIS, untuk menghargai kerja keras pengembangan project ini! 🙏☕*