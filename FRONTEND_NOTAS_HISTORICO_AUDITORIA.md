# Frontend — Histórico de Notas

## Objetivo

Documentar o contrato de auditoria/histórico para notas no dashboard:

- `/dashboard/cursos/notas`

Foco:

- histórico imutável de inclusão, edição e exclusão de notas manuais
- rota para timeline por nota
- dados de ator, data/hora e antes/depois

---

## Escopo atual

O backend audita notas manuais nas ações:

- `NOTA_MANUAL_ADICIONADA`
- `NOTA_MANUAL_ATUALIZADA`
- `NOTA_MANUAL_EXCLUIDA`

Isso cobre:

- criação manual de nota
- edição de nota manual
- exclusão individual de nota manual
- exclusão em lote de lançamentos manuais por aluno

Notas automáticas do sistema continuam bloqueadas para edição/exclusão.

---

## Endpoint de histórico

`GET /api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId/historico`

### Perfis com acesso

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

### Erros esperados

- `400 VALIDATION_ERROR`
- `404 NOTA_NOT_FOUND`
- `500 NOTA_HISTORICO_ERROR`

---

## Identificador vindo da listagem

Os endpoints de listagem:

- `GET /api/v1/cursos/notas`
- `GET /api/v1/cursos/:cursoId/notas`

agora retornam, por item:

```json
{
  "notaId": "uuid-ou-null",
  "historicoNotaId": "uuid-ou-null",
  "historicoDisponivel": true
}
```

### Regra dos campos

- `notaId`
  - id da nota manual atual associada ao item
  - pode vir `null` se a nota manual já foi excluída e o item estiver sendo exibido só pela inscrição/consolidação

- `historicoNotaId`
  - id estável para abrir a auditoria oficial
  - usar este campo para chamar `GET /historico`
  - continua disponível mesmo após exclusão da nota manual

- `historicoDisponivel`
  - indica se existe timeline oficial para o item
  - se `false`, não exibir ação de histórico oficial

---

## Resposta

```json
{
  "success": true,
  "data": {
    "notaId": "uuid",
    "items": [
      {
        "id": "uuid-log",
        "acao": "NOTA_MANUAL_ATUALIZADA",
        "dataHora": "2026-03-18T14:20:00.000Z",
        "ator": {
          "id": "uuid-usuario",
          "nome": "Maria Souza",
          "role": "PEDAGOGICO",
          "roleLabel": "Setor Pedagógico"
        },
        "descricao": "Nota manual atualizada para inscrição ...",
        "dadosAnteriores": {
          "notaId": "uuid",
          "cursoId": "uuid",
          "turmaId": "uuid",
          "inscricaoId": "uuid",
          "alunoId": "uuid",
          "tipo": "BONUS",
          "provaId": null,
          "referenciaExterna": "OUTRO",
          "titulo": "Ajuste",
          "descricao": "Histórico",
          "nota": 0.1,
          "peso": null,
          "valorMaximo": null,
          "dataReferencia": "2026-03-18T14:00:00.000Z",
          "observacoes": null,
          "criadoEm": "2026-03-18T14:00:00.000Z",
          "atualizadoEm": "2026-03-18T14:00:00.000Z"
        },
        "dadosNovos": {
          "notaId": "uuid",
          "cursoId": "uuid",
          "turmaId": "uuid",
          "inscricaoId": "uuid",
          "alunoId": "uuid",
          "tipo": "BONUS",
          "provaId": null,
          "referenciaExterna": "OUTRO",
          "titulo": "Ajuste",
          "descricao": "Histórico",
          "nota": 0.2,
          "peso": null,
          "valorMaximo": null,
          "dataReferencia": "2026-03-18T14:00:00.000Z",
          "observacoes": "Ajuste confirmado",
          "criadoEm": "2026-03-18T14:00:00.000Z",
          "atualizadoEm": "2026-03-18T14:20:00.000Z"
        }
      }
    ]
  }
}
```

---

## Comportamento importante

- o histórico continua disponível mesmo depois da nota ter sido excluída
- em exclusão:
  - `dadosAnteriores` vem preenchido
  - `dadosNovos` vem `null`
- em criação:
  - `dadosAnteriores` vem `null`
  - `dadosNovos` vem preenchido
- em exclusão em lote, cada nota recebe seu próprio evento `NOTA_MANUAL_EXCLUIDA`

---

## Fluxo recomendado no frontend

### 1) Tela de notas

Na listagem principal, manter a visualização atual de notas.

Quando o usuário quiser auditoria detalhada:

- abrir drawer/modal lateral
- buscar `GET /historico` usando `historicoNotaId`
- renderizar timeline ordenada por `dataHora` desc

### 2) Timeline sugerida

Cada item da timeline pode mostrar:

- ação
- nome do ator
- `roleLabel`
- data/hora
- resumo da mudança

Exemplos:

- `Administrador adicionou nota manual`
- `Setor Pedagógico atualizou a nota de 0.1 para 0.2`
- `Moderador removeu a nota manual`

### 3) Diff simples

Para `NOTA_MANUAL_ATUALIZADA`, comparar principalmente:

- `nota`
- `titulo`
- `descricao`
- `observacoes`
- `dataReferencia`

### 4) Exclusão

Mesmo que a nota manual já tenha sido removida:

- o item da listagem pode continuar com `notaId = null`
- mas `historicoNotaId` deve continuar preenchido
- o frontend deve usar `historicoNotaId` como fonte da verdade para a modal

---

## Regras já existentes que o frontend deve manter

- notas automáticas do sistema não devem exibir ação de editar/excluir
- notas manuais podem exibir editar/excluir
- ao excluir em lote, a UI pode atualizar a lista local, mas o histórico continua acessível por `historicoNotaId`

---

## Exemplo de consumo

```ts
const response = await api.get(
  `/api/v1/cursos/${cursoId}/turmas/${turmaId}/notas/${historicoNotaId}/historico`,
);

const historico = response.data?.data?.items ?? [];
```

---

## Checklist frontend

- [ ] Adicionar ação `Ver histórico` para notas manuais
- [ ] Consumir `GET /historico` usando `historicoNotaId`
- [ ] Exibir ator, role, data/hora e descrição
- [ ] Exibir diff simples usando `dadosAnteriores` e `dadosNovos`
- [ ] Suportar histórico após exclusão da nota
- [ ] Não depender do fallback local para montar a timeline oficial
