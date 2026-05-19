# Frontend - Turmas Publicadas Sem Estrutura

## Contexto

Nas telas:

- `/dashboard/cursos/turmas/cadastrar`
- `/dashboard/cursos/:cursoId/turmas/:turmaId/editar`
- `/dashboard/cursos/turmas/:turmaId?cursoId=:cursoId`

o backend agora permite criar, editar e publicar turmas sem itens de estrutura.

A turma pode ficar pública para inscrição antes de a estrutura final estar pronta, mas só pode iniciar quando tiver pelo menos `1` item efetivo.

## Perfis permitidos

Podem criar, editar, publicar e despublicar turmas:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

Demais perfis continuam sem permissão para ações de gestão.

## IDs nas ações

Todas as ações de turma continuam usando `cursoId + turmaId`.

Na tela de detalhes, o `turmaId` vem do path e o `cursoId` deve vir da query string ou do detalhe carregado:

```http
PUT /api/v1/cursos/:cursoId/turmas/:turmaId
PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar
DELETE /api/v1/cursos/:cursoId/turmas/:turmaId
```

Se `cursoId` não pertencer à turma informada, a API retorna:

```json
{
  "success": false,
  "code": "TURMA_NOT_FOUND",
  "message": "Turma não encontrada para o curso informado"
}
```

## Definição de estrutura vazia

A estrutura é considerada vazia quando a quantidade de itens efetivos for `0`.

Itens efetivos:

```ts
estrutura.modules[].items.length + estrutura.standaloneItems.length
```

Ou, nas respostas do backend:

```ts
turma.estruturaResumo.itemCount === 0;
```

## Criar turma sem estrutura

```http
POST /api/v1/cursos/:cursoId/turmas
```

### Rascunho

Criar `RASCUNHO` sem estrutura continua permitido.

```json
{
  "estruturaTipo": "PADRAO",
  "nome": "Turma Maio 2026",
  "turno": "NOITE",
  "metodo": "ONLINE",
  "status": "RASCUNHO",
  "dataInicio": "2026-05-20T00:00:00.000Z",
  "dataFim": "2026-07-20T00:00:00.000Z",
  "vagasIlimitadas": false,
  "vagasTotais": 30,
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  }
}
```

### Publicada

Criar `PUBLICADO` sem estrutura agora é permitido quando `dataInicio` é futura e `dataFim` é posterior a `dataInicio`.

```json
{
  "estruturaTipo": "PADRAO",
  "nome": "Turma Maio 2026",
  "turno": "NOITE",
  "metodo": "ONLINE",
  "status": "PUBLICADO",
  "dataInicio": "2026-05-20T00:00:00.000Z",
  "dataFim": "2026-07-20T00:00:00.000Z",
  "vagasIlimitadas": false,
  "vagasTotais": 30,
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  }
}
```

Resposta:

```json
{
  "id": "uuid-turma",
  "codigo": "TRM-000001",
  "nome": "Turma Maio 2026",
  "status": "PUBLICADO",
  "publicacaoStatus": "PUBLICADO",
  "publicado": true,
  "estruturaResumo": {
    "itemCount": 0,
    "modulesCount": 0,
    "standaloneItemsCount": 0
  },
  "inicioBloqueadoPorEstrutura": false
}
```

## Publicar e despublicar

```http
PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar
```

Publicar:

```json
{
  "publicar": true
}
```

Despublicar:

```json
{
  "publicar": false
}
```

`estruturaResumo.itemCount === 0` não bloqueia publicação. O frontend deve exibir um alerta operacional, não impedir a ação.

Quando a turma sem estrutura for publicada, ela precisa ter:

- `dataInicio` futura;
- `dataFim` posterior a `dataInicio`.

Erro quando o período não permite controle de início:

