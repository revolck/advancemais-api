# PRD — Exclusão de Curso (v1)

## 1) Contexto

Hoje `DELETE /api/v1/cursos/:cursoId` está sendo usado como **despublicar** (status para rascunho). Agora precisamos de uma rota de **exclusão de curso** com regras de segurança e integridade.

## 2) Problema

Precisamos permitir exclusão de curso apenas quando:

- não houver turmas vinculadas; ou
- todas as turmas vinculadas estiverem finalizadas.

E manter histórico/dados vinculados sem perda indevida.

## 3) Objetivo

Criar exclusão de curso segura, auditável e sem quebrar contratos atuais.

## 4) Não objetivos

- Não alterar a semântica da rota atual de despublicação.
- Não remover histórico de auditoria.

## 5) Regra de negócio

- Pode excluir curso se `turmasCount = 0`.
- Se existir qualquer turma vinculada (independente do status), bloquear exclusão.
- Em caso de bloqueio, o fluxo correto é **despublicar/arquivar** o curso (não excluir).

## 6) Decisão técnica recomendada (importante)

**Recomendação: Soft delete do curso**.

Motivo:

- O schema atual tem várias relações com `onDelete: Cascade` e FKs obrigatórias.
- Fazer “hard delete + set null em tudo” exigiria tornar várias FKs opcionais e trocar para `onDelete: SetNull`, com alto risco de regressão.
- Soft delete preserva integridade, histórico e evita apagamento em cascata.

## 7) Comportamento esperado

- Nova rota exclusiva para exclusão lógica.
- Curso marcado como excluído (`deletedAt`, `deletedById`, `statusPadrao=RASCUNHO` opcional) **somente quando não tiver turmas**.
- Curso não aparece nas listagens padrão (exceto com filtro explícito de admin).
- Dados vinculados continuam íntegros, sem precisar setar `null` em massa.

## 8) API proposta

### 8.1 Nova rota

`DELETE /api/v1/cursos/:cursoId/exclusao-definitiva`

### 8.2 Permissões

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`

### 8.3 Resposta sucesso

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "excluidoEm": "2026-03-05T15:10:00.000Z",
    "excluidoPorId": "uuid"
  }
}
```

### 8.4 Erros

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 CURSO_NOT_FOUND`
- `409 CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS`

### 8.5 Exemplo de bloqueio

```json
{
  "success": false,
  "code": "CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS",
  "message": "Não é possível excluir curso com turmas vinculadas. Use despublicar/arquivar.",
  "details": [
    {
      "id": "uuid-turma",
      "codigo": "DEV-FULL-T1",
      "nome": "Turma 1",
      "status": "EM_ANDAMENTO"
    }
  ]
}
```

## 9) Ajustes de dados (se adotarmos soft delete)

### 9.1 Tabela `Cursos`

Adicionar colunas:

- `deletedAt DateTime?`
- `deletedById String?`

### 9.2 Query padrão

Todos os `findMany/findFirst` de cursos devem filtrar:

- `deletedAt = null`

No admin, opcionalmente aceitar:

- `incluirExcluidos=true`

## 10) Auditoria

Registrar evento:

- `CURSO_EXCLUIDO_LOGICAMENTE`
- ator, data/hora, IP, user-agent, motivo (opcional)

## 11) Compatibilidade

- Manter rota atual `DELETE /api/v1/cursos/:cursoId` como despublicar.
- Frontend decide qual ação chamar:
  - despublicar: rota atual
  - excluir: nova rota

## 12) Critérios de aceite

- Exclusão só ocorre se não houver turmas vinculadas.
- Curso excluído não aparece em listagens padrão.
- Integridade referencial preservada sem apagar registros filhos.
- Retornos de erro claros para frontend.
- Auditoria registrada.

## 13) Testes E2E mínimos

- Excluir curso sem turmas: sucesso.
- Excluir curso com turmas concluídas: `409`.
- Excluir curso com turma em andamento: `409`.
- Usuário sem permissão: `403`.
- Curso excluído não aparece em `GET /api/v1/cursos` padrão.

## 14) Plano de rollout

1. Migration com colunas de soft delete em `Cursos`.
2. Criar nova rota de exclusão lógica.
3. Ajustar listagens/detalhe para ignorar excluídos por padrão.
4. Atualizar frontend com botão separado “Excluir curso”.
5. Ativar auditoria e monitorar logs.

## 15) Decisão fechada

A exclusão de curso é permitida apenas quando não há turmas vinculadas.
Se houver qualquer turma (inclusive `CONCLUIDO` ou `CANCELADO`), o curso não pode ser excluído e deve seguir fluxo de despublicação/arquivamento.
