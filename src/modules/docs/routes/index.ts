import { Router } from 'express';

const router = Router();

router.get('/docs/login', (req, res) => {
  res.send(
    String.raw`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Login - Advance+ API</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  
  body { 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0a0a0f;
    background-image: 
      radial-gradient(ellipse at 20% 10%, rgba(0, 37, 125, 0.2) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 90%, rgba(220, 38, 38, 0.15) 0%, transparent 50%);
    color: #ffffff;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 2rem;
    position: relative;
    overflow: hidden;
  }
  
  body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      linear-gradient(rgba(0, 37, 125, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 37, 125, 0.03) 1px, transparent 1px);
    background-size: 50px 50px;
    pointer-events: none;
  }
  
  .container {
    background: rgba(15, 15, 25, 0.8);
    backdrop-filter: blur(20px);
    padding: 3rem 2.5rem;
    border-radius: 24px;
    border: 1px solid rgba(0, 212, 255, 0.2);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    width: 100%;
    max-width: 420px;
    position: relative;
    z-index: 1;
    animation: float 6s ease-in-out infinite;
  }
  
  .logo-container {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  h1 {
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #00d4ff, #00257d);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }
  
  .subtitle {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 2rem;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  label {
    display: block;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 0.5rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  input[type="text"],
  input[type="password"] {
    width: 100%;
    padding: 1rem 1.25rem;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 12px;
    color: #ffffff;
    font-size: 1rem;
    transition: all 0.3s ease;
    outline: none;
  }
  
  input[type="text"]:focus,
  input[type="password"]:focus {
    border-color: rgba(0, 212, 255, 0.6);
    background: rgba(0, 37, 125, 0.2);
    box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
  }
  
  input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  .remember {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 1.25rem 0;
    cursor: pointer;
  }
  
  .remember input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #00d4ff;
  }
  
  .remember span {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
  }
  
  .hint {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .hint::before {
    content: "⚠️";
    font-size: 0.9rem;
  }
  
  button {
    width: 100%;
    padding: 1rem;
    background: linear-gradient(135deg, #00257d, #003ba8);
    color: #ffffff;
    border: 1px solid rgba(0, 37, 125, 0.5);
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 1.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  button:hover {
    background: linear-gradient(135deg, #003399, #004dd9);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 37, 125, 0.5);
  }
  
  button:active {
    transform: translateY(0);
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error {
    color: #dc2626;
    background: rgba(220, 38, 38, 0.1);
    border: 1px solid rgba(220, 38, 38, 0.3);
    border-radius: 8px;
    padding: 0.75rem;
    margin-top: 1rem;
    text-align: center;
    font-size: 0.9rem;
    display: none;
  }
  
  .error.show {
    display: block;
  }
  
  .back-link {
    text-align: center;
    margin-top: 1.5rem;
  }
  
  .back-link a {
    color: #00d4ff;
    text-decoration: none;
    font-size: 0.9rem;
    transition: color 0.3s ease;
  }
  
  .back-link a:hover {
    color: #00ffff;
  }
  
  @media (max-width: 480px) {
    .container {
      padding: 2rem 1.5rem;
    }
    h1 {
      font-size: 1.75rem;
    }
  }
</style>
</head>
<body>
<div class="container">
  <div class="logo-container">
    <h1>Advance+</h1>
    <p class="subtitle">Plataforma de API</p>
  </div>
  
  <form id="loginForm">
    <div class="form-group">
      <label for="cpf">CPF</label>
      <input
        type="text"
        id="cpf"
        placeholder="000.000.000-00"
        inputmode="numeric"
        maxlength="14"
        required
      />
    </div>
    
    <div class="form-group">
      <label for="senha">Senha</label>
      <input 
        type="password" 
        id="senha" 
        placeholder="Digite sua senha" 
        required 
      />
    </div>
    
    <label class="remember">
      <input type="checkbox" id="rememberMe" />
      <span>Manter sessão ativa neste dispositivo</span>
    </label>
    <p class="hint">Evite utilizar em dispositivos compartilhados</p>
    
    <button type="submit">Entrar</button>
    
    <p class="error" id="error"></p>
  </form>
  
  <div class="back-link">
    <a href="/">← Voltar para página inicial</a>
  </div>
</div>

<script>
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '/docs';
  const cpfInput = document.getElementById('cpf');
  const errorEl = document.getElementById('error');
  const submitBtn = document.querySelector('button[type="submit"]');

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
    
    // Limpar erro anterior
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    
    // Desabilitar botão durante o request
    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';
    
    try {
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
        submitBtn.textContent = '✓ Sucesso!';
        setTimeout(() => {
          window.location.href = redirect;
        }, 500);
      } else {
        throw new Error(data.message || 'Falha no login');
      }
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  });
</script>
</body>
</html>`,
  );
});

export { router as docsRoutes };
