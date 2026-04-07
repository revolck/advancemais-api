# Frontend — Instrutores vinculados na listagem de Turmas em `/dashboard/cursos/turmas`

## Status

Backend liberado.

Os perfis:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

agora recebem os instrutores vinculados corretamente na listagem de turmas.

---

## Problema corrigido

Antes, a listagem de turmas podia retornar a coluna `Instrutor` como `—` mesmo quando:

- a turma tinha `instrutorId` preenchido
- a turma tinha vínculos em `CursosTurmasInstrutores`
- o detalhe da turma já mostrava os instrutores corretamente

O backend agora normaliza esses dois cenários na resposta da listagem.

---

## Endpoint ajustado

### 1. Listagem de turmas por curso

`GET /api/v1/cursos/:cursoId/turmas`

Cada item da listagem agora traz:

- `instrutores[]` como fonte oficial
- `instrutor` como compatibilidade retroativa

### 2. Cursos com turmas embutidas

`GET /api/v1/cursos?includeTurmas=true`

Quando as turmas vierem embutidas no curso, o mesmo contrato é mantido.

---

## Contrato esperado por item da turma

Exemplo:

```json
{
  "id": "eae816da-d326-43b6-8206-65569a932956",
  "codigo": "TRUE4751",
  "nome": "E2E Turma Instrutor",
  "turno": "NOITE",
  "metodo": "ONLINE",
  "status": "PUBLICADO",
  "dataInicio": "2026-04-16T00:00:00.000Z",
  "dataFim": "2026-05-16T00:00:00.000Z",
  "vagasTotais": 30,
  "vagasOcupadas": 0,
  "instrutor": {
    "id": "0d68d45b-4a94-45c3-a224-a96952b0bca7",
    "codigo": "INS0001",
    "codUsuario": "INS0001",
    "nome": "Instrutor Maria Silva",
    "nomeCompleto": "Instrutor Maria Silva",
    "email": "instrutor@advancemais.com.br"
  },
  "instrutores": [
    {
      "id": "0d68d45b-4a94-45c3-a224-a96952b0bca7",
      "codigo": "INS0001",
      "codUsuario": "INS0001",
      "nome": "Instrutor Maria Silva",
      "nomeCompleto": "Instrutor Maria Silva",
      "email": "instrutor@advancemais.com.br"
    }
  ]
}
```

---

## Regras aplicadas no backend

- se a turma tiver `instrutorId`, ele entra no payload
- se a turma tiver vínculos em `CursosTurmasInstrutores`, todos entram no payload
- se o mesmo instrutor existir nos dois lugares, o backend deduplica
- `instrutor` representa o primeiro instrutor normalizado da turma
- `instrutores` sempre existe
- quando não houver instrutor vinculado:
  - `instrutor` vem como `null`
  - `instrutores` vem como `[]`

Campos mínimos por instrutor:

- `id`
- `nome`
- `nomeCompleto`
- `email`
- `codUsuario`

`codigo` também continua presente como compatibilidade.

---

## Consistência entre listagem e detalhe

Se esta rota:

- `GET /api/v1/cursos/:cursoId/turmas/:turmaId`

mostrar instrutores vinculados, a listagem da mesma turma agora reflete a mesma realidade.

Na prática:

- detalhe com `Instrutor Maria Silva`
- listagem com a mesma turma também exibindo `Instrutor Maria Silva`

---

## Impacto no frontend

O frontend pode manter o fluxo atual da tela.

Hoje a interface já:

- lê `instrutor`
- lê `instrutores[]`
- exibe resumo na coluna `Instrutor`
- mostra tooltip com todos os instrutores vinculados
- usa esse dado no filtro por instrutor

Não é necessário:

- criar endpoint novo
- complementar vínculo manualmente
- buscar detalhe da turma só para descobrir instrutor da listagem

---

## Cenários validados no backend

- turma com instrutor em `instrutorId`
- turma com múltiplos instrutores em `CursosTurmasInstrutores`
- deduplicação quando o mesmo instrutor existe no vínculo direto e na tabela intermediária
- turma com instrutor apenas na tabela intermediária
- turma sem instrutor
- consistência entre:
  - `GET /api/v1/cursos/:cursoId/turmas`
  - `GET /api/v1/cursos/:cursoId/turmas/:turmaId`
  - `GET /api/v1/cursos?includeTurmas=true`

---

## Checklist frontend

- [ ] continuar consumindo `GET /api/v1/cursos/:cursoId/turmas`
- [ ] usar `instrutores[]` como fonte principal da coluna `Instrutor`
- [ ] manter `instrutor` apenas como compatibilidade
- [ ] tratar `instrutor: null` e `instrutores: []` como turma sem instrutor
- [ ] não buscar detalhe da turma para preencher a listagem
- [ ] manter compatibilidade com turmas embutidas em `GET /api/v1/cursos?includeTurmas=true`
