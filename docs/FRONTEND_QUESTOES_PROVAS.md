# Guia de Implementação - Sistema de Questões para Provas

Este documento descreve como implementar no front-end o sistema de questões e respostas para provas.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Novas Funcionalidades](#novas-funcionalidades)
3. [APIs Disponíveis](#apis-disponíveis)
4. [Estrutura de Dados](#estrutura-de-dados)
5. [Fluxos de Implementação](#fluxos-de-implementação)
6. [Exemplos de Código](#exemplos-de-código)

---

## 🎯 Visão Geral

O sistema agora permite criar provas com questões de diferentes tipos:
- **TEXTO**: Resposta livre em texto
- **MULTIPLA_ESCOLHA**: Questões com alternativas (uma correta)
- **ANEXO**: Upload de arquivo

Cada prova pode ter o campo `valePonto` que indica se ela deve ser considerada no cálculo da média.

---

## ✨ Novas Funcionalidades

### 1. Campo `valePonto` em Provas

As provas agora possuem um campo `valePonto` (boolean, default: `true`) que indica se a prova deve ser considerada no cálculo da média.

```typescript
interface Prova {
  id: string;
  titulo: string;
  etiqueta: string;
  peso: number;
  valePonto: boolean; // NOVO
  // ... outros campos
}
```

### 2. Sistema de Questões

Cada prova pode ter múltiplas questões com diferentes tipos e pesos.

### 3. Sistema de Respostas

Alunos podem responder questões e instrutores podem corrigir e atribuir notas.

---

## 🔌 APIs Disponíveis

### Base URL
Todas as rotas seguem o padrão:
```
/api/v1/cursos/{cursoId}/turmas/{turmaId}/provas/{provaId}
```

### Autenticação
Todas as rotas requerem Bearer Token (JWT) e roles: `ADMIN`, `MODERADOR`, `PEDAGOGICO`, `INSTRUTOR`

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
          "texto": "Brasília",
          "ordem": 2,
          "correta": true
        }
      ]
    }
  ]
}
```

---

### 2. Detalhar Questão

**GET** `/questoes/{questaoId}`

**Resposta:** Mesmo formato do item da lista acima.

---

### 3. Criar Questão

**POST** `/questoes`

**Body:**
```json
{
  "enunciado": "Explique o conceito de REST API",
  "tipo": "TEXTO",
  "ordem": 1,
  "peso": 2.0,
  "obrigatoria": true
}
```

**Para múltipla escolha:**
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

**Para anexo:**
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
- `enunciado`: obrigatório, 1-2000 caracteres
- `tipo`: obrigatório, um dos: `TEXTO`, `MULTIPLA_ESCOLHA`, `ANEXO`
- `alternativas`: obrigatório para `MULTIPLA_ESCOLHA`, mínimo 2 alternativas, exatamente 1 correta

---

### 4. Atualizar Questão

**PUT** `/questoes/{questaoId}`

**Body:** Todos os campos opcionais (mesmos do create)

**Exemplo:**
```json
{
  "enunciado": "Texto atualizado",
  "peso": 2.5,
  "alternativas": [
    {
      "id": "uuid-existente",
      "texto": "Alternativa atualizada",
      "correta": true
    },
    {
      "texto": "Nova alternativa",
      "correta": false
    }
  ]
}
```

---

### 5. Remover Questão

**DELETE** `/questoes/{questaoId}`

**Resposta:**
```json
{
  "success": true
}
```

---

### 6. Responder Questão

**PUT** `/questoes/{questaoId}/responder`

**Body:**
```json
{
  "inscricaoId": "uuid",
  "respostaTexto": "REST é um estilo arquitetural..." // Para TEXTO
}
```

**Para múltipla escolha:**
```json
{
  "inscricaoId": "uuid",
  "alternativaId": "uuid-da-alternativa"
}
```

**Para anexo:**
```json
{
  "inscricaoId": "uuid",
  "anexoUrl": "https://storage.example.com/arquivo.pdf",
  "anexoNome": "projeto.pdf"
}
```

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

---

### 7. Corrigir Resposta

**PUT** `/questoes/{questaoId}/corrigir`

**Body:**
```json
{
  "inscricaoId": "uuid",
  "nota": 8.5,
  "observacoes": "Boa resposta, mas faltou mencionar...",
  "corrigida": true
}
```

**Resposta:** Mesmo formato da resposta, com campos atualizados.

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
        "enunciado": "...",
        "tipo": "TEXTO"
      },
      "inscricaoId": "uuid",
      "respostaTexto": "...",
      "alternativa": null,
      "anexoUrl": null,
      "anexoNome": null,
      "corrigida": true,
      "nota": 8.5,
      "observacoes": "...",
      "criadoEm": "2024-01-01T00:00:00.000Z",
      "atualizadoEm": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 📊 Estrutura de Dados

### Tipos TypeScript

```typescript
enum TipoQuestao {
  TEXTO = 'TEXTO',
  MULTIPLA_ESCOLHA = 'MULTIPLA_ESCOLHA',
  ANEXO = 'ANEXO'
}

