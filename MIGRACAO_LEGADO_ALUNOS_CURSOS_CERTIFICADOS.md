# Migração Legado - Alunos, Cursos e Certificados

## Objetivo

Importar dados históricos do sistema legado para preservar:

- empresas migradas;
- alunos por CPF;
- cursos históricos;
- turmas históricas;
- inscrições concluídas;
- certificados emitidos.

A fonte original é `grid_w_alunoCursos.xlsx`. O repositório versiona apenas o JSON normalizado:

```txt
prisma/seeds/data/alunos-cursos-certificados-migracao.json
```

A planilha `.xlsx` fica local e não deve ser commitada.

## Senha padrão

Todos os alunos migrados e todas as empresas processadas pela migração recebem a senha:

```txt
BemVindo@2026
```

A senha é persistida com bcrypt.

## Regra de identidade

O CPF é a chave principal do aluno.

A seed bloqueia a execução real quando encontra:

- CPF ausente ou inválido;
- data de cadastro inválida;
- `DT INÍCIO` ou `DT FIM` ausente/inválido;
- mesmo CPF associado a nomes divergentes.

Duplicatas exatas por `CPF + curso + DT INÍCIO + DT FIM` são consolidadas.

## Datas preservadas

As datas do legado são gravadas em UTC ao meio-dia para evitar mudança de dia por timezone.

- `Usuarios.criadoEm`: menor data de `CADASTRO` do aluno.
- `CursosTurmasInscricoes.criadoEm`: data de `CADASTRO` do registro.
- `CursosCertificadosEmitidos.emitidoEm`: `DT FIM`.
- `CursosCertificadosLogs.criadoEm`: `DT FIM`.

## Turmas históricas

As turmas criadas pela migração existem apenas para preservar o vínculo:

```txt
aluno -> inscrição -> turma -> curso -> certificado
```

Elas são criadas com:

- `status=CONCLUIDO`;
- `estruturaTipo=PADRAO`;
- sem aulas, módulos, provas ou atividades;
- `vagasIlimitadas=true`.

Os cursos históricos são criados como `statusPadrao=RASCUNHO` para não publicar catálogo legado automaticamente.

## Comandos

Validar sem gravar no banco:

```bash
pnpm run seed:migracao:legado -- --dry-run
```

Executar a migração real:

```bash
pnpm run seed:migracao:legado
```

O alias antigo continua disponível:

```bash
pnpm run seed:empresas
```

## Bloqueios atuais da planilha

O arquivo normalizado atual contém bloqueios conhecidos:

- 2 registros sem CPF;
- 43 registros sem `DT INÍCIO/DT FIM`;
- CPFs com nomes divergentes.

Enquanto esses itens existirem, a execução real será bloqueada antes de qualquer escrita.

## Arquivos que não devem entrar no commit

```txt
.env_prod
grid_w_alunoCursos.xlsx
```
