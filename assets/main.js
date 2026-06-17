// ── SCM Dashboard — Shared Utilities ──────────────────────

const SCM = {
  BASE: '',   // set otomatis di bawah
  cache: {}
};

// Deteksi base URL otomatis (GitHub Pages vs local)
SCM.BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? ''
  : '/scm-dashboard';

// ── Fetch data JSON ────────────────────────────────────────
async function fetchData(phase) {
  const url = `${SCM.BASE}/data/data_p${phase}.json?t=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    SCM.cache[phase] = data;
    return data;
  } catch (e) {
    console.error('fetchData error:', e);
    return null;
  }
}

// ── Format helpers ─────────────────────────────────────────
function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('id-ID');
}

function fmtRp(n) {
  if (!n) return '—';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return (Number(n) * 100).toFixed(1) + '%';
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d)) / 60000);
  if (diff < 1)  return 'baru saja';
  if (diff < 60) return diff + ' menit lalu';
  if (diff < 1440) return Math.floor(diff/60) + ' jam lalu';
  return Math.floor(diff/1440) + ' hari lalu';
}

// ── Badge helper ───────────────────────────────────────────
function badge(text, type) {
  const map = {
    // Status MD
    'MAINTAIN':  'green',  'REPLENISH': 'amber',
    'PUSH':      'red',    'IDLE':      'gray',
    'MONITOR':   'blue',   'STOCKOUT':  'red',
    // PO / WO
    'OPEN':      'blue',   'PARTIAL':   'amber',
    'CLOSED':    'green',  'CANCELLED': 'gray',
    'PROSES':    'blue',   'SELESAI':   'green',
    'DRAFT':     'gray',   'HOLD':      'red',
    // QC
    'PASS':      'green',  'FAIL':      'red',
    'CONDITIONAL PASS': 'amber',
    // Alert
    'OK':        'green',  'WARNING':   'amber',
    'CRITICAL':  'red',
    // Approval
    'APPROVED':  'green',  'PENDING':   'amber',
    'REJECTED':  'red',
    // GR
    'COMPLETE':  'green',
  };
  const cls = map[String(text).toUpperCase()] || 'gray';
  return `<span class="badge badge-${cls}">${text || '—'}</span>`;
}

// ── Alert banner ───────────────────────────────────────────
function showAlertBanner(containerId, alerts) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!alerts || alerts.length === 0) {
    el.innerHTML = `<div class="alert-bar ok">✅ Semua item dalam kondisi aman</div>`;
    return;
  }
  const critical = alerts.filter(a => a.status === 'CRITICAL');
  const warning  = alerts.filter(a => a.status === 'WARNING');
  let html = '';
  if (critical.length > 0) {
    html += `<div class="alert-bar critical">🔴 ${critical.length} item CRITICAL: 
      ${critical.slice(0,3).map(a => a.item_id).join(', ')}
      ${critical.length > 3 ? ` +${critical.length-3} lainnya` : ''}
    </div>`;
  }
  if (warning.length > 0) {
    html += `<div class="alert-bar warning">🟡 ${warning.length} item WARNING perlu dimonitor</div>`;
  }
  el.innerHTML = html;
}

// ── Last updated ───────────────────────────────────────────
function setLastUpdated(ts) {
  const el = document.getElementById('last-updated');
  if (!el) return;
  const ago = timeAgo(ts);
  const stale = (Date.now() - new Date(ts)) > 30 * 60 * 1000;
  el.innerHTML = stale
    ? `<span style="color:#e74c3c">⚠ Data ${ago} — mungkin belum terbaru</span>`
    : `Data diupdate ${ago}`;
}

// ── Filter pills ───────────────────────────────────────────
function initFilters(containerId, options, onFilter) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = options.map((opt, i) =>
    `<button class="pill ${i===0?'active':''}" data-val="${opt.val}">${opt.label}</button>`
  ).join('');
  el.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onFilter(btn.dataset.val);
    });
  });
}

// ── Sortable table ─────────────────────────────────────────
function makeSortable(tableId) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  const ths = tbl.querySelectorAll('thead th[data-sort]');
  ths.forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col   = th.dataset.sort;
      const asc   = th.dataset.asc !== 'true';
      th.dataset.asc = asc;
      ths.forEach(t => t.textContent = t.textContent.replace(/ [▲▼]$/,''));
      th.textContent += asc ? ' ▲' : ' ▼';
      const tbody = tbl.querySelector('tbody');
      const rows  = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const ai = th.cellIndex;
        const av = a.cells[ai]?.textContent.trim() || '';
        const bv = b.cells[ai]?.textContent.trim() || '';
        const an = parseFloat(av.replace(/[^0-9.-]/g,''));
        const bn = parseFloat(bv.replace(/[^0-9.-]/g,''));
        if (!isNaN(an) && !isNaN(bn)) return asc ? an-bn : bn-an;
        return asc ? av.localeCompare(bv,'id') : bv.localeCompare(av,'id');
      });
      rows.forEach(r => tbody.appendChild(r));
    });
  });
}

// ── Search/filter table rows ───────────────────────────────
function filterTable(inputId, tableId) {
  const input = document.getElementById(inputId);
  const tbl   = document.getElementById(tableId);
  if (!input || !tbl) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    tbl.querySelectorAll('tbody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ── Loading state ──────────────────────────────────────────
function showLoading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="loading"><div class="spinner"></div>Memuat data...</div>`;
}

function showEmpty(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="empty"><div class="icon">📭</div>${msg || 'Tidak ada data'}</div>`;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="alert-bar critical">${msg || 'Gagal memuat data'}</div>`;
}
