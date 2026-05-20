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

Todos os alunos migrados e todos os usuários com `role=EMPRESA` recebem a senha:

```txt
BemVindo@2026
```

A senha é persistida com bcrypt.

## Regra de identidade

O CPF é a chave principal do aluno.

A seed coloca em quarentena os registros que encontrar com:

- CPF ausente ou inválido;
- data de cadastro inválida;
- `DT INÍCIO` ou `DT FIM` ausente/inválido;
- mesmo CPF associado a nomes divergentes.
- CPF já existente no banco em usuário administrativo, como `ADMIN`, `MODERADOR` ou `PEDAGOGICO`.

Duplicatas exatas por `CPF + curso + DT INÍCIO + DT FIM` são consolidadas.

Por padrão, a execução real importa os registros seguros e gera um relatório local com os registros em quarentena. Para bloquear qualquer importação quando houver pendência, rode com `--strict`.

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

Executar a migração real importando registros seguros e isolando pendências:

```bash
pnpm run seed:migracao:legado
```

Executar em modo estrito, bloqueando tudo se houver pendência:

```bash
pnpm run seed:migracao:legado -- --strict
```

Retomar apenas alunos, cursos, turmas, inscrições e certificados quando a etapa de empresas já tiver sido concluída:

```bash
pnpm run seed:migracao:legado -- --skip-empresas
```

O alias antigo continua disponível:

```bash
pnpm run seed:empresas
```

## Bloqueios atuais da planilha

O arquivo normalizado atual contém pendências conhecidas que irão para quarentena:

- 2 registros sem CPF;
- 43 registros sem `DT INÍCIO/DT FIM`;
- CPFs com nomes divergentes.

Enquanto esses itens existirem, eles não serão importados. O restante dos registros válidos pode ser migrado.

Relatórios de quarentena são gerados localmente em:

```txt
prisma/seeds/reports/
```

## Arquivos que não devem entrar no commit

```txt
.env_prod
grid_w_alunoCursos.xlsx
prisma/seeds/reports/
```