interface Questao {
  id: string;
  provaId: string;
  enunciado: string;
  tipo: TipoQuestao;
  ordem: number;
  peso: number | null;
  obrigatoria: boolean;
  criadoEm: string;
  atualizadoEm: string;
  alternativas?: Alternativa[];
}

interface Alternativa {
  id: string;
  questaoId: string;
  texto: string;
  ordem: number;
  correta: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

interface Resposta {
  id: string;
  questaoId: string;
  inscricaoId: string;
  respostaTexto: string | null;
  alternativaId: string | null;
  anexoUrl: string | null;
  anexoNome: string | null;
  corrigida: boolean;
  nota: number | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

interface Prova {
  // ... campos existentes
  valePonto: boolean; // NOVO
}
```

---

## 🔄 Fluxos de Implementação

### Fluxo 1: Criar Prova com Questões (Instrutor)

1. Criar prova (API existente)
2. Para cada questão:
   - Criar questão via `POST /questoes`
   - Se for múltipla escolha, incluir `alternativas` no body
3. Listar questões para confirmar: `GET /questoes`

### Fluxo 2: Aluno Responder Prova

1. Listar questões da prova: `GET /questoes`
2. Para cada questão:
   - Se `tipo === 'TEXTO'`: Mostrar textarea
   - Se `tipo === 'MULTIPLA_ESCOLHA'`: Mostrar radio buttons com alternativas
   - Se `tipo === 'ANEXO'`: Mostrar upload de arquivo
3. Salvar resposta: `PUT /questoes/{questaoId}/responder`
4. Verificar se todas questões obrigatórias foram respondidas

### Fluxo 3: Instrutor Corrigir Respostas

1. Listar respostas: `GET /respostas?questaoId={uuid}`
2. Para cada resposta:
   - Visualizar resposta do aluno
   - Atribuir nota (0-10)
   - Adicionar observações
   - Marcar como corrigida
3. Salvar correção: `PUT /questoes/{questaoId}/corrigir`

### Fluxo 4: Visualizar Notas (Aluno)

1. Listar respostas do aluno: `GET /respostas?inscricaoId={uuid}`
2. Mostrar:
   - Questão respondida
   - Resposta enviada
   - Nota (se corrigida)
   - Observações do instrutor

---

## 💻 Exemplos de Código

### React/TypeScript - Listar Questões

```typescript
import { useState, useEffect } from 'react';

interface Questao {
  id: string;
  enunciado: string;
  tipo: 'TEXTO' | 'MULTIPLA_ESCOLHA' | 'ANEXO';
  alternativas?: Array<{
    id: string;
    texto: string;
    correta: boolean;
  }>;
}

function QuestoesProva({ cursoId, turmaId, provaId }: Props) {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestoes();
  }, []);

