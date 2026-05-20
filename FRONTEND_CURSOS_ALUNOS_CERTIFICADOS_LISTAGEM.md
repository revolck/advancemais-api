# Frontend - Listagem de Alunos com Certificados

## Contexto

Na tela:

- `/dashboard/cursos/alunos`

o frontend lista alunos/candidatos pelo endpoint:

```http
GET /api/v1/cursos/alunos
```

A listagem agora considera duas origens de relacionamento com curso/turma:

- inscricao/matricula em curso/turma;
- certificado emitido vinculado a inscricao, curso, turma e aluno.

Isso evita juntar `/api/v1/cursos/alunos` com `/api/v1/cursos/certificados` no cliente, o que quebraria paginacao, filtros e ordenacao.

## Endpoint

```http
GET /api/v1/cursos/alunos
```

Exemplo:

```http
GET /api/v1/cursos/alunos?page=1&limit=10&status=CONCLUIDO&cursoId=<uuid>&turmaId=<uuid>&cidade=Maceio&search=Maria
```

## Novo parametro opcional

```http
GET /api/v1/cursos/alunos?incluirCertificados=true
```

Default:

```txt
incluirCertificados=true
```

Quando `incluirCertificados=true`, alunos com certificado emitido tambem entram na listagem.

Quando `incluirCertificados=false`, a listagem considera apenas inscricoes.

## Regra de status

O campo principal para badge no frontend continua sendo:

```ts
aluno.ultimoCurso.statusInscricao;
```

Quando houver uma inscricao que bata com o filtro, a API retorna o status real da inscricao:

- `INSCRITO`
- `EM_ANDAMENTO`
- `EM_ESTAGIO`
- `CONCLUIDO`
- `REPROVADO`
- `CANCELADO`
- `TRANCADO`
- demais status existentes no dominio

Quando o aluno aparecer pelo certificado emitido em uma consulta de concluidos, a API pode derivar:

```json
{
  "statusInscricao": "CONCLUIDO"
}
```

Isso acontece porque certificado emitido representa conclusao administrativa para a listagem.

## Certificados considerados

Somente certificado `EMITIDO` torna o aluno elegivel por certificado.

Certificados `CANCELADO` ou `REVOGADO` nao devem transformar aluno em `CONCLUIDO`.

No contrato atual do banco, os certificados persistidos em `CursosCertificadosEmitidos` representam certificados emitidos. Por isso a resposta retorna:

```json
{
  "status": "EMITIDO"
}
```

## Filtros

Todos os filtros sao aplicados antes da paginacao.

### Status

```http
GET /api/v1/cursos/alunos?status=CONCLUIDO
```

Inclui:

- inscricoes com `statusInscricao=CONCLUIDO`;
- alunos encontrados por certificado `EMITIDO`.

```http
GET /api/v1/cursos/alunos?status=CANCELADO
```

Inclui apenas inscricoes realmente canceladas.

Certificado emitido nao transforma esse registro em cancelado.

### Curso e turma

```http
GET /api/v1/cursos/alunos?cursoId=<uuid>&turmaId=<uuid>
```

`cursoId` e `turmaId` filtram tanto inscricoes quanto certificados vinculados a inscricoes daquela turma.

### Cidade

```http
GET /api/v1/cursos/alunos?cidade=Maceio
```

Continua usando os dados de endereco do aluno/candidato.

### Busca

```http
GET /api/v1/cursos/alunos?search=Maria
```

Busca por:

- nome do aluno;
- email;
- CPF;
- codigo do aluno;
- codigo do certificado.

## Resposta

O formato principal continua com `data` e `pagination`.

Exemplo:

```json
{
  "data": [
    {
      "id": "uuid-aluno",
      "codigo": "ALU-000001",
      "nomeCompleto": "Maria Silva",
      "email": "maria@email.com",
      "cpf": "00000000000",
      "status": "ATIVO",
      "cidade": "Maceio",
      "estado": "AL",
      "avatarUrl": null,
      "ultimoLogin": null,
      "criadoEm": "2026-05-01T00:00:00.000Z",
      "ultimoCurso": {
        "inscricaoId": "uuid-inscricao",
        "statusInscricao": "CONCLUIDO",
        "dataInscricao": "2026-05-01T00:00:00.000Z",
        "turma": {
          "id": "uuid-turma",
          "nome": "Turma Maio 2026",
          "codigo": "TRM-000001",
          "status": "CONCLUIDO"
        },
        "curso": {
          "id": "uuid-curso",
          "nome": "Curso Exemplo",
          "codigo": "CUR-000001"
        },
        "certificado": {
          "id": "uuid-certificado",
          "codigo": "CERT-000001",
          "status": "EMITIDO",
          "emitidoEm": "2026-05-20T12:00:00.000Z"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

## Uso recomendado no frontend

### Badge de status

```ts
const statusBadge = aluno.ultimoCurso?.statusInscricao;
```

### Exibir certificado quando houver

```ts
const certificado = aluno.ultimoCurso?.certificado;

if (certificado) {
  // Exibir codigo, status e data de emissao
}
```

### Filtro de concluidos

```ts
await api.get('/api/v1/cursos/alunos', {
  params: {
    page: 1,
    limit: 10,
    status: 'CONCLUIDO',
    incluirCertificados: true,
  },
});
```

### Busca por certificado

```ts
await api.get('/api/v1/cursos/alunos', {
  params: {
    page: 1,
    limit: 10,
    search: 'CERT-000001',
  },
});
```

## Regras para a tela

- Nao juntar a listagem de alunos com a listagem global de certificados no cliente.
- Usar sempre `data` e `pagination` retornados por `/api/v1/cursos/alunos`.
- Usar `ultimoCurso.statusInscricao` como fonte do badge de status.
- Mostrar dados de certificado apenas quando `ultimoCurso.certificado` existir.
- Manter filtros atuais do frontend; a API ja aplica tudo antes da paginacao.
- Para compatibilidade, nao e necessario enviar `incluirCertificados`, porque o default ja e `true`.

## Criterios de aceite no frontend

1. Aluno com inscricao `CONCLUIDO` aparece na listagem.
2. Aluno com certificado `EMITIDO` aparece na listagem mesmo quando nao aparece por status operacional ativo.
3. Filtro `status=CONCLUIDO` inclui alunos encontrados por certificado emitido.
4. Filtro `status=CANCELADO` nao transforma certificado emitido em cancelado.
5. `cursoId` e `turmaId` funcionam para alunos encontrados por inscricao e por certificado.
6. `search` encontra aluno por nome, email, CPF, codigo do aluno e codigo do certificado.
7. Paginacao deve usar somente o retorno da API.
