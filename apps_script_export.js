/**
 * SCM EXPORT PIPELINE — Apps Script
 * File: export_to_github.gs
 * Jalankan di: SCM_MASTER_TEMPLATE
 * Fungsi utama: exportAllToGitHub()
 * Trigger: setiap 15 menit (setup via installTrigger)
 */

// ─── KONFIGURASI ────────────────────────────────────────────
var GH_USER   = "RifqiNasirulHaq";
var GH_REPO   = "scm-dashboard";
var GH_BRANCH = "main";
var GH_TOKEN  = ""; // ← kosongkan di sini, isi via Script Properties

// ─── AMBIL TOKEN DARI SCRIPT PROPERTIES ─────────────────────
function getToken() {
  var token = PropertiesService.getScriptProperties().getProperty("GH_TOKEN");
  if (!token) {
    Logger.log("ERROR: GH_TOKEN belum di-set. Jalankan setToken() dulu.");
    return null;
  }
  return token;
}

// ─── SIMPAN TOKEN SEKALI (jalankan sekali saja) ──────────────
function setToken() {
  // Ganti string di bawah dengan token kamu, jalankan sekali, lalu hapus tokennya
  PropertiesService.getScriptProperties().setProperty(
    "GH_TOKEN",
    "PASTE_TOKEN_KAMU_DI_SINI"
  );
  Logger.log("Token berhasil disimpan ke Script Properties.");
}

// ─── HELPER: Sheet ke array of objects ───────────────────────
function sheetToObjects(sheetName, headerRow, dataStart, maxRow) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(sheetName);
  if (!ws) { Logger.log("Sheet tidak ditemukan: " + sheetName); return []; }

  var lastRow = ws.getLastRow();
  if (lastRow < dataStart) return [];

  var endRow = maxRow ? Math.min(lastRow, dataStart + maxRow - 1) : lastRow;
  if (endRow < dataStart) return [];

  var headers = ws.getRange(headerRow, 1, 1, ws.getLastColumn()).getValues()[0];
  var rows    = ws.getRange(dataStart, 1, endRow - dataStart + 1, headers.length).getValues();

  var result = [];
  for (var i = 0; i < rows.length; i++) {
    // Skip baris kosong (kolom A kosong)
    if (!rows[i][0] || rows[i][0] === "") continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j]).trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      var val = rows[i][j];
      // Convert Date ke ISO string
      if (val instanceof Date) {
        val = val.toISOString();
      }
      obj[key] = val !== "" ? val : null;
    }
    result.push(obj);
  }
  return result;
}

// ─── HELPER: Push file ke GitHub ────────────────────────────
function pushToGitHub(path, content, token) {
  var url = "https://api.github.com/repos/" + GH_USER + "/" + GH_REPO + "/contents/" + path;

  // Ambil SHA file lama (untuk update)
  var sha = null;
  try {
    var getRes = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github.v3+json"
      },
      muteHttpExceptions: true
    });
    if (getRes.getResponseCode() === 200) {
      sha = JSON.parse(getRes.getContentText()).sha;
    }
  } catch(e) { /* file baru, tidak ada SHA */ }

  // Push konten baru
  var body = {
    message: "Auto-update " + path + " — " + new Date().toISOString(),
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch:  GH_BRANCH
  };
  if (sha) body.sha = sha;

  var res = UrlFetchApp.fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code === 200 || code === 201) {
    Logger.log("✅ Push berhasil: " + path + " (HTTP " + code + ")");
    return true;
  } else {
    Logger.log("❌ Push gagal: " + path + " — HTTP " + code + " — " + res.getContentText().substring(0,200));
    return false;
  }
}