```json
{
  "success": false,
  "code": "TURMA_PERIODO_OBRIGATORIO_PUBLICACAO",
  "message": "Para publicar uma turma sem estrutura, informe uma nova data de início e fim futuras.",
  "details": {
    "itemCount": 0,
    "modulesCount": 0,
    "standaloneItemsCount": 0,
    "dataInicio": null,
    "dataFim": null,
    "requiredFields": ["dataInicio", "dataFim"]
  }
}
```

## Bloqueio automático no início

O backend verifica automaticamente as datas da turma.

Quando `dataInicio` chegar:

- se `estruturaResumo.itemCount >= 1`, a turma pode entrar em `EM_ANDAMENTO`;
- se `estruturaResumo.itemCount === 0`, a turma volta para `RASCUNHO`;
- os alunos continuam com inscrição `INSCRITO`;
- gestores e alunos recebem notificação por sininho e email.

Resposta de detalhe/listagem após bloqueio:

```json
{
  "id": "uuid-turma",
  "nome": "Turma Maio 2026",
  "status": "RASCUNHO",
  "publicacaoStatus": "RASCUNHO",
  "publicado": false,
  "estruturaResumo": {
    "itemCount": 0,
    "modulesCount": 0,
    "standaloneItemsCount": 0
  },
  "inicioBloqueadoPorEstrutura": true
}
```

## Reprogramação

Se `inicioBloqueadoPorEstrutura=true`, o frontend deve exigir uma nova data antes de publicar novamente.

Fluxo esperado:

1. Usuário adiciona pelo menos `1` item na estrutura ou mantém a estrutura pendente.
2. Usuário informa nova `dataInicio` futura e nova `dataFim`.
3. Usuário publica a turma novamente.
4. A API notifica os alunos sobre a nova data confirmada.

Mensagem sugerida para alerta no dashboard:

```txt
Esta turma não iniciou porque ainda não possui estrutura. Adicione a estrutura e informe uma nova data de início e fim para publicar novamente.
```

## Notificações

Tipos novos que podem aparecer em `/api/v1/notificacoes`:

- `TURMA_ESTRUTURA_PENDENTE_24H`
- `TURMA_INICIO_BLOQUEADO_ESTRUTURA`
- `TURMA_INICIO_REPROGRAMADO`
- `TURMA_NOVA_DATA_CONFIRMADA`

### Gestão

24h antes do início, se a turma publicada estiver sem estrutura:

```txt
A turma "{{nome}}" do curso "{{curso}}" está prevista para iniciar em {{dataHora}} e ainda não possui estrutura. Cadastre pelo menos 1 item até {{horas}} para que ela possa iniciar. Se não for corrigida, a turma voltará para rascunho e os alunos permanecerão aguardando nova data.
```

Quando o início for bloqueado:

```txt
A turma "{{nome}}" do curso "{{curso}}" não iniciou porque ainda está sem estrutura. Para publicar novamente, adicione ao menos 1 item e informe uma nova data de início e fim futuras.
```

### Alunos

Quando o início for bloqueado:

```txt
A turma "{{nome}}" precisou ser reprogramada por um ajuste operacional. Em breve divulgaremos a nova data de início. Você continua inscrito e será avisado assim que o novo cronograma for confirmado. Atenciosamente, Direção Advance+.
```

Quando a nova data for confirmada:

```txt
A turma "{{nome}}" foi reprogramada e acontecerá de {{dataInicio}} a {{dataFim}}. Acompanhe a plataforma para consultar a estrutura, atividades e prazos atualizados.
```

## Ajustes esperados no frontend

Na criação, edição e detalhes:

- permitir publicar turma sem estrutura quando houver período futuro válido;
- mostrar alerta visual quando `estruturaResumo.itemCount === 0`;
- não bloquear publicação apenas por estrutura vazia;
- bloquear a publicação localmente quando `dataInicio` estiver ausente, vencida ou sem `dataFim`;
- quando `inicioBloqueadoPorEstrutura=true`, orientar o usuário a reprogramar datas e revisar estrutura;
- sempre usar `cursoId + turmaId` nas ações de editar, publicar, despublicar e excluir.
