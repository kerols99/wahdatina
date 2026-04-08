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
  <button class="pay-tab-btn" data-tab="owner"    onclick="switchReportsTab('owner')">${t('reports_owner') || 'المالك'}</button>
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
  else if (tab === 'owner')    loadOwnerRpt();
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
  <button class="btn btn-secondary" onclick="exportCSV('payments')">📥 CSV</button>
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
        .select('id, apartment, room, tenant_name, tenant_name2, monthly_rent, rent1, rent2, is_vacant, unit_status, start_date')
        .order('apartment').order('room'),
      sb.from('rent_payments')
        .select('unit_id, amount, tenant_num')
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
    // paidMap: unit_id → إجمالي مدفوع + منفصل per tenant
    const paidMap  = {};
    const paid1Map = {};
    const paid2Map = {};
    payments.forEach(p => {
      paidMap[p.unit_id]  = (paidMap[p.unit_id]  || 0) + parseFloat(p.amount || 0);
      if (p.tenant_num === 2) {
        paid2Map[p.unit_id] = (paid2Map[p.unit_id] || 0) + parseFloat(p.amount || 0);
      } else {
        paid1Map[p.unit_id] = (paid1Map[p.unit_id] || 0) + parseFloat(p.amount || 0);
      }
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

      const isDual = !hasHistory && u.tenant_name2 && u.rent2 > 0;
      reportUnits.push({
        id:          u.id,
        apartment:   u.apartment,
        room:        u.room,
        displayName: displayName || '—',
        tenant_name2: u.tenant_name2 || null,
        targetRent,
        rent1:       isDual ? parseFloat(u.rent1||0) : 0,
        rent2:       isDual ? parseFloat(u.rent2||0) : 0,
        paid:        paidMap[u.id]  || 0,
        paid1:       paid1Map[u.id] || 0,
        paid2:       paid2Map[u.id] || 0,
        isDual,
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
    <div>
      <span>${Helpers.escapeHtml(u.displayName)}${u.fromHistory ? ' <span class="muted small">📁</span>' : ''}</span>
      ${u.isDual ? `<br><span class="muted small">& ${Helpers.escapeHtml(u.tenant_name2)}</span>` : ''}
    </div>
    <div>
      <span class="${u.paid >= u.targetRent && u.targetRent > 0 ? 'green' : u.paid > 0 ? 'amber' : 'red'}">${Helpers.formatAED(u.paid)}</span>
      ${u.isDual ? `<br><span class="muted small">${Helpers.formatAED(u.paid1)} + ${Helpers.formatAED(u.paid2)}</span>` : ''}
    </div>
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
  <button class="icon-btn" onclick="editExpense('${e.id}')">✏️</button>
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

    // dedup بـ id — الأضمن لأن كل سجل له id فريد
    const seen = new Set();
    const deps = (allDeps || []).filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id); return true;
    });

    // Q12: refund_amount > 0 مش status='refunded'
    // لو refund_amount = amount → نعاملها كـ refunded حتى لو status='held' (بيانات قديمة)
    const held      = deps.filter(d => d.status === 'held' && !(d.refund_amount > 0));
    const partial   = deps.filter(d => d.status === 'held' && d.refund_amount > 0 && d.refund_amount < d.amount);
    const autoRefunded = deps.filter(d => d.status === 'held' && d.refund_amount >= d.amount);
    const refunded  = [...deps.filter(d => d.status === 'refunded'), ...autoRefunded];
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
  const prevYear     = selectedYear - 1;

  try {
    const [pR, eR, oR, dR, ppR] = await Promise.all([
      sb.from('rent_payments').select('amount,payment_month')
        .gte('payment_month', selectedYear + '-01-01').lte('payment_month', selectedYear + '-12-31'),
      sb.from('expenses').select('amount,period_month')
        .gte('period_month', selectedYear + '-01-01').lte('period_month', selectedYear + '-12-31'),
      sb.from('owner_payments').select('amount,period_month')
        .gte('period_month', selectedYear + '-01-01').lte('period_month', selectedYear + '-12-31'),
      sb.from('deposits').select('amount,deposit_received_date,refund_amount,status'),
      sb.from('rent_payments').select('amount,payment_month')
        .gte('payment_month', prevYear + '-01-01').lte('payment_month', prevYear + '-12-31'),
    ]);

    const pays     = pR.data || [];
    const exps     = eR.data || [];
    const owns     = oR.data || [];
    const deps     = dR.data || [];
    const prevPays = ppR.data || [];

    const monthNames = LANG === 'ar'
      ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
      : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const mShort = LANG === 'ar'
      ? ['ين','فب','مر','أب','مي','يو','يل','أغ','سب','أك','نو','دي']
      : ['J','F','M','A','M','J','J','A','S','O','N','D'];

    // prevYear map
    const prevMap = {};
    prevPays.forEach(p => {
      const m = String(p.payment_month||'').slice(5,7);
      if (m) prevMap[m] = (prevMap[m]||0) + parseFloat(p.amount||0);
    });

    const rows_data = [];
    let tRent=0, tDep=0, tExp=0, tOwn=0;

    Array.from({length:12}, (_,i) => {
      const m   = String(i+1).padStart(2,'0');
      const pfx = selectedYear + '-' + m;

      const rent = pays.filter(p => String(p.payment_month||'').startsWith(pfx))
                       .reduce((s,p) => s+parseFloat(p.amount||0), 0);
      const dep  = deps.filter(d => !d.status==='refunded' && String(d.deposit_received_date||'').slice(0,7)===pfx)
                       .reduce((s,d) => s+parseFloat(d.amount||0), 0);
      const exp  = exps.filter(e => String(e.period_month||'').startsWith(pfx))
                       .reduce((s,e) => s+parseFloat(e.amount||0), 0);
      const own  = owns.filter(o => String(o.period_month||'').startsWith(pfx))
                       .reduce((s,o) => s+parseFloat(o.amount||0), 0);
      const net  = rent + dep - exp - own;
      const prev = prevMap[m] || 0;
      const yoy  = rent - prev;

      tRent += rent; tDep += dep; tExp += exp; tOwn += own;
      rows_data.push({ m, i, rent, dep, exp, own, net, prev, yoy });
    });

    const tNet = tRent + tDep - tExp - tOwn;
    const maxColl = Math.max(...rows_data.map(r => r.rent + r.dep), 1);

    // Mini bar chart (زي واحدتي)
    const chartBars = rows_data.map(r => {
      const w   = Math.round((r.rent + r.dep) / maxColl * 100);
      const col = r.net >= 0 ? 'var(--green)' : 'var(--red)';
      return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0">
        <div style="font-size:.6rem;color:var(--muted);width:26px;text-align:end">${mShort[r.i]}</div>
        <div style="flex:1;background:var(--surf2);border-radius:3px;height:14px;overflow:hidden">
          <div style="height:100%;background:${col};width:${w}%;border-radius:3px"></div>
        </div>
        <div style="font-size:.62rem;color:var(--muted);width:54px;text-align:end">${Helpers.formatAED(r.rent+r.dep)}</div>
      </div>`;
    }).join('');

    // Table rows (زي واحدتي مع YoY)
    const tableRows = rows_data.map(r => {
      const yoyHtml = r.yoy !== 0
        ? `<td style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:.72rem;color:${r.yoy>0?'var(--green)':'var(--red)'}">${r.yoy>0?'↑':'↓'}${Math.abs(r.yoy).toLocaleString()}</td>`
        : `<td style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:.72rem;color:var(--muted)">—</td>`;
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:.78rem">${monthNames[r.i]}</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:.78rem;color:var(--green);font-weight:${r.rent>0?'700':'400'}">${r.rent>0?Helpers.formatAED(r.rent):'—'}</td>
        ${yoyHtml}
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:.78rem;color:var(--accent)">${r.dep>0?Helpers.formatAED(r.dep):'—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:.78rem;color:var(--amber)">${r.exp>0?Helpers.formatAED(r.exp):'—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:.78rem">${r.own>0?Helpers.formatAED(r.own):'—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:.78rem;font-weight:700;color:${r.net>=0?'var(--green)':'var(--red)'}">${Helpers.formatAED(r.net)}</td>
      </tr>`;
    }).join('');

    body.innerHTML = `
<div class="card" style="margin-bottom:8px">
  <div style="font-size:.68rem;color:var(--muted);font-weight:700;margin-bottom:8px;text-transform:uppercase">📊 ${selectedYear} — التحصيل الشهري</div>
  ${chartBars}
</div>
<div class="card" style="overflow-x:auto;margin-bottom:8px">
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:var(--surf2)">
      <th style="padding:7px;text-align:right;border-bottom:1px solid var(--border);font-size:.75rem">${LANG==='ar'?'الشهر':'Month'}</th>
      <th style="padding:7px;text-align:right;border-bottom:1px solid var(--border);color:var(--green);font-size:.75rem">${LANG==='ar'?'إيجار':'Rent'}</th>
      <th style="padding:7px;text-align:right;border-bottom:1px solid var(--border);color:var(--muted);font-size:.65rem">${prevYear}↔${selectedYear}</th>
      <th style="padding:7px;text-align:right;border-bottom:1px solid var(--border);color:var(--accent);font-size:.75rem">${LANG==='ar'?'تأمين':'Dep'}</th>
      <th style="padding:7px;text-align:right;border-bottom:1px solid var(--border);color:var(--amber);font-size:.75rem">${LANG==='ar'?'مصاريف':'Exp'}</th>
      <th style="padding:7px;text-align:right;border-bottom:1px solid var(--border);font-size:.75rem">${LANG==='ar'?'للمالك':'Owner'}</th>
      <th style="padding:7px;text-align:right;border-bottom:1px solid var(--border);font-size:.75rem">${LANG==='ar'?'صافي':'Net'}</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>
<div class="card" style="padding:0;overflow:hidden">
  <div style="padding:11px 14px;background:var(--surf2);border-bottom:2px solid var(--border);font-weight:800;font-size:.88rem">📅 إجمالي سنة ${selectedYear}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border)22"><span style="font-size:.8rem;color:var(--muted)">✅ إجمالي الإيجار</span><b style="color:var(--green)">${Helpers.formatAED(tRent)}</b></div>
  ${tDep>0?`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border)22"><span style="font-size:.8rem;color:var(--muted)">🔒 إجمالي التأمينات</span><b style="color:var(--accent)">${Helpers.formatAED(tDep)}</b></div>`:''}
  <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border)22"><span style="font-size:.8rem;color:var(--muted)">💸 إجمالي المصاريف</span><b style="color:var(--amber)">${Helpers.formatAED(tExp)}</b></div>
  ${tOwn>0?`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border)22"><span style="font-size:.8rem;color:var(--muted)">👤 دُفع للمالك</span><b>${Helpers.formatAED(tOwn)}</b></div>`:''}
  <div style="display:flex;justify-content:space-between;align-items:center;padding:13px 14px;background:${tNet>=0?'var(--green)':'var(--red)'}">
    <span style="font-size:.9rem;font-weight:800;color:#fff">🏦 الصافي السنوي</span>
    <b style="font-size:1.1rem;font-weight:800;color:#fff">${Helpers.formatAED(tNet)}</b>
  </div>
</div>`;

  } catch(err) {
    body.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}
// PDF Overlay helpers
function closePdf() {
  const el = document.getElementById('pdfOverlay');
  if (el) el.style.display = 'none';
}
function printPdf() { window.print(); }
window.closePdf = closePdf;
window.printPdf = printPdf;

// ══════════════════════════════════════════
// exportMonthlyPDF — تقرير شهري كامل مثل واحدتي
// مقسّم: دور → شقة → غرفة، مع ملخص كامل
// ══════════════════════════════════════════
async function exportMonthlyPDF() {
  const monthEl = document.getElementById('rpt-month');
  if (!monthEl) return;
  const monYM    = monthEl.value;
  const monStart = monYM + '-01';
  const monEnd   = Helpers.monthEnd(monStart);

  try {
    const [unitsRes, paysRes, expsRes, ownsRes, depsRes, histRes] = await Promise.all([
      sb.from('units').select('id,apartment,room,monthly_rent,rent1,rent2,tenant_name,tenant_name2,start_date,is_vacant').order('apartment').order('room'),
      sb.from('rent_payments').select('unit_id,amount,tenant_num').eq('payment_month', monStart),
      sb.from('expenses').select('amount,category').eq('period_month', monStart),
      sb.from('owner_payments').select('amount').eq('period_month', monStart),
      sb.from('deposits').select('unit_id,amount,deposit_received_date'),
      sb.from('unit_history').select('unit_id,tenant_name,monthly_rent,start_date,end_date')
        .lte('start_date', monEnd).or('end_date.gte.' + monStart + ',end_date.is.null'),
    ]);

    const units = unitsRes.data || [];
    const pays  = paysRes.data  || [];
    const exps  = expsRes.data  || [];
    const owns  = ownsRes.data  || [];
    const deps  = depsRes.data  || [];
    const hist  = histRes.data  || [];

    const histMap = {};
    hist.forEach(h => { if (!histMap[h.unit_id]) histMap[h.unit_id] = h; });

    const paidMap = {};
    pays.forEach(p => { paidMap[p.unit_id] = (paidMap[p.unit_id]||0) + parseFloat(p.amount||0); });

    const depMap = {};
    deps.forEach(d => {
      const rd = String(d.deposit_received_date||'').slice(0,7);
      if (rd === monYM && d.unit_id) depMap[d.unit_id] = (depMap[d.unit_id]||0) + parseFloat(d.amount||0);
    });

    let totalTarget=0, totalColl=0, totalDeps=0, totalExp=0, totalOwner=0;
    exps.forEach(e => { totalExp   += parseFloat(e.amount||0); });
    owns.forEach(o => { totalOwner += parseFloat(o.amount||0); });

    // تجميع حسب شقة
    const aptMap = {};
    units.forEach(u => {
      const h = histMap[u.id];
      const hasHistory = !!(h && h.tenant_name);
      const hasPay = (paidMap[u.id]||0) > 0 || (depMap[u.id]||0) > 0;
      const startedAfter = u.start_date && u.start_date.slice(0,7) > monYM;
      if (u.is_vacant && !hasPay && !hasHistory) return;
      if (startedAfter && !hasHistory && !hasPay) return;

      const displayName = hasHistory ? h.tenant_name : (u.tenant_name || '—');
      const targetRent  = hasHistory ? parseFloat(h.monthly_rent||0)
        : (startedAfter || u.is_vacant) ? 0 : parseFloat(u.monthly_rent||0);
      const paid = paidMap[u.id] || 0;
      const dep  = depMap[u.id]  || 0;

      totalTarget += targetRent;
      totalColl   += paid;
      totalDeps   += dep;

      const apt = String(u.apartment);
      if (!aptMap[apt]) aptMap[apt] = { units:[], rent:0, coll:0, deps:0 };
      aptMap[apt].units.push({ ...u, _name: displayName, _rent: targetRent, _paid: paid, _dep: dep });
      aptMap[apt].rent += targetRent;
      aptMap[apt].coll += paid;
      aptMap[apt].deps += dep;
    });

    // تجميع حسب الدور
    const floorMap = {};
    Object.keys(aptMap).sort((a,b)=>Number(a)-Number(b)).forEach(apt => {
      const fl = String(Math.floor(Number(apt)/100));
      if (!floorMap[fl]) floorMap[fl] = { apts:[], rent:0, coll:0, deps:0 };
      floorMap[fl].apts.push(apt);
      floorMap[fl].rent += aptMap[apt].rent;
      floorMap[fl].coll += aptMap[apt].coll;
      floorMap[fl].deps += aptMap[apt].deps;
    });

    const TH = t => '<th style="padding:6px 8px;text-align:right;background:#f0f0f0;border:1px solid #ccc;font-size:11px;font-weight:700">' + t + '</th>';
    const TD = (t,s) => '<td style="padding:5px 8px;text-align:right;border:1px solid #ddd;font-size:11px' + (s?';'+s:'') + '">' + (t===null||t===undefined?'—':t) + '</td>';

    let rows = '';
    Object.keys(floorMap).sort((a,b)=>Number(a)-Number(b)).forEach(fl => {
      const fg = floorMap[fl];
      const fc = fg.coll>=fg.rent?'#1a7a4a':fg.coll>0?'#b07400':'#c0392b';
      rows += '<tr><td colspan="7" style="background:#e0e0e0;padding:7px 10px;font-weight:700;font-size:12px;border:none">'
        + '🏬 الدور ' + fl
        + '<span style="float:left;font-size:11px;color:' + fc + '">محصّل: ' + Helpers.formatAED(fg.coll+fg.deps) + ' | متبقي: ' + Helpers.formatAED(fg.rent-fg.coll) + '</span>'
        + '</td></tr>';

      fg.apts.forEach(apt => {
        const g = aptMap[apt];
        const ac = g.coll>=g.rent?'#1a7a4a':g.coll>0?'#b07400':'#c0392b';
        rows += '<tr><td colspan="7" style="background:#e8e8e8;padding:5px 10px;font-weight:700;font-size:11px;border-bottom:1px solid #ccc;border-top:2px solid #999">'
          + 'شقة ' + apt + ' &nbsp;&nbsp;<span style="color:' + ac + '">محصّل: ' + Helpers.formatAED(g.coll)
          + (g.deps>0?' | تأمين: '+Helpers.formatAED(g.deps):'') + ' | متبقي: ' + Helpers.formatAED(g.rent-g.coll) + '</span>'
          + '</td></tr>';

        g.units.slice().sort((a,b)=>Number(a.room)-Number(b.room)).forEach(u => {
          const rem = Math.max(0, u._rent - u._paid);
          const st  = u._paid>=u._rent&&u._rent>0?'✅':u._paid>0?'⚠️':u._rent>0?'❌':'—';
          rows += '<tr>'
            + TD(u.room)
            + TD(Helpers.escapeHtml(u._name))
            + TD(Helpers.formatAED(u._rent))
            + TD(u._dep>0?Helpers.formatAED(u._dep):'—', u._dep>0?'color:#2456d3;font-weight:700':'color:#888')
            + TD(Helpers.formatAED(u._paid), u._paid>0?'color:#1a7a4a;font-weight:700':'color:#c0392b')
            + TD(Helpers.formatAED(rem), rem>0?'color:#c0392b;font-weight:700':'color:#1a7a4a')
            + '<td style="padding:5px 8px;text-align:center;border:1px solid #ddd;font-size:12px">' + st + '</td>'
            + '</tr>';
        });

        rows += '<tr style="background:#f0f0f0">'
          + '<td colspan="2" style="padding:5px 8px;font-weight:700;font-size:11px;border:1px solid #ddd;text-align:right">إجمالي شقة ' + apt + '</td>'
          + TD(Helpers.formatAED(g.rent),'font-weight:700')
          + TD(g.deps>0?Helpers.formatAED(g.deps):'—','font-weight:700;color:#2456d3')
          + TD(Helpers.formatAED(g.coll),'font-weight:700;color:#1a7a4a')
          + TD(Helpers.formatAED(g.rent-g.coll),'font-weight:700;color:'+(g.rent-g.coll>0?'#c0392b':'#1a7a4a'))
          + '<td style="border:1px solid #ddd"></td></tr>';
      });

      rows += '<tr style="background:#ddd">'
        + '<td colspan="2" style="padding:6px 10px;font-weight:700;font-size:12px;border:1px solid #ddd;text-align:right">إجمالي الدور ' + fl + '</td>'
        + TD(Helpers.formatAED(fg.rent),'font-weight:700')
        + TD(fg.deps>0?Helpers.formatAED(fg.deps):'—','font-weight:700;color:#2456d3')
        + TD(Helpers.formatAED(fg.coll),'font-weight:700;color:#1a7a4a')
        + TD(Helpers.formatAED(fg.rent-fg.coll),'font-weight:700;color:'+(fg.rent-fg.coll>0?'#c0392b':'#1a7a4a'))
        + '<td style="border:1px solid #ddd"></td></tr>';
    });

    const pct = totalTarget>0 ? Math.round(totalColl/totalTarget*100) : 0;
    const pctColor = pct>=90?'#1a7a4a':pct>=60?'#b07400':'#c0392b';
    const net = totalColl + totalDeps - totalExp - totalOwner;

    const pdfHtml = '<div style="font-family:Arial,sans-serif;direction:rtl;color:#111">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:16px">'
      +   '<div><div style="font-size:1.1rem;font-weight:700">واحدتنا — تقرير الاستحقاق</div>'
      +   '<div style="font-size:.8rem;color:#555;margin-top:2px">' + Helpers.fmtMonth(monStart) + ' · نسبة التحصيل: <b style="color:' + pctColor + '">' + pct + '%</b></div></div>'
      +   '<div style="font-size:.75rem;color:#666">' + new Date().toLocaleDateString('ar-EG') + '</div>'
      + '</div>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">'
      +   '<thead><tr>' + TH('غرفة') + TH('المستأجر') + TH('الإيجار') + TH('تأمين') + TH('مدفوع') + TH('متبقي')
      +   '<th style="padding:6px 8px;text-align:center;background:#f0f0f0;border:1px solid #ccc;font-size:11px">#</th></tr></thead>'
      +   '<tbody>' + rows + '</tbody>'
      + '</table>'
      + '<div style="border-top:2px solid #333;padding-top:12px">'
      +   '<div style="font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:8px">ملخص الشهر</div>'
      +   '<div style="display:flex;justify-content:space-between;padding:6px 8px;margin-bottom:2px;border-radius:4px"><span style="font-size:11px;color:#555">🎯 الإيجار المستهدف</span><b style="font-size:12px">' + Helpers.formatAED(totalTarget) + '</b></div>'
      +   '<div style="display:flex;justify-content:space-between;padding:6px 8px;margin-bottom:2px;background:#e8f5ee;border-radius:4px"><span style="font-size:11px;color:#555">✅ إيجار محصّل</span><b style="font-size:12px;color:#1a7a4a">' + Helpers.formatAED(totalColl) + '</b></div>'
      +   (totalDeps>0?'<div style="display:flex;justify-content:space-between;padding:6px 8px;margin-bottom:2px;background:#e8eeff;border-radius:4px"><span style="font-size:11px;color:#555">🔒 تأمينات</span><b style="font-size:12px;color:#2456d3">' + Helpers.formatAED(totalDeps) + '</b></div>':'')
      +   '<div style="display:flex;justify-content:space-between;padding:7px 8px;margin-bottom:2px;background:#d4edda;border-radius:4px;border:1px solid #1a7a4a44"><span style="font-size:11px;font-weight:600;color:#555">💵 إجمالي الكاش</span><b style="font-size:13px;color:#1a7a4a;font-weight:800">' + Helpers.formatAED(totalColl+totalDeps) + '</b></div>'
      +   '<div style="display:flex;justify-content:space-between;padding:6px 8px;margin-bottom:2px;background:#ffeaea;border-radius:4px"><span style="font-size:11px;color:#555">❌ غير محصّل</span><b style="font-size:12px;color:#c0392b">' + Helpers.formatAED(totalTarget-totalColl) + '</b></div>'
      +   (totalExp>0?'<div style="display:flex;justify-content:space-between;padding:6px 8px;margin-bottom:2px;background:#fff8e1;border-radius:4px"><span style="font-size:11px;color:#555">💸 المصاريف</span><b style="font-size:12px;color:#b07400">' + Helpers.formatAED(totalExp) + '</b></div>':'')
      +   (totalOwner>0?'<div style="display:flex;justify-content:space-between;padding:6px 8px;margin-bottom:2px"><span style="font-size:11px;color:#555">👤 دُفع للمالك</span><b style="font-size:12px;color:#555">' + Helpers.formatAED(totalOwner) + '</b></div>':'')
      +   '<div style="display:flex;justify-content:space-between;padding:6px 8px;margin-bottom:6px"><span style="font-size:11px;color:#555">📊 نسبة التحصيل</span><b style="font-size:12px;color:' + pctColor + '">' + pct + '%</b></div>'
      +   '<div style="display:flex;justify-content:space-between;padding:10px 12px;background:' + (net>=0?'#1a7a4a':'#c0392b') + ';border-radius:6px;color:#fff"><span style="font-size:12px;font-weight:700">🏦 الإجمالي الصافي</span><b style="font-size:15px;font-weight:800">' + Helpers.formatAED(net) + '</b></div>'
      + '</div></div>';

    const overlay = document.getElementById('pdfOverlay');
    const content = document.getElementById('pdf-content');
    if (overlay && content) {
      content.innerHTML = pdfHtml;
      overlay.style.display = 'flex';
    }
  } catch(err) {
    toast('❌ ' + err.message, 'error');
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

    await exportPDF(t('departures_report'), html);
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}


// ══════════════════════════════════════════
// exportCSV — تصدير CSV
// ══════════════════════════════════════════
async function exportCSV(type = 'payments') {
  try {
    let rows = [], headers = [], filename = '';

    if (type === 'payments') {
      const monthEl = document.getElementById('rpt-month');
      const month   = (monthEl?.value || Helpers.currentMonthFirst().slice(0,7)) + '-01';
      const { data, error } = await sb.from('rent_payments')
        .select('apartment,room,tenant_name,amount,payment_month,payment_date,payment_method')
        .eq('payment_month', month).order('apartment').order('room');
      if (error) throw error;
      headers   = ['apartment','room','tenant_name','amount','payment_month','payment_date','payment_method'];
      rows      = data || [];
      filename  = `payments_${month.slice(0,7)}.csv`;

    } else if (type === 'units') {
      const { data, error } = await sb.from('units')
        .select('apartment,room,tenant_name,monthly_rent,deposit,phone,unit_status,start_date')
        .order('apartment').order('room');
      if (error) throw error;
      headers  = ['apartment','room','tenant_name','monthly_rent','deposit','phone','unit_status','start_date'];
      rows     = data || [];
      filename = 'units.csv';

    } else if (type === 'deposits') {
      const { data, error } = await sb.from('deposits')
        .select('apartment,room,tenant_name,amount,status,refund_amount,deposit_received_date,refund_date')
        .order('created_at', { ascending: false });
      if (error) throw error;
      headers  = ['apartment','room','tenant_name','amount','status','refund_amount','deposit_received_date','refund_date'];
      rows     = data || [];
      filename = 'deposits.csv';

    } else if (type === 'expenses') {
      const { data, error } = await sb.from('expenses')
        .select('category,amount,period_month,description,receipt_no')
        .order('period_month', { ascending: false });
      if (error) throw error;
      headers  = ['category','amount','period_month','description','receipt_no'];
      rows     = data || [];
      filename = 'expenses.csv';
    }

    if (!rows.length) { toast(t('no_data_to_export'), 'info'); return; }

    // بناء الـ CSV
    const escape = v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(','))
    ].join('\n');

    // تحميل
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast(`✅ ${t('toast_csv_exported')}: ${filename}`, 'success');
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}


// ══════════════════════════════════════════
// تقرير دفعات المالك
// ══════════════════════════════════════════
async function loadOwnerRpt() {
  const c = document.getElementById('reports-tab-content');
  if (!c) return;
  try {
    const { data: rows, error } = await sb.from('owner_payments')
      .select('*').order('payment_date', { ascending: false });
    if (error) throw error;

    const total = (rows || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    c.innerHTML = `
<div class="rpt-header">
  <strong>${t('reports_owner') || 'دفعات المالك'}</strong>
  <span class="green">${Helpers.formatAED(total)}</span>
</div>
${(rows || []).length === 0
  ? '<div class="empty-msg">لا توجد دفعات</div>'
  : (rows || []).map(r => `
<div class="expense-row" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
  <div>
    <div style="font-weight:700">${Helpers.formatAED(r.amount)}</div>
    <div class="muted small">${Helpers.fmtDate(r.payment_date)} · ${r.method || 'Cash'}${r.reference ? ' · ' + Helpers.escapeHtml(r.reference) : ''}</div>
    ${r.notes ? '<div class="muted small">' + Helpers.escapeHtml(r.notes) + '</div>' : ''}
  </div>
  <button onclick="deleteOwnerPayment('${r.id}')" style="background:var(--red)22;border:1px solid var(--red)44;border-radius:6px;padding:4px 10px;color:var(--red);font-size:.75rem;cursor:pointer;font-family:inherit">🗑️</button>
</div>`).join('')
}
`;
  } catch(err) {
    c.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;
  }
}

async function deleteOwnerPayment(id) {
  if (!requireRole('delete')) return;
  if (!confirm(t('btn_confirm_delete'))) return;
  try {
    const { error } = await sb.from('owner_payments').delete().eq('id', id);
    if (error) throw error;
    toast(t('toast_deleted'), 'info');
    loadOwnerRpt();
  } catch(e) {
    toast(`❌ ${e.message}`, 'error');
  }
}

