const DAY_NAMES_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_ABBR = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

let _allUsers = [];
let _allEquipment = [];
let _allCheckouts = [];
let _checkoutsFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  if (!requireAdmin()) return;

  const user = getUser();
  document.getElementById('nav-username').textContent = user.full_name || user.username;
  document.getElementById('nav-role').textContent = user.role;

  setupTabs();
  await loadAll();
});

async function loadAll() {
  await Promise.all([loadEquipment(), loadUsers(), loadCheckouts()]);
}

/* ── Tabs ────────────────────────────────────────────────────────────── */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = '';
    });
  });
}

/* ── Equipment ──────────────────────────────────────────────────────── */
async function loadEquipment() {
  try {
    _allEquipment = await apiFetch('/api/equipment');
    renderEquipmentTable();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderEquipmentTable() {
  const tbody = document.querySelector('#equipment-table tbody');
  if (!_allEquipment.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-flask-vial"></i><p>No equipment yet.</p></td></tr>`;
    return;
  }
  tbody.innerHTML = _allEquipment.map(e => {
    const availBadge = e.available
      ? `<span class="badge badge-success">Available</span>`
      : `<span class="badge badge-warning">Checked Out</span>`;
    const policy = e.policy;
    const days = policy?.allowed_days ? policy.allowed_days.map(d => DAY_ABBR[d]).join(', ') : 'Any';
    const maxDays = policy ? `${policy.max_checkout_days}d` : '7d';
    const users = policy?.allowed_users === 'all' ? 'All' :
      Array.isArray(policy?.allowed_users) ? `${policy.allowed_users.length} user(s)` : 'All';

    return `<tr>
      <td><strong>${escHtml(e.name)}</strong><div class="text-xs text-muted">${escHtml(e.serial_number || '')}</div></td>
      <td>${escHtml(e.location || '—')}</td>
      <td>${availBadge}</td>
      <td><span class="text-xs">${days} · ${maxDays} · ${users}</span></td>
      <td class="actions-cell">
        <button class="btn btn-outline btn-xs" onclick="openEditEquipModal(${e.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-outline btn-xs" onclick="openPolicyModal(${e.id})"><i class="fa-solid fa-sliders"></i> Policy</button>
        <button class="btn btn-danger btn-xs" onclick="deleteEquipment(${e.id}, '${escHtml(e.name)}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

/* Add Equipment modal */
function openAddEquipModal() {
  document.getElementById('equip-modal-title').textContent = 'Add Equipment';
  document.getElementById('equip-form').reset();
  document.getElementById('equip-id').value = '';
  document.getElementById('equip-error').style.display = 'none';
  document.getElementById('equip-modal').style.display = 'flex';
}

function openEditEquipModal(id) {
  const e = _allEquipment.find(x => x.id === id);
  if (!e) return;
  document.getElementById('equip-modal-title').textContent = 'Edit Equipment';
  document.getElementById('equip-id').value = e.id;
  document.getElementById('equip-name').value = e.name;
  document.getElementById('equip-description').value = e.description || '';
  document.getElementById('equip-serial').value = e.serial_number || '';
  document.getElementById('equip-location').value = e.location || '';
  document.getElementById('equip-error').style.display = 'none';
  document.getElementById('equip-modal').style.display = 'flex';
}

function closeEquipModal() { document.getElementById('equip-modal').style.display = 'none'; }

async function submitEquipForm() {
  const id   = document.getElementById('equip-id').value;
  const body = {
    name:          document.getElementById('equip-name').value.trim(),
    description:   document.getElementById('equip-description').value.trim() || null,
    serial_number: document.getElementById('equip-serial').value.trim() || null,
    location:      document.getElementById('equip-location').value.trim() || null,
  };
  const errEl = document.getElementById('equip-error');
  errEl.style.display = 'none';

  if (!body.name) { showError(errEl, 'Name is required.'); return; }

  try {
    if (id) {
      await apiFetch(`/api/equipment/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Equipment updated.', 'success');
    } else {
      await apiFetch('/api/equipment', { method: 'POST', body: JSON.stringify(body) });
      toast('Equipment added.', 'success');
    }
    closeEquipModal();
    await loadEquipment();
  } catch (err) {
    showError(errEl, err.message);
  }
}

async function deleteEquipment(id, name) {
  if (!confirm(`Deactivate "${name}"? It will no longer appear in the catalog.`)) return;
  try {
    await apiFetch(`/api/equipment/${id}`, { method: 'DELETE' });
    toast('Equipment deactivated.', 'success');
    await loadEquipment();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ── Policy modal ───────────────────────────────────────────────────── */
let _policyEquipId = null;

function openPolicyModal(equipId) {
  _policyEquipId = equipId;
  const e = _allEquipment.find(x => x.id === equipId);
  document.getElementById('policy-modal-title').textContent = `Policy: ${e?.name || ''}`;

  const policy = e?.policy;
  document.getElementById('policy-max-days').value = policy?.max_checkout_days ?? 7;

  // Day checkboxes
  const allowedDays = policy?.allowed_days;
  for (let i = 0; i < 7; i++) {
    const cb = document.getElementById(`day-${i}`);
    cb.checked = !allowedDays || allowedDays.includes(i);
  }

  // Allowed users
  const au = policy?.allowed_users;
  const isAll = !au || au === 'all';
  document.getElementById('users-all').checked = isAll;
  document.getElementById('users-specific').checked = !isAll;
  toggleUserSelect(!isAll);
  renderUserCheckboxes(isAll ? [] : (Array.isArray(au) ? au : []));

  document.getElementById('policy-error').style.display = 'none';
  document.getElementById('policy-modal').style.display = 'flex';
}

function closePolicyModal() { document.getElementById('policy-modal').style.display = 'none'; }

function toggleUserSelect(show) {
  document.getElementById('user-select-wrap').style.display = show ? '' : 'none';
}

function renderUserCheckboxes(selectedIds) {
  const wrap = document.getElementById('user-checkboxes');
  const activeUsers = _allUsers.filter(u => u.is_active && u.role !== 'admin');
  wrap.innerHTML = activeUsers.map(u => `
    <label class="flex text-sm" style="margin-bottom:.4rem; cursor:pointer;">
      <input type="checkbox" value="${u.id}" ${selectedIds.includes(u.id) ? 'checked' : ''}
             style="margin-right:.4rem;">
      ${escHtml(u.full_name || u.username)}
      <span class="text-muted text-xs">(${escHtml(u.username)})</span>
    </label>`).join('');
}

document.addEventListener('change', e => {
  if (e.target.name === 'users-radio') {
    toggleUserSelect(e.target.value === 'specific');
  }
});

async function submitPolicy() {
  const maxDays = parseInt(document.getElementById('policy-max-days').value, 10);
  const errEl = document.getElementById('policy-error');
  errEl.style.display = 'none';

  // Collect allowed days: if all 7 are checked → null (any day); else send list
  const checkedDays = [];
  for (let i = 0; i < 7; i++) {
    if (document.getElementById(`day-${i}`).checked) checkedDays.push(i);
  }
  const allowed_days = checkedDays.length === 7 || checkedDays.length === 0 ? null : checkedDays;

  // Allowed users
  let allowed_users = 'all';
  if (document.getElementById('users-specific').checked) {
    const checked = [...document.querySelectorAll('#user-checkboxes input:checked')];
    allowed_users = checked.map(cb => parseInt(cb.value, 10));
  }

  try {
    await apiFetch(`/api/equipment/${_policyEquipId}/policy`, {
      method: 'PUT',
      body: JSON.stringify({ allowed_days, max_checkout_days: maxDays, allowed_users }),
    });
    toast('Policy saved.', 'success');
    closePolicyModal();
    await loadEquipment();
  } catch (err) {
    showError(errEl, err.message);
  }
}

/* ── Users ──────────────────────────────────────────────────────────── */
async function loadUsers() {
  try {
    _allUsers = await apiFetch('/api/users');
    renderUsersTable();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderUsersTable() {
  const tbody = document.querySelector('#users-table tbody');
  if (!_allUsers.length) {
    tbody.innerHTML = `<tr><td colspan="5">No users found.</td></tr>`;
    return;
  }
  tbody.innerHTML = _allUsers.map(u => `<tr>
    <td><strong>${escHtml(u.username)}</strong></td>
    <td>${escHtml(u.full_name || '—')}</td>
    <td>${escHtml(u.email || '—')}</td>
    <td>
      <span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-gray'}">${u.role}</span>
      ${!u.is_active ? '<span class="badge badge-danger" style="margin-left:.25rem;">Inactive</span>' : ''}
    </td>
    <td class="actions-cell">
      <button class="btn btn-outline btn-xs" onclick="openEditUserModal(${u.id})"><i class="fa-solid fa-pen"></i> Edit</button>
      ${u.is_active
        ? `<button class="btn btn-danger btn-xs" onclick="deactivateUser(${u.id}, '${escHtml(u.username)}')">Deactivate</button>`
        : `<button class="btn btn-success btn-xs" onclick="reactivateUser(${u.id})">Reactivate</button>`
      }
    </td>
  </tr>`).join('');
}

function openAddUserModal() {
  document.getElementById('user-modal-title').textContent = 'Add User';
  document.getElementById('user-form').reset();
  document.getElementById('user-id').value = '';
  document.getElementById('user-password-row').style.display = '';
  document.getElementById('user-password-hint').style.display = 'none';
  document.getElementById('user-error').style.display = 'none';
  document.getElementById('user-modal').style.display = 'flex';
}

function openEditUserModal(id) {
  const u = _allUsers.find(x => x.id === id);
  if (!u) return;
  document.getElementById('user-modal-title').textContent = 'Edit User';
  document.getElementById('user-id').value = u.id;
  document.getElementById('user-username').value = u.username;
  document.getElementById('user-fullname').value = u.full_name || '';
  document.getElementById('user-email').value = u.email || '';
  document.getElementById('user-role').value = u.role;
  document.getElementById('user-password').value = '';
  document.getElementById('user-password-row').style.display = '';
  document.getElementById('user-password-hint').style.display = '';
  document.getElementById('user-error').style.display = 'none';
  document.getElementById('user-modal').style.display = 'flex';
}

function closeUserModal() { document.getElementById('user-modal').style.display = 'none'; }

async function submitUserForm() {
  const id = document.getElementById('user-id').value;
  const password = document.getElementById('user-password').value;
  const errEl = document.getElementById('user-error');
  errEl.style.display = 'none';

  const body = {
    username:  document.getElementById('user-username').value.trim(),
    full_name: document.getElementById('user-fullname').value.trim() || null,
    email:     document.getElementById('user-email').value.trim() || null,
    role:      document.getElementById('user-role').value,
  };
  if (password) body.password = password;

  if (!body.username) { showError(errEl, 'Username is required.'); return; }
  if (!id && !password) { showError(errEl, 'Password is required for new users.'); return; }

  try {
    if (id) {
      await apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('User updated.', 'success');
    } else {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(body) });
      toast('User created.', 'success');
    }
    closeUserModal();
    await loadUsers();
  } catch (err) {
    showError(errEl, err.message);
  }
}

async function deactivateUser(id, username) {
  if (!confirm(`Deactivate user "${username}"?`)) return;
  try {
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    toast('User deactivated.', 'success');
    await loadUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function reactivateUser(id) {
  try {
    await apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
    toast('User reactivated.', 'success');
    await loadUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ── All Checkouts ──────────────────────────────────────────────────── */
async function loadCheckouts() {
  try {
    _allCheckouts = await apiFetch('/api/checkouts');
    renderCheckoutsTable();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function filterCheckouts(status) {
  _checkoutsFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('btn-primary', b.dataset.filter === status);
    b.classList.toggle('btn-outline', b.dataset.filter !== status);
  });
  renderCheckoutsTable();
}

function renderCheckoutsTable() {
  const items = _checkoutsFilter === 'all'
    ? _allCheckouts
    : _allCheckouts.filter(c => c.status === _checkoutsFilter);

  const tbody = document.querySelector('#checkouts-table tbody');
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:2rem;">No checkouts found.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(c => {
    const od = c.status === 'active' && isOverdue(c.due_date);
    const statusBadge = c.status === 'active'
      ? (od ? `<span class="badge badge-danger">Overdue</span>`
             : `<span class="badge badge-success">Active</span>`)
      : `<span class="badge badge-gray">Returned</span>`;
    return `<tr>
      <td><strong>${escHtml(c.equipment?.name || '')}</strong></td>
      <td>${escHtml(c.user?.full_name || c.user?.username || '')}</td>
      <td>${fmtDate(c.checked_out_at)}</td>
      <td class="${od ? 'overdue-text' : ''}">${fmtDate(c.due_date)}</td>
      <td>${statusBadge}</td>
      <td>
        ${c.status === 'active'
          ? `<button class="btn btn-outline btn-xs" onclick="adminReturn(${c.id})">
               <i class="fa-solid fa-rotate-left"></i> Return
             </button>`
          : `<span class="text-muted text-xs">${fmtDate(c.returned_at)}</span>`}
      </td>
    </tr>`;
  }).join('');
}

async function adminReturn(checkoutId) {
  if (!confirm('Mark this equipment as returned?')) return;
  try {
    await apiFetch(`/api/checkouts/${checkoutId}/return`, { method: 'PUT' });
    toast('Marked as returned.', 'success');
    await loadCheckouts();
    await loadEquipment();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ── Utility ─────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
