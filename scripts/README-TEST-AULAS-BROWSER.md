# Teste Automatizado de Cadastro de Aulas via Navegador

Este script automatiza testes de cadastro de aulas através do navegador usando Puppeteer.

## Pré-requisitos

1. Frontend rodando em `http://localhost:3001`
2. Backend rodando e conectado ao banco de dados
3. Usuário admin de teste criado:
   - CPF: `11111111111`
   - Senha: `AdminTeste@123`
   - Role: `ADMIN`

## Como Executar

```bash
pnpm exec ts-node --transpile-only -r tsconfig-paths/register scripts/test-aulas-automatizado-browser.ts
```

## O que o Script Testa

### FASE 1: Sem vínculos (sem curso, turma, instrutor, materiais)

- ✅ ONLINE sem vínculos
- ✅ PRESENCIAL sem vínculos
- ✅ AO_VIVO sem vínculos
- ✅ SEMIPRESENCIAL sem vínculos

### FASE 2: Com curso e turma (sem instrutor, sem materiais)

- ✅ ONLINE com curso e turma
- ✅ PRESENCIAL com curso e turma
- ✅ AO_VIVO com curso e turma
- ✅ SEMIPRESENCIAL com curso e turma

### FASE 3: Com instrutor (sem curso/turma, sem materiais)

- ✅ ONLINE com instrutor
- ✅ PRESENCIAL com instrutor
- ✅ AO_VIVO com instrutor
- ✅ SEMIPRESENCIAL com instrutor

### FASE 4: Com curso, turma e instrutor (sem materiais)

- ✅ ONLINE completo
- ✅ PRESENCIAL completo
- ✅ AO_VIVO completo
- ✅ SEMIPRESENCIAL completo

### FASE 5: Com materiais (sem outros vínculos)

- ✅ ONLINE com materiais
- ✅ PRESENCIAL com materiais
- ✅ AO_VIVO com materiais
- ✅ SEMIPRESENCIAL com materiais

### FASE 6: Com materiais + curso + turma + instrutor

- ✅ ONLINE completo com materiais
- ✅ PRESENCIAL completo com materiais
- ✅ AO_VIVO completo com materiais
- ✅ SEMIPRESENCIAL completo com materiais

**Total: 24 testes automatizados**

## Funcionalidades

- ✅ Login automático
- ✅ Navegação automática para página de cadastro
- ✅ Preenchimento automático de formulários
- ✅ Submissão automática
- ✅ Detecção de erros
- ✅ Relatório final com resumo de sucessos e falhas
- ✅ Busca automática de IDs (curso, turma, instrutor) no banco

## Notas

- O script abre o navegador em modo visível (`headless: false`) para facilitar debug
- Se algum ID (curso, turma, instrutor) não for encontrado, as fases correspondentes serão puladas
- O script aguarda automaticamente o carregamento de elementos antes de interagir
- Todos os erros são capturados e reportados no resumo final

## Troubleshooting

### Chrome não encontrado

```bash
pnpm exec puppeteer browsers install chrome
```

### Erro de login

- Verificar se o usuário admin existe no banco
- Verificar se o frontend está rodando na porta 3001
- Verificar credenciais no script

### Elementos não encontrados

- O script tenta múltiplos seletores para encontrar elementos
- Se o frontend mudar a estrutura, pode ser necessário ajustar os seletores no script
