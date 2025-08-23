(function () {
  function hasToken() {
    return document.cookie.split(';').some(function (c) {
      return c.trim().startsWith('token=');
    });
  }

  window.addEventListener('load', function () {
    if (!hasToken()) return;
    var btn = document.createElement('button');
    btn.textContent = 'Logout';
    btn.style.position = 'fixed';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = '9999';
    btn.style.background = '#d11124';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.padding = '8px 12px';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.onclick = async function () {
      try {
        await fetch('/api/v1/usuarios/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (e) {
        console.error('Erro ao fazer logout', e);
      }
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.href = '/docs/login';
    };
    document.body.appendChild(btn);
  });
})();
