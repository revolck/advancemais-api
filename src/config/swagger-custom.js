(function () {
  function hasToken() {
    return document.cookie.split(';').some(function (c) {
      return c.trim().startsWith('token=');
    });
  }

  function insertButton() {
    var container = document.querySelector('.swagger-ui aside, .swagger-ui nav');
    if (!container || container.querySelector('.logout-btn')) return false;

    var btn = document.createElement('button');
    btn.textContent = 'Logout';
    btn.className = 'logout-btn';
    btn.style.display = 'block';
    btn.style.margin = '1rem';
    btn.style.padding = '8px 12px';
    btn.style.width = 'calc(100% - 2rem)';
    btn.style.background = '#d11124';
    btn.style.color = '#fff';
    btn.style.border = 'none';
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

    container.appendChild(btn);
    return true;
  }

  window.addEventListener('load', function () {
    if (!hasToken()) return;

    if (!insertButton()) {
      var observer = new MutationObserver(function () {
        if (insertButton()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
})();
