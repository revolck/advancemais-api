# PRD — Notas: Histórico e Auditoria de Alterações

## 1) Contexto

A tela de notas em:

- `/dashboard/cursos/notas`
- `/dashboard/cursos/:cursoId/turmas/:turmaId/notas`

precisa manter histórico confiável das alterações feitas nas notas.

Hoje o requisito de negócio é claro:

- quando uma nota for adicionada, editada ou excluída
- deve ficar registrado quem fez
- quando fez
- o que foi alterado
- e esse histórico deve permanecer, mesmo após exclusão da nota

---

## 2) Problema atual

Pelo estado atual do backend:

- já existe log para `NOTA_MANUAL_ADICIONADA` em `AuditoriaLogs`
- não há contrato fechado para histórico de `edição` e `exclusão`
- não há rota dedicada para o frontend consultar histórico de uma nota
- exclusão hoje remove a nota, mas não garante trilha completa e padronizada para consulta na UI

Resultado:

- o frontend não consegue exibir uma linha do tempo confiável de alterações de nota
- auditoria fica parcial

---

## 3) Objetivo

Garantir histórico imutável e consultável para notas manuais, cobrindo:

- criação
- edição
- exclusão individual
- exclusão em lote de lançamentos manuais

Esse histórico deve continuar disponível mesmo que a nota original tenha sido removida.

---

## 4) Escopo

Entram neste PRD:

- `POST /api/v1/cursos/:cursoId/turmas/:turmaId/notas`
- `PUT /api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId`
- `DELETE /api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId`
- `DELETE /api/v1/cursos/:cursoId/turmas/:turmaId/notas?alunoId=uuid`
- nova leitura de histórico para frontend

Fora de escopo nesta versão:

- reverter alteração de nota via histórico
- versionamento completo de notas automáticas geradas por cálculo do sistema

---

## 5) Regras de negócio

### 5.1 Eventos que devem gerar histórico

Toda nota manual deve registrar histórico em:

- criação
- atualização
- exclusão
- exclusão em lote

### 5.2 O histórico deve sobreviver à exclusão

Mesmo após `DELETE`, o histórico da nota deve continuar acessível.

Isso exclui depender apenas da tabela da nota como fonte do histórico.

### 5.3 O histórico deve ser imutável

Depois que um evento de auditoria for gravado:

- não pode ser editado
- não pode ser sobrescrito
- cada ação gera um novo item na linha do tempo

### 5.4 O histórico precisa mostrar ator e data/hora

Cada item deve conter no mínimo:

- `usuarioId`
- nome do usuário
- role do usuário
- data/hora da ação
- ação executada

### 5.5 O histórico precisa mostrar antes/depois

Para atualização, deve registrar:

- valores anteriores
- valores novos

Campos recomendados:

- `nota`
- `titulo`
- `descricao`
- `referenciaExterna`
- `dataReferencia`
- `observacoes`
- `tipo`
- `provaId`

### 5.6 Exclusão em lote

Quando houver limpeza de lançamentos manuais por aluno:

`DELETE /api/v1/cursos/:cursoId/turmas/:turmaId/notas?alunoId=uuid`

recomendação:

- registrar um evento por nota removida, para manter granularidade
- opcionalmente registrar também um evento agregador de lote

---

## 6) Modelo de persistência recomendado

### Opção recomendada: continuar usando `AuditoriaLogs`

Vantagens:

- já existe no projeto
- já está sendo usado em `NOTA_MANUAL_ADICIONADA`
- resolve sobrevivência do histórico após exclusão da nota

### Ações novas sugeridas

Padronizar os seguintes `acao`:

- `NOTA_MANUAL_ADICIONADA`
- `NOTA_MANUAL_ATUALIZADA`
- `NOTA_MANUAL_EXCLUIDA`
- `NOTA_MANUAL_EXCLUSAO_EM_LOTE`

### Convenção sugerida

- `categoria`: `CURSO`
- `tipo`: `CURSO_NOTA`
- `entidadeTipo`: `CURSO_NOTA`
- `entidadeId`: `notaId`

### Estrutura recomendada em `dadosAnteriores` e `dadosNovos`

#### Criação

- `dadosAnteriores = null`
- `dadosNovos = payload final salvo`

#### Edição

- `dadosAnteriores = snapshot antes do update`
- `dadosNovos = snapshot após o update`

#### Exclusão

- `dadosAnteriores = snapshot completo antes do delete`
- `dadosNovos = null`

---

## 7) Contrato de leitura para o frontend

### Nova rota recomendada

`GET /api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId/historico`

### Permissões recomendadas