  const fetchQuestoes = async () => {
    try {
      const response = await fetch(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaId}/questoes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await response.json();
      setQuestoes(data.data);
    } catch (error) {
      console.error('Erro ao buscar questões:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      {questoes.map((questao) => (
        <QuestaoItem key={questao.id} questao={questao} />
      ))}
    </div>
  );
}
```

### React/TypeScript - Responder Questão

```typescript
function ResponderQuestao({ questao, inscricaoId }: Props) {
  const [resposta, setResposta] = useState('');
  const [alternativaSelecionada, setAlternativaSelecionada] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);

  const handleSubmit = async () => {
    try {
      let body: any = { inscricaoId };

      if (questao.tipo === 'TEXTO') {
        body.respostaTexto = resposta;
      } else if (questao.tipo === 'MULTIPLA_ESCOLHA') {
        body.alternativaId = alternativaSelecionada;
      } else if (questao.tipo === 'ANEXO') {
        // Primeiro fazer upload do arquivo
        const anexoUrl = await uploadArquivo(arquivo);
        body.anexoUrl = anexoUrl;
        body.anexoNome = arquivo?.name;
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

      if (response.ok) {
        alert('Resposta salva com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar resposta:', error);
    }
  };

  return (
    <div>
      <h3>{questao.enunciado}</h3>
      
      {questao.tipo === 'TEXTO' && (
        <textarea
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          placeholder="Digite sua resposta..."
        />
      )}

      {questao.tipo === 'MULTIPLA_ESCOLHA' && questao.alternativas && (
        <div>
          {questao.alternativas.map((alt) => (
            <label key={alt.id}>
              <input
                type="radio"
                name={`questao-${questao.id}`}
                value={alt.id}
                checked={alternativaSelecionada === alt.id}
                onChange={() => setAlternativaSelecionada(alt.id)}
              />
              {alt.texto}
            </label>
          ))}
        </div>
      )}

      {questao.tipo === 'ANEXO' && (
        <input
          type="file"
          onChange={(e) => setArquivo(e.target.files?.[0] || null)}
        />
      )}

      <button onClick={handleSubmit}>Salvar Resposta</button>
    </div>
  );
}
```

### React/TypeScript - Criar Questão

```typescript
function CriarQuestao({ provaId }: Props) {
  const [enunciado, setEnunciado] = useState('');
  const [tipo, setTipo] = useState<'TEXTO' | 'MULTIPLA_ESCOLHA' | 'ANEXO'>('TEXTO');
  const [alternativas, setAlternativas] = useState([
    { texto: '', correta: false },
    { texto: '', correta: false },
  ]);

  const handleSubmit = async () => {
    try {
      const body: any = {
        enunciado,
        tipo,
        ordem: 1,
        obrigatoria: true,
      };

      if (tipo === 'MULTIPLA_ESCOLHA') {
        // Validar: pelo menos 2 alternativas e exatamente 1 correta
        const corretas = alternativas.filter((a) => a.correta).length;
        if (alternativas.length < 2 || corretas !== 1) {
          alert('Questões de múltipla escolha precisam de pelo menos 2 alternativas e exatamente 1 correta');
          return;
        }

        body.alternativas = alternativas.map((alt, index) => ({
          texto: alt.texto,
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

      if (response.ok) {
        alert('Questão criada com sucesso!');
        // Limpar formulário ou redirecionar
      }
    } catch (error) {
      console.error('Erro ao criar questão:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Enunciado:
        <textarea
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          required
        />
      </label>

      <label>
        Tipo:
        <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
          <option value="TEXTO">Texto</option>
          <option value="MULTIPLA_ESCOLHA">Múltipla Escolha</option>
          <option value="ANEXO">Anexo</option>
        </select>
      </label>

      {tipo === 'MULTIPLA_ESCOLHA' && (
        <div>
          <h4>Alternativas:</h4>
          {alternativas.map((alt, index) => (
            <div key={index}>
              <input
                type="text"
                value={alt.texto}
                onChange={(e) => {
                  const novas = [...alternativas];
                  novas[index].texto = e.target.value;
                  setAlternativas(novas);
                }}
                placeholder={`Alternativa ${index + 1}`}
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

      <button type="submit">Criar Questão</button>
    </form>
  );
}
```

### React/TypeScript - Corrigir Resposta

```typescript
function CorrigirResposta({ questaoId, inscricaoId }: Props) {
  const [nota, setNota] = useState<number | null>(null);
  const [observacoes, setObservacoes] = useState('');

  const handleSubmit = async () => {
    try {
      const response = await fetch(
        `/api/v1/cursos/${cursoId}/turmas/${turmaId}/provas/${provaId}/questoes/${questaoId}/corrigir`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inscricaoId,
            nota,
            observacoes,
            corrigida: true,
          }),
        }
      );

      if (response.ok) {
        alert('Resposta corrigida com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao corrigir resposta:', error);
    }
  };

  return (
    <div>
      <label>
        Nota (0-10):
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={nota || ''}
          onChange={(e) => setNota(parseFloat(e.target.value) || null)}
        />
      </label>

      <label>
        Observações:
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </label>

      <button onClick={handleSubmit}>Salvar Correção</button>
    </div>
  );
}
```

---

## ⚠️ Validações Importantes

1. **Múltipla Escolha:**
   - Mínimo 2 alternativas
   - Exatamente 1 alternativa deve estar marcada como correta

2. **Respostas:**
   - TEXTO: `respostaTexto` é obrigatório
   - MULTIPLA_ESCOLHA: `alternativaId` é obrigatório
   - ANEXO: `anexoUrl` é obrigatório

3. **Notas:**
   - Valores entre 0 e 10
   - Apenas 1 casa decimal

---

## 🔗 Integração com Provas Existentes

O campo `valePonto` nas provas deve ser considerado ao:
- Criar/editar prova
- Calcular médias (apenas provas com `valePonto: true` devem ser consideradas)
- Exibir no dashboard de notas

---

## 📝 Notas de Implementação

1. **Upload de Arquivos:**
   - Para questões do tipo ANEXO, você precisará implementar upload de arquivos
   - Após upload, use a URL retornada no campo `anexoUrl`

2. **Validação de Respostas:**
   - Verifique se todas questões obrigatórias foram respondidas antes de finalizar a prova

3. **Feedback Visual:**
   - Questões respondidas podem ter indicador visual
   - Questões corrigidas podem mostrar nota e observações

4. **Performance:**
   - Considere paginação para listas grandes de questões/respostas
   - Use cache para questões que não mudam frequentemente

---

## 🐛 Tratamento de Erros

```typescript
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 400) {
      // Erro de validação
      console.error('Erros:', error.issues);
    } else if (response.status === 404) {
      // Recurso não encontrado
      console.error('Não encontrado:', error.message);
    } else {
      // Erro genérico
      console.error('Erro:', error.message);
    }
  }
} catch (error) {
  console.error('Erro de rede:', error);
}
```

---

## 📚 Recursos Adicionais

- Documentação Swagger: `/api-docs` (quando disponível)
- Códigos de erro: Verificar campo `code` nas respostas de erro
- Logs: Verificar console do navegador para detalhes de erros

---

**Última atualização:** 2025-12-16

