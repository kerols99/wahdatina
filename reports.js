// ══════════════════════════════════════════
// reports.js — التقارير الكاملة (المرحلة 4)
// 4 تبويبات: شهري / مصاريف / تأمينات / سنوي
// ══════════════════════════════════════════
'use strict';

// ══════════════════════════════════════════
// exportPDF — دالة مركزية لكل تقارير الـ PDF
// ══════════════════════════════════════════
async function exportPDF(title, bodyHTML) {
  const style = `
    <style>
      @page { size: A4; margin: 10mm; }
      body { font-family: Cairo, Arial, sans-serif; direction: rtl; color: #111; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1a3a6a; color: #fff; padding: 6px 8px; text-align: right; font-size: 11px; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
      .header { border-bottom: 3px solid #1a3a6a; padding-bottom: 10px; margin-bottom: 16px; }
      .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 16px; }
      .kpi-box { background: #f5f7ff; border-radius: 8px; padding: 10px; text-align: center; }
      .kpi-val { font-size: 16px; font-weight: 800; color: #1a3a6a; }
      @media print { body { margin: 0; } }
    </style>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title>${style}</head><body>${bodyHTML}</body></html>`;
  const win = window.open('', '_blank');
  if (!win) { toast(t('allow_popups') || 'يرجى السماح بالنوافذ المنبثقة', 'error'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}


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
  if (!c) return;
  try {
    const monthFirst = Helpers.currentMonthFirst();
    c.innerHTML = `
<div class="report-controls">
  <input type="month" id="rpt-month" value="${monthFirst.slice(0,7)}" onchange="loadMonthly()">
  <button class="btn btn-secondary" onclick="exportMonthlyPDF()">${t('btn_export_pdf')}</button>
</div>
<div id="rpt-monthly-body"><div class="loading">${t('loading')}</div></div>`;
    await _renderMonthly();
  } catch(err) {
    c.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;
  }
}

async function _renderMonthly() {
  const monthEl = document.getElementById('rpt-month');
  const body    = document.getElementById('rpt-monthly-body');
  if (!monthEl || !body) return;

  const selectedMonthYM = monthEl.value;  // 'YYYY-MM'
  const monStart = selectedMonthYM + '-01';
  const monEnd   = Helpers.monthEnd(monStart);

  try {
    // Q9: جيب كل البيانات دفعة واحدة
    const [unitsRes, paymentsRes, allDepsRes, historyRes] = await Promise.all([
      sb.from('units')
        .select('id, apartment, room, tenant_name, monthly_rent, is_vacant, unit_status, start_date')
        .order('apartment').order('room'),
      sb.from('rent_payments')
        .select('unit_id, amount')
        .eq('payment_month', monStart),
      // كل التأمينات بدون فلتر — هنفلتر يدوياً حسب المنطق
      sb.from('deposits')
        .select('unit_id, amount, refund_amount, deposit_received_date, refund_date'),
      // unit_history للشهر المطلوب — مهم للتقارير التاريخية
      sb.from('unit_history')
        .select('unit_id, tenant_name, monthly_rent, start_date, end_date')
        .lte('start_date', monEnd)
        .or(`end_date.gte.${monStart},end_date.is.null`),
    ]);

    if (unitsRes.error)   throw unitsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const units   = unitsRes.data    || [];
    const payments = paymentsRes.data || [];
    const allDeps  = allDepsRes.data  || [];
    const history  = historyRes.data  || [];

    // ── Maps ──────────────────────────────────────────────
    // paidMap: unit_id → إجمالي مدفوع هذا الشهر
    const paidMap = {};
    payments.forEach(p => {
      paidMap[p.unit_id] = (paidMap[p.unit_id] || 0) + parseFloat(p.amount || 0);
    });

    // historyMap: unit_id → أقدم سجل ينتمي لهذا الشهر
    // (للمستأجر اللي كان موجود في هذا الشهر)
    const historyMap = {};
    history.forEach(h => {
      if (!historyMap[h.unit_id]) historyMap[h.unit_id] = h;
    });

    // deposit logic حسب الـ prompt:
    // - دخل: التأمين المستلم في هذا الشهر (deposit_received_date)
    // - خصم: المرتجع في هذا الشهر (refund_date)
    const depReceivedMap = {};  // unit_id → مبلغ التأمين المستلم هذا الشهر
    const depRefundMap   = {};  // unit_id → مبلغ المرتجع هذا الشهر
    allDeps.forEach(d => {
      const recYM = String(d.deposit_received_date || '').slice(0, 7);
      const refYM = String(d.refund_date || '').slice(0, 7);
      if (recYM === selectedMonthYM) {
        depReceivedMap[d.unit_id] = (depReceivedMap[d.unit_id] || 0) + parseFloat(d.amount || 0);
      }
      if (refYM === selectedMonthYM && parseFloat(d.refund_amount || 0) > 0) {
        depRefundMap[d.unit_id] = (depRefundMap[d.unit_id] || 0) + parseFloat(d.refund_amount || 0);
      }
    });

    // ── إجماليات ──────────────────────────────────────────
    const totalRent    = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const totalDeps    = Object.values(depReceivedMap).reduce((s, v) => s + v, 0);
    const totalRefunds = Object.values(depRefundMap).reduce((s, v) => s + v, 0);
    const totalNet     = totalRent + totalDeps - totalRefunds;

    // ── بناء قائمة الوحدات للتقرير ─────────────────────────
    // منطق المستأجر الصح للشهر:
    const reportUnits = [];

    units.forEach(u => {
      const h                 = historyMap[u.id];
      const hasPay            = (paidMap[u.id] || 0) > 0;
      const hasDepActivity    = (depReceivedMap[u.id] || 0) > 0 || (depRefundMap[u.id] || 0) > 0;
      const hasHistory        = !!h?.tenant_name;

      // المستأجر الحالي دخل بعد هذا الشهر؟
      const tenantStartedAfter = u.start_date &&
        u.start_date.slice(0, 7) > selectedMonthYM;

      // تجاهل الوحدة لو:
      // فاضية حالياً + مفيش مدفوعات + مفيش تأمين + مفيش تاريخ
      if (u.is_vacant && !hasPay && !hasDepActivity && !hasHistory) return;
      // المستأجر الحالي دخل بعد الشهر + مفيش تاريخ + مفيش مدفوعات
      if (tenantStartedAfter && !hasHistory && !hasPay && !hasDepActivity) return;

      // اختار المستأجر الصح للشهر ده
      const displayName = hasHistory ? h.tenant_name : u.tenant_name;

      // الإيجار المستهدف
      const targetRent = hasHistory
        ? parseFloat(h.monthly_rent || 0)
        : (tenantStartedAfter || u.is_vacant)
          ? 0
          : parseFloat(u.monthly_rent || 0);

      reportUnits.push({
        id:          u.id,
        apartment:   u.apartment,
        room:        u.room,
        displayName: displayName || '—',
        targetRent,
        paid:        paidMap[u.id] || 0,
        depReceived: depReceivedMap[u.id] || 0,
        depRefund:   depRefundMap[u.id] || 0,
        fromHistory: hasHistory,
      });
    });

    // تجميع حسب الشقة
    const aptMap = {};
    reportUnits.forEach(u => {
      const key = u.apartment;
      if (!aptMap[key]) aptMap[key] = { apartment: key, units: [], totalRequired: 0, totalPaid: 0 };
      aptMap[key].units.push(u);
      aptMap[key].totalRequired += u.targetRent;
      aptMap[key].totalPaid     += u.paid;
    });

    const totalTarget = reportUnits.reduce((s, u) => s + u.targetRent, 0);
    const aptGroups   = Object.values(aptMap)
      .sort((a, b) => a.apartment.localeCompare(b.apartment, undefined, { numeric: true }));

    body.innerHTML = `
<div id="rpt-monthly-content">
<div class="rpt-header">
  <strong>${t('reports_monthly')} — ${Helpers.fmtMonth(monStart)}</strong>
</div>

<div class="rpt-kpi-bar">
  <div class="rpt-kpi"><span class="rpt-kpi-val green">${Helpers.formatAED(totalRent)}</span><span class="rpt-kpi-lbl">${t('kpi_collected')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val blue">${Helpers.formatAED(totalDeps)}</span><span class="rpt-kpi-lbl">${t('deposits_received')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val red">${Helpers.formatAED(totalRefunds)}</span><span class="rpt-kpi-lbl">${t('refunds_lbl')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val amber">${Helpers.formatAED(Math.max(0, totalTarget - totalRent))}</span><span class="rpt-kpi-lbl">${t('kpi_remaining')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val">${Helpers.formatAED(totalNet)}</span><span class="rpt-kpi-lbl">${t('net_profit')}</span></div>
</div>

${aptGroups.map(g => `
<div class="rpt-apt-group">
  <div class="rpt-apt-header">
    <span>${t('apt_label')} ${Helpers.escapeHtml(g.apartment)}</span>
    <span class="${g.totalPaid >= g.totalRequired && g.totalRequired > 0 ? 'green' : g.totalPaid > 0 ? 'amber' : 'red'}">
      ${Helpers.formatAED(g.totalPaid)} / ${Helpers.formatAED(g.totalRequired)}
    </span>
  </div>
  ${g.units.map(u => `
  <div class="rpt-unit-row">
    <span class="muted">${t('room_label')} ${Helpers.escapeHtml(u.room)}</span>
    <span>${Helpers.escapeHtml(u.displayName)}${u.fromHistory ? ' <span class="muted small">📁</span>' : ''}</span>
    <span class="${u.paid >= u.targetRent && u.targetRent > 0 ? 'green' : u.paid > 0 ? 'amber' : 'red'}">${Helpers.formatAED(u.paid)}</span>
    <span class="muted">${Helpers.formatAED(u.targetRent)}</span>
    ${u.depReceived > 0 ? `<span class="blue small">+${Helpers.formatAED(u.depReceived)} ${t('deposit_held')}</span>` : ''}
    ${u.depRefund   > 0 ? `<span class="red small">-${Helpers.formatAED(u.depRefund)} ${t('deposit_refunded')}</span>` : ''}
  </div>`).join('')}
</div>`).join('')}

${aptGroups.length === 0
  ? `<div class="empty-msg">${t('no_payments_this_month')}</div>`
  : ''}
</div>`;

  } catch(err) {
    console.error('_renderMonthly:', err);
    body.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

// ══════════════════════════════════════════
// تقرير المصاريف
// ══════════════════════════════════════════
async function loadExpRpt() {
  const c = document.getElementById('reports-tab-content');
  if (!c) return;
  try {
    const monthFirst = Helpers.currentMonthFirst();
    c.innerHTML = `
<div class="report-controls">
  <input type="month" id="exp-rpt-month" value="${monthFirst.slice(0,7)}" onchange="loadExpRpt()">
</div>
<div id="rpt-exp-body"><div class="loading">${t('loading')}</div></div>`;
    await _renderExpRpt();
  } catch(err) {
    c.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;
  }
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
  try {
    const { error } = await sb.from('expenses').delete().eq('id', id);
    if (error) throw error;
    toast(t('toast_deleted'), 'info');
    _renderExpRpt();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════
// تقرير التأمينات — مع dedup + groupByApt
// ══════════════════════════════════════════
async function loadDepRpt() {
  const c = document.getElementById('reports-tab-content');
  if (!c) return;
  try {
    c.innerHTML = `<div class="loading">${t('loading')}</div>`;

    const { data: allDeps, error } = await sb.from('deposits')
      .select('*').gt('amount', 0).order('created_at', { ascending: false });
    if (error) throw error;

    // dedup: نفس unit_id + tenant_name + amount + status = سجل واحد
    const seen = new Set();
    const deps = (allDeps || []).filter(d => {
      const key = `${d.unit_id}|${d.tenant_name}|${d.amount}|${d.status}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Q12: refund_amount > 0 مش status='refunded'
    const held      = deps.filter(d => d.status === 'held' && !(d.refund_amount > 0));
    const partial   = deps.filter(d => d.status === 'held' && d.refund_amount > 0);
    const refunded  = deps.filter(d => d.status === 'refunded');
    const forfeited = deps.filter(d => d.status === 'forfeited');

    const totalHeld      = held.reduce((s,d) => s + parseFloat(d.amount||0), 0);
    const totalPartial   = partial.reduce((s,d) => s + parseFloat(d.amount||0) - parseFloat(d.refund_amount||0), 0);
    const totalRefunded  = [...refunded, ...partial].reduce((s,d) => s + parseFloat(d.refund_amount||0), 0);
    const totalForfeited = forfeited.reduce((s,d) => s + parseFloat(d.amount||0), 0);
    const totalActive    = totalHeld + totalPartial; // ما زال محتجزاً فعلاً

    // تجميع حسب شقة
    function groupByApt(items) {
      const groups = {};
      items.forEach(d => {
        const apt = String(d.apartment || '—');
        if (!groups[apt]) groups[apt] = { apt, items: [], total: 0 };
        groups[apt].items.push(d);
        groups[apt].total += parseFloat(d.amount || 0);
      });
      return Object.values(groups).sort((a,b) => a.apt.localeCompare(b.apt, undefined, { numeric: true }));
    }

    function renderGroup(list, title, badgeClass) {
      if (!list.length) return '';
      const groups = groupByApt(list);
      return `
<div class="section-title">${title} (${list.length})</div>
${groups.map(g => `
<div class="rpt-apt-group">
  <div class="rpt-apt-header">
    <span>${t('apt_label')} ${Helpers.escapeHtml(g.apt)}</span>
    <span class="green">${Helpers.formatAED(g.total)}</span>
  </div>
  ${g.items.map(d => `
  <div class="rpt-unit-row" style="grid-template-columns:80px 1fr 1fr auto">
    <span class="muted">${t('room_label')} ${Helpers.escapeHtml(d.room)}</span>
    <span>${Helpers.escapeHtml(d.tenant_name||'—')}</span>
    <div>
      <span class="green">${Helpers.formatAED(d.amount)}</span>
      ${d.refund_amount > 0 ? `<br><span class="amber small">↩ ${Helpers.formatAED(d.refund_amount)}</span><br><span class="muted small">${t('balance')}: ${Helpers.formatAED(parseFloat(d.amount)-parseFloat(d.refund_amount))}</span>` : ''}
    </div>
    <span class="status-badge ${badgeClass}">${d.status==='held'?t('deposit_held'):d.status==='refunded'?t('deposit_refunded'):t('deposit_forfeited')}</span>
  </div>`).join('')}
</div>`).join('')}`;
    }

    c.innerHTML = `
<div class="rpt-header"><strong>${t('reports_deposits')}</strong></div>

<div class="rpt-kpi-bar">
  <div class="rpt-kpi"><span class="rpt-kpi-val green">${Helpers.formatAED(totalActive)}</span><span class="rpt-kpi-lbl">🔒 ${t('total_held_active')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val green">${Helpers.formatAED(totalHeld)}</span><span class="rpt-kpi-lbl">${t('deposit_held')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val amber">${Helpers.formatAED(totalPartial)}</span><span class="rpt-kpi-lbl">${t('deposit_partial')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val blue">${Helpers.formatAED(totalRefunded)}</span><span class="rpt-kpi-lbl">↩️ ${t('deposit_refunded')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val red">${Helpers.formatAED(totalForfeited)}</span><span class="rpt-kpi-lbl">🚫 ${t('deposit_forfeited')}</span></div>
</div>

${renderGroup(held,      t('deposit_held'),     'status-paid')}
${renderGroup(partial,   t('deposit_partial'),  'status-partial')}
${renderGroup(refunded,  t('deposit_refunded'), 'status-vacant')}
${renderGroup(forfeited, t('deposit_forfeited'),'status-unpaid')}
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
  if (!c) return;
  try {
    const year = new Date().getFullYear();
    c.innerHTML = `
<div class="report-controls">
  <select id="ann-year" onchange="loadAnnual()">
    ${[year, year-1, year-2].map(y => `<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}
  </select>
</div>
<div id="rpt-annual-body"><div class="loading">${t('loading')}</div></div>`;
    await _renderAnnual();
  } catch(err) {
    c.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;
  }
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
  const selectedMonthYM = monthEl.value;
  const monStart = selectedMonthYM + '-01';
  const monEnd   = Helpers.monthEnd(monStart);

  try {
    // Q9: نفس منطق _renderMonthly مع unit_history
    const [unitsRes, paymentsRes, allDepsRes, historyRes] = await Promise.all([
      sb.from('units').select('id,apartment,room,tenant_name,monthly_rent,is_vacant,unit_status,start_date').order('apartment').order('room'),
      sb.from('rent_payments').select('unit_id,amount').eq('payment_month', monStart),
      sb.from('deposits').select('unit_id,amount,refund_amount,deposit_received_date,refund_date'),
      sb.from('unit_history').select('unit_id,tenant_name,monthly_rent,start_date,end_date')
        .lte('start_date', monEnd).or(`end_date.gte.${monStart},end_date.is.null`),
    ]);

    if (unitsRes.error) throw unitsRes.error;

    const units   = unitsRes.data || [];
    const payments = paymentsRes.data || [];
    const allDeps  = allDepsRes.data || [];
    const history  = historyRes.data || [];

    const paidMap = {};
    payments.forEach(p => { paidMap[p.unit_id] = (paidMap[p.unit_id]||0) + parseFloat(p.amount||0); });

    const historyMap = {};
    history.forEach(h => { if (!historyMap[h.unit_id]) historyMap[h.unit_id] = h; });

    const depReceivedMap = {};
    allDeps.forEach(d => {
      const recYM = String(d.deposit_received_date||'').slice(0,7);
      if (recYM === selectedMonthYM)
        depReceivedMap[d.unit_id] = (depReceivedMap[d.unit_id]||0) + parseFloat(d.amount||0);
    });

    const totalCollected = payments.reduce((s,p) => s+parseFloat(p.amount||0), 0);
    let   totalTarget = 0;

    const rows = [];
    units.forEach(u => {
      const h                  = historyMap[u.id];
      const hasPay             = (paidMap[u.id]||0) > 0;
      const hasDepActivity     = (depReceivedMap[u.id]||0) > 0;
      const hasHistory         = !!h?.tenant_name;
      const tenantStartedAfter = u.start_date && u.start_date.slice(0,7) > selectedMonthYM;

      if (u.is_vacant && !hasPay && !hasDepActivity && !hasHistory) return;
      if (tenantStartedAfter && !hasHistory && !hasPay && !hasDepActivity) return;

      const displayName = hasHistory ? h.tenant_name : u.tenant_name;
      const targetRent  = hasHistory
        ? parseFloat(h.monthly_rent||0)
        : (tenantStartedAfter || u.is_vacant) ? 0 : parseFloat(u.monthly_rent||0);

      totalTarget += targetRent;
      const paid = paidMap[u.id] || 0;
      const due  = Math.max(0, targetRent - paid);
      rows.push(`<tr>
        <td>${Helpers.escapeHtml(u.apartment)}</td>
        <td>${Helpers.escapeHtml(u.room)}</td>
        <td>${Helpers.escapeHtml(displayName||'—')}${hasHistory?'  📁':''}</td>
        <td style="color:#22c55e;font-weight:700">${Helpers.formatAED(paid)}</td>
        <td>${Helpers.formatAED(targetRent)}</td>
        <td style="color:${due>0?'#ef4444':'#22c55e'}">${due>0?Helpers.formatAED(due):'✅'}</td>
      </tr>`);
    });

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
<div class="sub">${Helpers.fmtMonth(monStart)} | ${t('reports_monthly')}</div>
<table>
  <thead><tr>
    <th>${t('apt_label')}</th><th>${t('room_label')}</th><th>${t('drawer_tenant')}</th>
    <th>${t('kpi_collected')}</th><th>${t('uf_rent')}</th><th>${t('kpi_remaining')}</th>
  </tr></thead>
  <tbody>${rows.join('')}</tbody>
</table>
<div class="total">
  ${t('kpi_collected')}: ${Helpers.formatAED(totalCollected)} &nbsp;|&nbsp;
  ${t('kpi_target')}: ${Helpers.formatAED(totalTarget)} &nbsp;|&nbsp;
  ${t('kpi_remaining')}: ${Helpers.formatAED(Math.max(0, totalTarget - totalCollected))}
</div>
</body></html>`;

    await exportPDF(t('reports_monthly') + ' — ' + Helpers.fmtMonth(monStart), html);
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════
// exportDeparturePDF — تقرير المغادرين PDF
// ══════════════════════════════════════════
async function exportDeparturePDF() {
  try {
    const { data: moves, error } = await sb
      .from('moves')
      .select('*')
      .eq('type', 'depart')
      .eq('status', 'pending')
      .order('move_date');
    if (error) throw error;

    const { data: units } = await sb
      .from('units')
      .select('id, apartment, room, tenant_name, monthly_rent, deposit, phone');

    const unitMap = {};
    (units || []).forEach(u => { unitMap[u.id] = u; });

    const rows = (moves || []).map(m => {
      const u = unitMap[m.unit_id] || {};
      return `<tr>
        <td>${Helpers.escapeHtml(m.apartment)}</td>
        <td>${Helpers.escapeHtml(m.room)}</td>
        <td>${Helpers.escapeHtml(m.tenant_name || u.tenant_name || '—')}</td>
        <td>${Helpers.escapeHtml(m.phone || u.phone || '—')}</td>
        <td>${Helpers.fmtDate(m.move_date)}</td>
        <td>${Helpers.formatAED(u.monthly_rent || 0)}</td>
        <td>${Helpers.formatAED(u.deposit || 0)}</td>
        <td>${Helpers.escapeHtml(m.notes || '')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html dir="${LANG==='ar'?'rtl':'ltr'}">
<head><meta charset="UTF-8">
<style>
  body { font-family: Cairo, Arial, sans-serif; font-size: 11px; margin: 20px; }
  h2   { text-align: center; color: #1e293b; margin-bottom: 4px; }
  .sub { text-align: center; color: #64748b; margin-bottom: 16px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #6366f1; color: white; padding: 7px 6px; text-align: center; font-size: 11px; }
  td { padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center; }
  tr:nth-child(even) td { background: #f8fafc; }
  .total { margin-top: 12px; font-weight: 700; font-size: 12px; color: #1e293b; }
  @media print { body { margin: 0; } }
</style></head><body>
<h2>🏢 واحدتنا — Wahdatina</h2>
<div class="sub">${t('departures_report')} | ${Helpers.fmtDate(Helpers.today())}</div>
<table>
  <thead><tr>
    <th>${t('apt_label')}</th>
    <th>${t('room_label')}</th>
    <th>${t('drawer_tenant')}</th>
    <th>${t('drawer_phone')}</th>
    <th>${t('move_date')}</th>
    <th>${t('uf_rent')}</th>
    <th>${t('uf_deposit')}</th>
    <th>${t('drawer_notes')}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total">${t('total')}: ${moves?.length || 0} ${t('departures_count')}</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

