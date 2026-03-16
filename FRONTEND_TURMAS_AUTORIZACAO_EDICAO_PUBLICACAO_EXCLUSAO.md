# Frontend — Turmas: Autorização, Publicação, Exclusão e Matrícula Tardia

## Objetivo

Documentar o contrato atual do backend para o módulo de turmas:

- `/dashboard/cursos/:cursoId/turmas`
- detalhe de turma
- alunos da turma
- publicar/despublicar
- exclusão lógica
- operação de instrutor em turma iniciada
- inclusão tardia de aluno

---

## Perfis

Perfis com gestão:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

Perfil com leitura operacional restrita:

- `INSTRUTOR`

---

## Regra por role

### `ADMIN`, `MODERADOR`, `PEDAGOGICO`

Podem:

- editar turma
- publicar turma
- despublicar turma
- excluir turma
- ver detalhe completo da turma
- ver histórico completo da turma

### `INSTRUTOR`

Pode:

- ver apenas turmas em que tenha vínculo real com conteúdo
- ver os alunos da turma vinculada
- ver visão geral da turma
- ver detalhe completo apenas dos próprios conteúdos
- ver histórico filtrado apenas para conteúdos vinculados a ele

Não pode:

- editar turma
- publicar turma
- despublicar turma
- excluir turma
- acessar detalhe de aula/prova/atividade de outro instrutor

---

## O que conta como vínculo do instrutor

A turma só aparece para o instrutor quando ele está vinculado a pelo menos um conteúdo da turma.

Exemplos aceitos no backend:

- aula da turma com `instrutorId = usuarioLogado.id`
- prova da turma com `instrutorId = usuarioLogado.id`
- atividade/avaliação da turma com `instrutorId = usuarioLogado.id`

Sem vínculo:

- `GET /api/v1/cursos/:cursoId/turmas/:turmaId` retorna `403 FORBIDDEN`
- a turma não aparece na listagem do instrutor
- histórico da turma não deve ser exibido

---

## Endpoints impactados

### 1) Listagem de turmas

`GET /api/v1/cursos/:cursoId/turmas`

- `INSTRUTOR` recebe apenas turmas vinculadas a ele
- turmas removidas logicamente não aparecem
- o frontend deve confiar no retorno da API, sem filtro local adicional de permissão

### 2) Detalhe da turma

`GET /api/v1/cursos/:cursoId/turmas/:turmaId`

- `INSTRUTOR` vinculado pode ver:
  - dados gerais
  - status
  - cronograma geral
  - alunos da turma
  - visão geral da estrutura
  - detalhe completo apenas do que é dele

- conteúdos de outros instrutores podem vir resumidos ou não aparecer
- turma removida logicamente se comporta como inexistente no fluxo padrão

### 3) Inscrições / alunos da turma

`GET /api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes`

- `INSTRUTOR` vinculado pode acessar
- usar essa rota para listagem de alunos da turma

### 4) Atualização da turma

`PUT /api/v1/cursos/:cursoId/turmas/:turmaId`

- permitido para `ADMIN`, `MODERADOR`, `PEDAGOGICO`
- `INSTRUTOR` recebe bloqueio de permissão
- `PEDAGOGICO` pode alterar turma já iniciada
- após o início, o backend bloqueia alteração de:
  - `dataInicio`
  - `dataFim`
  - `dataInscricaoInicio`
  - `dataInscricaoFim`

Erro esperado:

- `409 TURMA_PERIODO_BLOQUEADO_APOS_INICIO`

### 5) Publicar / despublicar turma

`PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar`

Body:

```json
{ "publicar": true }
```

ou

```json
{ "publicar": false }
```

Regras:

- `INSTRUTOR` não pode chamar esse fluxo
- ao publicar, o backend exige pré-requisitos de conteúdo
- ao despublicar, o backend bloqueia se:
  - a turma já estiver em andamento/iniciada
  - a turma tiver inscritos ativos

Erros esperados:

- `422 TURMA_PREREQUISITOS_NAO_ATENDIDOS`
- `409 TURMA_DESPUBLICACAO_BLOQUEADA_EM_ANDAMENTO`
- `409 TURMA_DESPUBLICACAO_BLOQUEADA_COM_INSCRITOS`

Quando houver sucesso, usar o `data` retornado como fonte da verdade para status final.

### 6) Excluir turma

`DELETE /api/v1/cursos/:cursoId/turmas/:turmaId`

Regra atual:

- exclusão é lógica (`soft delete`)
- só gestão (`ADMIN`, `MODERADOR`, `PEDAGOGICO`)
- não pode excluir se a turma já iniciou
- não pode excluir se houver inscritos

