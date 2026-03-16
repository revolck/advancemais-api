# PRD — Turmas: Autorização, Edição, Publicação, Exclusão e Operação em Andamento (v1)

## 1) Contexto

Temos o módulo de turmas com rotas principais em:

- `GET /api/v1/cursos/:cursoId/turmas`
- `GET /api/v1/cursos/:cursoId/turmas/:turmaId`
- `PUT /api/v1/cursos/:cursoId/turmas/:turmaId`
- `PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar`
- `DELETE /api/v1/cursos/:cursoId/turmas/:turmaId`
- `POST /api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes`

Além disso, a turma é a base operacional de:

- aulas
- provas/atividades
- agenda
- frequência
- alunos inscritos
- histórico operacional

Agora precisamos fechar regras de negócio e autorização para gestão e visibilidade de turmas, com atenção especial ao perfil `INSTRUTOR`.

---

## 2) Problema

Hoje faltam regras explícitas para responder de forma consistente:

- quem pode editar turma;
- quem pode publicar/despublicar;
- quando a turma pode ser excluída;
- o que o `INSTRUTOR` pode ou não ver dentro da turma;
- como tratar alterações pedagógicas após a turma ter iniciado;
- como tratar inclusão tardia de aluno sem quebrar prazo de aulas, provas e atividades.

Sem esse contrato, frontend e backend tendem a divergir em permissões e comportamento.

---

## 3) Objetivo

Definir um contrato único para:

- autorização por role;
- visibilidade de turma e de estrutura interna;
- edição de turma;
- publicação/despublicação;
- exclusão;
- inclusão tardia de alunos;
- notificações automáticas para mudanças em turmas já iniciadas.

---

## 4) Perfis e autorização

Perfis relevantes:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

### Matriz de acesso de alto nível

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: gestão de turmas.
- `INSTRUTOR`: acesso operacional restrito às turmas em que possua vínculo real de conteúdo.

### Regra fechada

- Somente `ADMIN`, `MODERADOR` e `PEDAGOGICO` podem:
  - alterar turma;
  - publicar turma;
  - despublicar turma.

- `INSTRUTOR`:
  - não altera turma;
  - não publica turma;
  - não despublica turma;
  - só visualiza turma quando houver vínculo efetivo com conteúdo da turma.

---

## 5) Definição de vínculo do instrutor com a turma

O instrutor só pode acessar a turma se estiver vinculado a pelo menos um conteúdo da turma:

- uma aula da turma;
- uma prova da turma;
- uma atividade/avaliação da turma.

### Regra de vínculo

Uma turma é considerada acessível ao instrutor quando existir pelo menos um registro em que:

- `aula.instrutorId = usuarioLogado.id`; ou
- `prova.instrutorId = usuarioLogado.id`; ou
- `avaliacao.instrutorId = usuarioLogado.id`.

Sem esse vínculo:

- `GET /api/v1/cursos/:cursoId/turmas/:turmaId` -> `403 FORBIDDEN`
- listagens de turmas não devem incluir a turma
- histórico da turma não deve ser retornado

---

## 6) Regras de visibilidade da turma para INSTRUTOR

### 6.1 Listagem de turmas

`GET /api/v1/cursos/:cursoId/turmas`

- `INSTRUTOR` só vê turmas em que tenha vínculo com algum conteúdo.
- Não pode haver vazamento de turmas sem vínculo via filtros.

### 6.2 Detalhe da turma

`GET /api/v1/cursos/:cursoId/turmas/:turmaId`

O `INSTRUTOR` vinculado pode visualizar:

- dados gerais da turma;
- status;
- cronograma geral;
- alunos da turma;
- visão geral da estrutura;
- seus conteúdos vinculados com detalhe completo.

O `INSTRUTOR` **não pode** visualizar em detalhe:

- aula de outro instrutor;
- prova de outro instrutor;
- atividade de outro instrutor.

### 6.3 Regra prática para a estrutura

