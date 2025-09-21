import { Router } from 'express';

const router = Router();

router.get('/docs/login', (req, res) => {
  res.send(
    String.raw`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Login - Advance+</title>
<style>
  body { font-family: Arial, sans-serif; background:#f3f2ef; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
  .container { background:#fff; padding:2rem; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); width:300px; }
  h1 { color:#0a66c2; font-size:1.5rem; text-align:center; margin-bottom:1rem; }
  input { width:100%; padding:0.5rem; margin:0.5rem 0; border:1px solid #ccc; border-radius:4px; }
  button { width:100%; padding:0.5rem; background:#0a66c2; color:#fff; border:none; border-radius:4px; cursor:pointer; }
  .error { color:#d11124; margin-top:0.5rem; text-align:center; }
  .remember { display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem; color:#444; font-size:0.875rem; }
  .remember input { width:auto; margin:0; }
  .hint { font-size:0.75rem; color:#666; margin-top:0.25rem; }
</style>
</head>
<body>
<div class="container">
  <h1>Advance+</h1>
  <form id="loginForm">
    <input
      type="text"
      id="cpf"
      placeholder="000.000.000-00"
      inputmode="numeric"
      maxlength="14"
      required
    />
    <input type="password" id="senha" placeholder="Senha" required />
    <label class="remember">
      <input type="checkbox" id="rememberMe" />
      <span>Manter sessão ativa neste dispositivo</span>
    </label>
    <p class="hint">Evite utilizar em dispositivos compartilhados.</p>
    <button type="submit">Entrar</button>
    <p class="error" id="error"></p>
  </form>
</div>
<script>
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '/docs';
  const cpfInput = document.getElementById('cpf');

  const formatCPF = (value) =>
    value
      .replace(/[^0-9]/g, '')
      .slice(0, 11)
      .replace(/([0-9]{3})([0-9])/, '$1.$2')
      .replace(/([0-9]{3})([0-9])/, '$1.$2')
      .replace(/([0-9]{3})([0-9]{1,2})$/, '$1-$2');

  cpfInput.addEventListener('input', () => {
    cpfInput.value = formatCPF(cpfInput.value);
  });

  const form = document.getElementById('loginForm');
  const rememberInput = document.getElementById('rememberMe');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const documento = cpfInput.value.replace(/[^0-9]/g, '');
    const senha = document.getElementById('senha').value;
    const rememberMe = rememberInput.checked;
    const res = await fetch('/api/v1/usuarios/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ documento, senha, rememberMe })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      document.cookie = 'token=' + data.token + '; path=/';
      window.location.href = redirect;
    } else {
      document.getElementById('error').textContent = data.message || 'Falha no login';
    }
  });
</script>
</body>
</html>`,
  );
});

export { router as docsRoutes };