// ─── BUILD JSON PHASE 1 ──────────────────────────────────────
function buildP1() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // KPI dari DASH_P1
  var d1  = ss.getSheetByName("DASH_P1");
  var kpi = {};
  if (d1) {
    // Baris 5 = nilai KPI (dari struktur yang kita buat di Apps Script setup)
    try {
      kpi = {
        po_open:      d1.getRange("A5").getValue() || 0,
        po_partial:   d1.getRange("B5").getValue() || 0,
        wo_aktif:     d1.getRange("C5").getValue() || 0,
        qc_pass_rate: d1.getRange("D5").getValue() || 0,
        ncr_open:     d1.getRange("E5").getValue() || 0,
        po_pending:   d1.getRange("F5").getValue() || 0,
        capa_open:    d1.getRange("G5").getValue() || 0,
      };
    } catch(e) { Logger.log("KPI P1 error: " + e); }
  }

  // PO Tracker
  var po_tracker = sheetToObjects("PO_TRACKER", 2, 3, 200);

  // Production Log → Work Orders
  var work_orders = sheetToObjects("PRODUCTION_LOG", 2, 3, 100);

  // Alerts dari ALERT_ENGINE
  var alert_raw = sheetToObjects("ALERT_ENGINE", 2, 3, 100);
  var alerts = alert_raw.filter(function(a) {
    return a.status === "CRITICAL" || a.status === "WARNING";
  }).map(function(a) {
    return {
      alert_id:          a.alert_id,
      phase:             a.phase,
      item_type:         a.item_type,
      item_id:           a.item_id,
      threshold_reorder: a.threshold_reorder,
      threshold_safety:  a.threshold_safety,
      stok_current:      a.stok_current,
      status:            a.status,
      aksi:              a.aksi_diperlukan
    };
  });

  return {
    last_updated: new Date().toISOString(),
    phase:        "P1",
    kpi:          kpi,
    po_tracker:   po_tracker,
    work_orders:  work_orders,
    alerts:       alerts
  };
}

// ─── BUILD JSON PHASE 2 ──────────────────────────────────────
function buildP2() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d2 = ss.getSheetByName("DASH_P2");

  var stok_cover    = [];
  var stok_inner    = [];
  var assembly_calc = [];

  if (d2) {
    // Cover: baris 5–9 (header baris 4)
    var coverData = sheetToObjects("DASH_P2", 4, 5, 65);
    stok_cover = coverData.filter(function(r) { return r.cover_id; }).map(function(r) {
      return {
        cover_id:          r.cover_id,
        cover_name:        r.cover_name,
        stok_saat_ini:     Number(r.stok_saat_ini) || 0,
        safety_stock:      Number(r.safety_stock)  || 0,
        status:            String(r.status || "").replace(/[⚠️🟡🟢]/g,'').trim(),
        sku_yang_tergantung: Number(r.sku_yg_tergantung) || 0
      };
    });

    // Inner: baris 12–14 (header baris 11)
    var innerData = sheetToObjects("DASH_P2", 11, 12, 6);
    stok_inner = innerData.filter(function(r) { return r.inner_id; }).map(function(r) {
      return {
        inner_id:        r.inner_id,
        inner_name:      r.inner_name,
        stok_saat_ini:   Number(r.stok_saat_ini)  || 0,
        safety_stock:    Number(r.safety_stock)    || 0,
        status:          String(r.status || "").replace(/[⚠️🟡🟢]/g,'').trim(),
        cover_yang_pakai: Number(r.cover_yg_pakai) || 0
      };
    });

    // Assembly calc: baris 19–21 (header baris 18)
    var asmData = sheetToObjects("DASH_P2", 18, 19, 65);
    assembly_calc = asmData.filter(function(r) { return r.sku_id; }).map(function(r) {
      return {
        sku_id:           r.sku_id,
        cover_id:         r.cover_id,
        inner_id:         r.inner_id,
        stok_cover:       Number(r.stok_cover)       || 0,
        stok_inner:       Number(r.stok_inner)        || 0,
        max_assembleable: Number(r.max_bisa_assembly)  || 0
      };
    });
  }

  // Alerts dari ALERT_ENGINE — filter P2
  var alert_raw = sheetToObjects("ALERT_ENGINE", 2, 3, 100);
  var alerts = alert_raw.filter(function(a) {
    return (a.status === "CRITICAL" || a.status === "WARNING") && a.phase === "P2";
  }).map(function(a) {
    return {
      item_id:      a.item_id,
      item_type:    a.item_type,
      stok_current: Number(a.stok_current) || 0,
      status:       a.status,
      aksi:         a.aksi_diperlukan
    };
  });

  return {
    last_updated:  new Date().toISOString(),
    phase:         "P2",
    stok_cover:    stok_cover,
    stok_inner:    stok_inner,
    assembly_calc: assembly_calc,
    alerts:        alerts
  };
}