No detalhe da turma para `INSTRUTOR`:

- a turma pode mostrar visão geral da estrutura;
- mas o conteúdo detalhado retornado deve ficar restrito aos itens vinculados a ele;
- itens não vinculados podem:
  - não aparecer, ou
  - aparecer apenas de forma resumida/sem conteúdo interno.

### 6.4 Regra fechada para endpoints de detalhe de conteúdo

Mesmo que o `INSTRUTOR` tenha acesso à turma, ele **não** ganha acesso automático a todo conteúdo da turma.

Exemplos que devem continuar bloqueados com `403 FORBIDDEN`:

- `GET /api/v1/cursos/:cursoId/turmas/:turmaId/aulas/:aulaId`
- `GET /api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId`
- `GET /api/v1/cursos/avaliacoes/:avaliacaoId`

quando o item detalhado não estiver vinculado ao instrutor logado.

---

## 7) Histórico da turma

### Regra para gestão

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: podem ver histórico completo da turma.

### Regra para INSTRUTOR

- só pode acessar histórico vinculado a ele;
- o backend deve filtrar eventos relacionados aos conteúdos em que ele atua;
- eventos de conteúdos de outros instrutores não devem ser retornados.

---

## 8) Alunos da turma

### Regra

O `INSTRUTOR` vinculado à turma pode visualizar os alunos inscritos.

Isso inclui:

- listagem de alunos;
- dados básicos de acompanhamento pedagógico permitidos pelo sistema;
- contexto necessário para lançamento de presença, notas, correções e acompanhamento.

### Restrição

Esse acesso a alunos **não** amplia o acesso do instrutor a conteúdos de outros instrutores.

---

## 9) Regras de edição da turma

### 9.1 Quem pode editar

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

### 9.2 Regra principal

- A turma pode ser alterada por esses perfis.

### 9.3 Exceção operacional fechada

O `PEDAGOGICO` pode alterar dados da turma **a qualquer momento**, inclusive com turma já iniciada.

### 9.4 Decisão recomendada

Para evitar conflito operacional:

- `PEDAGOGICO` é o perfil com override explícito pós-início;
- `ADMIN` e `MODERADOR` mantêm gestão da turma, mas alterações estruturais após início devem seguir a mesma política do `PEDAGOGICO` **somente se vocês quiserem ampliar essa permissão depois**.

Para esta versão do PRD, a recomendação é:

- pós-início com impacto pedagógico/cronograma = responsabilidade do `PEDAGOGICO`.

---

## 10) Publicação e despublicação da turma

### Endpoint

`PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar`

### Permissões

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

### Regras

- `INSTRUTOR` não publica nem despublica turma.
- Publicação e despublicação precisam refletir o estado final persistido.

### Regra adicional recomendada

Para evitar inconsistência com alunos já inscritos:

- despublicação deve ser bloqueada se a turma já estiver em andamento;
- despublicação deve ser bloqueada se houver alunos inscritos ativos;
- nesses casos, a turma deve seguir fluxo de encerramento/gestão, não de ocultação pública simples.

---

## 11) Criação de aulas, provas e atividades em turma iniciada

### Regra para INSTRUTOR

O `INSTRUTOR` não pode criar:

- aula;
- prova;
- atividade/avaliação

se a turma já tiver iniciado.

### Regra para PEDAGOGICO

O `PEDAGOGICO` pode adicionar conteúdos mesmo com turma iniciada.

Casos válidos:

- inclusão de nova aula;
- inclusão de nova prova;
- inclusão de nova atividade;
- alteração de data/hora de conteúdo já programado.

### Regra de notificação obrigatória

Sempre que o `PEDAGOGICO` fizer alteração pedagógica em turma iniciada, os alunos da turma devem ser notificados.

Exemplos de mensagem:

