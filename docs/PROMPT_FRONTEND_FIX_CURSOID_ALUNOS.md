# 🔧 Correção: Filtro de Curso na Listagem de Alunos

**Data:** 2025-11-05  
**Prioridade:** Alta  
**Módulo:** Dashboard > Cursos > Alunos

---

## ❌ Problema Identificado

Ao filtrar alunos por curso na tela de listagem, a API está retornando erro `400 Bad Request` com a mensagem:

> **"Curso ID deve ser um UUID válido"**

### Evidências

1. **Erro no Console:**

   ```
   API Error 400 (/api/v1/cursos/alunos?page=1&limit=10&cursold=5)
   ```

2. **Problemas identificados:**
   - ❌ **Typo no parâmetro:** `cursold` ao invés de `cursoId` (ou `curso`)
   - ❌ **Formato incorreto:** Enviando número (`5`) ao invés de UUID (string)

---

## 🔍 Contexto Técnico

### Mudança no Backend

O campo `id` do modelo `Cursos` foi alterado de `Int` (número inteiro) para `String @default(uuid())` (UUID).

**Antes:**

```typescript
// Cursos.id era um número
cursoId: 1, 2, 3, ...
```

**Agora:**

```typescript
// Cursos.id é um UUID (string)
cursoId: '550e8400-e29b-41d4-a716-446655440000';
```

### API Endpoint

**Endpoint:** `GET /api/v1/cursos/alunos`

**Parâmetros aceitos:**

- `cursoId` (string UUID) - **OU** `curso` (string UUID)
- `turmaId` (string UUID) - **OU** `turma` (string UUID)
- `status` (enum: INSCRITO, EM_ANDAMENTO, CONCLUIDO, etc.)
- `cidade` (string)
- `search` (string)
- `page` (number)
- `limit` (number)

**Exemplo de requisição correta:**

```
GET /api/v1/cursos/alunos?page=1&limit=10&cursoId=550e8400-e29b-41d4-a716-446655440000
```

---

## ✅ Ação Necessária no Frontend

### 1. Corrigir Typo no Parâmetro

**Arquivo:** `src/api/cursos/core.ts` (aproximadamente linha 577)

**Antes:**

```typescript
// ❌ ERRADO - Typo: "cursold"
const params = {
  page: 1,
  limit: 10,
  cursold: selectedCursoId, // Typo aqui!
};
```

**Depois:**

```typescript
// ✅ CORRETO
const params = {
  page: 1,
  limit: 10,
  cursoId: selectedCursoId, // Nome correto do parâmetro
};
```

### 2. Usar UUID do Curso (não o ID numérico)

**Problema:** O dropdown de cursos está enviando um ID numérico, mas precisa enviar o UUID.

**Verificar:**

1. **No componente do dropdown de cursos:**
   - Certifique-se de que o `value` enviado seja o `id` (UUID) do curso, não um código ou número
   - O `id` do curso vem da API `GET /api/v1/cursos` e é um UUID string

2. **Exemplo de estrutura esperada:**

   ```typescript
   // Resposta da API /api/v1/cursos
   {
     id: "550e8400-e29b-41d4-a716-446655440000", // ← UUID (string)
     codigo: "123", // ← Código do curso (não usar para filtro!)
     nome: "Desenvolvimento Full Stack Completo",
     // ...
   }
   ```

3. **Ao selecionar um curso no dropdown:**

   ```typescript
   // ✅ CORRETO - Usar o UUID
   const cursoSelecionado = {
     id: '550e8400-e29b-41d4-a716-446655440000', // UUID
     codigo: '123',
     nome: 'Desenvolvimento Full Stack Completo',
   };

   // Enviar o UUID para a API
   setCursoId(cursoSelecionado.id); // UUID string
   ```

   ```typescript
   // ❌ ERRADO - Não usar código ou número
   setCursoId(cursoSelecionado.codigo); // "123" - não funciona!
   setCursoId(123); // número - não funciona!
   ```

### 3. Verificar a API de Listagem de Cursos

**Endpoint:** `GET /api/v1/cursos`

Certifique-se de que a API está retornando o campo `id` como UUID:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000", // ← UUID (string)
        "codigo": "123",
        "nome": "Desenvolvimento Full Stack Completo"
        // ...
      }
    ]
  }
}
```

Se a API não estiver retornando `id` como UUID, o backend precisa ser verificado também.

---

## 🧪 Checklist de Testes

Após as correções, testar:

- [ ] Selecionar um curso no dropdown e verificar se os alunos são listados corretamente
- [ ] Verificar no Network tab do DevTools que o parâmetro `cursoId` está sendo enviado (não `cursold`)
- [ ] Verificar que o valor de `cursoId` é um UUID válido (formato: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`)
- [ ] Testar outros filtros (status, turma, cidade, pesquisa) para garantir que não quebraram
- [ ] Limpar o filtro de curso e verificar se todos os alunos são listados

---

## 📝 Arquivos Provavelmente Afetados

1. `src/api/cursos/core.ts` - Função `listAlunosComInscricao`
2. `src/theme/dashboard/components/admin/lista-alunos/hooks/useAlunosDashboardQuery.ts`
3. Componente do dropdown de cursos (onde o curso é selecionado)
4. Qualquer componente que popula o dropdown de cursos

---

## 🔗 Referências

- **API Endpoint:** `GET /api/v1/cursos/alunos`
- **Documentação Swagger:** Disponível em `/api-docs` (rota `/api/v1/cursos/alunos`)

---

## 💡 Dúvidas?

Se houver alguma dúvida sobre:

- O formato UUID esperado
- A estrutura da resposta da API de cursos
- Como obter o UUID correto do curso

Por favor, consultar a documentação da API no Swagger ou entrar em contato com o time de backend.

---

**Agradeço a colaboração!** 🚀
