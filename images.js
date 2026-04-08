'use strict';
// ══════════════════════════════════════════
// images.js — صور الوحدات
// ══════════════════════════════════════════

let _unitImgFiles = [];

function previewUnitImgs(input) {
  _unitImgFiles = Array.from(input.files || []);
  const preview = document.getElementById('unit-imgs-preview');
  if (!preview) return;
  preview.innerHTML = '';
  _unitImgFiles.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = e => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;width:70px;height:70px;display:inline-block;margin:4px';
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid var(--border)';
      const btn = document.createElement('button');
      btn.style.cssText = 'position:absolute;top:-6px;right:-6px;background:var(--red);border:none;border-radius:50%;width:20px;height:20px;color:#fff;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center';
      btn.textContent = '×';
      btn.onclick = () => removeUnitImg(i);
      wrap.appendChild(img);
      wrap.appendChild(btn);
      preview.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  });
}

function removeUnitImg(idx) {
  _unitImgFiles.splice(idx, 1);
  previewUnitImgs({ files: _unitImgFiles });
}

async function uploadUnitImages(unitId) {
  if (!_unitImgFiles.length) return [];
  const urls = [];
  for (const file of _unitImgFiles) {
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { error } = await sb.from('unit_images').insert({
        unit_id: unitId, image_data: base64,
        file_name: file.name, created_by: ME?.id || null,
      });
      if (!error) urls.push(base64);
    } catch(e) { console.warn('image upload:', e); }
  }
  _unitImgFiles = [];
  return urls;
}

async function loadUnitImages(unitId) {
  try {
    const { data } = await sb.from('unit_images').select('id,image_data,file_name,created_at')
      .eq('unit_id', unitId).order('created_at');
    return data || [];
  } catch(e) { return []; }
}

async function deleteUnitImage(imgId) {
  if (!confirm('حذف الصورة؟')) return;
  try {
    await sb.from('unit_images').delete().eq('id', imgId);
    toast('✅ تم حذف الصورة', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

// عرض صور الوحدة في الـ drawer
async function renderUnitImages(unitId, container) {
  if (!container) return;
  const imgs = await loadUnitImages(unitId);
  if (!imgs.length) { container.innerHTML = ''; return; }
  container.innerHTML = `
<div style="margin-top:12px">
  <div style="font-size:.72rem;color:var(--muted);font-weight:700;margin-bottom:6px">📸 صور الوحدة</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${imgs.map(img => `
      <div style="position:relative">
        <img src="${img.image_data}" alt="${Helpers.escapeHtml(img.file_name||'')}"
          style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer"
          onclick="window.open('${img.image_data}','_blank')">
        <button onclick="deleteUnitImage('${img.id}'); this.parentElement.remove()"
          style="position:absolute;top:-4px;right:-4px;background:var(--red);border:none;border-radius:50%;width:18px;height:18px;color:#fff;cursor:pointer;font-size:.65rem">×</button>
      </div>`).join('')}
  </div>
</div>`;
}

window.previewUnitImgs  = previewUnitImgs;
window.removeUnitImg    = removeUnitImg;
window.uploadUnitImages = uploadUnitImages;
window.loadUnitImages   = loadUnitImages;
window.deleteUnitImage  = deleteUnitImage;
window.renderUnitImages = renderUnitImages;
