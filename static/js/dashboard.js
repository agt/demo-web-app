const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  const user = getUser();
  document.getElementById('nav-username').textContent = user.full_name || user.username;
  document.getElementById('nav-role').textContent = user.role;
  if (user.role === 'admin') {
    document.getElementById('admin-link').style.display = '';
  }

  await Promise.all([loadEquipment(), loadMyCheckouts()]);
});

/* ── Equipment catalog ──────────────────────────────────────────────── */
async function loadEquipment() {
  const grid = document.getElementById('equipment-grid');
  grid.innerHTML = '<div class="spinner"></div>';
  try {
    const items = await apiFetch('/api/equipment');
    if (!items.length) {
      grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-flask-vial"></i><p>No equipment found.</p></div>`;
      return;
    }
    grid.innerHTML = items.map(e => equipmentCard(e)).join('');
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i>${err.message}</div>`;
  }
}

function policyInfo(e) {
  if (!e.policy) return '';
  const days = e.policy.allowed_days
    ? e.policy.allowed_days.map(d => DAY_NAMES[d]).join(', ')
    : 'Any day';
  return `<span><i class="fa-regular fa-calendar"></i>${days}</span>
          <span><i class="fa-regular fa-clock"></i>Max ${e.policy.max_checkout_days} day(s)</span>`;
}

function equipmentCard(e) {
  const availBadge = e.available
    ? `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i>Available</span>`
    : `<span class="badge badge-warning"><i class="fa-solid fa-circle-minus"></i>Checked Out</span>`;

  const checkoutBtn = e.available
    ? `<button class="btn btn-primary btn-sm" onclick="openCheckoutModal(${e.id}, '${escHtml(e.name)}')">
         <i class="fa-solid fa-right-from-bracket"></i> Check Out
       </button>`
    : `<span class="text-muted text-xs">Unavailable</span>`;

  return `
    <div class="equip-card" id="equip-card-${e.id}">
      <div class="equip-card-icon">
        <i class="fa-solid fa-microscope"></i>
      </div>
      <div class="equip-card-body">
        <h3>${escHtml(e.name)}</h3>
        <p class="text-muted text-sm">${escHtml(e.description || '')}</p>
        <div class="meta">
          ${e.serial_number ? `<span><i class="fa-solid fa-barcode"></i>${escHtml(e.serial_number)}</span>` : ''}
          ${e.location ? `<span><i class="fa-solid fa-location-dot"></i>${escHtml(e.location)}</span>` : ''}
          ${policyInfo(e)}
        </div>
      </div>
      <div class="equip-card-footer">
        ${availBadge}
        ${checkoutBtn}
      </div>
    </div>`;
}

/* ── My checkouts ───────────────────────────────────────────────────── */
async function loadMyCheckouts() {
  const container = document.getElementById('my-checkouts');
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const all = await apiFetch('/api/checkouts');
    const active = all.filter(c => c.status === 'active');
    const history = all.filter(c => c.status !== 'active').slice(0, 10);

    renderActiveCheckouts(active);
    renderHistory(history);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function renderActiveCheckouts(items) {
  const el = document.getElementById('active-checkouts');
  if (!items.length) {
    el.innerHTML = `<p class="text-muted">No active checkouts.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Equipment</th><th>Checked Out</th><th>Due Date</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${items.map(c => {
            const od = isOverdue(c.due_date);
            return `<tr>
              <td><strong>${escHtml(c.equipment?.name || '')}</strong>
                  <div class="text-xs text-muted">${escHtml(c.equipment?.location || '')}</div></td>
              <td>${fmtDate(c.checked_out_at)}</td>
              <td class="${od ? 'overdue-text' : ''}">${fmtDate(c.due_date)}${od ? ' ⚠ Overdue' : ''}</td>
              <td><button class="btn btn-outline btn-sm" onclick="returnCheckout(${c.id})">
                    <i class="fa-solid fa-rotate-left"></i> Return
                  </button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderHistory(items) {
  const el = document.getElementById('checkout-history');
  if (!items.length) {
    el.innerHTML = `<p class="text-muted">No checkout history.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Equipment</th><th>Checked Out</th><th>Returned</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${items.map(c => `<tr>
            <td>${escHtml(c.equipment?.name || '')}</td>
            <td>${fmtDate(c.checked_out_at)}</td>
            <td>${fmtDate(c.returned_at)}</td>
            <td><span class="badge badge-gray">${c.status}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Checkout modal ─────────────────────────────────────────────────── */
let _checkoutEquipId = null;

function openCheckoutModal(id, name) {
  _checkoutEquipId = id;
  document.getElementById('checkout-modal-title').textContent = `Check Out: ${name}`;
  document.getElementById('checkout-notes').value = '';
  document.getElementById('checkout-error').style.display = 'none';
  document.getElementById('checkout-modal').style.display = 'flex';
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').style.display = 'none';
}

async function submitCheckout() {
  const notes = document.getElementById('checkout-notes').value.trim();
  const errEl = document.getElementById('checkout-error');
  errEl.style.display = 'none';
  try {
    await apiFetch('/api/checkouts', {
      method: 'POST',
      body: JSON.stringify({ equipment_id: _checkoutEquipId, notes: notes || null }),
    });
    closeCheckoutModal();
    toast('Equipment checked out successfully!', 'success');
    await Promise.all([loadEquipment(), loadMyCheckouts()]);
  } catch (err) {
    showError(errEl, err.message);
  }
}

async function returnCheckout(checkoutId) {
  if (!confirm('Confirm return of this equipment?')) return;
  try {
    await apiFetch(`/api/checkouts/${checkoutId}/return`, { method: 'PUT' });
    toast('Equipment returned.', 'success');
    await Promise.all([loadEquipment(), loadMyCheckouts()]);
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ── Utility ─────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