Mesma política de acesso da área de notas:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR` com acesso válido à turma/conteúdo

### Resposta esperada

```json
{
  "success": true,
  "data": {
    "notaId": "uuid",
    "items": [
      {
        "id": "audit-log-id",
        "acao": "NOTA_MANUAL_ADICIONADA",
        "dataHora": "2026-03-17T14:30:00.000Z",
        "ator": {
          "id": "uuid",
          "nome": "João Silva",
          "role": "PEDAGOGICO",
          "roleLabel": "Setor Pedagógico"
        },
        "descricao": "Nota manual adicionada",
        "dadosAnteriores": null,
        "dadosNovos": {
          "nota": 1.5,
          "motivo": "Participação extra"
        }
      },
      {
        "id": "audit-log-id-2",
        "acao": "NOTA_MANUAL_EXCLUIDA",
        "dataHora": "2026-03-18T10:15:00.000Z",
        "ator": {
          "id": "uuid-2",
          "nome": "Maria Souza",
          "role": "ADMIN",
          "roleLabel": "Administrador"
        },
        "descricao": "Nota manual removida",
        "dadosAnteriores": {
          "nota": 1.5,
          "motivo": "Participação extra"
        },
        "dadosNovos": null
      }
    ]
  }
}
```

### Ordenação

- mais recente primeiro no backend, ou
- crescente por data/hora se a UI preferir timeline

Recomendação:

- backend devolver `desc`
- frontend decide inverter visualmente se quiser timeline cronológica

---

## 8) Endpoints impactados

### Criar nota manual

`POST /api/v1/cursos/:cursoId/turmas/:turmaId/notas`

Novo comportamento:

- além de salvar a nota, registrar `NOTA_MANUAL_ADICIONADA`
- manter snapshot do valor salvo

### Atualizar nota manual

`PUT /api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId`

Novo comportamento:

- registrar `NOTA_MANUAL_ATUALIZADA`
- salvar antes/depois

### Excluir nota manual

`DELETE /api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId`

Novo comportamento:

- registrar `NOTA_MANUAL_EXCLUIDA` antes do delete físico
- manter snapshot completo em auditoria

### Limpar lançamentos manuais por aluno

`DELETE /api/v1/cursos/:cursoId/turmas/:turmaId/notas?alunoId=uuid`

Novo comportamento:

- registrar histórico de cada nota removida
- opcional: registrar evento agregador do lote

---

## 9) Regras de UI

No frontend, a tela de notas deve conseguir mostrar:

- quem adicionou a nota
- quem editou a nota
- quem excluiu a nota
- data e hora de cada ação
- diferença entre valor anterior e valor novo

### Exemplo de uso no frontend

Na listagem ou no detalhe da nota:

- botão `Ver histórico`
- modal ou drawer com timeline

### Exibição mínima recomendada

Cada item da timeline deve mostrar:

- ação
- ator
- data/hora
- resumo da mudança

Exemplos:

- `João Silva adicionou nota 1,5 em 17/03/2026 às 14:30`
- `Maria Souza alterou nota de 1,5 para 2,0 em 18/03/2026 às 09:10`
- `Carlos Lima excluiu a nota em 18/03/2026 às 10:15`

---

## 10) Erros esperados

### Leitura do histórico

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 NOTA_NOT_FOUND`
- `500 NOTA_HISTORICO_ERROR`

### Escrita com auditoria

Se a operação principal funcionar, a auditoria não deve derrubar a ação do usuário apenas se a política do produto permitir isso.

Decisão recomendada:

- para notas, auditoria deve ser transacional
- se não conseguir gravar histórico, falhar a operação

Motivo:

- nota é dado sensível acadêmico
- não vale aceitar alteração sem trilha de auditoria

---

## 11) Critérios de aceite

- [ ] Criar nota manual gera item de histórico
- [ ] Atualizar nota manual gera item de histórico com antes/depois
- [ ] Excluir nota manual gera item de histórico preservado após delete
- [ ] Exclusão em lote registra histórico das notas removidas
- [ ] Frontend consegue consultar histórico por `notaId`
- [ ] Histórico mostra ator, role e data/hora
- [ ] Histórico continua acessível mesmo após exclusão da nota

---

## 12) Testes E2E mínimos

1. Criar nota manual e verificar `NOTA_MANUAL_ADICIONADA`
2. Atualizar nota manual e verificar `NOTA_MANUAL_ATUALIZADA` com `dadosAnteriores` e `dadosNovos`
3. Excluir nota manual e verificar `NOTA_MANUAL_EXCLUIDA`
4. Consultar histórico da nota excluída e receber eventos normalmente
5. Limpar lançamentos manuais em lote e verificar logs por nota removida
6. Usuário sem permissão recebe `403` ao consultar histórico

---

## 13) Decisão recomendada

A recomendação correta aqui é:

- manter a nota como dado operacional
- manter a auditoria como dado imutável separado
- expor uma rota específica de histórico para o frontend

Esse modelo é o que sustenta auditoria real para nota acadêmica.
