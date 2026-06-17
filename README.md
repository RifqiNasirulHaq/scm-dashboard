# SCM Dashboard — Al-Quran Supply Chain Management

Dashboard supply chain management real-time untuk produksi dan penjualan Al-Quran (Cover & Inner).

## 🌐 Live Dashboard

**[Buka Dashboard →](https://RifqiNasirulHaq.github.io/scm-dashboard)**

| Phase | Dashboard | Fungsi |
|-------|-----------|--------|
| Phase 1 | [Produksi](https://RifqiNasirulHaq.github.io/scm-dashboard/phase1/) | PO Tracker, Work Order, QC, Alert |
| Phase 2 | [Assembly](https://RifqiNasirulHaq.github.io/scm-dashboard/phase2/) | Stok Cover & Inner, Assembly Calculator |
| Phase 3 | [MD](https://RifqiNasirulHaq.github.io/scm-dashboard/phase3/) | SKU Status, DOS, Reforecast Mingguan |

## 🏗️ Arsitektur

```
Google Sheets (Master + OPS)
        ↓ Apps Script (setiap 15 menit)
    data/data_p1.json
    data/data_p2.json
    data/data_p3.json
        ↓ GitHub Pages
    Dashboard HTML (Phase 1 / 2 / 3)
```

## 📁 Struktur Folder

```
scm-dashboard/
├── index.html          # Landing page
├── phase1/
│   └── index.html      # Dashboard Produksi
├── phase2/
│   └── index.html      # Dashboard Assembly
├── phase3/
│   └── index.html      # Dashboard MD
├── data/
│   ├── data_p1.json    # Data Phase 1 (auto-generated)
│   ├── data_p2.json    # Data Phase 2 (auto-generated)
│   └── data_p3.json    # Data Phase 3 (auto-generated)
├── assets/
│   ├── style.css       # Global styles
│   └── main.js         # Shared utilities
└── apps_script_export.js  # Script untuk Google Apps Script
```

## ⚙️ Setup

### 1. Google Sheets
- `SCM_MASTER_TEMPLATE` — master data & dashboard staging
- `SCM_OPS_PROCESS` — proses operasional 6 departemen

### 2. Apps Script Export
1. Buka `SCM_MASTER_TEMPLATE` → Extensions → Apps Script
2. Buat file baru, paste isi `apps_script_export.js`
3. Jalankan `setToken()` untuk simpan GitHub token
4. Jalankan `testExport()` untuk test manual
5. Jalankan `installTrigger()` untuk auto-export setiap 15 menit

### 3. GitHub Pages
- Settings → Pages → Branch: main → / (root)
- Dashboard live di: `https://RifqiNasirulHaq.github.io/scm-dashboard`

## 🔄 Alur Data

```
MD Dashboard (P3) ←→ Assembly Dashboard (P2) ←→ Produksi Dashboard (P1)
     ↓ alert stok kosong    ↓ alert cover/inner tipis    ↓ trigger PO/WO
```

---
*Dibuat dengan Google Sheets + GitHub Pages — Free tier, zero cost*
