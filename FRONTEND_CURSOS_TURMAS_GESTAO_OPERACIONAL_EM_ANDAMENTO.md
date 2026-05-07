# Frontend — Turmas: vínculo de instrutores e gestão operacional em `EM_ANDAMENTO`

## Status

Backend liberado.

Agora o frontend já pode:

- enviar `instrutorIds[]` na criação da turma
- sincronizar instrutores vinculados da turma por endpoint dedicado
- adicionar nova `AULA`, `PROVA` ou `ATIVIDADE` na estrutura da turma sem reabrir a edição completa

Rotas impactadas:

- `/dashboard/cursos/turmas/cadastrar`
- `/dashboard/cursos/turmas/:turmaId?cursoId=:cursoId`

---

## Perfis permitidos

### Criação de turma

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

### Gestão operacional da turma em andamento

- `PEDAGOGICO`

Perfis sem acesso:

- `INSTRUTOR`
- demais papéis não acadêmicos

Observação:

- `ADMIN` e `MODERADOR` continuam podendo criar e editar turma antes do início
- após início da turma, os endpoints operacionais novos ficam restritos ao `PEDAGOGICO`

---

## Parte 1 — Criação de turma com instrutores vinculados

### Endpoint

`POST /api/v1/cursos/:cursoId/turmas`

### Payload aceito

O payload da turma pode enviar:

- `instrutorIds?: string[]`

Exemplo:

```json
{
  "nome": "Turma 2 - Gestão de Projetos Ágeis",
  "turno": "NOITE",
  "metodo": "ONLINE",
  "dataInscricaoInicio": "2026-04-10",
  "dataInscricaoFim": "2026-04-20",
  "dataInicio": "2026-04-25",
  "dataFim": "2026-06-25",
  "vagasTotais": 30,
  "vagasIlimitadas": false,
  "status": "RASCUNHO",
  "estruturaTipo": "DINAMICA",
  "instrutorIds": ["0d68d45b-4a94-45c3-a224-a96952b0bca7", "6ed9647a-59d7-4fb7-b05d-8d70f8855e6a"],
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  }
}
```

### Regras aplicadas

- `instrutorIds` é opcional
- ids duplicados são deduplicados
- apenas usuários com `role = INSTRUTOR` e `status = ATIVO` são aceitos
- `instrutor` continua existindo como compatibilidade
- `instrutor` passa a refletir o primeiro instrutor normalizado
- `instrutores[]` é a fonte oficial da turma

### Resposta

O retorno da criação já vem normalizado com:

- `instrutor`
- `instrutores[]`

---

## Parte 2 — Sincronização de instrutores da turma

### Endpoint

`PUT /api/v1/cursos/:cursoId/turmas/:turmaId/instrutores`

### Payload

```json
{
  "instrutorIds": ["0d68d45b-4a94-45c3-a224-a96952b0bca7", "6ed9647a-59d7-4fb7-b05d-8d70f8855e6a"]
}
```

### Semântica

- a operação é idempotente
- o backend substitui o conjunto atual pelo conjunto enviado
- se vier `[]`, remove todos os vínculos institucionais da turma
- a resposta devolve a turma atualizada com `instrutor` e `instrutores[]`

### Regra crítica

Esse endpoint altera apenas o vínculo institucional da turma.

Ele não:

- reescreve retroativamente `instrutorId` de `AULA`
- reescreve retroativamente `instrutorId` de `PROVA`
- reescreve retroativamente `instrutorId` de `ATIVIDADE`

Ou seja:

- dono explícito do item continua preservado
- frequência, notas e escopo do instrutor continuam respeitando o dono da origem

### Com turma em andamento

Para turma em `EM_ANDAMENTO`:

- permitido apenas para `PEDAGOGICO`
- `ADMIN` e `MODERADOR` recebem `403 FORBIDDEN`

---

## Parte 3 — Adicionar item na estrutura da turma

### Endpoint

`POST /api/v1/cursos/:cursoId/turmas/:turmaId/estrutura/itens`

### Tipos suportados

- `AULA`
- `PROVA`
- `ATIVIDADE`

### Payload

Exemplo para aula avulsa:

```json
{
  "type": "AULA",
  "placement": {
    "moduleId": null,
    "afterItemId": null
  },
  "item": {
    "titulo": "Aula extra de revisão",
    "descricao": "Revisão dos tópicos mais críticos",
    "modalidade": "ONLINE",
    "status": "PUBLICADA",
    "dataInicio": "2026-05-05",
    "horaInicio": "19:00",
    "horaFim": "21:00",
    "obrigatoria": true,
    "instrutorIds": ["0d68d45b-4a94-45c3-a224-a96952b0bca7"]
  }
}
```

