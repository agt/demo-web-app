document.addEventListener('DOMContentLoaded', () => {
  // Already logged in → go to dashboard
  if (getToken()) { window.location.href = '/dashboard.html'; return; }

  const form    = document.getElementById('login-form');
  const errDiv  = document.getElementById('login-error');
  const btnText = document.getElementById('btn-text');
  const spinner = document.getElementById('btn-spinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errDiv.style.display = 'none';
    btnText.textContent = 'Signing in…';
    spinner.style.display = 'inline-block';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const tokenData = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const user = await apiFetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });
      setSession(tokenData.access_token, user);
      window.location.href = '/dashboard.html';
    } catch (err) {
      errDiv.querySelector('span').textContent = err.message;
      errDiv.style.display = 'flex';
      btnText.textContent = 'Sign in';
      spinner.style.display = 'none';
    }
  });
});
