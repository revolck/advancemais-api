# Frontend — Regras de Curso, Categoria e Subcategoria

## Objetivo

Alinhar o frontend com as novas regras de negócio para:

- despublicação de curso
- exclusão de categoria/subcategoria
- edição de curso/categoria/subcategoria

---

## 1) Curso com turmas vinculadas

### Regra

- Curso com turmas vinculadas **não é excluído fisicamente**.
- O endpoint atual de `DELETE /api/v1/cursos/:cursoId` continua sendo tratado como **despublicar** (status para rascunho).

---

## 2) Despublicar curso com turmas

### Regra

- Só pode despublicar curso quando **todas** as turmas vinculadas estiverem com status `CONCLUIDO`.
- Se existir qualquer turma em outro status (`RASCUNHO`, `PUBLICADO`, `INSCRICOES_ABERTAS`, `INSCRICOES_ENCERRADAS`, `EM_ANDAMENTO`, `SUSPENSO`, `CANCELADO`), a despublicação é bloqueada.

### Endpoint

`DELETE /api/v1/cursos/:cursoId`

### Erro esperado

`409 CURSO_DESPUBLICAR_TURMAS_NAO_CONCLUIDAS`

Exemplo:

```json
{
  "success": false,
  "code": "CURSO_DESPUBLICAR_TURMAS_NAO_CONCLUIDAS",
  "message": "Não é possível despublicar curso com turmas não concluídas. Conclua todas as turmas antes de despublicar.",
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

---

## 3) Edição de curso

### Regra

- Curso pode ser editado a qualquer momento.
- Não há bloqueio para `PUT /api/v1/cursos/:cursoId` por causa de status da turma.

---

## 4) Exclusão de categoria

### Regra

- Categoria não pode ser removida se houver cursos vinculados.
- Edição de nome/descrição continua permitida.

### Endpoint

`DELETE /api/v1/cursos/categorias/:categoriaId`

### Erro esperado

`409 CATEGORIA_IN_USE`

---

## 5) Exclusão de subcategoria

### Regra

- Subcategoria não pode ser removida se houver cursos vinculados.
- Edição de nome/descrição continua permitida.

### Endpoint

`DELETE /api/v1/cursos/categorias/subcategorias/:subcategoriaId`

### Erro esperado

`409 SUBCATEGORIA_IN_USE`

---

## Checklist frontend

- [ ] Tratar `DELETE /cursos/:cursoId` como ação de despublicar.
- [ ] Exibir mensagem de bloqueio quando retornar `CURSO_DESPUBLICAR_TURMAS_NAO_CONCLUIDAS`.
- [ ] Em categorias/subcategorias, bloquear feedback de sucesso se API retornar `CATEGORIA_IN_USE` / `SUBCATEGORIA_IN_USE`.
- [ ] Manter edição de curso/categoria/subcategoria habilitada normalmente.
