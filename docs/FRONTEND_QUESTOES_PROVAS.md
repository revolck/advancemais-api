# Guia de Implementação - Sistema de Questões para Provas

Este documento descreve como implementar no front-end o sistema de questões e respostas para provas.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Novas Funcionalidades](#novas-funcionalidades)
3. [APIs Disponíveis](#apis-disponíveis)
4. [Estrutura de Dados](#estrutura-de-dados)
5. [Fluxos de Implementação](#fluxos-de-implementação)
6. [Exemplos de Código](#exemplos-de-código)
7. [Validações e Regras de Negócio](#validações-e-regras-de-negócio)
8. [Tratamento de Erros](#tratamento-de-erros)
9. [Boas Práticas](#boas-práticas)

---

## 🎯 Visão Geral

O sistema permite criar provas com questões de diferentes tipos:

- **TEXTO**: Resposta livre em texto (até 10.000 caracteres)
- **MULTIPLA_ESCOLHA**: Questões com alternativas (exatamente 1 correta)
- **ANEXO**: Upload de arquivo com URL e nome

Cada prova possui o campo `valePonto` (boolean, default: `true`) que indica se ela deve ser considerada no cálculo da média.

### Características Principais

- ✅ Validação robusta no backend (Zod + Prisma)
- ✅ Transações atômicas para garantir consistência
- ✅ Ordenação automática de questões
- ✅ Suporte a múltiplas alternativas com ordem customizável
- ✅ Sistema de correção com notas e observações
- ✅ Vinculação automática com envios de prova

---

## ✨ Novas Funcionalidades

### 1. Campo `valePonto` em Provas

As provas possuem um campo `valePonto` (boolean, default: `true`) que indica se a prova deve ser considerada no cálculo da média.

```typescript
interface Prova {
  id: string;
  titulo: string;
  etiqueta: string;
  peso: number;
  valePonto: boolean; // NOVO - Indica se conta para média
  ativo: boolean;
  localizacao: 'TURMA' | 'MODULO';
  // ... outros campos
}
```

### 2. Sistema de Questões

Cada prova pode ter múltiplas questões com diferentes tipos, pesos e ordem. As questões são ordenadas automaticamente se não fornecida uma ordem específica.

### 3. Sistema de Respostas

Alunos podem responder questões e instrutores podem corrigir e atribuir notas. As respostas são vinculadas automaticamente ao envio da prova quando existir.

### 4. Validação Inteligente

O sistema valida automaticamente:

- Questões de múltipla escolha devem ter pelo menos 2 alternativas
- Exatamente 1 alternativa deve estar marcada como correta
- Tipos de resposta devem corresponder ao tipo da questão

---

## 🔌 APIs Disponíveis

### Base URL

Todas as rotas seguem o padrão:

```
/api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}
```

### Autenticação

Todas as rotas requerem Bearer Token (JWT) no header:

```
Authorization: Bearer {token}
```

**Roles necessárias:**

- **Questões (CRUD)**: `ADMIN`, `MODERADOR`, `PEDAGOGICO`, `INSTRUTOR`
- **Responder**: `ALUNO_CANDIDATO` (própria inscrição)
- **Corrigir**: `ADMIN`, `MODERADOR`, `PEDAGOGICO`, `INSTRUTOR`
- **Listar Respostas**: `ADMIN`, `MODERADOR`, `PEDAGOGICO`, `INSTRUTOR`

---

### 1. Listar Questões da Prova

**GET** `/questoes`

**Resposta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "provaId": "uuid",
      "enunciado": "Qual é a capital do Brasil?",
      "tipo": "MULTIPLA_ESCOLHA",
      "ordem": 1,
      "peso": 1.5,
      "obrigatoria": true,
      "criadoEm": "2024-01-01T00:00:00.000Z",
      "atualizadoEm": "2024-01-01T00:00:00.000Z",
      "alternativas": [
        {
          "id": "uuid",
          "questaoId": "uuid",
          "texto": "São Paulo",
          "ordem": 1,
          "correta": false,
          "criadoEm": "2024-01-01T00:00:00.000Z",
          "atualizadoEm": "2024-01-01T00:00:00.000Z"
        },
        {
          "id": "uuid",
          "questaoId": "uuid",
          "texto": "Brasília",
          "ordem": 2,
          "correta": true,
          "criadoEm": "2024-01-01T00:00:00.000Z",
          "atualizadoEm": "2024-01-01T00:00:00.000Z"
        }
      ]
    },
    {
      "id": "uuid",
      "provaId": "uuid",
      "enunciado": "Explique o conceito de REST API",
      "tipo": "TEXTO",
      "ordem": 2,
      "peso": 2.0,
      "obrigatoria": true,
      "criadoEm": "2024-01-01T00:00:00.000Z",
      "atualizadoEm": "2024-01-01T00:00:00.000Z",
      "alternativas": undefined
    }
  ]
}
```

**Notas:**

- Questões são ordenadas por `ordem` (ascendente) e depois por `criadoEm`
- Alternativas só são retornadas para questões do tipo `MULTIPLA_ESCOLHA`
- Alternativas são ordenadas por `ordem` (ascendente)

---

### 2. Detalhar Questão

**GET** `/questoes/{questaoId}`

**Resposta:** Mesmo formato do item da lista acima (objeto único, não array).

**Códigos de Erro:**

- `404`: Questão não encontrada (`QUESTAO_NOT_FOUND`)
- `404`: Prova não encontrada (`PROVA_NOT_FOUND`)

---

### 3. Criar Questão

**POST** `/questoes`

**Body para TEXTO:**

```json
{
  "enunciado": "Explique o conceito de REST API",
  "tipo": "TEXTO",
  "ordem": 1,
  "peso": 2.0,
  "obrigatoria": true
}
```

**Body para MULTIPLA_ESCOLHA:**

```json
{
  "enunciado": "Qual é a capital do Brasil?",
  "tipo": "MULTIPLA_ESCOLHA",
  "ordem": 1,
  "peso": 1.5,
  "obrigatoria": true,
  "alternativas": [
    {
      "texto": "São Paulo",
      "ordem": 1,
      "correta": false
    },
    {
      "texto": "Brasília",
      "ordem": 2,
      "correta": true
    },
    {
      "texto": "Rio de Janeiro",
      "ordem": 3,
      "correta": false
    }
  ]
}
```

**Body para ANEXO:**

```json
{
  "enunciado": "Envie um arquivo PDF com seu projeto",
  "tipo": "ANEXO",
  "ordem": 2,
  "peso": 3.0,
  "obrigatoria": true
}
```

**Validações:**

- `enunciado`: obrigatório, 1-2000 caracteres (trim aplicado)
- `tipo`: obrigatório, um dos: `TEXTO`, `MULTIPLA_ESCOLHA`, `ANEXO`
- `ordem`: opcional, inteiro >= 0 (se não fornecido, será o próximo número sequencial)
- `peso`: opcional, número > 0 e <= 1000
- `obrigatoria`: opcional, boolean (default: `true`)
- `alternativas`: obrigatório para `MULTIPLA_ESCOLHA`
  - Mínimo 2 alternativas
  - Exatamente 1 alternativa deve ter `correta: true`
  - Cada alternativa: `texto` (1-1000 caracteres), `ordem` (opcional), `correta` (opcional, default: `false`)

**Resposta:** Objeto da questão criada (mesmo formato do GET).

**Códigos de Erro:**

- `400`: Dados inválidos (`VALIDATION_ERROR`)
- `404`: Prova não encontrada (`PROVA_NOT_FOUND`)
- `404`: Turma não encontrada (`TURMA_NOT_FOUND`)

---

### 4. Atualizar Questão

**PUT** `/questoes/{questaoId}`

**Body:** Todos os campos opcionais (mesmos do create)

**Exemplo - Atualizar enunciado e alternativas:**

```json
{
  "enunciado": "Texto atualizado",
  "peso": 2.5,
  "alternativas": [
    {
      "id": "uuid-existente",
      "texto": "Alternativa atualizada",
      "ordem": 1,
      "correta": true
    },
    {
      "texto": "Nova alternativa",
      "ordem": 2,
      "correta": false
    }
  ]
}
```

**Comportamento:**

- Se `alternativas` for fornecido:
  - Alternativas com `id` são atualizadas
  - Alternativas sem `id` são criadas
  - Alternativas existentes que não estão na lista são removidas
- Se o tipo mudar de `MULTIPLA_ESCOLHA` para outro, todas as alternativas são removidas automaticamente
- Se `ordem` não for fornecida, mantém a ordem atual

**Resposta:** Objeto da questão atualizada.

**Códigos de Erro:**

- `400`: Dados inválidos (`VALIDATION_ERROR`)
- `400`: Nenhum campo fornecido para atualização
- `404`: Questão não encontrada (`QUESTAO_NOT_FOUND`)
- `404`: Prova não encontrada (`PROVA_NOT_FOUND`)

---

### 5. Remover Questão

**DELETE** `/questoes/{questaoId}`

**Resposta:**

```json
{
  "success": true
}
```

**Nota:** A remoção é em cascata - todas as alternativas e respostas relacionadas são removidas automaticamente.

**Códigos de Erro:**

- `404`: Questão não encontrada (`QUESTAO_NOT_FOUND`)
- `404`: Prova não encontrada (`PROVA_NOT_FOUND`)

---

### 6. Responder Questão

**PUT** `/questoes/{questaoId}/responder`

**Body para TEXTO:**

```json
{
  "inscricaoId": "uuid",
  "respostaTexto": "REST é um estilo arquitetural para sistemas distribuídos..."
}
```

**Body para MULTIPLA_ESCOLHA:**

```json
{
  "inscricaoId": "uuid",
  "alternativaId": "uuid-da-alternativa"
}
```

**Body para ANEXO:**

```json
{
  "inscricaoId": "uuid",
  "anexoUrl": "https://storage.example.com/arquivo.pdf",
  "anexoNome": "projeto.pdf"
}
```

**Validações:**

- `inscricaoId`: obrigatório (pode vir do body ou do token JWT)
- Para `TEXTO`: `respostaTexto` obrigatório (até 10.000 caracteres)
- Para `MULTIPLA_ESCOLHA`: `alternativaId` obrigatório (UUID válido)
- Para `ANEXO`: `anexoUrl` obrigatório (URL válida, até 500 caracteres), `anexoNome` opcional (até 255 caracteres)

**Comportamento:**

- Se já existir resposta, ela é atualizada (upsert)
- A resposta é vinculada automaticamente ao envio da prova se existir
- Valida se o tipo de resposta corresponde ao tipo da questão

**Resposta:**

```json
{
  "id": "uuid",
  "questaoId": "uuid",
  "inscricaoId": "uuid",
  "respostaTexto": "...",
  "alternativaId": null,
  "anexoUrl": null,
  "anexoNome": null,
  "corrigida": false,
  "nota": null,
  "observacoes": null,
  "criadoEm": "2024-01-01T00:00:00.000Z",
  "atualizadoEm": "2024-01-01T00:00:00.000Z"
}
```

**Códigos de Erro:**

- `400`: Dados inválidos (`VALIDATION_ERROR`)
- `400`: Tipo de resposta não corresponde ao tipo da questão
- `404`: Questão não encontrada (`QUESTAO_NOT_FOUND`)
- `404`: Inscrição não encontrada (`INSCRICAO_NOT_FOUND`)

---

### 7. Corrigir Resposta

**PUT** `/questoes/{questaoId}/corrigir`

**Body:**

```json
{
  "inscricaoId": "uuid",
  "nota": 8.5,
  "observacoes": "Boa resposta, mas faltou mencionar o uso de verbos HTTP.",
  "corrigida": true
}
```

**Validações:**

- `inscricaoId`: obrigatório
- `nota`: opcional, número entre 0 e 10 (1 casa decimal)
- `observacoes`: opcional, até 1000 caracteres
- `corrigida`: opcional, boolean (default: `true` se nota fornecida)

**Resposta:** Mesmo formato da resposta, com campos atualizados.

**Códigos de Erro:**

- `400`: Dados inválidos (`VALIDATION_ERROR`)
- `404`: Resposta não encontrada (`RESPOSTA_NOT_FOUND`)
- `404`: Questão não encontrada (`QUESTAO_NOT_FOUND`)

---

### 8. Listar Respostas

**GET** `/respostas?questaoId={uuid}&inscricaoId={uuid}`

**Query Params (opcionais):**

- `questaoId`: Filtrar por questão específica
- `inscricaoId`: Filtrar por aluno específico

**Resposta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "questaoId": "uuid",
      "questao": {
        "id": "uuid",
        "enunciado": "Explique o conceito de REST API",
        "tipo": "TEXTO"
      },
      "inscricaoId": "uuid",
      "respostaTexto": "REST é um estilo arquitetural...",
      "alternativa": null,
      "anexoUrl": null,
      "anexoNome": null,
      "corrigida": true,
      "nota": 8.5,
      "observacoes": "Boa resposta.",
      "criadoEm": "2024-01-01T00:00:00.000Z",
      "atualizadoEm": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "questaoId": "uuid",
      "questao": {
        "id": "uuid",
        "enunciado": "Qual é a capital do Brasil?",
        "tipo": "MULTIPLA_ESCOLHA"
      },
      "inscricaoId": "uuid",
      "respostaTexto": null,
      "alternativa": {
        "id": "uuid",
        "texto": "Brasília",
        "correta": true
      },
      "anexoUrl": null,
      "anexoNome": null,
      "corrigida": false,
      "nota": null,
      "observacoes": null,
      "criadoEm": "2024-01-01T00:00:00.000Z",
      "atualizadoEm": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Notas:**

- Respostas são ordenadas por `criadoEm` (descendente - mais recentes primeiro)
- O campo `alternativa` só é preenchido para respostas de múltipla escolha
- O campo `questao` sempre vem preenchido com informações básicas

**Códigos de Erro:**

- `404`: Prova não encontrada (`PROVA_NOT_FOUND`)
- `404`: Turma não encontrada (`TURMA_NOT_FOUND`)

---

## 📊 Estrutura de Dados

### Tipos TypeScript

```typescript
enum CursosTipoQuestao {
  TEXTO = 'TEXTO',
  MULTIPLA_ESCOLHA = 'MULTIPLA_ESCOLHA',
  ANEXO = 'ANEXO',
}

interface Questao {
  id: string;
  provaId: string;
  enunciado: string;
  tipo: CursosTipoQuestao;
  ordem: number;
  peso: number | null;
  obrigatoria: boolean;
  criadoEm: string; // ISO 8601
  atualizadoEm: string; // ISO 8601
  alternativas?: Alternativa[]; // Apenas para MULTIPLA_ESCOLHA
}

interface Alternativa {
  id: string;
  questaoId: string;
  texto: string;
  ordem: number;
  correta: boolean;
  criadoEm: string; // ISO 8601
  atualizadoEm: string; // ISO 8601
}

interface Resposta {
  id: string;
  questaoId: string;
  inscricaoId: string;
  respostaTexto: string | null; // Para TEXTO
  alternativaId: string | null; // Para MULTIPLA_ESCOLHA
  anexoUrl: string | null; // Para ANEXO
  anexoNome: string | null; // Para ANEXO
  corrigida: boolean;
  nota: number | null; // 0-10, 1 casa decimal
  observacoes: string | null; // Até 1000 caracteres
  criadoEm: string; // ISO 8601
  atualizadoEm: string; // ISO 8601
}

interface RespostaComQuestao extends Resposta {
  questao: {
    id: string;
    enunciado: string;
    tipo: CursosTipoQuestao;
  };
  alternativa?: {
    id: string;
    texto: string;
    correta: boolean;
  } | null;
}

interface Prova {
  id: string;
  turmaId: string;
  titulo: string;
  etiqueta: string;
  peso: number;
  valePonto: boolean; // Indica se conta para média
  ativo: boolean;
  localizacao: 'TURMA' | 'MODULO';
  // ... outros campos
}
```

---

## 🔄 Fluxos de Implementação

### Fluxo 1: Criar Prova com Questões (Instrutor)

1. Criar prova (API existente de provas)
2. Para cada questão:
   - Criar questão via `POST /questoes`
   - Se for múltipla escolha, incluir `alternativas` no body
   - Validar que alternativas têm pelo menos 2 itens e exatamente 1 correta
3. Listar questões para confirmar: `GET /questoes`
4. Opcionalmente, reordenar questões atualizando o campo `ordem`

**Exemplo de fluxo completo:**

```typescript
// 1. Criar prova (assumindo que já existe)
const provaId = 'prova-uuid';

// 2. Criar questão de múltipla escolha
const questao1 = await criarQuestao({
  enunciado: 'Qual é a capital do Brasil?',
  tipo: 'MULTIPLA_ESCOLHA',
  peso: 1.5,
  alternativas: [
    { texto: 'São Paulo', correta: false },
    { texto: 'Brasília', correta: true },
    { texto: 'Rio de Janeiro', correta: false },
  ],
});

// 3. Criar questão de texto
const questao2 = await criarQuestao({
  enunciado: 'Explique o conceito de REST API',
  tipo: 'TEXTO',
  peso: 2.0,
});

// 4. Verificar questões criadas
const questoes = await listarQuestoes();
```

---

### Fluxo 2: Aluno Responder Prova

1. Listar questões da prova: `GET /questoes`
2. Para cada questão:
   - Se `tipo === 'TEXTO'`: Mostrar textarea
   - Se `tipo === 'MULTIPLA_ESCOLHA'`: Mostrar radio buttons com alternativas
   - Se `tipo === 'ANEXO'`: Mostrar upload de arquivo
3. Salvar resposta: `PUT /questoes/{questaoId}/responder`
4. Verificar se todas questões obrigatórias foram respondidas
5. Opcionalmente, permitir edição de respostas antes de finalizar

**Validações no frontend:**

- Verificar se questão obrigatória foi respondida
- Para múltipla escolha, garantir que uma alternativa foi selecionada
- Para anexo, garantir que arquivo foi enviado e URL obtida
- Mostrar indicador visual de questões respondidas/não respondidas

---

### Fluxo 3: Instrutor Corrigir Respostas

1. Listar respostas: `GET /respostas?questaoId={uuid}` (por questão) ou `GET /respostas?inscricaoId={uuid}` (por aluno)
2. Para cada resposta:
   - Visualizar resposta do aluno
   - Atribuir nota (0-10)
   - Adicionar observações (opcional)
   - Marcar como corrigida
3. Salvar correção: `PUT /questoes/{questaoId}/corrigir`
4. Opcionalmente, calcular nota total da prova automaticamente

**Dicas:**

- Filtrar por questão facilita correção em lote
- Filtrar por aluno facilita ver todas respostas de um aluno
- Mostrar indicador visual de respostas corrigidas/não corrigidas

---

### Fluxo 4: Visualizar Notas (Aluno)

1. Listar respostas do aluno: `GET /respostas?inscricaoId={uuid}`
2. Mostrar:
   - Questão respondida (enunciado)
   - Resposta enviada
   - Nota (se corrigida)
   - Observações do instrutor (se houver)
   - Status (corrigida/não corrigida)

**UX Sugerida:**

- Agrupar por prova
- Mostrar nota total da prova
- Destacar questões não corrigidas
- Permitir visualizar resposta original mesmo após correção

---

## 💻 Exemplos de Código

### React/TypeScript - Hook para Questões

```typescript
import { useState, useEffect } from 'react';

interface UseQuestoesProps {
  cursoId: string;
  turmaId: string;
  provaId: string;
  token: string;
}

export function useQuestoes({ cursoId, turmaId, provaId, token }: UseQuestoesProps) {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestoes = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaId}/questoes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar questões');
      }

      const data = await response.json();
      setQuestoes(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cursoId && turmaId && provaId) {
      fetchQuestoes();
    }
  }, [cursoId, turmaId, provaId]);

  return { questoes, loading, error, refetch: fetchQuestoes };
}
```

---

### React/TypeScript - Componente para Responder Questão

```typescript
import { useState } from 'react';

interface ResponderQuestaoProps {
  questao: Questao;
  inscricaoId: string;
  cursoId: string;
  turmaId: string;
  provaId: string;
  token: string;
  onSuccess?: () => void;
}

export function ResponderQuestao({
  questao,
  inscricaoId,
  cursoId,
  turmaId,
  provaId,
  token,
  onSuccess,
}: ResponderQuestaoProps) {
  const [resposta, setResposta] = useState('');
  const [alternativaSelecionada, setAlternativaSelecionada] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      let body: any = { inscricaoId };

      if (questao.tipo === 'TEXTO') {
        if (!resposta.trim()) {
          setError('Resposta é obrigatória');
          return;
        }
        body.respostaTexto = resposta;
      } else if (questao.tipo === 'MULTIPLA_ESCOLHA') {
        if (!alternativaSelecionada) {
          setError('Selecione uma alternativa');
          return;
        }
        body.alternativaId = alternativaSelecionada;
      } else if (questao.tipo === 'ANEXO') {
        if (!arquivo) {
          setError('Arquivo é obrigatório');
          return;
        }
        // Primeiro fazer upload do arquivo (implementar função de upload)
        const anexoUrl = await uploadArquivo(arquivo);
        body.anexoUrl = anexoUrl;
        body.anexoNome = arquivo.name;
      }

      const response = await fetch(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaId}/questoes/${questao.id}/responder`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar resposta');
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="questao-container">
      <h3>{questao.enunciado}</h3>
      {questao.peso && <span className="peso">Peso: {questao.peso}</span>}

      {questao.tipo === 'TEXTO' && (
        <textarea
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          placeholder="Digite sua resposta..."
          rows={5}
          maxLength={10000}
        />
      )}

      {questao.tipo === 'MULTIPLA_ESCOLHA' && questao.alternativas && (
        <div className="alternativas">
          {questao.alternativas.map((alt) => (
            <label key={alt.id} className="alternativa">
              <input
                type="radio"
                name={`questao-${questao.id}`}
                value={alt.id}
                checked={alternativaSelecionada === alt.id}
                onChange={() => setAlternativaSelecionada(alt.id)}
              />
              <span>{alt.texto}</span>
            </label>
          ))}
        </div>
      )}

      {questao.tipo === 'ANEXO' && (
        <div className="anexo">
          <input
            type="file"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            accept=".pdf,.doc,.docx"
          />
          {arquivo && <span>Arquivo selecionado: {arquivo.name}</span>}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar Resposta'}
      </button>
    </div>
  );
}
```

---

### React/TypeScript - Criar Questão com Validação

```typescript
import { useState } from 'react';

interface CriarQuestaoProps {
  provaId: string;
  cursoId: string;
  turmaId: string;
  token: string;
  onSuccess?: () => void;
}

export function CriarQuestao({
  provaId,
  cursoId,
  turmaId,
  token,
  onSuccess,
}: CriarQuestaoProps) {
  const [enunciado, setEnunciado] = useState('');
  const [tipo, setTipo] = useState<CursosTipoQuestao>('TEXTO');
  const [peso, setPeso] = useState<number | null>(null);
  const [obrigatoria, setObrigatoria] = useState(true);
  const [alternativas, setAlternativas] = useState([
    { texto: '', correta: false },
    { texto: '', correta: false },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validarAlternativas = (): boolean => {
    if (tipo !== 'MULTIPLA_ESCOLHA') return true;

    const alternativasValidas = alternativas.filter((a) => a.texto.trim().length > 0);
    if (alternativasValidas.length < 2) {
      setError('Questões de múltipla escolha precisam de pelo menos 2 alternativas');
      return false;
    }

    const corretas = alternativasValidas.filter((a) => a.correta).length;
    if (corretas !== 1) {
      setError('Questões de múltipla escolha precisam ter exatamente 1 alternativa correta');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!enunciado.trim()) {
      setError('Enunciado é obrigatório');
      return;
    }

    if (!validarAlternativas()) {
      return;
    }

    try {
      setLoading(true);

      const body: any = {
        enunciado: enunciado.trim(),
        tipo,
        obrigatoria,
      };

      if (peso !== null && peso > 0) {
        body.peso = peso;
      }

      if (tipo === 'MULTIPLA_ESCOLHA') {
        body.alternativas = alternativas
          .filter((a) => a.texto.trim().length > 0)
          .map((alt, index) => ({
            texto: alt.texto.trim(),
            ordem: index + 1,
            correta: alt.correta,
          }));
      }

      const response = await fetch(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaId}/questoes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar questão');
      }

      // Limpar formulário
      setEnunciado('');
      setTipo('TEXTO');
      setPeso(null);
      setObrigatoria(true);
      setAlternativas([
        { texto: '', correta: false },
        { texto: '', correta: false },
      ]);

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="criar-questao">
      <label>
        Enunciado: *
        <textarea
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          required
          maxLength={2000}
          rows={3}
        />
      </label>

      <label>
        Tipo: *
        <select value={tipo} onChange={(e) => setTipo(e.target.value as CursosTipoQuestao)}>
          <option value="TEXTO">Texto</option>
          <option value="MULTIPLA_ESCOLHA">Múltipla Escolha</option>
          <option value="ANEXO">Anexo</option>
        </select>
      </label>

      <label>
        Peso:
        <input
          type="number"
          min="0.1"
          max="1000"
          step="0.1"
          value={peso || ''}
          onChange={(e) => setPeso(e.target.value ? parseFloat(e.target.value) : null)}
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={obrigatoria}
          onChange={(e) => setObrigatoria(e.target.checked)}
        />
        Obrigatória
      </label>

      {tipo === 'MULTIPLA_ESCOLHA' && (
        <div className="alternativas-editor">
          <h4>Alternativas: *</h4>
          {alternativas.map((alt, index) => (
            <div key={index} className="alternativa-editor">
              <input
                type="text"
                value={alt.texto}
                onChange={(e) => {
                  const novas = [...alternativas];
                  novas[index].texto = e.target.value;
                  setAlternativas(novas);
                }}
                placeholder={`Alternativa ${index + 1}`}
                maxLength={1000}
              />
              <label>
                <input
                  type="radio"
                  name="correta"
                  checked={alt.correta}
                  onChange={() => {
                    const novas = alternativas.map((a, i) => ({
                      ...a,
                      correta: i === index,
                    }));
                    setAlternativas(novas);
                  }}
                />
                Correta
              </label>
              <button
                type="button"
                onClick={() => {
                  const novas = alternativas.filter((_, i) => i !== index);
                  setAlternativas(novas);
                }}
                disabled={alternativas.length <= 2}
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAlternativas([...alternativas, { texto: '', correta: false }])}
          >
            Adicionar Alternativa
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Criando...' : 'Criar Questão'}
      </button>
    </form>
  );
}
```

---

### React/TypeScript - Corrigir Resposta

```typescript
interface CorrigirRespostaProps {
  questaoId: string;
  inscricaoId: string;
  cursoId: string;
  turmaId: string;
  provaId: string;
  token: string;
  respostaAtual: Resposta;
  onSuccess?: () => void;
}

export function CorrigirResposta({
  questaoId,
  inscricaoId,
  cursoId,
  turmaId,
  provaId,
  token,
  respostaAtual,
  onSuccess,
}: CorrigirRespostaProps) {
  const [nota, setNota] = useState<number | null>(
    respostaAtual.nota ?? null
  );
  const [observacoes, setObservacoes] = useState(
    respostaAtual.observacoes ?? ''
  );
  const [corrigida, setCorrigida] = useState(respostaAtual.corrigida);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const body: any = {
        inscricaoId,
        corrigida: true,
      };

      if (nota !== null) {
        if (nota < 0 || nota > 10) {
          setError('Nota deve estar entre 0 e 10');
          return;
        }
        body.nota = nota;
      }

      if (observacoes.trim()) {
        body.observacoes = observacoes.trim();
      }

      const response = await fetch(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaId}/questoes/${questaoId}/corrigir`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao corrigir resposta');
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="corrigir-resposta">
      <div className="resposta-aluno">
        <h4>Resposta do Aluno:</h4>
        {respostaAtual.respostaTexto && <p>{respostaAtual.respostaTexto}</p>}
        {respostaAtual.alternativaId && (
          <p>Alternativa selecionada: {respostaAtual.alternativaId}</p>
        )}
        {respostaAtual.anexoUrl && (
          <a href={respostaAtual.anexoUrl} target="_blank" rel="noopener noreferrer">
            {respostaAtual.anexoNome || 'Ver anexo'}
          </a>
        )}
      </div>

      <label>
        Nota (0-10):
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={nota ?? ''}
          onChange={(e) => setNota(e.target.value ? parseFloat(e.target.value) : null)}
        />
      </label>

      <label>
        Observações:
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          maxLength={1000}
          rows={4}
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={corrigida}
          onChange={(e) => setCorrigida(e.target.checked)}
        />
        Marcar como corrigida
      </label>

      {error && <div className="error">{error}</div>}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar Correção'}
      </button>
    </div>
  );
}
```

---

## ⚠️ Validações e Regras de Negócio

### Validações no Backend

1. **Questões de Múltipla Escolha:**
   - ✅ Mínimo 2 alternativas obrigatório
   - ✅ Exatamente 1 alternativa deve estar marcada como correta
   - ✅ Validação feita com `superRefine` do Zod

2. **Respostas:**
   - ✅ `TEXTO`: `respostaTexto` é obrigatório (até 10.000 caracteres)
   - ✅ `MULTIPLA_ESCOLHA`: `alternativaId` é obrigatório (UUID válido)
   - ✅ `ANEXO`: `anexoUrl` é obrigatório (URL válida, até 500 caracteres)
   - ✅ Tipo de resposta deve corresponder ao tipo da questão

3. **Notas:**
   - ✅ Valores entre 0 e 10
   - ✅ Apenas 1 casa decimal
   - ✅ Opcional (pode corrigir sem atribuir nota)

4. **Ordenação:**
   - ✅ Se `ordem` não fornecida, será calculada automaticamente (próximo número sequencial)
   - ✅ Questões são ordenadas por `ordem` (ascendente), depois por `criadoEm`

5. **Transações:**
   - ✅ Todas operações críticas usam transações do Prisma
   - ✅ Garantia de consistência de dados
   - ✅ Rollback automático em caso de erro

---

## 🐛 Tratamento de Erros

### Estrutura de Erro Padrão

```typescript
interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  issues?: Record<string, string[]>; // Para erros de validação Zod
  error?: string; // Mensagem técnica (apenas em desenvolvimento)
}
```

### Códigos de Erro Comuns

| Código                 | Status | Descrição                            |
| ---------------------- | ------ | ------------------------------------ |
| `VALIDATION_ERROR`     | 400    | Dados inválidos (ver campo `issues`) |
| `QUESTAO_NOT_FOUND`    | 404    | Questão não encontrada               |
| `PROVA_NOT_FOUND`      | 404    | Prova não encontrada                 |
| `TURMA_NOT_FOUND`      | 404    | Turma não encontrada                 |
| `INSCRICAO_NOT_FOUND`  | 404    | Inscrição não encontrada             |
| `RESPOSTA_NOT_FOUND`   | 404    | Resposta não encontrada              |
| `QUESTAO_CREATE_ERROR` | 500    | Erro ao criar questão                |
| `QUESTAO_UPDATE_ERROR` | 500    | Erro ao atualizar questão            |
| `RESPOSTA_ERROR`       | 500    | Erro ao registrar resposta           |
| `CORRECAO_ERROR`       | 500    | Erro ao corrigir resposta            |

### Exemplo de Tratamento

```typescript
async function criarQuestao(data: CreateQuestaoData) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();

      if (response.status === 400) {
        // Erro de validação
        if (error.issues) {
          // Mostrar erros específicos por campo
          Object.entries(error.issues).forEach(([field, messages]) => {
            console.error(`${field}: ${messages.join(', ')}`);
          });
        } else {
          console.error('Erro de validação:', error.message);
        }
      } else if (response.status === 404) {
        // Recurso não encontrado
        console.error('Não encontrado:', error.message);
      } else {
        // Erro genérico
        console.error('Erro:', error.message);
      }

      throw new Error(error.message);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      console.error('Erro de rede:', error.message);
    } else {
      console.error('Erro desconhecido:', error);
    }
    throw error;
  }
}
```

---

## 🎨 Boas Práticas

### 1. Upload de Arquivos

Para questões do tipo `ANEXO`, implemente upload de arquivos antes de chamar a API:

```typescript
async function uploadArquivo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Erro ao fazer upload do arquivo');
  }

  const data = await response.json();
  return data.url; // URL do arquivo no storage
}
```

### 2. Validação no Frontend

Sempre valide no frontend antes de enviar para o backend:

```typescript
function validarQuestao(questao: CreateQuestaoData): string | null {
  if (!questao.enunciado.trim()) {
    return 'Enunciado é obrigatório';
  }

  if (questao.enunciado.length > 2000) {
    return 'Enunciado deve ter no máximo 2000 caracteres';
  }

  if (questao.tipo === 'MULTIPLA_ESCOLHA') {
    if (!questao.alternativas || questao.alternativas.length < 2) {
      return 'Múltipla escolha precisa de pelo menos 2 alternativas';
    }

    const corretas = questao.alternativas.filter((a) => a.correta).length;
    if (corretas !== 1) {
      return 'Deve haver exatamente 1 alternativa correta';
    }
  }

  return null; // Válido
}
```

### 3. Feedback Visual

- ✅ Mostrar indicador de questões respondidas/não respondidas
- ✅ Destacar questões obrigatórias não respondidas
- ✅ Mostrar status de correção (corrigida/não corrigida)
- ✅ Exibir nota e observações quando disponíveis
- ✅ Indicar questões com peso maior

### 4. Performance

- ✅ Use paginação para listas grandes de questões/respostas
- ✅ Cache questões que não mudam frequentemente
- ✅ Implemente debounce para salvar respostas automaticamente
- ✅ Use React Query ou SWR para cache e sincronização

### 5. Acessibilidade

- ✅ Use labels apropriados para campos de formulário
- ✅ Forneça feedback de erro acessível
- ✅ Garanta navegação por teclado
- ✅ Use ARIA labels quando necessário

---

## 🔗 Integração com Provas Existentes

O campo `valePonto` nas provas deve ser considerado ao:

- ✅ Criar/editar prova (incluir campo `valePonto`)
- ✅ Calcular médias (apenas provas com `valePonto: true`)
- ✅ Exibir no dashboard de notas
- ✅ Filtrar provas que contam para média

---

## 📝 Notas de Implementação

1. **Upload de Arquivos:**
   - Para questões do tipo `ANEXO`, implemente upload de arquivos antes de chamar a API
   - Após upload, use a URL retornada no campo `anexoUrl`
   - Valide tipo e tamanho do arquivo no frontend

2. **Validação de Respostas:**
   - Verifique se todas questões obrigatórias foram respondidas antes de finalizar a prova
   - Valide tipo de resposta corresponde ao tipo da questão
   - Mostre mensagens de erro claras para o usuário

3. **Feedback Visual:**
   - Questões respondidas podem ter indicador visual (checkmark, cor diferente)
   - Questões corrigidas podem mostrar nota e observações
   - Questões não respondidas podem ter borda destacada

4. **Performance:**
   - Considere paginação para listas grandes de questões/respostas
   - Use cache para questões que não mudam frequentemente
   - Implemente auto-save para respostas (debounce)

5. **Segurança:**
   - Nunca exponha alternativas corretas para alunos antes da correção
   - Valide permissões no frontend, mas sempre confie no backend
   - Sanitize inputs antes de exibir (prevenir XSS)

---

## 📚 Recursos Adicionais

- **Documentação Swagger**: `/api-docs` (quando disponível)
- **Códigos de erro**: Verificar campo `code` nas respostas de erro
- **Logs**: Verificar console do navegador para detalhes de erros
- **Validação Zod**: Schema completo em `src/modules/cursos/validators/questoes.schema.ts`

---

## 🔄 Changelog

### 2025-12-16

- ✅ Melhorada validação de múltipla escolha usando `superRefine`
- ✅ Adicionada documentação completa de códigos de erro
- ✅ Melhorados exemplos de código React/TypeScript
- ✅ Adicionada seção de boas práticas
- ✅ Documentado comportamento de transações e consistência
- ✅ Adicionada documentação sobre ordenação automática

---

**Última atualização:** 2025-12-16

















