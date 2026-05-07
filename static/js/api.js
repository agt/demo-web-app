/* Shared API client and auth helpers — included on every page */

function getToken()  { return localStorage.getItem('token'); }
function getUser()   { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; }
function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function logout() {
  clearSession();
  window.location.href = '/login.html';
}

function requireAuth() {
  if (!getToken()) { window.location.href = '/login.html'; return false; }
  return true;
}

function requireAdmin() {
  const user = getUser();
  if (!user || user.role !== 'admin') { window.location.href = '/dashboard.html'; return false; }
  return true;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login.html';
    return;
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || 'Request failed');
  }
  return res.json();
}

/* ── Alert helper ────────────────────────────────────────────────────── */
function showError(el, msg) {
  const span = el.querySelector('span');
  if (span) span.textContent = msg; else el.textContent = msg;
  el.style.display = 'flex';
}

/* ── Toast notifications ─────────────────────────────────────────────── */
function toast(msg, type = 'default', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ── Date helpers ────────────────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' });
}
function isOverdue(dueDateIso) {
  return new Date(dueDateIso) < new Date();
}

/* ── Navigation: highlight active link ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  document.querySelectorAll('.navbar-links a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
});