Resposta de sucesso:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "removidoEm": "2026-03-11T15:14:46.000Z",
    "removidoPorId": "uuid"
  }
}
```

Após exclusão:

- a turma deixa de aparecer nas listagens padrão
- o detalhe padrão da turma deixa de funcionar como item ativo
- rotas públicas também deixam de expor essa turma

Erros esperados:

- `409 TURMA_EXCLUSAO_BLOQUEADA_JA_INICIADA`
- `409 TURMA_EXCLUSAO_BLOQUEADA_COM_INSCRITOS`

### 7) Incluir aluno na turma

`POST /api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes`

Body:

```json
{
  "alunoId": "uuid",
  "prazoAdaptacaoDias": 7
}
```

Observações:

- `prazoAdaptacaoDias` é opcional
- mínimo `1`, máximo `90`
- se omitido, o backend usa fallback padrão

---

## Regras para conteúdos em turma iniciada

### `INSTRUTOR`

Não pode criar em turma iniciada:

- aula
- prova
- atividade/avaliação

Erro esperado:

- `409 INSTRUTOR_NAO_PODE_CRIAR_CONTEUDO_EM_TURMA_INICIADA`

### `PEDAGOGICO`

Pode:

- alterar turma iniciada
- adicionar aula/prova/atividade em turma iniciada
- reagendar conteúdo

Quando isso acontece, o backend tenta notificar os alunos automaticamente.

---

## Notificações em turma iniciada

Quando o `PEDAGOGICO` altera uma turma já iniciada e existem inscritos ativos, o backend pode disparar notificação para os alunos.

Exemplos:

- nova aula adicionada
- nova atividade adicionada
- nova prova adicionada
- cronograma alterado

O frontend não precisa montar a notificação. Precisa apenas refletir que a alteração foi aceita.

---

## Inclusão tardia de aluno

Quando um aluno entra em turma já iniciada:

- o backend cria liberação individual para conteúdos já existentes
- isso vale para aulas e provas/atividades já cadastradas
- o frontend não deve assumir que aluno novo só verá conteúdo futuro

Regra prática:

- conteúdos antigos podem aparecer disponíveis para esse aluno por janela individual
- essa janela pode ser diferente do prazo original da turma

---

## Regras de UI no detalhe da turma

### Se o usuário for `INSTRUTOR`

- mostrar visão geral da turma
- mostrar alunos da turma
- mostrar detalhe completo apenas dos conteúdos vinculados a ele
- não assumir acesso total aos conteúdos de outros instrutores

### Se tentar abrir conteúdo não vinculado

Tratar `403 FORBIDDEN` com mensagem como:

`Você não tem permissão para acessar este conteúdo.`

### Se a turma foi removida logicamente

Tratar como item indisponível:

- redirecionar para listagem, ou
- mostrar estado de não encontrado / indisponível

---

## Erros esperados

- `403 FORBIDDEN`
- `404 TURMA_NOT_FOUND`
- `422 TURMA_PREREQUISITOS_NAO_ATENDIDOS`
- `409 TURMA_PERIODO_BLOQUEADO_APOS_INICIO`
- `409 TURMA_EXCLUSAO_BLOQUEADA_JA_INICIADA`
- `409 TURMA_EXCLUSAO_BLOQUEADA_COM_INSCRITOS`
- `409 TURMA_DESPUBLICACAO_BLOQUEADA_EM_ANDAMENTO`
- `409 TURMA_DESPUBLICACAO_BLOQUEADA_COM_INSCRITOS`
- `409 INSTRUTOR_NAO_PODE_CRIAR_CONTEUDO_EM_TURMA_INICIADA`

---

## Checklist frontend

- [ ] `INSTRUTOR` não deve ver botão de editar/publicar/despublicar/excluir turma
- [ ] listagem de turmas do instrutor deve confiar no retorno da API
- [ ] detalhe da turma deve aceitar visão geral + conteúdos próprios
- [ ] detalhe de conteúdo de outro instrutor deve tratar `403`
- [ ] campos de período da turma devem ficar bloqueados na UI quando a turma já iniciou
- [ ] publicação/despublicação deve usar o `data` retornado pela API como estado final
- [ ] tela de exclusão deve tratar bloqueios `409`
- [ ] tela de despublicação deve tratar bloqueios `409`
- [ ] criação de aula/prova/atividade por instrutor em turma iniciada deve tratar `409`
- [ ] alunos da turma devem continuar visíveis para instrutor vinculado
- [ ] matrícula tardia deve aceitar `prazoAdaptacaoDias` quando necessário
- [ ] após exclusão lógica, remover a turma da UI local e voltar para a listagem

---

## Status de validação

Validado no backend com:

- `src/__tests__/api/turmas-autorizacao-operacao.e2e.test.ts`
- `src/__tests__/api/turmas-historico-routes.test.ts`

Resultado atual:

- `24` testes passando
