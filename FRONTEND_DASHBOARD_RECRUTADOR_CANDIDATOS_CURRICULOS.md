# Frontend — Currículos Visíveis no Detalhe do Candidato para `RECRUTADOR`

## Objetivo

Permitir que a tela:

- `/dashboard/empresas/candidatos/:id`

mostre, para `RECRUTADOR`, o currículo realmente enviado em cada candidatura visível no próprio escopo.

---

## Rotas

### Detalhe do candidato enriquecido

`GET /api/v1/recrutador/candidatos/:candidatoId`

### Visualização segura do currículo

`GET /api/v1/recrutador/candidatos/:candidatoId/curriculos/:curriculoId`

---

## Regra de escopo

### Vínculo por empresa

- o recrutador pode ver currículos das candidaturas visíveis nas vagas operáveis da empresa

### Vínculo por vaga

- o recrutador pode ver apenas o currículo ligado à candidatura da vaga vinculada

### Regra fixa

- currículo fora do escopo não pode ser exposto
- se a candidatura estiver visível, o currículo ligado a ela também pode ser exposto
- se a candidatura não estiver visível, o currículo não aparece no payload

---

## 1. Detalhe do candidato enriquecido

### Rota

`GET /api/v1/recrutador/candidatos/:candidatoId`

### Ajuste no payload

Cada item de `candidaturas` agora pode incluir:

```json
{
  "id": "uuid-candidatura",
  "statusId": "uuid-status",
  "status": "Em processo",
  "vaga": {
    "id": "uuid-vaga",
    "titulo": "Desenvolvedor Full Stack Pleno",
    "codigo": "V51386",
    "status": "PUBLICADO"
  },
  "empresa": {
    "id": "uuid-empresa",
    "nomeExibicao": "Tech Innovations LTDA",
    "codigo": "EMP-009"
  },
  "curriculo": {
    "id": "uuid-curriculo",
    "titulo": "Currículo Desenvolvedor Full Stack",
    "principal": false,
    "ultimaAtualizacao": "2026-04-01T18:00:00.000Z"
  }
}
```

### Semântica

- `candidaturas[].curriculo.id`
  - currículo ligado à candidatura visível
- `candidaturas[].curriculo.titulo`
  - label para a coluna `Currículo`
- `candidaturas[].curriculo.principal`
  - opcional para badge
- `candidaturas[].curriculo.ultimaAtualizacao`
  - opcional para tooltip ou resumo temporal
- `candidaturas[].curriculo`
  - pode ser `null` se a candidatura não tiver currículo vinculado

---

## 2. Visualização segura do currículo

### Rota

`GET /api/v1/recrutador/candidatos/:candidatoId/curriculos/:curriculoId`

### Regra de permissão

O backend só devolve o currículo quando:

- o `candidatoId` existe
- o `curriculoId` pertence ao candidato
- o currículo está ligado a pelo menos uma candidatura visível daquele candidato no escopo atual do recrutador

### Resposta

```json
{
  "success": true,
  "data": {
    "id": "uuid-curriculo",
    "usuarioId": "uuid-candidato",
    "titulo": "Currículo Desenvolvedor Full Stack",
    "resumo": "Profissional com experiência em React e Node.js.",
    "objetivo": "Atuar como desenvolvedor full stack.",
    "principal": false,
    "areasInteresse": {
      "primaria": "Tecnologia"
    },
    "preferencias": null,
    "habilidades": {
      "tecnicas": ["React", "Node.js", "TypeScript"],
      "comportamentais": ["Comunicação", "Trabalho em equipe"]
    },
    "idiomas": [],
    "experiencias": [],
    "formacao": [],
    "cursosCertificacoes": [],
    "premiosPublicacoes": [],
    "acessibilidade": null,
    "consentimentos": null,
    "ultimaAtualizacao": "2026-04-01T18:00:00.000Z",
    "criadoEm": "2026-03-20T10:00:00.000Z",
    "atualizadoEm": "2026-04-01T18:00:00.000Z"
  }
}
```

---

## Tratamento de erros

### Detalhe do candidato

- `403 FORBIDDEN`
- `404 CANDIDATO_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

### Currículo

- `403 FORBIDDEN`
- `404 CANDIDATO_NOT_FOUND`
- `404 CURRICULO_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

Exemplo fora do escopo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a este currículo."
}
```

---

## Fluxo recomendado no frontend

1. carregar `GET /api/v1/recrutador/candidatos/:candidatoId`
2. renderizar `candidaturas[].curriculo.titulo` na coluna `Currículo`
3. ao clicar em `Visualizar currículo`, chamar:
   - `GET /api/v1/recrutador/candidatos/:candidatoId/curriculos/:curriculoId`
4. abrir modal ou drawer com o payload retornado

---

## Checklist frontend

- [ ] usar `candidaturas[].curriculo` no detalhe do candidato
- [ ] renderizar o título do currículo por candidatura visível
- [ ] usar `GET /api/v1/recrutador/candidatos/:candidatoId/curriculos/:curriculoId` para visualizar o currículo
- [ ] tratar `curriculo = null` quando a candidatura não tiver currículo vinculado
- [ ] tratar `403 FORBIDDEN`
- [ ] tratar `404 CANDIDATO_NOT_FOUND`
- [ ] tratar `404 CURRICULO_NOT_FOUND`