- `Foi adicionada uma nova aula para a data DD/MM/AAAA às HH:mm com {{instrutor}}.`
- `Foi adicionada uma nova atividade na turma {{nomeTurma}}.`
- `A prova da turma {{nomeTurma}} teve sua data alterada para DD/MM/AAAA às HH:mm.`

Se houver instrutor vinculado ao conteúdo, incluir o nome.

### Implementação recomendada

Usar a rota/serviço já existente de notificações para:

- disparo em lote para alunos inscritos ativos;
- registro auditável da alteração;
- payload com tipo do evento (`AULA_ADICIONADA`, `PROVA_ADICIONADA`, `ATIVIDADE_ADICIONADA`, `CONTEUDO_REAGENDADO`).

---

## 12) Exclusão da turma

### Endpoint impactado

`DELETE /api/v1/cursos/:cursoId/turmas/:turmaId`

### Tipo recomendado

Exclusão lógica (soft delete) ou cancelamento lógico, nunca remoção física simples.

### Regras de bloqueio fechadas

Não pode excluir turma se:

- a turma já tiver sido realizada/iniciada;
- a turma tiver alunos inscritos.

### Definição recomendada de “já realizada/iniciada”

Considerar bloqueio quando qualquer condição for verdadeira:

- `status` em `EM_ANDAMENTO` ou `CONCLUIDO`;
- `dataInicio <= agora`;
- já existir conteúdo executado/frequência/lançamento associado.

### Erros sugeridos

- `409 TURMA_EXCLUSAO_BLOQUEADA_JA_INICIADA`
- `409 TURMA_EXCLUSAO_BLOQUEADA_COM_INSCRITOS`

---

## 13) Inclusão tardia de aluno na turma

### Regra de negócio

O `PEDAGOGICO` pode incluir aluno na turma a qualquer momento, inclusive com a turma em andamento.

### Consequência obrigatória do sistema

Ao inserir um aluno tardiamente, o sistema precisa recalcular o acesso desse aluno a:

- aulas;
- provas;
- atividades.

### Regras mínimas esperadas

1. O aluno passa a ter acesso imediato aos conteúdos da turma compatíveis com sua entrada.
2. Conteúdos vencidos antes da entrada não podem simplesmente permanecer bloqueados sem regra de compensação.
3. O sistema deve suportar prazo individual por aluno quando houver ingresso tardio.

### Decisão técnica recomendada

Criar regra de disponibilidade por inscrição/aluno para conteúdos da turma, em vez de depender apenas da data global do item.

Isso permite:

- liberar conteúdo atrasado para quem entrou depois;
- manter prazos originais para quem já estava na turma;
- evitar distorção de deadline para toda a turma.

### Comportamento recomendado por tipo

#### Aulas

- aulas anteriores devem ficar visíveis ao novo aluno;
- se houver gravação/material, liberar imediatamente;
- presença retroativa não deve ser concedida automaticamente.

#### Atividades e provas

- se ainda estiverem abertas: aluno segue o prazo original;
- se já tiverem vencido: gerar janela individual excepcional para o aluno incluído tardiamente;
- essa janela deve ficar vinculada à inscrição do aluno.

### Ponto em aberto para fechar na implementação

Definir a política de prazo excepcional:

- até a data de fim da turma; ou
- `dataEntrada + N dias`; ou
- regra configurável por turma/conteúdo.

Recomendação inicial:

- tornar essa janela **configurável**, com fallback operacional controlado pelo `PEDAGOGICO`.

---

## 14) Endpoints impactados

### Turma

- `GET /api/v1/cursos/:cursoId/turmas`
- `GET /api/v1/cursos/:cursoId/turmas/:turmaId`
- `PUT /api/v1/cursos/:cursoId/turmas/:turmaId`
- `PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar`
- `DELETE /api/v1/cursos/:cursoId/turmas/:turmaId`
- `POST /api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes`

### Conteúdos dependentes

- `POST /api/v1/cursos/:cursoId/turmas/:turmaId/aulas`
- `POST /api/v1/cursos/:cursoId/turmas/:turmaId/provas`
- `POST /api/v1/cursos/avaliacoes`

