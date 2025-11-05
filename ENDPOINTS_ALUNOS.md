# 📚 Documentação - Endpoints de Alunos

## 🎯 Visão Geral

Este documento lista **todos os endpoints** disponíveis para gerenciamento de alunos (role `ALUNO_CANDIDATO`) no sistema Advance+.

---

## 📍 Base URL

**Desenvolvimento:** `http://localhost:3000`  
**Produção:** `https://api.advancemais.com`

---

## 🔐 Autenticação

Todos os endpoints requerem **autenticação Bearer Token (JWT)** no header:

```
Authorization: Bearer <seu_token_jwt_aqui>
```

---

## 📋 Índice

1. [Listar Alunos](#1-listar-alunos)
2. [Buscar Detalhes do Aluno](#2-buscar-detalhes-do-aluno)
3. [Atualizar Informações do Aluno](#3-atualizar-informações-do-aluno)
4. [Inscrever Aluno em uma Turma](#4-inscrever-aluno-em-uma-turma)
5. [Remover Inscrição do Aluno](#5-remover-inscrição-do-aluno)
6. [Aplicar Bloqueio ao Aluno](#6-aplicar-bloqueio-ao-aluno)
7. [Revogar Bloqueio do Aluno](#7-revogar-bloqueio-do-aluno)
8. [Listar Histórico de Bloqueios](#8-listar-histórico-de-bloqueios)

---

## 1. Listar Alunos

### Endpoint

```
GET /api/v1/cursos/alunos
```

### Descrição

Retorna lista paginada de alunos que possuem inscrições em cursos, incluindo detalhes das inscrições, turmas e cursos associados.

### Roles Permitidas

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

### Query Parameters

| Parâmetro | Tipo   | Obrigatório | Descrição                               | Exemplo         |
| --------- | ------ | ----------- | --------------------------------------- | --------------- |
| `page`    | number | Não         | Número da página (padrão: 1)            | `1`             |
| `limit`   | number | Não         | Itens por página (padrão: 10, máx: 50)  | `10`            |
| `cidade`  | string | Não         | Filtrar por cidade do aluno             | `"Campinas"`    |
| `status`  | string | Não         | Status da inscrição                     | `"INSCRITO"` |
| `curso`   | string | Não         | ID do curso                             | `"4"`           |
| `turma`   | string | Não         | ID da turma                             | `"uuid"`        |
| `search`  | string | Não         | Busca por nome, email, CPF ou código de inscrição | `"João"`        |

### Status Válidos para `status`

- `INSCRITO`
- `EM_ANDAMENTO`
- `CONCLUIDO`
- `REPROVADO`
- `EM_ESTAGIO`
- `CANCELADO`
- `TRANCADO`

### Exemplos de Uso

```bash
# Listar todos os alunos (primeira página)
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/v1/cursos/alunos?page=1&limit=10"

# Filtrar por cidade
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/v1/cursos/alunos?cidade=Campinas"

# Filtrar por status
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/v1/cursos/alunos?status=INSCRITO"

# Filtrar por curso
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/v1/cursos/alunos?curso=4"

# Buscar aluno
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/v1/cursos/alunos?search=João Silva"
```

### Resposta de Sucesso (200 OK)

```json
{
  "data": [
    {
      "id": "0b89ee94-f3ab-4682-999b-36574f81751a",
      "codigo": "MAT0001",
      "nomeCompleto": "João da Silva",
      "email": "joao@example.com",
      "cpf": "123.456.789-00",
      "status": "ATIVO",
      "cidade": "Campinas",
      "estado": "SP",
      "ultimoLogin": "2025-10-30T10:00:00Z",
      "criadoEm": "2025-01-15T08:00:00Z",
      "ultimoCurso": {
        "inscricaoId": "abc123",
        "statusInscricao": "INSCRITO",
        "dataInscricao": "2025-01-15T08:00:00Z",
        "turma": {
          "id": "8438a571-d7ca-4cf7-92d3-3cecf272c9a0",
          "nome": "Turma 1 – SQL do Básico ao Avançado",
          "codigo": "TUR001",
          "status": "EM_ANDAMENTO"
        },
        "curso": {
          "id": 4,
          "nome": "SQL do Básico ao Avançado",
          "codigo": "SQL001"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 150,
    "totalPages": 15
  }
}
```

### Respostas de Erro

| Código | Descrição                             |
| ------ | ------------------------------------- |
| 400    | Status inválido                       |
| 401    | Token ausente ou inválido             |
| 403    | Acesso negado                         |
| 500    | Erro interno                          |
| 503    | Problema temporário de conexão        |
| 504    | Query timeout (consulta muito pesada) |

---

## 2. Buscar Detalhes do Aluno

### Endpoint

```
GET /api/v1/cursos/alunos/{alunoId}
```

### Descrição

Retorna informações detalhadas completas de um aluno específico, incluindo:

- Dados pessoais completos
- Redes sociais (LinkedIn, Instagram, Facebook, YouTube, Twitter, TikTok)
- Todos os endereços cadastrados
- **TODAS as inscrições em cursos** (não apenas a última)
- Estatísticas de cursos (ativos, concluídos, cancelados)

### Roles Permitidas

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

### Path Parameters

| Parâmetro | Tipo   | Descrição          | Exemplo                                  |
| --------- | ------ | ------------------ | ---------------------------------------- |
| `alunoId` | string | ID do aluno (UUID) | `"0b89ee94-f3ab-4682-999b-36574f81751a"` |

### Exemplo de Uso

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/v1/cursos/alunos/0b89ee94-f3ab-4682-999b-36574f81751a"
```

### Resposta de Sucesso (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "0b89ee94-f3ab-4682-999b-36574f81751a",
    "codigo": "MAT0001",
    "nomeCompleto": "João da Silva",
    "email": "joao@example.com",
    "cpf": "123.456.789-00",
    "telefone": "(19) 99999-9999",
    "status": "ATIVO",
    "genero": "MASCULINO",
    "dataNasc": "1990-05-15",
    "descricao": "Desenvolvedor apaixonado por dados",
    "avatarUrl": "https://example.com/avatar.jpg",
    "criadoEm": "2025-01-15T08:00:00Z",
    "atualizadoEm": "2025-10-30T12:00:00Z",
    "ultimoLogin": "2025-10-30T10:00:00Z",
    "enderecos": [
      {
        "id": "addr123",
        "logradouro": "Rua das Flores, 123",
        "numero": "123",
        "bairro": "Centro",
        "cidade": "Campinas",
        "estado": "SP",
        "cep": "13000-000",
        "criadoEm": "2025-01-15T08:00:00Z"
      }
    ],
    "redesSociais": {
      "linkedin": "https://linkedin.com/in/joaosilva",
      "instagram": "https://instagram.com/joaosilva",
      "facebook": null,
      "youtube": null,
      "twitter": null,
      "tiktok": null
    },
    "inscricoes": [
      {
        "id": "insc123",
        "statusInscricao": "INSCRITO",
        "criadoEm": "2025-01-15T08:00:00Z",
        "turma": {
          "id": "8438a571-d7ca-4cf7-92d3-3cecf272c9a0",
          "nome": "Turma 1 – SQL do Básico ao Avançado",
          "codigo": "TUR001",
          "status": "EM_ANDAMENTO",
          "dataInicio": "2025-02-01",
          "dataFim": "2025-12-31"
        },
        "curso": {
          "id": 4,
          "nome": "SQL do Básico ao Avançado",
          "codigo": "SQL001",
          "descricao": "Curso completo de SQL",
          "cargaHoraria": 120,
          "imagemUrl": "https://example.com/sql.jpg"
        }
      }
    ],
    "totalInscricoes": 3,
    "estatisticas": {
      "cursosAtivos": 2,
      "cursosConcluidos": 1,
      "cursosCancelados": 0
    }
  }
}
```

### Respostas de Erro

| Código | Descrição                       |
| ------ | ------------------------------- |
| 400    | ID inválido (não é UUID válido) |
| 401    | Token ausente ou inválido       |
| 403    | Acesso negado                   |
| 404    | Aluno não encontrado            |
| 500    | Erro interno                    |

---

## 3. Atualizar Informações do Aluno

### Endpoint

```
PUT /api/v1/cursos/alunos/{alunoId}
```

### Descrição

Atualiza informações de um aluno específico. Apenas ADMIN e MODERADOR podem atualizar.

**OPÇÕES DE ATUALIZAÇÃO:**

- ✅ Atualizar dados pessoais (nome, telefone, gênero, data de nascimento, descrição)
- ✅ Alterar e-mail (com validação de unicidade)
- ✅ Redefinir senha manualmente (hash bcrypt automático)
- ✅ Atualizar redes sociais (LinkedIn, Instagram, etc.)
- ✅ Atualizar endereço completo

### Roles Permitidas

- `ADMIN`
- `MODERADOR`

### Path Parameters

| Parâmetro | Tipo   | Descrição          | Exemplo                                  |
| --------- | ------ | ------------------ | ---------------------------------------- |
| `alunoId` | string | ID do aluno (UUID) | `"0b89ee94-f3ab-4682-999b-36574f81751a"` |

### Body (JSON) - Todos os campos são opcionais

```json
{
  "nomeCompleto": "João da Silva",
  "email": "joao.silva@example.com",
  "telefone": "(19) 99999-9999",
  "genero": "MASCULINO",
  "dataNasc": "1990-05-15",
  "descricao": "Desenvolvedor apaixonado por dados",
  "avatarUrl": "https://example.com/avatar.jpg",
  "endereco": {
    "logradouro": "Rua das Flores, 123",
    "numero": "123",
    "bairro": "Centro",
    "cidade": "Campinas",
    "estado": "SP",
    "cep": "13000-000"
  },
  "redesSociais": {
    "linkedin": "https://linkedin.com/in/joaosilva",
    "instagram": "https://instagram.com/joaosilva",
    "facebook": "https://facebook.com/joaosilva",
    "youtube": null,
    "twitter": null,
    "tiktok": null
  }
}
```

**Para redefinir senha, envie:**

```json
{
  "senha": "NovaSenha123!",
  "confirmarSenha": "NovaSenha123!"
}
```

**Notas:**

- O campo `endereco` atualiza o endereço mais recente do aluno. Se não houver endereço cadastrado, cria um novo.
- O campo `email` deve ser único no sistema.
- A `senha` deve ter pelo menos 8 caracteres e requer `confirmarSenha` igual.
- Senha é hashado automaticamente com bcrypt antes de salvar no banco.

### Exemplo de Uso

```bash
# Atualizar endereço completo
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "endereco": {
      "logradouro": "Rua das Flores, 456",
      "numero": "456",
      "bairro": "Centro",
      "cidade": "São Paulo",
      "estado": "SP",
      "cep": "01000-000"
    }
  }' \
  "http://localhost:3000/api/v1/cursos/alunos/0b89ee94-f3ab-4682-999b-36574f81751a"

# Atualizar apenas nome e rede social
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nomeCompleto": "João Silva Atualizado",
    "redesSociais": {
      "linkedin": "https://linkedin.com/in/joaosilva"
    }
  }' \
  "http://localhost:3000/api/v1/cursos/alunos/0b89ee94-f3ab-4682-999b-36574f81751a"

# Alterar e-mail do aluno
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novo.email@example.com"
  }' \
  "http://localhost:3000/api/v1/cursos/alunos/0b89ee94-f3ab-4682-999b-36574f81751a"

# Redefinir senha do aluno
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "senha": "NovaSenha123!",
    "confirmarSenha": "NovaSenha123!"
  }' \
  "http://localhost:3000/api/v1/cursos/alunos/0b89ee94-f3ab-4682-999b-36574f81751a"
```

### Resposta de Sucesso (200 OK)

```json
{
  "success": true,
  "message": "Informações do aluno atualizadas com sucesso",
  "data": {
    "id": "0b89ee94-f3ab-4682-999b-36574f81751a",
    "codigo": "MAT0001",
    "nomeCompleto": "João Silva Atualizado",
    "email": "joao@example.com",
    "cpf": "123.456.789-00",
    "telefone": "(19) 99999-9999",
    "status": "ATIVO",
    "genero": "MASCULINO",
    "dataNasc": "1990-05-15",
    "descricao": "Desenvolvedor apaixonado por dados",
    "avatarUrl": "https://example.com/avatar.jpg",
    "criadoEm": "2025-01-15T08:00:00Z",
    "atualizadoEm": "2025-10-30T14:00:00Z",
    "ultimoLogin": "2025-10-30T10:00:00Z",
    "enderecos": [
      {
        "id": "addr123",
        "logradouro": "Rua das Flores, 456",
        "numero": "456",
        "bairro": "Centro",
        "cidade": "São Paulo",
        "estado": "SP",
        "cep": "01000-000",
        "criadoEm": "2025-01-15T08:00:00Z"
      }
    ],
    "redesSociais": {
      "linkedin": "https://linkedin.com/in/joaosilva",
      "instagram": null,
      "facebook": null,
      "youtube": null,
      "twitter": null,
      "tiktok": null
    }
  }
}
```

### Respostas de Erro

| Código | Descrição                                                            |
| ------ | -------------------------------------------------------------------- |
| 400    | ID inválido, senha curta, emails diferentes, confirmação obrigatória |
| 401    | Token ausente ou inválido                                            |
| 403    | Acesso negado (apenas ADMIN/MODERADOR)                               |
| 404    | Aluno não encontrado                                                 |
| 409    | Email já está em uso                                                 |
| 500    | Erro interno                                                         |

**Códigos de Erro Específicos (400):**

- `INVALID_EMAIL` - Formato de e-mail inválido
- `PASSWORD_TOO_SHORT` - Senha deve ter pelo menos 8 caracteres
- `PASSWORD_MISMATCH` - Senha e confirmarSenha devem ser iguais
- `PASSWORD_CONFIRMATION_REQUIRED` - Informe senha e confirmarSenha juntos

**Códigos de Erro Específicos (409):**

- `EMAIL_ALREADY_EXISTS` - Este e-mail já está em uso por outro usuário

---

## 4. Inscrever Aluno em uma Turma

### Endpoint

```
POST /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes
```

### Descrição

Inscreve um aluno em uma turma específica de um curso.

**AUTORIZAÇÕES ESPECIAIS (ADMIN/MODERADOR):**

- ✅ Podem inscrever alunos mesmo **após o término** do período de inscrição
- ✅ Podem inscrever alunos mesmo em turmas **sem vagas disponíveis**
- ✅ Logs automáticos de todas as ações privilegiadas

### Roles Permitidas

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

### Path Parameters

| Parâmetro | Tipo   | Descrição            | Exemplo                                  |
| --------- | ------ | -------------------- | ---------------------------------------- |
| `cursoId` | number | ID numérico do curso | `4`                                      |
| `turmaId` | string | ID da turma (UUID)   | `"8438a571-d7ca-4cf7-92d3-3cecf272c9a0"` |

### Body (JSON)

```json
{
  "alunoId": "0b89ee94-f3ab-4682-999b-36574f81751a"
}
```

### Validações Automáticas

- ✅ Verifica se curso existe
- ✅ Verifica se turma pertence ao curso
- ✅ Verifica se aluno existe e é do tipo ALUNO_CANDIDATO
- ✅ Verifica se aluno já está inscrito na turma
- ✅ Verifica período de inscrição (restringido para usuários sem privilégio)
- ✅ Verifica vagas disponíveis (restringido para usuários sem privilégio)

### Exemplo de Uso

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "alunoId": "0b89ee94-f3ab-4682-999b-36574f81751a"
  }' \
  "http://localhost:3000/api/v1/cursos/4/turmas/8438a571-d7ca-4cf7-92d3-3cecf272c9a0/inscricoes"
```

### Resposta de Sucesso (201 Created)

Retorna a turma completa com todas as informações atualizadas.

### Respostas de Erro

| Código | Descrição                                         |
| ------ | ------------------------------------------------- |
| 400    | Dados inválidos ou identificadores incorretos     |
| 401    | Token ausente ou inválido                         |
| 403    | Acesso negado                                     |
| 404    | Curso, turma ou aluno não encontrado              |
| 409    | Aluno já inscrito, sem vagas ou período encerrado |
| 500    | Erro interno                                      |

**Códigos de Erro Específicos (409):**

- `ALUNO_JA_INSCRITO` - Aluno já está inscrito nesta turma
- `SEM_VAGAS` - Não há vagas disponíveis (para usuários sem privilégio)
- `INSCRICOES_ENCERRADAS` - Período de inscrição encerrado (para usuários sem privilégio)

---

## 5. Remover Inscrição do Aluno

### Endpoint

```
DELETE /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes/{alunoId}
```

### Descrição

Remove a inscrição de um aluno de uma turma específica.

### Roles Permitidas

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

### Path Parameters

| Parâmetro | Tipo   | Descrição            | Exemplo                                  |
| --------- | ------ | -------------------- | ---------------------------------------- |
| `cursoId` | number | ID numérico do curso | `4`                                      |
| `turmaId` | string | ID da turma (UUID)   | `"8438a571-d7ca-4cf7-92d3-3cecf272c9a0"` |
| `alunoId` | string | ID do aluno (UUID)   | `"0b89ee94-f3ab-4682-999b-36574f81751a"` |

### Exemplo de Uso

```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/v1/cursos/4/turmas/8438a571-d7ca-4cf7-92d3-3cecf272c9a0/inscricoes/0b89ee94-f3ab-4682-999b-36574f81751a"
```

### Resposta de Sucesso (200 OK)

Retorna a turma atualizada após a remoção da inscrição.

### Respostas de Erro

| Código | Descrição                                 |
| ------ | ----------------------------------------- |
| 401    | Token ausente ou inválido                 |
| 403    | Acesso negado                             |
| 404    | Curso, turma ou inscrição não encontrados |
| 500    | Erro interno                              |

---

## 6. Aplicar Bloqueio ao Aluno

### Endpoint

```
POST /api/v1/usuarios/alunos/{userId}/bloqueios
```

### Descrição

Aplica bloqueio temporário ou permanente ao aluno. Registra o motivo, observações e histórico de auditoria.

### Roles Permitidas

- `ADMIN`
- `MODERADOR`

### Path Parameters

| Parâmetro | Tipo   | Descrição          | Exemplo                                  |
| --------- | ------ | ------------------ | ---------------------------------------- |
| `userId`  | string | ID do aluno (UUID) | `"0b89ee94-f3ab-4682-999b-36574f81751a"` |

### Body (JSON)

```json
{
  "tipo": "TEMPORARIO",
  "motivo": "VIOLACAO_POLITICAS",
  "dias": 30,
  "observacoes": "Uso indevido de dados pessoais."
}
```

### Tipos de Bloqueio

- `TEMPORARIO` - Bloqueio por período determinado (obrigatório informar `dias`)
- `PERMANENTE` - Bloqueio permanente
- `RESTRICAO_DE_RECURSO` - Restrição de acesso a recursos específicos

### Motivos de Bloqueio

- `SPAM`
- `VIOLACAO_POLITICAS`
- `FRAUDE`
- `ABUSO_DE_RECURSOS`
- `OUTROS`

### Exemplo de Uso

```bash
# Bloqueio temporário
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "TEMPORARIO",
    "motivo": "VIOLACAO_POLITICAS",
    "dias": 30,
    "observacoes": "Usuário violou políticas da plataforma"
  }' \
  "http://localhost:3000/api/v1/usuarios/alunos/0b89ee94-f3ab-4682-999b-36574f81751a/bloqueios"

# Bloqueio permanente
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "PERMANENTE",
    "motivo": "FRAUDE",
    "observacoes": "Fraude comprovada"
  }' \
  "http://localhost:3000/api/v1/usuarios/alunos/0b89ee94-f3ab-4682-999b-36574f81751a/bloqueios"
```

### Resposta de Sucesso (201 Created)

```json
{
  "bloqueio": {
    "id": "block123",
    "alvo": {
      "id": "0b89ee94-f3ab-4682-999b-36574f81751a",
      "nome": "João da Silva",
      "role": "ALUNO_CANDIDATO"
    },
    "bloqueio": {
      "tipo": "TEMPORARIO",
      "motivo": "VIOLACAO_POLITICAS",
      "status": "ATIVO",
      "inicio": "2025-10-30T15:00:00Z",
      "fim": "2025-11-29T15:00:00Z",
      "observacoes": "Usuário violou políticas da plataforma"
    },
    "aplicadoPor": {
      "id": "admin123",
      "nome": "Admin Silva",
      "role": "ADMIN"
    },
    "auditoria": {
      "criadoEm": "2025-10-30T15:00:00Z",
      "atualizadoEm": "2025-10-30T15:00:00Z"
    }
  }
}
```

### Respostas de Erro

| Código | Descrição                                             |
| ------ | ----------------------------------------------------- |
| 400    | Dados inválidos (ex: faltando `dias` para TEMPORARIO) |
| 401    | Token ausente ou inválido                             |
| 403    | Acesso negado                                         |
| 404    | Aluno não encontrado                                  |
| 500    | Erro interno                                          |

---

## 7. Revogar Bloqueio do Aluno

### Endpoint

```
POST /api/v1/usuarios/alunos/{userId}/bloqueios/revogar
```

### Descrição

Revoga o bloqueio ativo mais recente do aluno. Atualiza o status do usuário para `ATIVO` e registra a ação no histórico de auditoria.

### Roles Permitidas

- `ADMIN`
- `MODERADOR`

### Path Parameters

| Parâmetro | Tipo   | Descrição          | Exemplo                                  |
| --------- | ------ | ------------------ | ---------------------------------------- |
| `userId`  | string | ID do aluno (UUID) | `"0b89ee94-f3ab-4682-999b-36574f81751a"` |

### Body (JSON) - Opcional

```json
{
  "observacoes": "Aluno apresentou recurso e foi aceito"
}
```

### Exemplo de Uso

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "observacoes": "Aluno apresentou recurso e foi aceito"
  }' \
  "http://localhost:3000/api/v1/usuarios/alunos/0b89ee94-f3ab-4682-999b-36574f81751a/bloqueios/revogar"
```

### Resposta de Sucesso (200 OK)

```json
{
  "success": true,
  "message": "Bloqueio revogado com sucesso"
}
```

### Respostas de Erro

| Código | Descrição                              |
| ------ | -------------------------------------- |
| 401    | Token ausente ou inválido              |
| 403    | Acesso negado                          |
| 404    | Aluno ou bloqueio ativo não encontrado |
| 500    | Erro interno                           |

---

## 8. Listar Histórico de Bloqueios

### Endpoint

```
GET /api/v1/usuarios/alunos/{userId}/bloqueios
```

### Descrição

Lista o histórico completo de todos os bloqueios aplicados a um aluno, incluindo logs de auditoria.

### Roles Permitidas

- `ADMIN`
- `MODERADOR`

### Path Parameters

| Parâmetro | Tipo   | Descrição          | Exemplo                                  |
| --------- | ------ | ------------------ | ---------------------------------------- |
| `userId`  | string | ID do aluno (UUID) | `"0b89ee94-f3ab-4682-999b-36574f81751a"` |

### Query Parameters

| Parâmetro  | Tipo   | Obrigatório | Descrição                               |
| ---------- | ------ | ----------- | --------------------------------------- |
| `page`     | number | Não         | Número da página (padrão: 1)            |
| `pageSize` | number | Não         | Itens por página (padrão: 20, máx: 100) |

### Exemplo de Uso

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/v1/usuarios/alunos/0b89ee94-f3ab-4682-999b-36574f81751a/bloqueios?page=1&pageSize=20"
```

### Resposta de Sucesso (200 OK)

```json
{
  "data": [
    {
      "id": "block123",
      "alvo": {
        "id": "0b89ee94-f3ab-4682-999b-36574f81751a",
        "nome": "João da Silva",
        "role": "ALUNO_CANDIDATO"
      },
      "bloqueio": {
        "tipo": "TEMPORARIO",
        "motivo": "VIOLACAO_POLITICAS",
        "status": "REVOGADO",
        "inicio": "2025-10-30T15:00:00Z",
        "fim": "2025-11-29T15:00:00Z",
        "observacoes": "Usuário violou políticas da plataforma"
      },
      "aplicadoPor": {
        "id": "admin123",
        "nome": "Admin Silva",
        "role": "ADMIN"
      },
      "auditoria": {
        "criadoEm": "2025-10-30T15:00:00Z",
        "atualizadoEm": "2025-10-31T10:00:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### Respostas de Erro

| Código | Descrição                 |
| ------ | ------------------------- |
| 401    | Token ausente ou inválido |
| 403    | Acesso negado             |
| 404    | Aluno não encontrado      |
| 500    | Erro interno              |

---

## 🔄 Fluxo de Dados

### Exemplo Completo: Gerenciar Aluno

```bash
# 1. Listar alunos
GET /api/v1/cursos/alunos?page=1&limit=10

# 2. Buscar detalhes de um aluno específico
GET /api/v1/cursos/alunos/{alunoId}

# 3. Atualizar informações do aluno
PUT /api/v1/cursos/alunos/{alunoId}

# 4. Inscrever aluno em uma turma
POST /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes

# 5. Ver inscrições do aluno (detalhes)
GET /api/v1/cursos/alunos/{alunoId}

# 6. Aplicar bloqueio se necessário
POST /api/v1/usuarios/alunos/{userId}/bloqueios

# 7. Ver histórico de bloqueios
GET /api/v1/usuarios/alunos/{userId}/bloqueios

# 8. Revogar bloqueio se necessário
POST /api/v1/usuarios/alunos/{userId}/bloqueios/revogar

# 9. Remover inscrição se necessário
DELETE /api/v1/cursos/{cursoId}/turmas/{turmaId}/inscricoes/{alunoId}
```

---

## 📚 Documentação Completa

- **Swagger UI:** `http://localhost:3000/docs`
- **ReDoc:** `http://localhost:3000/redoc`

---

## 🔐 Matriz de Permissões

| Endpoint                                     | ADMIN | MODERADOR | PEDAGOGICO | INSTRUTOR |
| -------------------------------------------- | ----- | --------- | ---------- | --------- |
| GET /cursos/alunos                           | ✅    | ✅        | ✅         | ✅        |
| GET /cursos/alunos/:id                       | ✅    | ✅        | ✅         | ✅        |
| PUT /cursos/alunos/:id                       | ✅    | ✅        | ❌         | ❌        |
| POST /cursos/:id/turmas/:id/inscricoes       | ✅    | ✅        | ✅         | ✅        |
| DELETE /cursos/:id/turmas/:id/inscricoes/:id | ✅    | ✅        | ✅         | ✅        |
| POST /usuarios/alunos/:id/bloqueios          | ✅    | ✅        | ❌         | ❌        |
| POST /usuarios/alunos/:id/bloqueios/revogar  | ✅    | ✅        | ❌         | ❌        |
| GET /usuarios/alunos/:id/bloqueios           | ✅    | ✅        | ❌         | ❌        |

---

## 🎯 Cenários de Uso

### Cenário 1: Aluno Novo

```bash
# 1. Inscrever aluno em uma turma
POST /api/v1/cursos/4/turmas/{turmaId}/inscricoes

# 2. Verificar inscrição
GET /api/v1/cursos/alunos/{alunoId}

# 3. Atualizar perfil completo
PUT /api/v1/cursos/alunos/{alunoId}
```

### Cenário 2: Gerenciar Bloqueio

```bash
# 1. Aplicar bloqueio
POST /api/v1/usuarios/alunos/{userId}/bloqueios

# 2. Ver histórico
GET /api/v1/usuarios/alunos/{userId}/bloqueios

# 3. Revogar bloqueio
POST /api/v1/usuarios/alunos/{userId}/bloqueios/revogar
```

### Cenário 3: Inscrição Emergencial

```bash
# ADMIN inscreve aluno em turma cheia/encerrada
POST /api/v1/cursos/4/turmas/{turmaId}/inscricoes
# ✅ Ação permitida automaticamente (privilegiado)
```

---

## 📝 Notas Importantes

### 1. **Vagas Negativas**

Quando um ADMIN inscreve um aluno em uma turma sem vagas, o campo `vagasDisponiveis` fica **negativo**, indicando que a turma está em "overflow".

### 2. **Logs Automáticos**

Todas as ações privilegiadas (inscrições em turmas encerradas/cheias, bloqueios) são **logadas automaticamente** para auditoria.

### 3. **Cache**

Cache de usuário é **invalidado automaticamente** após:

- Atualização de informações
- Aplicação/revogação de bloqueios

### 4. **Transações Atômicas**

Todas as operações de banco de dados usam **transações Prisma** com rollback automático em caso de erro.

### 5. **Validação de Status**

O sistema valida automaticamente se o status de inscrição fornecido é válido, retornando `400 Bad Request` para valores inválidos.

---

**Data de Criação:** 30/10/2025  
**Versão:** 1.0.0  
**Desenvolvido por:** Sistema Advance+ AI Assistant
