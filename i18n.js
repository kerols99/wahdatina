// ══════════════════════════════════════════
// i18n.js — نظام الترجمة العربي / الإنجليزي
// ══════════════════════════════════════════

'use strict';

const T = {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AUTH
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  login_email:        { ar: 'البريد الإلكتروني',       en: 'Email' },
  login_password:     { ar: 'كلمة المرور',              en: 'Password' },
  login_btn:          { ar: 'دخول',                    en: 'Login' },
  login_subtitle:     { ar: 'إدارة الوحدات السكنية — دبي', en: 'Residential Units Management — Dubai' },
  login_loading:      { ar: '...جاري الدخول',           en: 'Signing in...' },
  logout:             { ar: 'خروج',                    en: 'Logout' },
  welcome:            { ar: 'مرحباً بك 👋',             en: 'Welcome back 👋' },
  login_error:        { ar: 'بيانات الدخول غير صحيحة', en: 'Invalid email or password' },
  logout_success:     { ar: 'تم تسجيل الخروج',         en: 'Signed out successfully' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NAV
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  nav_home:           { ar: 'الرئيسية',   en: 'Home' },
  nav_units:          { ar: 'الوحدات',    en: 'Units' },
  nav_pay:            { ar: 'إضافة',      en: 'Add' },
  nav_reports:        { ar: 'التقارير',   en: 'Reports' },
  nav_moves:          { ar: 'التنقلات',   en: 'Moves' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DASHBOARD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  kpi_collected:      { ar: 'إجمالي محصّل',    en: 'Total Collected' },
  kpi_target:         { ar: 'المستهدف',         en: 'Target' },
  kpi_remaining:      { ar: 'المتبقي',          en: 'Remaining' },
  kpi_rate:           { ar: 'نسبة التحصيل',     en: 'Collection Rate' },
  net_profit:         { ar: 'الصافي',           en: 'Net Profit' },
  expenses_lbl:       { ar: 'مصاريف',           en: 'Expenses' },
  owner_lbl:          { ar: 'مالك',             en: 'Owner' },
  refunds_lbl:        { ar: 'مرتجعات',          en: 'Refunds' },
  stat_occupied:      { ar: 'مشغولة',           en: 'Occupied' },
  stat_vacant:        { ar: 'شاغرة',            en: 'Vacant' },
  stat_leaving:       { ar: 'مغادرة',           en: 'Leaving' },
  stat_reserved:      { ar: 'محجوزة',           en: 'Reserved' },
  stat_maintenance:   { ar: 'صيانة',            en: 'Maintenance' },
  stat_total:         { ar: 'إجمالي',           en: 'Total' },
  pending_arrivals:   { ar: 'حجز جديد',         en: 'New Booking' },
  pending_departures: { ar: 'مغادرة قيد الانتظار', en: 'Pending Departure' },
  quick_units:        { ar: '🏠 الوحدات',        en: '🏠 Units' },
  quick_pay:          { ar: '💰 تسجيل دفعة',    en: '💰 Add Payment' },
  quick_reports:      { ar: '📋 التقارير',       en: '📋 Reports' },
  quick_moves:        { ar: '🚀 التنقلات',       en: '🚀 Moves' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UNITS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  add_unit:           { ar: '➕ إضافة وحدة جديدة',  en: '➕ Add New Unit' },
  search_placeholder: { ar: '🔍 ابحث باسم المستأجر أو رقم الشقة...', en: '🔍 Search by tenant name or unit number...' },
  filter_all:         { ar: 'الكل',      en: 'All' },
  filter_paid:        { ar: 'مدفوع',     en: 'Paid' },
  filter_partial:     { ar: 'جزئي',      en: 'Partial' },
  filter_unpaid:      { ar: 'غير مدفوع', en: 'Unpaid' },
  no_units:           { ar: 'لا توجد وحدات', en: 'No units found' },
  apt_label:          { ar: 'شقة',       en: 'Apt' },
  room_label:         { ar: 'غرفة',      en: 'Room' },
  vacant_label:       { ar: 'شاغرة',     en: 'Vacant' },
  remaining_prefix:   { ar: 'متبقي',     en: 'Due' },

  // Unit Status
  status_paid:        { ar: 'مدفوع',          en: 'Paid' },
  status_partial:     { ar: 'جزئي',           en: 'Partial' },
  status_unpaid:      { ar: 'غير مدفوع',      en: 'Unpaid' },
  status_vacant:      { ar: 'شاغرة',          en: 'Vacant' },
  status_maint:       { ar: 'صيانة',          en: 'Maintenance' },
  status_reserved:    { ar: 'محجوز',          en: 'Reserved' },
  status_leaving:     { ar: 'مغادر قريباً',   en: 'Leaving Soon' },

  // Unit Drawer
  drawer_tenant:      { ar: 'المستأجر',        en: 'Tenant' },
  drawer_partner:     { ar: 'الشريك',          en: 'Partner' },
  drawer_phone:       { ar: 'الهاتف',          en: 'Phone' },
  drawer_phone2:      { ar: 'هاتف 2',          en: 'Phone 2' },
  drawer_rent:        { ar: 'الإيجار',         en: 'Rent' },
  drawer_start:       { ar: 'تاريخ البداية',   en: 'Start Date' },
  drawer_persons:     { ar: 'الأشخاص',         en: 'Persons' },
  drawer_lang:        { ar: 'اللغة',           en: 'Language' },
  drawer_notes:       { ar: 'ملاحظات',         en: 'Notes' },
  drawer_deposit:     { ar: 'التأمين',         en: 'Deposit' },
  drawer_payments:    { ar: 'آخر المدفوعات',   en: 'Recent Payments' },
  no_payments:        { ar: 'لا توجد مدفوعات مسجّلة', en: 'No payments recorded' },
  all_paid:           { ar: 'كل الوحدات دفعت هذا الشهر ✅', en: 'All units paid this month ✅' },
  pay_who:            { ar: 'مين بيدفع؟',                   en: 'Who is paying?' },
  receipt_search:     { ar: 'بحث في الإيصالات',              en: 'Search Receipts' },
  no_receipts:        { ar: 'لا توجد إيصالات',               en: 'No receipts found' },
  occ_rate:           { ar: 'نسبة الإشغال',                  en: 'Occupancy Rate' },
  avg_rent:           { ar: 'متوسط الإيجار',                 en: 'Avg Rent' },
  best_apt:           { ar: 'أفضل شقة تحصيلاً',              en: 'Top Apt' },
  cash_trend:         { ar: 'تحصيل آخر 6 شهور',              en: 'Cash Trend (6M)' },
  stats_lbl:          { ar: 'إحصائيات',                      en: 'Stats' },
  btn_confirm_delete:     { ar: 'هل أنت متأكد من الحذف؟',    en: 'Are you sure you want to delete?' },
  toast_deposit_refunded: { ar: 'تم تسجيل الاسترداد ✓',       en: 'Refund recorded ✓' },
  deposit_refund_title:   { ar: 'استرداد التأمين',             en: 'Refund Deposit' },
  refund_amount:          { ar: 'مبلغ الاسترداد',              en: 'Refund Amount' },
  refund_date:            { ar: 'تاريخ الاسترداد',             en: 'Refund Date' },
  balance:                { ar: 'المتبقي',                     en: 'Balance' },
  no_phone:               { ar: 'لا يوجد رقم هاتف',           en: 'No phone number' },
  reports_owner:          { ar: 'دفعات المالك',                en: 'Owner Payments' },
  btn_edit_payment:       { ar: 'تعديل الدفعة',                en: 'Edit Payment' },
  btn_edit_deposit:       { ar: 'تعديل التأمين',               en: 'Edit Deposit' },
  btn_edit_expense:       { ar: 'تعديل المصروف',               en: 'Edit Expense' },
  save_changes:           { ar: 'حفظ التعديلات',               en: 'Save Changes' },
  no_deposit:         { ar: 'لا يوجد تأمين مسجّل',    en: 'No deposit recorded' },
  deposit_held:       { ar: 'محتجز',           en: 'Held' },
  deposit_refunded:   { ar: 'مُسترد',          en: 'Refunded' },
  deposit_forfeited:  { ar: 'مصادر',           en: 'Forfeited' },
  refunded_prefix:    { ar: 'مُسترد',          en: 'Refunded' },
  btn_edit:           { ar: '✏️ تعديل',         en: '✏️ Edit' },
  btn_pay:            { ar: '💰 دفع',           en: '💰 Pay' },
  btn_reminder:       { ar: '💬 تذكير',         en: '💬 Reminder' },
  btn_departure:      { ar: '🚪 مغادرة',        en: '🚪 Departure' },
  btn_tenant_profile: { ar: '👤 بروفايل المستأجر',  en: '👤 Tenant Profile' },
  btn_unit_timeline:  { ar: '📅 تاريخ الوحدة الكامل', en: '📅 Unit Timeline' },
  deposit_status:     { ar: 'الحالة',               en: 'Status' },
  drawer_date:        { ar: 'تاريخ الاستلام',        en: 'Received Date' },
  btn_save:           { ar: '💾 حفظ التعديلات', en: '💾 Save Changes' },
  btn_add_unit:       { ar: '➕ إضافة الوحدة',  en: '➕ Add Unit' },
  btn_delete:         { ar: '🗑️ حذف',           en: '🗑️ Delete' },
  btn_cancel:         { ar: 'إلغاء',            en: 'Cancel' },
  btn_confirm_delete: { ar: 'هل أنت متأكد من حذف هذه الوحدة؟ سيتم حذف كل البيانات المرتبطة بها.', en: 'Are you sure you want to delete this unit? All related data will be deleted.' },

  // Unit Form Labels
  uf_apt:         { ar: 'رقم الشقة *',             en: 'Apartment No. *' },
  uf_apt_ph:      { ar: 'مثال: 101',               en: 'e.g. 101' },
  uf_room:        { ar: 'رقم الغرفة/البارتشن *',   en: 'Room/Partition No. *' },
  uf_room_ph:     { ar: 'مثال: A',                 en: 'e.g. A' },
  uf_tenant:      { ar: 'اسم المستأجر',            en: 'Tenant Name' },
  uf_tenant_ph:   { ar: 'الاسم الكامل',            en: 'Full name' },
  uf_tenant2:     { ar: 'اسم الشريك',              en: 'Partner Name' },
  uf_optional:    { ar: 'اختياري',                 en: 'Optional' },
  uf_phone:       { ar: 'رقم الهاتف',              en: 'Phone Number' },
  uf_phone2:      { ar: 'هاتف الشريك',             en: 'Partner Phone' },
  uf_rent:        { ar: 'الإيجار الشهري',          en: 'Monthly Rent' },
  uf_deposit:     { ar: 'التأمين',                 en: 'Deposit' },
  uf_rent1:       { ar: 'إيجار مستأجر 1',          en: 'Tenant 1 Rent' },
  uf_rent2:       { ar: 'إيجار مستأجر 2',          en: 'Tenant 2 Rent' },
  uf_start:       { ar: 'تاريخ البداية',           en: 'Start Date' },
  uf_persons:     { ar: 'عدد الأشخاص',             en: 'No. of Persons' },
  uf_language:    { ar: 'اللغة',                   en: 'Language' },
  uf_lang_ar:     { ar: 'عربي',                    en: 'Arabic' },
  uf_lang_en:     { ar: 'إنجليزي',                 en: 'English' },
  uf_status:      { ar: 'حالة الوحدة',             en: 'Unit Status' },
  uf_st_avail:    { ar: 'متاحة',                   en: 'Available' },
  uf_st_occ:      { ar: 'مشغولة',                  en: 'Occupied' },
  uf_st_res:      { ar: 'محجوزة',                  en: 'Reserved' },
  uf_st_maint:    { ar: 'صيانة',                   en: 'Maintenance' },
  uf_st_leaving:  { ar: 'مغادر قريباً',            en: 'Leaving Soon' },
  uf_notes:       { ar: 'ملاحظات',                 en: 'Notes' },
  edit_unit_title:{ ar: 'تعديل الوحدة',            en: 'Edit Unit' },
  add_unit_title: { ar: 'إضافة وحدة جديدة',        en: 'Add New Unit' },

  // Toast messages
  toast_unit_saved:   { ar: '✅ تم حفظ التعديلات',    en: '✅ Changes saved' },
  toast_unit_added:   { ar: '✅ تمت إضافة الوحدة',    en: '✅ Unit added' },
  toast_unit_deleted: { ar: '🗑️ تم حذف الوحدة',      en: '🗑️ Unit deleted' },
  toast_apt_required: { ar: 'رقم الشقة والغرفة مطلوبان', en: 'Apartment and room number are required' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAYMENTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  tab_rent:       { ar: '💰 إيجار',   en: '💰 Rent' },
  tab_expense:    { ar: '💸 مصروف',   en: '💸 Expense' },
  tab_owner:      { ar: '👤 مالك',    en: '👤 Owner' },
  tab_deposit:    { ar: '🔐 تأمين',   en: '🔐 Deposit' },

  pay_apt:        { ar: 'رقم الشقة *',     en: 'Apartment No. *' },
  pay_room:       { ar: 'رقم الغرفة *',    en: 'Room No. *' },
  pay_tenant:     { ar: 'اسم المستأجر',    en: 'Tenant Name' },
  pay_autofill:   { ar: 'يُملأ تلقائياً', en: 'Auto-filled' },
  pay_amount:     { ar: 'المبلغ *',        en: 'Amount *' },
  pay_tenant_num: { ar: 'المستأجر',        en: 'Tenant' },
  pay_t1:         { ar: 'مستأجر 1',        en: 'Tenant 1' },
  pay_t2:         { ar: 'مستأجر 2',        en: 'Tenant 2' },
  pay_month:      { ar: 'شهر الإيجار *',   en: 'Rent Month *' },
  pay_date:       { ar: 'تاريخ الاستلام *',en: 'Receipt Date *' },
  pay_method:     { ar: 'طريقة الدفع',     en: 'Payment Method' },
  pay_cash:       { ar: 'كاش',            en: 'Cash' },
  pay_transfer:   { ar: 'تحويل',          en: 'Transfer' },
  pay_cheque:     { ar: 'شيك',            en: 'Cheque' },
  pay_notes:      { ar: 'ملاحظات',        en: 'Notes' },
  pay_btn:        { ar: '💰 تسجيل الدفعة', en: '💰 Record Payment' },
  toast_rent_saved: { ar: '✅ تم تسجيل الدفعة', en: '✅ Payment recorded' },
  toast_amount_req: { ar: 'يرجى إدخال مبلغ صحيح', en: 'Please enter a valid amount' },
  toast_month_req:  { ar: 'يرجى تحديد شهر الدفع', en: 'Please select payment month' },
  toast_date_req:   { ar: 'يرجى تحديد تاريخ الاستلام', en: 'Please select receipt date' },

  exp_cat:        { ar: 'الفئة',        en: 'Category' },
  exp_cat_ph:     { ar: 'كهرباء / صيانة / تنظيف...', en: 'Electricity / Maintenance / Cleaning...' },
  exp_amount:     { ar: 'المبلغ *',     en: 'Amount *' },
  exp_month:      { ar: 'الشهر *',      en: 'Month *' },
  exp_desc:       { ar: 'الوصف',        en: 'Description' },
  exp_receipt:    { ar: 'رقم الإيصال', en: 'Receipt No.' },
  exp_btn:        { ar: '💸 تسجيل المصروف', en: '💸 Record Expense' },
  toast_exp_saved:{ ar: '✅ تم تسجيل المصروف', en: '✅ Expense recorded' },

  own_amount:     { ar: 'المبلغ *',       en: 'Amount *' },
  own_month:      { ar: 'الشهر *',        en: 'Month *' },
  own_date:       { ar: 'تاريخ الدفع',   en: 'Payment Date' },
  own_method:     { ar: 'طريقة الدفع',   en: 'Payment Method' },
  own_ref:        { ar: 'المرجع',         en: 'Reference' },
  own_ref_ph:     { ar: 'رقم التحويل / المرجع', en: 'Transfer no. / Reference' },
  own_notes:      { ar: 'ملاحظات',        en: 'Notes' },
  own_btn:        { ar: '👤 تسجيل دفعة المالك', en: '👤 Record Owner Payment' },
  toast_own_saved:{ ar: '✅ تم تسجيل دفعة المالك', en: '✅ Owner payment recorded' },

  dep_apt:        { ar: 'رقم الشقة *',      en: 'Apartment No. *' },
  dep_room:       { ar: 'رقم الغرفة *',     en: 'Room No. *' },
  dep_tenant:     { ar: 'اسم المستأجر',     en: 'Tenant Name' },
  dep_amount:     { ar: 'مبلغ التأمين',     en: 'Deposit Amount' },
  dep_status:     { ar: 'الحالة',           en: 'Status' },
  dep_held:       { ar: 'محتجز',            en: 'Held' },
  dep_refunded:   { ar: 'مُسترد',           en: 'Refunded' },
  dep_forfeited:  { ar: 'مصادر',            en: 'Forfeited' },
  dep_refund_amt: { ar: 'المبلغ المُسترد',  en: 'Refund Amount' },
  dep_deduct:     { ar: 'الخصم',            en: 'Deduction' },
  dep_recv_date:  { ar: 'تاريخ الاستلام',  en: 'Received Date' },
  dep_ref_date:   { ar: 'تاريخ الرد',      en: 'Refund Date' },
  dep_notes:      { ar: 'ملاحظات',          en: 'Notes' },
  dep_btn:        { ar: '🔐 تسجيل التأمين', en: '🔐 Record Deposit' },
  toast_dep_saved:{ ar: '✅ تم تسجيل التأمين', en: '✅ Deposit recorded' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MOVES / REPORTS (coming soon)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  moves_title:        { ar: 'التنقلات',          en: 'Moves' },
  moves_coming:       { ar: 'المرحلة 3 — قادم قريباً', en: 'Phase 3 — Coming Soon' },
  moves_departures:   { ar: '🚪 مغادرون',          en: '🚪 Departures' },
  moves_arrivals:     { ar: '🆕 حجوزات',           en: '🆕 Bookings' },
  moves_internal:     { ar: '🔄 نقل داخلي',        en: '🔄 Transfers' },
  moves_welcome:      { ar: '📄 رسالة ترحيب',      en: '📄 Welcome Letter' },
  reports_title:      { ar: 'التقارير',            en: 'Reports' },
  reports_coming:     { ar: 'المرحلة 4 — قادم قريباً', en: 'Phase 4 — Coming Soon' },
  reports_monthly:    { ar: '📋 شهري',             en: '📋 Monthly' },
  reports_expenses:   { ar: '💸 مصاريف',            en: '💸 Expenses' },
  reports_deposits:   { ar: '🔐 تأمينات',           en: '🔐 Deposits' },
  reports_annual:     { ar: '📈 سنوي',              en: '📈 Annual' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MOVES DETAILED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  departures_count:       { ar: 'مغادرون',              en: 'Departures' },
  no_departures:          { ar: 'لا يوجد مغادرون pending', en: 'No pending departures' },
  no_bookings:            { ar: 'لا توجد حجوزات pending', en: 'No pending bookings' },
  no_transfers:           { ar: 'لا توجد نقلات',         en: 'No transfers' },
  free_vacant:            { ar: 'شاغر حر',               en: 'Free Vacant' },
  move_date:              { ar: 'تاريخ المغادرة/الانتقال', en: 'Move Date' },
  btn_register_departure: { ar: '➕ تسجيل مغادرة',       en: '➕ Register Departure' },
  btn_confirm_departure:  { ar: '✅ تأكيد المغادرة',      en: '✅ Confirm Departure' },
  btn_save_departure:     { ar: '💾 حفظ',                en: '💾 Save' },
  btn_new_booking:        { ar: '➕ حجز جديد',            en: '➕ New Booking' },
  btn_save_booking:       { ar: '💾 حفظ الحجز',          en: '💾 Save Booking' },
  btn_confirm_arrival:    { ar: '✅ تأكيد الانتقال',      en: '✅ Confirm Arrival' },
  btn_new_transfer:       { ar: '➕ نقل داخلي جديد',     en: '➕ New Transfer' },
  btn_save_transfer:      { ar: '💾 حفظ النقل',          en: '💾 Save Transfer' },
  btn_execute_now:        { ar: '▶️ نفّذ الآن',          en: '▶️ Execute Now' },
  btn_revert:             { ar: '↩ تراجع',               en: '↩ Revert' },
  btn_preview:            { ar: '👁 معاينة',              en: '👁 Preview' },
  btn_print:              { ar: '🖨 طباعة / PDF',         en: '🖨 Print / PDF' },
  transfer_from:          { ar: 'من الوحدة',              en: 'From Unit' },
  transfer_to:            { ar: 'إلى الوحدة',             en: 'To Unit' },
  transfer_type:          { ar: 'نوع النقل',              en: 'Transfer Type' },
  transfer_immediate:     { ar: 'فوري',                   en: 'Immediate' },
  transfer_scheduled:     { ar: 'مجدول',                  en: 'Scheduled' },
  transfers_pending:      { ar: 'نقلات قيد الانتظار',    en: 'Pending Transfers' },
  transfers_done:         { ar: 'نقلات منفّذة',           en: 'Executed Transfers' },
  unit_not_found:         { ar: 'الوحدة غير موجودة',     en: 'Unit not found' },
  building_name:          { ar: 'اسم المبنى',             en: 'Building Name' },
  id_number:              { ar: 'رقم الهوية',             en: 'ID Number' },
  confirm_cancel_move:    { ar: 'هل تريد إلغاء هذه العملية؟', en: 'Cancel this operation?' },
  confirm_revert_transfer:{ ar: 'هل تريد التراجع عن النقل؟ سيتم استعادة البيانات القديمة.', en: 'Revert this transfer? Old data will be restored.' },
  toast_departure_saved:  { ar: '✅ تم تسجيل المغادرة',  en: '✅ Departure registered' },
  toast_departure_confirmed:{ar:'✅ تم تأكيد المغادرة وإفراغ الوحدة', en: '✅ Departure confirmed, unit cleared' },
  toast_booking_saved:    { ar: '✅ تم حفظ الحجز',       en: '✅ Booking saved' },
  toast_arrival_confirmed:{ ar: '✅ تم تأكيد الانتقال',  en: '✅ Arrival confirmed' },
  toast_transfer_saved:   { ar: '✅ تم حفظ النقل',       en: '✅ Transfer saved' },
  toast_transfer_done:    { ar: '✅ تم تنفيذ النقل',     en: '✅ Transfer executed' },
  toast_transfer_reverted:{ ar: '✅ تم التراجع عن النقل', en: '✅ Transfer reverted' },
  toast_move_cancelled:   { ar: '🗑 تم الإلغاء',          en: '🗑 Cancelled' },
  toast_name_required:    { ar: 'اسم المستأجر مطلوب',    en: 'Tenant name is required' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REPORTS DETAILED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  btn_export_pdf:         { ar: '🖨 PDF',               en: '🖨 PDF' },
  deposits_received:      { ar: 'تأمينات مستلمة',       en: 'Deposits Received' },
  deposit_partial:        { ar: 'استرداد جزئي',         en: 'Partial Refund' },
  no_payments_this_month: { ar: 'لا توجد مدفوعات هذا الشهر', en: 'No payments this month' },
  no_expenses:            { ar: 'لا توجد مصاريف',       en: 'No expenses' },
  no_deposits:            { ar: 'لا توجد تأمينات',      en: 'No deposits' },
  total:                  { ar: 'الإجمالي',             en: 'Total' },
  details:                { ar: 'التفاصيل',             en: 'Details' },
  uncategorized:          { ar: 'غير مصنّف',            en: 'Uncategorized' },
  toast_deleted:          { ar: '🗑 تم الحذف',           en: '🗑 Deleted' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DASHBOARD extras
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  stat_new:               { ar: 'جديد',                 en: 'New' },
  quick_access:           { ar: 'وصول سريع',            en: 'Quick Access' },
  late_payers_title:      { ar: '⚠️ المتأخرون',          en: '⚠️ Late Payers' },
  no_late_payers:         { ar: 'الكل دفع هذا الشهر',   en: 'Everyone paid this month' },
  send_bulk_reminder:     { ar: 'تذكير جماعي',          en: 'Bulk Reminder' },
  bulk_sent:              { ar: '✅ تم إرسال التذكيرات', en: '✅ Reminders sent' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // THEME PANEL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  theme_title:        { ar: '🎨 اختر الثيم',   en: '🎨 Choose Theme' },
  theme_changed:      { ar: '✅ تم تغيير الثيم', en: '✅ Theme changed' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━


  btn_send_contract:  { ar: 'إرسال العقد',          en: 'Send Contract' },
  contract_options:   { ar: 'خيارات العقد',          en: 'Contract Options' },
  contract_note:      { ar: 'ملاحظة إضافية',         en: 'Additional Note' },
  contract_note_ph:   { ar: 'مثال: يُمنع التدخين...',en: 'e.g. No smoking...' },
  contract_lang:      { ar: 'لغة العقد',             en: 'Contract Language' },
  nav_buildings:  { ar: 'المباني',   en: 'Buildings' },
  nav_theme:      { ar: 'المظهر',    en: 'Theme' },
  // BUILDINGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  manage_buildings:     { ar: 'إدارة المباني',         en: 'Manage Buildings' },
  building_name_label:  { ar: 'اسم المبنى *',           en: 'Building Name *' },
  building_name_ph:     { ar: 'مثال: Al Barsha 1',      en: 'e.g. Al Barsha 1' },
  building_address:     { ar: 'العنوان',                en: 'Address' },
  building_address_ph:  { ar: 'دبي، الإمارات',         en: 'Dubai, UAE' },
  btn_save_building:    { ar: '💾 حفظ المبنى',          en: '💾 Save Building' },
  existing_buildings:   { ar: 'المباني الموجودة',       en: 'Existing Buildings' },
  no_buildings_yet:     { ar: 'لا توجد مباني — أضف أول مبنى', en: 'No buildings yet — add your first' },
  building_name_required:{ ar: 'اسم المبنى مطلوب',     en: 'Building name is required' },
  toast_building_added: { ar: '✅ تم إضافة المبنى',     en: '✅ Building added' },
  toast_building_updated:{ ar: '✅ تم تحديث المبنى',    en: '✅ Building updated' },
  building_has_units:   { ar: 'المبنى فيه وحدات مرتبطة — افصلها أولاً', en: 'Building has linked units — unlink them first' },
  toast_building_deleted:{ ar: '🗑 تم حذف المبنى',      en: '🗑 Building deleted' },
  all_buildings:        { ar: 'كل المباني',             en: 'All Buildings' },
  uf_building:          { ar: 'المبنى',                 en: 'Building' },
  no_building:          { ar: 'بدون مبنى',              en: 'No building' },
  departures_report:    { ar: 'تقرير المغادرين',        en: 'Departures Report' },



  // ━━━━━━━━━━━━━━━━━━━━━━━━━━


  nav_menu_title: { ar: 'القائمة', en: 'Menu' },
  no_data_to_export:   { ar: 'لا توجد بيانات للتصدير',     en: 'No data to export' },
  toast_csv_exported:  { ar: '✅ تم تصدير الملف',           en: '✅ File exported' },
  quick_report_title:  { ar: 'تقرير التحصيل السريع',        en: 'Quick Collection Report' },
  quick_coll_report:   { ar: 'تحصيل سريع',                 en: 'Quick Report' },
  toast_phone_required:{ ar: 'رقم الهاتف مطلوب',           en: 'Phone number required' },
  // AUDIT LOG
  audit_log_title:   { ar: 'سجل العمليات',       en: 'Activity Log' },
  all_actions:       { ar: 'كل العمليات',         en: 'All Actions' },
  no_audit_logs:     { ar: 'لا يوجد سجلات',       en: 'No activity yet' },

  active:                  { ar: 'نشط',                        en: 'Active' },
  inactive:                { ar: 'غير نشط',                    en: 'Inactive' },
  toggle_active:           { ar: 'تفعيل/تعطيل',               en: 'Toggle Active' },
  toast_user_activated:    { ar: '✅ تم تفعيل الحساب',         en: '✅ Account activated' },
  toast_user_deactivated:  { ar: '❌ تم تعطيل الحساب',         en: '❌ Account deactivated' },
  // ADMIN / TEAM
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  admin_team:              { ar: 'إدارة الفريق',              en: 'Team Management' },
  btn_add_staff:           { ar: 'إضافة عضو جديد',            en: 'Add New Member' },
  btn_create_user:         { ar: 'إنشاء الحساب',              en: 'Create Account' },
  staff_email:             { ar: 'البريد الإلكتروني *',        en: 'Email *' },
  staff_name:              { ar: 'الاسم الكامل',               en: 'Full Name' },
  staff_name_ph:           { ar: 'مثال: أحمد محمد',            en: 'e.g. Ahmed Mohamed' },
  staff_pass:              { ar: 'كلمة المرور *',              en: 'Password *' },
  staff_role:              { ar: 'الدور',                      en: 'Role' },
  team_members:            { ar: 'أعضاء الفريق',               en: 'Team Members' },
  no_team_members:         { ar: 'لا يوجد أعضاء',             en: 'No team members yet' },
  you:                     { ar: 'أنت',                        en: 'You' },
  no_permission:           { ar: '🚫 ليس لديك صلاحية',         en: '🚫 No permission' },
  confirm_delete_staff:    { ar: 'هل تريد حذف هذا العضو؟',    en: 'Delete this member?' },
  toast_user_created:      { ar: '✅ تم إنشاء الحساب',         en: '✅ Account created' },
  toast_role_changed:      { ar: '✅ تم تغيير الدور',          en: '✅ Role updated' },
  toast_staff_deleted:     { ar: '🗑 تم حذف العضو',            en: '🗑 Member deleted' },
  toast_email_pass_required:{ ar: 'البريد وكلمة المرور مطلوبان', en: 'Email and password required' },
  toast_pass_too_short:    { ar: 'كلمة المرور أقل من 6 أحرف', en: 'Password too short (min 6)' },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UNITS DRAWER EXTRAS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  prev_tenants:           { ar: 'المستأجرون السابقون',      en: 'Previous Tenants' },
  no_history:             { ar: 'لا يوجد سجل سابق',         en: 'No history recorded' },
  deposit_already_exists: { ar: 'تأمين مسجّل بالفعل',       en: 'Deposit already exists' },
  total_held_active:      { ar: 'إجمالي محتجز فعلي',        en: 'Total Active Held' },
  balance:                { ar: 'متبقي',                     en: 'Balance' },
  allow_popups:           { ar: 'يرجى السماح بالنوافذ المنبثقة', en: 'Please allow popups' },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GENERAL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  loading:            { ar: '⏳ جاري التحميل...', en: '⏳ Loading...' },
  error_prefix:       { ar: 'حدث خطأ',           en: 'Error' },
  lang_ar:            { ar: 'عربي',              en: 'عربي' },
  lang_en:            { ar: 'EN',                en: 'EN' },
};

// ─────────────────────────────────────────
// t(key) — الوظيفة الرئيسية للترجمة
// ─────────────────────────────────────────
function t(key) {
  const entry = T[key];
  if (!entry) {
    console.warn(`i18n: missing key "${key}"`);
    return key;
  }
  return entry[LANG] ?? entry['ar'] ?? key;
}

// ─────────────────────────────────────────
// applyLang() — تطبيق اللغة على الـ HTML الثابت
// يُطبَّق على كل عنصر عنده data-i18n="key"
// ─────────────────────────────────────────
function applyLang() {
  const isAr = LANG === 'ar';

  // اتجاه الصفحة
  document.documentElement.setAttribute('lang', LANG);
  document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');

  // ترجمة كل العناصر الثابتة
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const val = t(key);
    if (attr) {
      el.setAttribute(attr, val);
    } else {
      el.textContent = val;
    }
  });

  // زر اللغة نفسه
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.textContent = isAr ? 'EN' : 'عربي';

  // تحديث الـ panels اللي اتحمّلت
  if (CURRENT_PANEL === 'home')    loadHome?.();
  if (CURRENT_PANEL === 'units')   loadUnits?.();
  if (CURRENT_PANEL === 'moves')   loadMoves?.();
  if (CURRENT_PANEL === 'reports') loadReports?.();
}

// ─────────────────────────────────────────
// toggleLang() — تبديل اللغة
// ─────────────────────────────────────────
function toggleLang() {
  LANG = LANG === 'ar' ? 'en' : 'ar';
  localStorage.setItem('wn_lang', LANG);
  applyLang();
}
