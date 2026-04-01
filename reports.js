// ══════════════════════════════════════════
// reports.js — التقارير الكاملة (المرحلة 4)
// 4 تبويبات: شهري / مصاريف / تأمينات / سنوي
// ══════════════════════════════════════════
'use strict';

let _reportsTab = 'monthly';

function loadReports() {
  const container = document.getElementById('reports-content');
  if (!container) return;
  container.innerHTML = `
<div class="pay-tabs" id="reports-tabs">
  <button class="pay-tab-btn active" data-tab="monthly"  onclick="switchReportsTab('monthly')">${t('reports_monthly')}</button>
  <button class="pay-tab-btn" data-tab="expenses" onclick="switchReportsTab('expenses')">${t('reports_expenses')}</button>
  <button class="pay-tab-btn" data-tab="deposits" onclick="switchReportsTab('deposits')">${t('reports_deposits')}</button>
  <button class="pay-tab-btn" data-tab="annual"   onclick="switchReportsTab('annual')">${t('reports_annual')}</button>
</div>
<div id="reports-tab-content"></div>`;
  switchReportsTab('monthly');
}

function switchReportsTab(tab) {
  _reportsTab = tab;
  document.querySelectorAll('#reports-tabs .pay-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const c = document.getElementById('reports-tab-content');
  if (!c) return;
  c.innerHTML = `<div class="loading">${t('loading')}</div>`;
  if      (tab === 'monthly')  loadMonthly();
  else if (tab === 'expenses') loadExpRpt();
  else if (tab === 'deposits') loadDepRpt();
  else if (tab === 'annual')   loadAnnual();
}

// ══════════════════════════════════════════
// التقرير الشهري — Accrual by apartment
// ══════════════════════════════════════════
async function loadMonthly() {
  const c = document.getElementById('reports-tab-content');
  const monthFirst = Helpers.currentMonthFirst();

  c.innerHTML = `
<div class="report-controls">
  <input type="month" id="rpt-month" value="${monthFirst.slice(0,7)}" onchange="loadMonthly()">
  <button class="btn btn-secondary" onclick="exportMonthlyPDF()">${t('btn_export_pdf')}</button>
</div>
<div id="rpt-monthly-body"><div class="loading">${t('loading')}</div></div>`;

  await _renderMonthly();
}

async function _renderMonthly() {
  const monthEl = document.getElementById('rpt-month');
  const body    = document.getElementById('rpt-monthly-body');
  if (!monthEl || !body) return;

  const selectedMonth = monthEl.value + '-01';

  try {
    // Q9: جيب كل البيانات دفعة واحدة
    const [unitsRes, paymentsRes, depositsRes, refundsRes] = await Promise.all([
      sb.from('units').select('id, apartment, room, tenant_name, monthly_rent, is_vacant, unit_status').order('apartment').order('room'),
      sb.from('rent_payments').select('unit_id, apartment, room, tenant_name, amount, tenant_num, payment_method').eq('payment_month', selectedMonth),
      sb.from('deposits').select('unit_id, amount, status, deposit_received_date').like('deposit_received_date', selectedMonth.slice(0,7) + '%'),
      sb.from('deposits').select('unit_id, refund_amount').gt('refund_amount', 0).like('refund_date', selectedMonth.slice(0,7) + '%'),
    ]);

    if (unitsRes.error) throw unitsRes.error;

    const units      = unitsRes.data    || [];
    const payments   = paymentsRes.data || [];
    const newDeps    = depositsRes.data || [];
    const refunds    = refundsRes.data  || [];

    // Map المدفوعات حسب unit_id
    const paidMap = {};
    payments.forEach(p => { paidMap[p.unit_id] = (paidMap[p.unit_id]||0) + parseFloat(p.amount||0); });

    // إجماليات
    const totalRent     = payments.reduce((s,p) => s+parseFloat(p.amount||0), 0);
    const totalDeps     = newDeps.reduce((s,d) => s+parseFloat(d.amount||0), 0);
    const totalRefunds  = refunds.reduce((s,r) => s+parseFloat(r.refund_amount||0), 0);
    const totalTarget   = units.filter(u => !u.is_vacant && u.unit_status==='occupied').reduce((s,u) => s+parseFloat(u.monthly_rent||0), 0);
    const totalNet      = totalRent + totalDeps - totalRefunds;

    // تجميع حسب الشقة
    const aptMap = {};
    units.filter(u => !u.is_vacant).forEach(u => {
      const key = u.apartment;
      if (!aptMap[key]) aptMap[key] = { apartment: key, units: [], totalRequired: 0, totalPaid: 0 };
      const paid = paidMap[u.id] || 0;
      aptMap[key].units.push({ ...u, paid });
      aptMap[key].totalRequired += parseFloat(u.monthly_rent||0);
      aptMap[key].totalPaid     += paid;
    });

    const aptGroups = Object.values(aptMap).sort((a,b) => a.apartment.localeCompare(b.apartment, undefined, {numeric:true}));

    body.innerHTML = `
<div id="rpt-monthly-content">
<div class="rpt-header">
  <strong>${t('reports_monthly')} — ${Helpers.fmtMonth(selectedMonth)}</strong>
</div>

<div class="rpt-kpi-bar">
  <div class="rpt-kpi"><span class="rpt-kpi-val green">${Helpers.formatAED(totalRent)}</span><span class="rpt-kpi-lbl">${t('kpi_collected')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val blue">${Helpers.formatAED(totalDeps)}</span><span class="rpt-kpi-lbl">${t('deposits_received')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val red">${Helpers.formatAED(totalRefunds)}</span><span class="rpt-kpi-lbl">${t('refunds_lbl')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val amber">${Helpers.formatAED(totalTarget - totalRent > 0 ? totalTarget - totalRent : 0)}</span><span class="rpt-kpi-lbl">${t('kpi_remaining')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val">${Helpers.formatAED(totalNet)}</span><span class="rpt-kpi-lbl">${t('net_profit')}</span></div>
</div>

${aptGroups.map(g => `
<div class="rpt-apt-group">
  <div class="rpt-apt-header">
    <span>${t('apt_label')} ${Helpers.escapeHtml(g.apartment)}</span>
    <span class="${g.totalPaid >= g.totalRequired ? 'green' : g.totalPaid > 0 ? 'amber' : 'red'}">${Helpers.formatAED(g.totalPaid)} / ${Helpers.formatAED(g.totalRequired)}</span>
  </div>
  ${g.units.map(u => `
  <div class="rpt-unit-row">
    <span class="muted">${t('room_label')} ${Helpers.escapeHtml(u.room)}</span>
    <span>${Helpers.escapeHtml(u.tenant_name||'—')}</span>
    <span class="${u.paid >= parseFloat(u.monthly_rent||0) ? 'green' : u.paid > 0 ? 'amber' : 'red'}">${Helpers.formatAED(u.paid)}</span>
    <span class="muted">${Helpers.formatAED(u.monthly_rent)}</span>
  </div>`).join('')}
</div>`).join('')}

${aptGroups.length === 0 ? `<div class="empty-msg">${t('no_payments_this_month')}</div>` : ''}
</div>`;

  } catch(err) {
    body.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

// ══════════════════════════════════════════
// تقرير المصاريف
// ══════════════════════════════════════════
async function loadExpRpt() {
  const c = document.getElementById('reports-tab-content');
  const monthFirst = Helpers.currentMonthFirst();

  c.innerHTML = `
<div class="report-controls">
  <input type="month" id="exp-rpt-month" value="${monthFirst.slice(0,7)}" onchange="loadExpRpt()">
</div>
<div id="rpt-exp-body"><div class="loading">${t('loading')}</div></div>`;

  await _renderExpRpt();
}

async function _renderExpRpt() {
  const monthEl = document.getElementById('exp-rpt-month');
  const body    = document.getElementById('rpt-exp-body');
  if (!monthEl || !body) return;

  const month = monthEl.value + '-01';

  try {
    const { data: expenses, error } = await sb.from('expenses')
      .select('*').eq('period_month', month).order('created_at', {ascending: false});
    if (error) throw error;

    const total = (expenses||[]).reduce((s,e) => s+parseFloat(e.amount||0), 0);

    // تجميع حسب الفئة
    const catMap = {};
    (expenses||[]).forEach(e => {
      const cat = e.category || t('uncategorized');
      catMap[cat] = (catMap[cat]||0) + parseFloat(e.amount||0);
    });

    body.innerHTML = `
<div class="rpt-header">
  <strong>${t('reports_expenses')} — ${Helpers.fmtMonth(month)}</strong>
  <span class="red bold">${t('total')}: ${Helpers.formatAED(total)}</span>
</div>

${Object.entries(catMap).length > 0 ? `
<div class="rpt-cat-summary">
  ${Object.entries(catMap).map(([cat, amt]) => `
  <div class="rpt-cat-row">
    <span>${Helpers.escapeHtml(cat)}</span>
    <span class="red">${Helpers.formatAED(amt)}</span>
  </div>`).join('')}
</div>` : ''}

<div class="section-title">${t('details')}</div>
${(expenses||[]).length === 0
  ? `<div class="empty-msg">${t('no_expenses')}</div>`
  : (expenses||[]).map(e => `
<div class="rpt-row">
  <span class="muted small">${Helpers.fmtDate(e.created_at)}</span>
  <span>${Helpers.escapeHtml(e.category||'—')}</span>
  <span class="red">${Helpers.formatAED(e.amount)}</span>
  <span class="muted small">${Helpers.escapeHtml(e.description||'')}</span>
  <button class="icon-btn" onclick="deleteExpense('${e.id}')">🗑️</button>
</div>`).join('')
}`;
  } catch(err) {
    body.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

async function deleteExpense(id) {
  if (!confirm(t('btn_confirm_delete'))) return;
  const { error } = await sb.from('expenses').delete().eq('id', id);
  if (error) { toast(`❌ ${error.message}`, 'error'); return; }
  toast(t('toast_deleted'), 'info');
  _renderExpRpt();
}

// ══════════════════════════════════════════
// تقرير التأمينات
// ══════════════════════════════════════════
async function loadDepRpt() {
  const c = document.getElementById('reports-tab-content');
  c.innerHTML = `<div class="loading">${t('loading')}</div>`;

  try {
    const { data: deposits, error } = await sb.from('deposits')
      .select('*').order('created_at', {ascending: false});
    if (error) throw error;

    const deps = deposits || [];
    const held      = deps.filter(d => d.status==='held' && !(d.refund_amount > 0));
    const partial   = deps.filter(d => d.status==='held' && d.refund_amount > 0);
    const refunded  = deps.filter(d => d.status==='refunded');
    const forfeited = deps.filter(d => d.status==='forfeited');

    const totalHeld      = held.reduce((s,d) => s+parseFloat(d.amount||0), 0);
    const totalPartial   = partial.reduce((s,d) => s+parseFloat(d.amount||0), 0);
    const totalRefunded  = [...refunded,...partial].reduce((s,d) => s+parseFloat(d.refund_amount||0), 0);
    const totalForfeited = forfeited.reduce((s,d) => s+parseFloat(d.amount||0), 0);

    const renderGroup = (list, title, badgeClass) => {
      if (list.length === 0) return '';
      return `
<div class="section-title">${title} (${list.length})</div>
${list.map(d => `
<div class="rpt-row">
  <span>${t('apt_label')} ${Helpers.escapeHtml(d.apartment)} — ${t('room_label')} ${Helpers.escapeHtml(d.room)}</span>
  <span>${Helpers.escapeHtml(d.tenant_name||'—')}</span>
  <span class="green">${Helpers.formatAED(d.amount)}</span>
  ${d.refund_amount > 0 ? `<span class="amber">↩ ${Helpers.formatAED(d.refund_amount)}</span>` : ''}
  <span class="status-badge ${badgeClass}">${d.status==='held'?t('deposit_held'):d.status==='refunded'?t('deposit_refunded'):t('deposit_forfeited')}</span>
</div>`).join('')}`;
    };

    c.innerHTML = `
<div class="rpt-header"><strong>${t('reports_deposits')}</strong></div>

<div class="rpt-kpi-bar">
  <div class="rpt-kpi"><span class="rpt-kpi-val green">${Helpers.formatAED(totalHeld)}</span><span class="rpt-kpi-lbl">${t('deposit_held')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val amber">${Helpers.formatAED(totalPartial)}</span><span class="rpt-kpi-lbl">${t('deposit_partial')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val blue">${Helpers.formatAED(totalRefunded)}</span><span class="rpt-kpi-lbl">${t('deposit_refunded')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val red">${Helpers.formatAED(totalForfeited)}</span><span class="rpt-kpi-lbl">${t('deposit_forfeited')}</span></div>
</div>

${renderGroup(held,     t('deposit_held'),     'status-paid')}
${renderGroup(partial,  t('deposit_partial'),  'status-partial')}
${renderGroup(refunded, t('deposit_refunded'), 'status-vacant')}
${renderGroup(forfeited,t('deposit_forfeited'),'status-unpaid')}
${deps.length === 0 ? `<div class="empty-msg">${t('no_deposits')}</div>` : ''}`;

  } catch(err) {
    c.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

// ══════════════════════════════════════════
// التقرير السنوي
// ══════════════════════════════════════════
async function loadAnnual() {
  const c = document.getElementById('reports-tab-content');
  const year = new Date().getFullYear();

  c.innerHTML = `
<div class="report-controls">
  <select id="ann-year" onchange="loadAnnual()">
    ${[year, year-1, year-2].map(y => `<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}
  </select>
</div>
<div id="rpt-annual-body"><div class="loading">${t('loading')}</div></div>`;

  await _renderAnnual();
}

async function _renderAnnual() {
  const yearEl = document.getElementById('ann-year');
  const body   = document.getElementById('rpt-annual-body');
  if (!yearEl || !body) return;

  const selectedYear = parseInt(yearEl.value);

  try {
    const months = Array.from({length:12}, (_,i) => {
      const m = String(i+1).padStart(2,'0');
      return `${selectedYear}-${m}-01`;
    });

    // Q9: جيب كل المدفوعات للسنة دفعة واحدة
    const { data: payments, error: pErr } = await sb.from('rent_payments')
      .select('amount, payment_month')
      .gte('payment_month', `${selectedYear}-01-01`)
      .lte('payment_month', `${selectedYear}-12-31`);
    if (pErr) throw pErr;

    const { data: expenses, error: eErr } = await sb.from('expenses')
      .select('amount, period_month')
      .gte('period_month', `${selectedYear}-01-01`)
      .lte('period_month', `${selectedYear}-12-31`);
    if (eErr) throw eErr;

    // تجميع حسب الشهر
    const rentByMonth = {};
    const expByMonth  = {};
    months.forEach(m => { rentByMonth[m] = 0; expByMonth[m] = 0; });

    (payments||[]).forEach(p => {
      const key = Helpers.toMonthFirst(p.payment_month);
      if (rentByMonth[key] !== undefined) rentByMonth[key] += parseFloat(p.amount||0);
    });
    (expenses||[]).forEach(e => {
      const key = Helpers.toMonthFirst(e.period_month);
      if (expByMonth[key] !== undefined) expByMonth[key] += parseFloat(e.amount||0);
    });

    const totalRent = Object.values(rentByMonth).reduce((s,v) => s+v, 0);
    const totalExp  = Object.values(expByMonth).reduce((s,v) => s+v, 0);
    const maxRent   = Math.max(...Object.values(rentByMonth), 1);

    const monthNames = LANG === 'ar'
      ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
      : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    body.innerHTML = `
<div class="rpt-header">
  <strong>${t('reports_annual')} ${selectedYear}</strong>
</div>
<div class="rpt-kpi-bar">
  <div class="rpt-kpi"><span class="rpt-kpi-val green">${Helpers.formatAED(totalRent)}</span><span class="rpt-kpi-lbl">${t('kpi_collected')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val red">${Helpers.formatAED(totalExp)}</span><span class="rpt-kpi-lbl">${t('expenses_lbl')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val">${Helpers.formatAED(totalRent - totalExp)}</span><span class="rpt-kpi-lbl">${t('net_profit')}</span></div>
</div>

<div class="annual-chart">
${months.map((m, i) => {
  const rent = rentByMonth[m];
  const exp  = expByMonth[m];
  const barW = Math.round((rent / maxRent) * 100);
  return `
<div class="annual-row">
  <span class="annual-month">${monthNames[i]}</span>
  <div class="annual-bar-wrap">
    <div class="annual-bar-rent" style="width:${barW}%"></div>
  </div>
  <span class="annual-val green">${Helpers.formatAED(rent)}</span>
  <span class="annual-val red" style="font-size:.75rem">${exp > 0 ? '−' + Helpers.formatAED(exp) : ''}</span>
</div>`;
}).join('')}
</div>`;

  } catch(err) {
    body.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

// ══════════════════════════════════════════
// PDF Export — التقرير الشهري
// ══════════════════════════════════════════
async function exportMonthlyPDF() {
  const monthEl = document.getElementById('rpt-month');
  if (!monthEl) return;
  const month = monthEl.value + '-01';

  try {
    const [unitsRes, paymentsRes] = await Promise.all([
      sb.from('units').select('*').eq('is_vacant', false).order('apartment').order('room'),
      sb.from('rent_payments').select('*').eq('payment_month', month),
    ]);

    const units    = unitsRes.data    || [];
    const payments = paymentsRes.data || [];

    const paidMap = {};
    payments.forEach(p => { paidMap[p.unit_id] = (paidMap[p.unit_id]||0) + parseFloat(p.amount||0); });

    const totalCollected = payments.reduce((s,p) => s+parseFloat(p.amount||0), 0);
    const totalTarget    = units.reduce((s,u) => s+parseFloat(u.monthly_rent||0), 0);

    const rows = units.map(u => {
      const paid = paidMap[u.id] || 0;
      const due  = Math.max(0, parseFloat(u.monthly_rent||0) - paid);
      return `<tr>
        <td>${Helpers.escapeHtml(u.apartment)}</td>
        <td>${Helpers.escapeHtml(u.room)}</td>
        <td>${Helpers.escapeHtml(u.tenant_name||'—')}</td>
        <td style="color:#22c55e;font-weight:700">${Helpers.formatAED(paid)}</td>
        <td>${Helpers.formatAED(u.monthly_rent)}</td>
        <td style="color:${due>0?'#ef4444':'#22c55e'}">${due>0?Helpers.formatAED(due):'✅'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html dir="${LANG==='ar'?'rtl':'ltr'}">
<head><meta charset="UTF-8">
<style>
  body{font-family:Cairo,Arial,sans-serif;font-size:12px;margin:20px}
  h2{text-align:center;color:#333}
  .sub{text-align:center;color:#777;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#2196f3;color:white;padding:8px;text-align:center}
  td{padding:7px 8px;border-bottom:1px solid #eee;text-align:center}
  tr:nth-child(even) td{background:#f9f9f9}
  .total{margin-top:15px;font-weight:700;font-size:13px;text-align:right;color:#333}
  @media print{body{margin:0}}
</style></head><body>
<h2>🏢 واحدتنا — Wahdatina</h2>
<div class="sub">${Helpers.fmtMonth(month)} | ${t('reports_monthly')}</div>
<table>
  <thead><tr>
    <th>${t('apt_label')}</th><th>${t('room_label')}</th><th>${t('drawer_tenant')}</th>
    <th>${t('kpi_collected')}</th><th>${t('uf_rent')}</th><th>${t('kpi_remaining')}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total">
  ${t('kpi_collected')}: ${Helpers.formatAED(totalCollected)} &nbsp;|&nbsp;
  ${t('kpi_target')}: ${Helpers.formatAED(totalTarget)} &nbsp;|&nbsp;
  ${t('kpi_remaining')}: ${Helpers.formatAED(Math.max(0, totalTarget - totalCollected))}
</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}