// ─── BUILD JSON PHASE 3 ──────────────────────────────────────
function buildP3() {
  // SKU Status dari DASH_P3
  var sku_raw = sheetToObjects("DASH_P3", 2, 3, 100);
  var sku_status = sku_raw.filter(function(r) { return r.sku_id; }).map(function(r) {
    return {
      sku_id:          r.sku_id,
      sku_name:        r.sku_name,
      stok_efektif:    Number(r.stok_efektif)   || 0,
      aws_4w:          Number(r.aws_4w)          || 0,
      dos:             Number(r.dos)             || 0,
      status_md:       String(r.status_md        || "IDLE"),
      reforecast_4w:   Number(r.reforecast_4w)   || 0,
      suggested_order: Number(r.suggested_order)  || 0,
      on_order:        Number(r.on_order)         || 0,
      stok_setelah_po: Number(r.stok_setelah_po) || 0
    };
  });

  // Weekly intake dari SALES_WEEKLY
  var weekly_raw = sheetToObjects("SALES_WEEKLY", 2, 3, 100);
  var weekly_intake = weekly_raw.filter(function(r) { return r.week_id; }).map(function(r) {
    return {
      week_id:     r.week_id,
      sku_id:      r.sku_id,
      qty_terjual: Number(r.qty_terjual) || 0,
      revenue:     Number(r.revenue)     || 0,
      channel:     r.channel
    };
  });

  // Alerts P3
  var alert_raw = sheetToObjects("ALERT_ENGINE", 2, 3, 100);
  var alerts = alert_raw.filter(function(a) {
    return (a.status === "CRITICAL" || a.status === "WARNING") && a.phase === "P3";
  }).map(function(a) {
    return {
      item_id:      a.item_id,
      stok_current: Number(a.stok_current) || 0,
      status:       a.status,
      aksi:         a.aksi_diperlukan
    };
  });

  return {
    last_updated:  new Date().toISOString(),
    phase:         "P3",
    sku_status:    sku_status,
    weekly_intake: weekly_intake,
    alerts:        alerts
  };
}

// ─── MAIN EXPORT ─────────────────────────────────────────────
function exportAllToGitHub() {
  Logger.log("=== START exportAllToGitHub ===");

  var token = getToken();
  if (!token) return;

  try {
    // Build semua data
    Logger.log("Building P1...");
    var p1 = buildP1();
    Logger.log("Building P2...");
    var p2 = buildP2();
    Logger.log("Building P3...");
    var p3 = buildP3();

    // Push ke GitHub
    Logger.log("Pushing data_p1.json...");
    pushToGitHub("data/data_p1.json", JSON.stringify(p1, null, 2), token);

    Logger.log("Pushing data_p2.json...");
    pushToGitHub("data/data_p2.json", JSON.stringify(p2, null, 2), token);

    Logger.log("Pushing data_p3.json...");
    pushToGitHub("data/data_p3.json", JSON.stringify(p3, null, 2), token);

    // Log export ke sheet
    logExport(true, "P1+P2+P3 berhasil di-export");

    Logger.log("=== DONE — " + new Date().toISOString() + " ===");

  } catch(e) {
    Logger.log("ERROR: " + e.toString());
    logExport(false, e.message);
  }
}

// ─── LOG EXPORT KE SHEET ─────────────────────────────────────
function logExport(success, msg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName("_EXPORT_LOG");

  if (!logSheet) {
    logSheet = ss.insertSheet("_EXPORT_LOG");
    logSheet.setTabColor("#5D6D7E");
    logSheet.getRange(1,1,1,4).setValues([["TIMESTAMP","STATUS","PESAN","TRIGGER"]]);
    logSheet.getRange(1,1,1,4)
      .setBackground("#1A3A5C").setFontColor("#FFFFFF").setFontWeight("bold");
  }

  var nextRow = logSheet.getLastRow() + 1;
  logSheet.getRange(nextRow, 1).setValue(new Date()).setNumberFormat("DD/MM/YYYY HH:MM:SS");
  logSheet.getRange(nextRow, 2).setValue(success ? "✅ SUCCESS" : "❌ FAILED")
    .setFontColor(success ? "#1E8449" : "#C0392B").setFontWeight("bold");
  logSheet.getRange(nextRow, 3).setValue(msg || "");
  logSheet.getRange(nextRow, 4).setValue("Auto");

  // Batasi log 200 baris
  if (nextRow > 202) logSheet.deleteRow(2);
}

// ─── SETUP TRIGGER OTOMATIS (jalankan sekali) ────────────────
function installTrigger() {
  // Hapus trigger lama
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "exportAllToGitHub") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Buat trigger baru setiap 15 menit
  ScriptApp.newTrigger("exportAllToGitHub")
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log("✅ Trigger setiap 15 menit berhasil dipasang");
}

// ─── HAPUS TRIGGER ───────────────────────────────────────────
function removeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "exportAllToGitHub") {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  Logger.log("Dihapus " + count + " trigger");
}

// ─── TEST: Export manual tanpa trigger ───────────────────────
function testExport() {
  Logger.log("=== TEST EXPORT ===");
  exportAllToGitHub();
}
