# 📝 PROMPT PARA O FRONTEND - GESTÃO DE USUÁRIOS

O backend foi atualizado com novas funcionalidades para gestão de usuários. Segue o que precisa ser implementado no frontend.

---

## 📚 DOCUMENTAÇÃO

- **Swagger**: http://localhost:3000/docs
- **ReDoc**: http://localhost:3000/redoc

---

## 📋 MUDANÇAS NECESSÁRIAS

### 1️⃣ LISTAGEM DE USUÁRIOS (GET /api/v1/usuarios/usuarios)

#### ✅ NOVOS FILTROS DE LOCALIZAÇÃO

- Adicionar filtro de "Cidade" no componente de filtros
- Adicionar filtro de "Estado" no componente de filtros
- Os filtros devem enviar parâmetros: `?cidade=xxx&estado=xxx`

#### 📋 NOVOS CAMPOS NA TABELA

- Exibir "codUsuario" (código do usuário)
- Exibir "cpf" ou "cnpj" conforme tipoUsuario
- Ajustar colunas para mostrar endereço completo

#### 🔗 EXEMPLO DE API

```
GET /api/v1/usuarios/usuarios?cidade=Maceió&estado=AL&page=1&limit=50
```

---

### 2️⃣ DETALHES DO USUÁRIO (GET /api/v1/usuarios/usuarios/:userId)

#### 📌 NOVA ESTRUTURA DE RESPOSTA (COM RELAÇÕES POR ROLE)

**Para ALUNO_CANDIDATO:**

```json
{
  "usuario": {
    // ... dados básicos
    "curriculos": [...],        // Array de currículos
    "candidaturas": [...],      // Array de candidaturas
    "cursosInscricoes": [...]   // Array de inscrições em cursos
  }
}
```

**Para EMPRESA:**

```json
{
  "usuario": {
    // ... dados básicos
    "vagas": [...]              // Array de vagas da empresa
  }
}
```

#### 📝 AÇÃO NECESSÁRIA

- Criar seção "Currículos" para ALUNO_CANDIDATO
- Criar seção "Candidaturas" para ALUNO_CANDIDATO
- Criar seção "Inscrições em Cursos" para ALUNO_CANDIDATO
- Criar seção "Vagas" para EMPRESA
- Implementar accordion/tabs por seção
- Mostrar dados apenas se o array não estiver vazio

---

### 3️⃣ EDIÇÃO DE USUÁRIO (PUT /api/v1/usuarios/usuarios/:userId)

#### ✅ CAMPOS JÁ IMPLEMENTADOS (conferir se estão todos)

- nomeCompleto, email, telefone, genero, dataNasc
- descricao, avatarUrl
- endereco completo (logradouro, numero, bairro, cidade, estado, cep)
- redesSociais (LinkedIn, Instagram, Facebook, etc.)

#### ⚠️ NOVO: EDITAR SENHA

- Adicionar campos: senha + confirmarSenha
- Validação: mínimo 8 caracteres, confirmação deve ser igual
- Exibir em seção separada "Redefinir Senha"

---

### 4️⃣ BLOQUEIO DE USUÁRIO (NOVAS FUNCIONALIDADES)

#### 🔒 APLICAR BLOQUEIO

```
POST /api/v1/usuarios/usuarios/:userId/bloqueios
Body: { tipo, motivo, dias?, observacoes? }
```

#### ✅ REVOGAR BLOQUEIO

```
POST /api/v1/usuarios/usuarios/:userId/bloqueios/revogar
Body: { observacoes? }
```

#### 📜 HISTÓRICO DE BLOQUEIOS

```
GET /api/v1/usuarios/usuarios/:userId/bloqueios
Response: { data: [...], pagination: {...} }
```

#### 📝 UI NECESSÁRIA

- Botão "Bloquear Usuário" (modal com formulário)
- Botão "Desbloquear" (se houver bloqueio ativo)
- Seção "Histórico de Bloqueios" (tabela)
- Indicador visual de status BLOQUEADO (badge vermelho)

---

## ✅ PRIORIDADES

### 🔴 ALTA:

1. Filtro de localização (cidade/estado) na listagem
2. Exibir campos codUsuario, cpf/cnpj na tabela
3. Seções de relações no detalhe do usuário (curriculos, candidaturas, vagas, etc)

### 🟡 MÉDIA:

4. Edição de senha no formulário de edição
5. Bloqueio/desbloqueio de usuário

### 🟢 BAIXA:

6. Histórico de bloqueios (pode ser em versão futura)

---

## 🧪 COMO TESTAR

1. Iniciar o backend (porta 3000)
2. Acessar Swagger: http://localhost:3000/docs
3. Testar endpoints manualmente
4. Implementar no frontend
5. Testar integração

---

## 📊 ESTRUTURA DE RESPOSTA COMPLETA

### Exemplo para ALUNO_CANDIDATO:

```json
{
  "message": "Usuário encontrado",
  "usuario": {
    "id": "uuid",
    "codUsuario": "USR-2024-001",
    "nomeCompleto": "João Silva",
    "email": "joao@example.com",
    "cpf": "12345678901",
    "role": "ALUNO_CANDIDATO",
    "status": "ATIVO",
    "telefone": "11999999999",
    "cidade": "São Paulo",
    "estado": "SP",
    "curriculos": [
      {
        "id": "uuid",
        "titulo": "Desenvolvedor Full Stack",
        "resumo": "...",
        "principal": true
      }
    ],
    "candidaturas": [
      {
        "id": "uuid",
        "vaga": {
          "id": "uuid",
          "titulo": "Desenvolvedor React"
        },
        "status": {
          "nome": "EM_ANALISE"
        }
      }
    ],
    "cursosInscricoes": [
      {
        "id": "uuid",
        "status": "EM_ANDAMENTO",
        "turma": {
          "nome": "Turma 1",
          "curso": {
            "nome": "React Avançado"
          }
        }
      }
    ]
  }
}
```

### Exemplo para EMPRESA:

```json
{
  "message": "Usuário encontrado",
  "usuario": {
    "id": "uuid",
    "codUsuario": "EMP-2024-001",
    "nomeCompleto": "Tech Innovations",
    "email": "contato@tech.com",
    "cnpj": "12345678000199",
    "role": "EMPRESA",
    "status": "ATIVO",
    "vagas": [
      {
        "id": "uuid",
        "titulo": "Desenvolvedor React",
        "status": "PUBLICADO",
        "modalidade": "REMOTO",
        "senioridade": "PLENO"
      }
    ]
  }
}
```

---

## ❓ DÚVIDAS?

Qualquer dúvida sobre:

- Estrutura das respostas
- Validações necessárias
- Campos disponíveis

Consulte a documentação Swagger ou avise!
