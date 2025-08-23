import { Router } from "express";

const router = Router();

router.get("/docs/login", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Login - AdvanceMais</title>
<style>
  body { font-family: Arial, sans-serif; background:#f3f2ef; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
  .container { background:#fff; padding:2rem; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); width:300px; }
  h1 { color:#0a66c2; font-size:1.5rem; text-align:center; margin-bottom:1rem; }
  input { width:100%; padding:0.5rem; margin:0.5rem 0; border:1px solid #ccc; border-radius:4px; }
  button { width:100%; padding:0.5rem; background:#0a66c2; color:#fff; border:none; border-radius:4px; cursor:pointer; }
  .error { color:#d11124; margin-top:0.5rem; text-align:center; }
</style>
</head>
<body>
<div class="container">
  <h1>AdvanceMais</h1>
  <form id="loginForm">
    <input type="text" id="documento" placeholder="CPF ou CNPJ" required />
    <input type="password" id="senha" placeholder="Senha" required />
    <button type="submit">Entrar</button>
    <p class="error" id="error"></p>
  </form>
</div>
<script>
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const documento = document.getElementById('documento').value;
    const senha = document.getElementById('senha').value;
    const res = await fetch('/api/v1/usuarios/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento, senha })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      document.cookie = 'token=' + data.token + '; path=/';
      window.location.href = '/docs';
    } else {
      document.getElementById('error').textContent = data.message || 'Falha no login';
    }
  });
</script>
</body>
</html>`);
});

export { router as docsRoutes };
