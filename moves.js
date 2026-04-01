// ══════════════════════════════
// moves.js — التنقلات (المرحلة 3)
// ══════════════════════════════

'use strict';

function loadMoves() {
  const container = document.getElementById('moves-content');
  if (!container) return;
  container.innerHTML = `
<div class="coming-soon">
  <div class="cs-icon">🚀</div>
  <div class="cs-title">التنقلات</div>
  <div class="cs-desc">المرحلة 3 — قادم قريباً</div>
  <div class="cs-list">
    <span>🚪 تسجيل المغادرين</span>
    <span>🆕 حجوزات جديدة</span>
    <span>🔄 نقل داخلي</span>
    <span>📄 رسالة ترحيب</span>
  </div>
</div>`;
}

function loadReports() {
  const container = document.getElementById('reports-content');
  if (!container) return;
  container.innerHTML = `
<div class="coming-soon">
  <div class="cs-icon">📊</div>
  <div class="cs-title">التقارير</div>
  <div class="cs-desc">المرحلة 4 — قادم قريباً</div>
  <div class="cs-list">
    <span>📋 التقرير الشهري</span>
    <span>💸 المصاريف</span>
    <span>🔐 التأمينات</span>
    <span>📈 السنوي</span>
  </div>
</div>`;
}

// ══════════════════════════
// activateScheduled — تفعيل الحجوزات المجدولة
// يشتغل مرة واحدة فقط عند فتح التطبيق
// ══════════════════════════
async function activateScheduled() {
  try {
    const todayStr = Helpers.today();

    // جلب كل الحجوزات المنتظرة التي حان وقتها
    const { data: pendingArrivals, error: arrivalsErr } = await sb
      .from('moves')
      .select('*')
      .eq('type', 'arrive')
      .eq('status', 'pending')
      .lte('new_start_date', todayStr);

    if (arrivalsErr) throw arrivalsErr;
    if (!pendingArrivals || pendingArrivals.length === 0) return;

    console.log(`activateScheduled: ${pendingArrivals.length} حجز يحتاج تفعيل`);

    for (const move of pendingArrivals) {
      try {
        await _activateOneArrival(move);
      } catch (err) {
        console.error(`فشل تفعيل الحجز ${move.id}:`, err);
      }
    }
  } catch (err) {
    console.error('activateScheduled error:', err);
  }
}

async function _activateOneArrival(move) {
  // 1. جلب الوحدة بـ apartment+room
  let unitId = move.unit_id;
  if (!unitId) {
    const { data: unit } = await sb
      .from('units')
      .select('id')
      .eq('apartment', move.apartment)
      .eq('room', move.room)
      .maybeSingle();
    unitId = unit?.id;
  }
  if (!unitId) {
    console.warn(`لم يُعثر على الوحدة: شقة ${move.apartment} غرفة ${move.room}`);
    return;
  }

  // 2. حفظ snapshot في unit_history
  const { data: currentUnit } = await sb
    .from('units')
    .select('*')
    .eq('id', unitId)
    .maybeSingle();

  if (currentUnit && !currentUnit.is_vacant) {
    await sb.from('unit_history').insert({
      unit_id:      unitId,
      apartment:    currentUnit.apartment,
      room:         currentUnit.room,
      tenant_name:  currentUnit.tenant_name,
      tenant_name2: currentUnit.tenant_name2,
      phone:        currentUnit.phone,
      phone2:       currentUnit.phone2,
      monthly_rent: currentUnit.monthly_rent,
      deposit:      currentUnit.deposit,
      start_date:   currentUnit.start_date,
      end_date:     move.move_date || Helpers.today(),
      snapshot_type: 'departure',
      recorded_by:  ME?.id || null,
    });
  }

  // 3. تحديث الوحدة بالمستأجر الجديد
  await sb.from('units').update({
    tenant_name:  move.new_tenant_name || null,
    phone:        move.new_phone       || null,
    monthly_rent: move.new_rent        || 0,
    deposit:      move.new_deposit     || 0,
    persons_count: move.new_persons    || 1,
    start_date:   move.new_start_date  || Helpers.today(),
    language:     move.language        || 'AR',
    is_vacant:    false,
    unit_status:  'occupied',
    updated_at:   new Date().toISOString(),
  }).eq('id', unitId);

  // 4. تحويل العربون → تأمين نهائي (مع guard ضد التكرار)
  if (move.new_deposit && move.new_deposit > 0) {
    const { data: existingDep } = await sb
      .from('deposits')
      .select('id')
      .eq('unit_id', unitId)
      .eq('status', 'held')
      .is('notes', null)
      .maybeSingle();

    if (!existingDep) {
      // حذف العربون
      await sb.from('deposits')
        .delete()
        .eq('unit_id', unitId)
        .eq('notes', 'عربون حجز');

      // إضافة التأمين النهائي
      await sb.from('deposits').insert({
        unit_id:               unitId,
        apartment:             move.apartment,
        room:                  move.room,
        tenant_name:           move.new_tenant_name || null,
        amount:                move.new_deposit,
        status:                'held',
        deposit_received_date: Helpers.today(),
        created_by:            ME?.id || null,
      });
    }
  }

  // 5. تغيير status الـ move لـ done
  await sb.from('moves')
    .update({ status: 'done', unit_id: unitId })
    .eq('id', move.id);

  console.log(`✅ تم تفعيل الحجز: ${move.apartment}/${move.room}`);
}

// ══════════════════════════
// openDepartureForm — stub
// ══════════════════════════
function openDepartureForm(unitId) {
  toast('تسجيل المغادرة سيتوفر في المرحلة 3', 'info');
}