### Histórico/notificações

- rotas de histórico da turma;
- serviço/rota de notificações para alunos da turma.

---

## 15) Contrato de erro esperado

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 TURMA_NOT_FOUND`
- `409 TURMA_EXCLUSAO_BLOQUEADA_JA_INICIADA`
- `409 TURMA_EXCLUSAO_BLOQUEADA_COM_INSCRITOS`
- `409 TURMA_DESPUBLICACAO_BLOQUEADA_EM_ANDAMENTO`
- `409 TURMA_DESPUBLICACAO_BLOQUEADA_COM_INSCRITOS`
- `409 INSTRUTOR_NAO_PODE_CRIAR_CONTEUDO_EM_TURMA_INICIADA`

---

## 16) Critérios de aceite

- [ ] Somente `ADMIN`, `MODERADOR` e `PEDAGOGICO` alteram/publicam/despublicam turma.
- [ ] `INSTRUTOR` só vê turma quando tiver vínculo com conteúdo da turma.
- [ ] `INSTRUTOR` vê alunos da turma vinculada.
- [ ] `INSTRUTOR` não acessa detalhe de aula/prova/atividade de outro instrutor.
- [ ] `INSTRUTOR` só acessa histórico vinculado a ele.
- [ ] `INSTRUTOR` não cria aula/prova/atividade se a turma já iniciou.
- [ ] `PEDAGOGICO` pode alterar a turma em andamento e adicionar conteúdo.
- [ ] Alteração pedagógica em turma iniciada gera notificação para os alunos.
- [ ] Turma não pode ser excluída se já iniciou.
- [ ] Turma não pode ser excluída se já tiver inscritos.
- [ ] Inclusão tardia de aluno recalcula disponibilidade de conteúdos.

---

## 17) Testes E2E mínimos

1. Instrutor lista turmas: retorna apenas turmas com vínculo em conteúdo.
2. Instrutor tenta abrir turma sem vínculo: `403`.
3. Instrutor abre turma vinculada: `200`.
4. Instrutor vê alunos da turma vinculada: `200`.
5. Instrutor tenta abrir aula de outro instrutor dentro da mesma turma: `403`.
6. Instrutor tenta criar aula/prova/atividade em turma iniciada: `409 INSTRUTOR_NAO_PODE_CRIAR_CONTEUDO_EM_TURMA_INICIADA`.
7. Pedagógico altera turma iniciada: `200`.
8. Pedagógico adiciona aula em turma iniciada: `200` + notificação gerada.
9. Exclusão de turma iniciada: `409 TURMA_EXCLUSAO_BLOQUEADA_JA_INICIADA`.
10. Exclusão de turma com inscritos: `409 TURMA_EXCLUSAO_BLOQUEADA_COM_INSCRITOS`.
11. Inclusão tardia de aluno cria disponibilidade individual para conteúdos vencidos.

---

## 18) Regras adicionais recomendadas

Para evitar ambiguidade futura, recomenda-se também:

- bloquear despublicação de turma com alunos ativos;
- auditar toda alteração pedagógica feita após início da turma;
- registrar no histórico qual conteúdo foi adicionado/alterado e por quem;
- suportar filtro “meu conteúdo” para instrutor no detalhe da turma;
- separar no frontend:
  - visão geral da turma;
  - meus conteúdos;
  - histórico filtrado.

---

## 19) Decisão proposta desta versão

Para esta versão do PRD, a recomendação é adotar as seguintes decisões:

- `INSTRUTOR` tem acesso de leitura operacional restrito;
- `INSTRUTOR` não gerencia publicação de turma;
- `PEDAGOGICO` é o perfil com override operacional pós-início;
- exclusão de turma só é permitida antes de início e sem inscritos;
- entrada tardia de aluno exige regra individual de disponibilidade de conteúdo.