Exemplo para prova em módulo:

```json
{
  "type": "PROVA",
  "placement": {
    "moduleId": "2dd3f1d3-89dd-4f2c-aea8-3d95a0aaf8fd",
    "afterItemId": null
  },
  "item": {
    "titulo": "Prova complementar",
    "descricao": "Avaliação complementar da turma",
    "status": "PUBLICADA",
    "dataInicio": "2026-05-12",
    "horaInicio": "19:00",
    "horaTermino": "20:00",
    "obrigatoria": true,
    "valePonto": true,
    "peso": 2,
    "instrutorIds": ["0d68d45b-4a94-45c3-a224-a96952b0bca7"]
  }
}
```

### Resposta

```json
{
  "success": true,
  "data": {
    "item": {
      "id": "f3bc59a0-b0f1-4208-b181-cd2f0e3e6721",
      "type": "AULA",
      "title": "Aula extra de revisão",
      "ordem": 8,
      "startDate": "2026-05-05T19:00:00.000Z",
      "endDate": "2026-05-05T21:00:00.000Z",
      "instructorIds": ["0d68d45b-4a94-45c3-a224-a96952b0bca7"]
    },
    "turma": {
      "id": "2aa198a1-9a66-40b0-8a43-2d58b173dca1",
      "estruturaTipo": "DINAMICA",
      "estrutura": {
        "modules": [],
        "standaloneItems": []
      }
    }
  }
}
```

### Regras operacionais

- a criação já nasce anexada à estrutura da turma
- o backend calcula `ordem` e posicionamento no mesmo fluxo
- o item novo pode ser criado em módulo ou como item avulso
- em estrutura `MODULAR`, `moduleId` é obrigatório
- em estrutura `PADRAO`, `moduleId` não pode ser enviado

### Regras obrigatórias em `EM_ANDAMENTO`

- permitido apenas para `PEDAGOGICO`
- o novo item não pode nascer em data passada
- o backend bloqueia inserção que empurre conteúdo já realizado
- quando `afterItemId` implicar inserir antes de item já executado, a API retorna `409 TURMA_OPERACAO_NAO_PERMITIDA`
- o append preserva o histórico já existente da turma

### Regra de escopo do instrutor

Se o novo item for criado com dono explícito:

- `instrutorId`
- `instrutorIds[]`

o backend usa o primeiro instrutor normalizado como dono da origem.

Isso mantém a regra já vigente de escopo:

- dono explícito da `AULA`, `PROVA` ou `ATIVIDADE` prevalece
- vínculo amplo de `TURMA` ou `CURSO` não invade item com outro instrutor dono

---

## Contrato prático para o frontend

### Cadastro de turma

Na `step 2`, o frontend já pode:

- exibir multi-select de instrutores
- enviar `instrutorIds[]` no `POST` da turma

### Aba `Instrutores` no detalhe

O frontend pode:

- abrir modal simples de multi-seleção
- enviar `PUT /api/v1/cursos/:cursoId/turmas/:turmaId/instrutores`

### Ações operacionais no detalhe

O frontend pode expor:

- `Gerenciar instrutores`
- `Nova aula`
- `Nova atividade/prova`

Sem reabrir a edição completa da turma.

---

## Invalidação recomendada no frontend

Após sucesso em qualquer mutação acima, invalidar:

- detalhe da turma
- listagem de turmas
- estrutura da turma
- queries correlatas de agenda, overview, frequência e notas quando aplicável

---

## Tratamento de erros

Erros esperados:

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 TURMA_OPERACAO_NAO_PERMITIDA`
- `422 VALIDATION_ERROR`
- `500 TURMA_STRUCTURE_APPEND_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "TURMA_OPERACAO_NAO_PERMITIDA",
  "message": "Nao e possivel inserir item em posicao anterior a conteudo ja realizado."
}
```

---

## Checklist frontend

- [ ] adicionar multi-select de instrutores na `step 2` do cadastro de turma
- [ ] enviar `instrutorIds[]` na criação
- [ ] exibir `instrutor` e `instrutores[]` retornados pela API
- [ ] criar modal de gestão de instrutores na aba `Instrutores`
- [ ] usar `PUT /api/v1/cursos/:cursoId/turmas/:turmaId/instrutores`
- [ ] criar ações operacionais no detalhe:
- [ ] `Gerenciar instrutores`
- [ ] `Nova aula`
- [ ] `Nova atividade/prova`
- [ ] usar `POST /api/v1/cursos/:cursoId/turmas/:turmaId/estrutura/itens`
- [ ] invalidar queries da turma após mutações
- [ ] não reabrir edição completa da turma como solução para operação em `EM_ANDAMENTO`
