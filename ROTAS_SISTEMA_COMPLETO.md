# Rotas do Sistema

Gerado automaticamente em **2026-02-12T01:21:02.619Z**.

Total de rotas: **453**

## Índice de módulos

- [`/api/v1/auditoria`](#apiv1auditoria)
- [`/api/v1/auth/google`](#apiv1authgoogle)
- [`/api/v1/brevo`](#apiv1brevo)
- [`/api/v1/candidatos`](#apiv1candidatos)
- [`/api/v1/cupons`](#apiv1cupons)
- [`/api/v1/cursos`](#apiv1cursos)
- [`/api/v1/dashboard`](#apiv1dashboard)
- [`/api/v1/empresas`](#apiv1empresas)
- [`/api/v1/mercadopago`](#apiv1mercadopago)
- [`/api/v1/notificacoes`](#apiv1notificacoes)
- [`/api/v1/recrutador`](#apiv1recrutador)
- [`/api/v1/requerimentos`](#apiv1requerimentos)
- [`/api/v1/status-processo`](#apiv1status-processo)
- [`/api/v1/usuarios`](#apiv1usuarios)
- [`/api/v1/vagas/solicitacoes`](#apiv1vagassolicitacoes)
- [`/api/v1/website`](#apiv1website)
- [`Sistema`](#sistema)

## /api/v1/auditoria

| Método | Rota                                              |
| ------ | ------------------------------------------------- |
| `GET`  | `/api/v1/auditoria/assinaturas`                   |
| `GET`  | `/api/v1/auditoria/assinaturas/:id`               |
| `GET`  | `/api/v1/auditoria/logs`                          |
| `GET`  | `/api/v1/auditoria/logs/:id`                      |
| `GET`  | `/api/v1/auditoria/scripts`                       |
| `GET`  | `/api/v1/auditoria/scripts/:id`                   |
| `GET`  | `/api/v1/auditoria/transacoes`                    |
| `GET`  | `/api/v1/auditoria/transacoes/:id`                |
| `GET`  | `/api/v1/auditoria/usuarios/:usuarioId/historico` |

## /api/v1/auth/google

| Método | Rota                             |
| ------ | -------------------------------- |
| `GET`  | `/api/v1/auth/google/callback`   |
| `GET`  | `/api/v1/auth/google/connect`    |
| `POST` | `/api/v1/auth/google/disconnect` |
| `GET`  | `/api/v1/auth/google/status`     |

## /api/v1/brevo

| Método | Rota                                       |
| ------ | ------------------------------------------ |
| `GET`  | `/api/v1/brevo`                            |
| `GET`  | `/api/v1/brevo/config`                     |
| `GET`  | `/api/v1/brevo/health`                     |
| `POST` | `/api/v1/brevo/reenviar`                   |
| `POST` | `/api/v1/brevo/reenviar-verificacao`       |
| `GET`  | `/api/v1/brevo/status-verificacao/:userId` |
| `GET`  | `/api/v1/brevo/status/:email`              |
| `POST` | `/api/v1/brevo/test/email`                 |
| `POST` | `/api/v1/brevo/test/sms`                   |
| `GET`  | `/api/v1/brevo/verificar`                  |
| `GET`  | `/api/v1/brevo/verificar-email`            |

## /api/v1/candidatos

| Método   | Rota                                                  |
| -------- | ----------------------------------------------------- |
| `GET`    | `/api/v1/candidatos`                                  |
| `POST`   | `/api/v1/candidatos/aplicar`                          |
| `GET`    | `/api/v1/candidatos/areas-interesse`                  |
| `POST`   | `/api/v1/candidatos/areas-interesse`                  |
| `POST`   | `/api/v1/candidatos/areas-interesse/:areaId/subareas` |
| `DELETE` | `/api/v1/candidatos/areas-interesse/:id`              |
| `GET`    | `/api/v1/candidatos/areas-interesse/:id`              |
| `PUT`    | `/api/v1/candidatos/areas-interesse/:id`              |
| `GET`    | `/api/v1/candidatos/candidaturas`                     |
| `DELETE` | `/api/v1/candidatos/candidaturas/:id`                 |
| `GET`    | `/api/v1/candidatos/candidaturas/:id`                 |
| `PUT`    | `/api/v1/candidatos/candidaturas/:id`                 |
| `GET`    | `/api/v1/candidatos/candidaturas/overview`            |
| `GET`    | `/api/v1/candidatos/candidaturas/recebidas`           |
| `GET`    | `/api/v1/candidatos/candidaturas/status-disponiveis`  |
| `GET`    | `/api/v1/candidatos/candidaturas/verificar`           |
| `GET`    | `/api/v1/candidatos/curriculos`                       |
| `POST`   | `/api/v1/candidatos/curriculos`                       |
| `DELETE` | `/api/v1/candidatos/curriculos/:id`                   |
| `GET`    | `/api/v1/candidatos/curriculos/:id`                   |
| `PUT`    | `/api/v1/candidatos/curriculos/:id`                   |
| `PATCH`  | `/api/v1/candidatos/curriculos/:id/principal`         |
| `GET`    | `/api/v1/candidatos/cursos`                           |
| `GET`    | `/api/v1/candidatos/dashboard`                        |
| `GET`    | `/api/v1/candidatos/subareas-interesse`               |
| `POST`   | `/api/v1/candidatos/subareas-interesse`               |
| `DELETE` | `/api/v1/candidatos/subareas-interesse/:subareaId`    |
| `GET`    | `/api/v1/candidatos/subareas-interesse/:subareaId`    |
| `PUT`    | `/api/v1/candidatos/subareas-interesse/:subareaId`    |
| `GET`    | `/api/v1/candidatos/vagas`                            |

## /api/v1/cupons

| Método   | Rota                     |
| -------- | ------------------------ |
| `GET`    | `/api/v1/cupons`         |
| `POST`   | `/api/v1/cupons`         |
| `DELETE` | `/api/v1/cupons/:id`     |
| `GET`    | `/api/v1/cupons/:id`     |
| `PUT`    | `/api/v1/cupons/:id`     |
| `POST`   | `/api/v1/cupons/validar` |

## /api/v1/cursos

| Método   | Rota                                                                                    |
| -------- | --------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/cursos`                                                                        |
| `POST`   | `/api/v1/cursos`                                                                        |
| `DELETE` | `/api/v1/cursos/:cursoId`                                                               |
| `GET`    | `/api/v1/cursos/:cursoId`                                                               |
| `PUT`    | `/api/v1/cursos/:cursoId`                                                               |
| `GET`    | `/api/v1/cursos/:cursoId/auditoria`                                                     |
| `GET`    | `/api/v1/cursos/:cursoId/inscricoes`                                                    |
| `GET`    | `/api/v1/cursos/:cursoId/meta`                                                          |
| `GET`    | `/api/v1/cursos/:cursoId/notas`                                                         |
| `GET`    | `/api/v1/cursos/:cursoId/turmas`                                                        |
| `POST`   | `/api/v1/cursos/:cursoId/turmas`                                                        |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId`                                               |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId`                                               |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/agenda`                                        |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/agenda`                                        |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/agenda/:agendaId`                              |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/agenda/:agendaId`                              |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/agenda/:agendaId`                              |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/aulas`                                         |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/aulas`                                         |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/aulas/:aulaId`                                 |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/aulas/:aulaId`                                 |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/aulas/:aulaId`                                 |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/avaliacoes/clone`                              |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/certificados`                                  |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/certificados`                                  |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/frequencias`                                   |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/frequencias`                                   |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/:frequenciaId`                     |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/:frequenciaId`                     |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/:frequenciaId`                     |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/resumo`                            |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes`                                    |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes`                                    |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes/:alunoId`                           |
| `PATCH`  | `/api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes/:inscricaoId`                       |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes/:inscricaoId/estagios`              |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/inscricoes/:inscricaoId/estagios`              |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/modulos`                                       |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/modulos`                                       |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/modulos/:moduloId`                             |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/modulos/:moduloId`                             |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/modulos/:moduloId`                             |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/notas`                                         |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/notas`                                         |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/notas`                                         |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId`                                 |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId`                                 |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId`                                 |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas`                                        |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas`                                        |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId`                               |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId`                               |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId`                               |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/notas`                         |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/questoes`                      |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/questoes`                      |
| `DELETE` | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId`           |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId`           |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId`           |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId/corrigir`  |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/questoes/:questaoId/responder` |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/provas/:provaId/respostas`                     |
| `PATCH`  | `/api/v1/cursos/:cursoId/turmas/:turmaId/publicar`                                      |
| `POST`   | `/api/v1/cursos/:cursoId/turmas/:turmaId/recuperacoes`                                  |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/regras-avaliacao`                              |
| `PUT`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/regras-avaliacao`                              |
| `GET`    | `/api/v1/cursos/:cursoId/turmas/:turmaId/vagas`                                         |
| `GET`    | `/api/v1/cursos/agenda`                                                                 |
| `GET`    | `/api/v1/cursos/alunos`                                                                 |
| `GET`    | `/api/v1/cursos/alunos/:alunoId`                                                        |
| `PUT`    | `/api/v1/cursos/alunos/:alunoId`                                                        |
| `GET`    | `/api/v1/cursos/alunos/:alunoId/inscricoes`                                             |
| `GET`    | `/api/v1/cursos/aulas`                                                                  |
| `POST`   | `/api/v1/cursos/aulas`                                                                  |
| `GET`    | `/api/v1/cursos/aulas/:aulaId/materiais`                                                |
| `POST`   | `/api/v1/cursos/aulas/:aulaId/materiais`                                                |
| `DELETE` | `/api/v1/cursos/aulas/:aulaId/materiais/:materialId`                                    |
| `PUT`    | `/api/v1/cursos/aulas/:aulaId/materiais/:materialId`                                    |
| `POST`   | `/api/v1/cursos/aulas/:aulaId/materiais/:materialId/gerar-token`                        |
| `PATCH`  | `/api/v1/cursos/aulas/:aulaId/materiais/reordenar`                                      |
| `DELETE` | `/api/v1/cursos/aulas/:id`                                                              |
| `GET`    | `/api/v1/cursos/aulas/:id`                                                              |
| `PUT`    | `/api/v1/cursos/aulas/:id`                                                              |
| `GET`    | `/api/v1/cursos/aulas/:id/historico`                                                    |
| `GET`    | `/api/v1/cursos/aulas/:id/presenca`                                                     |
| `POST`   | `/api/v1/cursos/aulas/:id/presenca`                                                     |
| `GET`    | `/api/v1/cursos/aulas/:id/progresso`                                                    |
| `POST`   | `/api/v1/cursos/aulas/:id/progresso`                                                    |
| `PATCH`  | `/api/v1/cursos/aulas/:id/publicar`                                                     |
| `GET`    | `/api/v1/cursos/aulas/materiais/download/:token`                                        |
| `GET`    | `/api/v1/cursos/avaliacoes`                                                             |
| `POST`   | `/api/v1/cursos/avaliacoes`                                                             |
| `DELETE` | `/api/v1/cursos/avaliacoes/:id`                                                         |
| `GET`    | `/api/v1/cursos/avaliacoes/:id`                                                         |
| `PUT`    | `/api/v1/cursos/avaliacoes/:id`                                                         |
| `GET`    | `/api/v1/cursos/avaliacoes/instrutores`                                                 |
| `GET`    | `/api/v1/cursos/avaliacoes/turmas`                                                      |
| `GET`    | `/api/v1/cursos/categorias`                                                             |
| `POST`   | `/api/v1/cursos/categorias`                                                             |
| `DELETE` | `/api/v1/cursos/categorias/:categoriaId`                                                |
| `GET`    | `/api/v1/cursos/categorias/:categoriaId`                                                |
| `PUT`    | `/api/v1/cursos/categorias/:categoriaId`                                                |
| `GET`    | `/api/v1/cursos/categorias/:categoriaId/subcategorias`                                  |
| `POST`   | `/api/v1/cursos/categorias/:categoriaId/subcategorias`                                  |
| `GET`    | `/api/v1/cursos/certificados/codigo/:codigo`                                            |
| `POST`   | `/api/v1/cursos/checkout`                                                               |
| `GET`    | `/api/v1/cursos/checkout/pagamento/:paymentId`                                          |
| `GET`    | `/api/v1/cursos/checkout/validar-token/:token`                                          |
| `POST`   | `/api/v1/cursos/checkout/webhook`                                                       |
| `GET`    | `/api/v1/cursos/estagios`                                                               |
| `PATCH`  | `/api/v1/cursos/estagios/:estagioId/status`                                             |
| `GET`    | `/api/v1/cursos/inscricoes/:inscricaoId/certificados`                                   |
| `GET`    | `/api/v1/cursos/inscricoes/:inscricaoId/frequencias-detalhadas`                         |
| `GET`    | `/api/v1/cursos/inscricoes/:inscricaoId/notas`                                          |
| `GET`    | `/api/v1/cursos/inscricoes/:inscricaoId/notas-detalhadas`                               |
| `GET`    | `/api/v1/cursos/me/agenda`                                                              |
| `GET`    | `/api/v1/cursos/me/certificados`                                                        |
| `GET`    | `/api/v1/cursos/me/inscricoes/:inscricaoId/certificados`                                |
| `GET`    | `/api/v1/cursos/me/inscricoes/:inscricaoId/estagios`                                    |
| `GET`    | `/api/v1/cursos/me/inscricoes/:inscricaoId/frequencias-detalhadas`                      |
| `GET`    | `/api/v1/cursos/me/inscricoes/:inscricaoId/notas`                                       |
| `GET`    | `/api/v1/cursos/me/inscricoes/:inscricaoId/notas-detalhadas`                            |
| `GET`    | `/api/v1/cursos/meta`                                                                   |
| `GET`    | `/api/v1/cursos/publico/cursos`                                                         |
| `GET`    | `/api/v1/cursos/publico/cursos/:cursoId`                                                |
| `GET`    | `/api/v1/cursos/publico/turmas/:turmaId`                                                |
| `DELETE` | `/api/v1/cursos/subcategorias/:subcategoriaId`                                          |
| `PUT`    | `/api/v1/cursos/subcategorias/:subcategoriaId`                                          |
| `POST`   | `/api/v1/cursos/templates/vincular`                                                     |
| `GET`    | `/api/v1/cursos/visaogeral`                                                             |
| `GET`    | `/api/v1/cursos/visaogeral/faturamento`                                                 |

## /api/v1/dashboard

| Método | Rota                                        |
| ------ | ------------------------------------------- |
| `GET`  | `/api/v1/dashboard/setor-de-vagas/metricas` |

## /api/v1/empresas

| Método   | Rota                                                           |
| -------- | -------------------------------------------------------------- |
| `GET`    | `/api/v1/empresas`                                             |
| `POST`   | `/api/v1/empresas`                                             |
| `GET`    | `/api/v1/empresas/:id`                                         |
| `PUT`    | `/api/v1/empresas/:id`                                         |
| `GET`    | `/api/v1/empresas/:id/bloqueios`                               |
| `POST`   | `/api/v1/empresas/:id/bloqueios`                               |
| `POST`   | `/api/v1/empresas/:id/bloqueios/revogar`                       |
| `GET`    | `/api/v1/empresas/:id/pagamentos`                              |
| `POST`   | `/api/v1/empresas/:id/plano`                                   |
| `PUT`    | `/api/v1/empresas/:id/plano`                                   |
| `GET`    | `/api/v1/empresas/:id/vagas`                                   |
| `POST`   | `/api/v1/empresas/:id/vagas/:vagaId/aprovar`                   |
| `GET`    | `/api/v1/empresas/:id/vagas/em-analise`                        |
| `GET`    | `/api/v1/empresas/candidato`                                   |
| `GET`    | `/api/v1/empresas/candidato/:id`                               |
| `GET`    | `/api/v1/empresas/cartoes`                                     |
| `POST`   | `/api/v1/empresas/cartoes`                                     |
| `DELETE` | `/api/v1/empresas/cartoes/:id`                                 |
| `PUT`    | `/api/v1/empresas/cartoes/:id/padrao`                          |
| `POST`   | `/api/v1/empresas/cartoes/:id/pagar-pendente`                  |
| `GET`    | `/api/v1/empresas/clientes`                                    |
| `POST`   | `/api/v1/empresas/clientes`                                    |
| `DELETE` | `/api/v1/empresas/clientes/:id`                                |
| `GET`    | `/api/v1/empresas/clientes/:id`                                |
| `PUT`    | `/api/v1/empresas/clientes/:id`                                |
| `GET`    | `/api/v1/empresas/dashboard`                                   |
| `GET`    | `/api/v1/empresas/minha`                                       |
| `GET`    | `/api/v1/empresas/pagamentos`                                  |
| `GET`    | `/api/v1/empresas/pagamentos/planos`                           |
| `GET`    | `/api/v1/empresas/planos-empresariais`                         |
| `POST`   | `/api/v1/empresas/planos-empresariais`                         |
| `DELETE` | `/api/v1/empresas/planos-empresariais/:id`                     |
| `GET`    | `/api/v1/empresas/planos-empresariais/:id`                     |
| `PUT`    | `/api/v1/empresas/planos-empresariais/:id`                     |
| `GET`    | `/api/v1/empresas/vagas`                                       |
| `POST`   | `/api/v1/empresas/vagas`                                       |
| `DELETE` | `/api/v1/empresas/vagas/:id`                                   |
| `GET`    | `/api/v1/empresas/vagas/:id`                                   |
| `PUT`    | `/api/v1/empresas/vagas/:id`                                   |
| `GET`    | `/api/v1/empresas/vagas/:vagaId/processos`                     |
| `POST`   | `/api/v1/empresas/vagas/:vagaId/processos`                     |
| `DELETE` | `/api/v1/empresas/vagas/:vagaId/processos/:processoId`         |
| `GET`    | `/api/v1/empresas/vagas/:vagaId/processos/:processoId`         |
| `PATCH`  | `/api/v1/empresas/vagas/:vagaId/processos/:processoId`         |
| `GET`    | `/api/v1/empresas/vagas/categorias`                            |
| `POST`   | `/api/v1/empresas/vagas/categorias`                            |
| `DELETE` | `/api/v1/empresas/vagas/categorias/:categoriaId`               |
| `GET`    | `/api/v1/empresas/vagas/categorias/:categoriaId`               |
| `PUT`    | `/api/v1/empresas/vagas/categorias/:categoriaId`               |
| `POST`   | `/api/v1/empresas/vagas/categorias/:categoriaId/subcategorias` |
| `GET`    | `/api/v1/empresas/vagas/minhas`                                |
| `GET`    | `/api/v1/empresas/vagas/slug/:slug`                            |
| `GET`    | `/api/v1/empresas/vagas/solicitacoes`                          |
| `GET`    | `/api/v1/empresas/vagas/solicitacoes/:id`                      |
| `PUT`    | `/api/v1/empresas/vagas/solicitacoes/:id/aprovar`              |
| `PUT`    | `/api/v1/empresas/vagas/solicitacoes/:id/rejeitar`             |
| `DELETE` | `/api/v1/empresas/vagas/subcategorias/:subcategoriaId`         |
| `PUT`    | `/api/v1/empresas/vagas/subcategorias/:subcategoriaId`         |
| `GET`    | `/api/v1/empresas/validate-cnpj`                               |
| `GET`    | `/api/v1/empresas/validate-cpf`                                |
| `GET`    | `/api/v1/empresas/visao-geral`                                 |

## /api/v1/mercadopago

| Método | Rota                                                   |
| ------ | ------------------------------------------------------ |
| `POST` | `/api/v1/mercadopago/assinaturas/admin/remind-payment` |
| `POST` | `/api/v1/mercadopago/assinaturas/admin/sync-plan`      |
| `POST` | `/api/v1/mercadopago/assinaturas/admin/sync-plans`     |
| `POST` | `/api/v1/mercadopago/assinaturas/cancelar`             |
| `POST` | `/api/v1/mercadopago/assinaturas/checkout`             |
| `POST` | `/api/v1/mercadopago/assinaturas/downgrade`            |
| `POST` | `/api/v1/mercadopago/assinaturas/reconcile`            |
| `POST` | `/api/v1/mercadopago/assinaturas/remind-payment`       |
| `POST` | `/api/v1/mercadopago/assinaturas/upgrade`              |
| `POST` | `/api/v1/mercadopago/assinaturas/webhook`              |
| `GET`  | `/api/v1/mercadopago/logs`                             |
| `GET`  | `/api/v1/mercadopago/logs/:id`                         |

## /api/v1/notificacoes

| Método | Rota                               |
| ------ | ---------------------------------- |
| `GET`  | `/api/v1/notificacoes`             |
| `PUT`  | `/api/v1/notificacoes/arquivar`    |
| `GET`  | `/api/v1/notificacoes/contador`    |
| `PUT`  | `/api/v1/notificacoes/lidas`       |
| `PUT`  | `/api/v1/notificacoes/lidas/todas` |

## /api/v1/recrutador

| Método | Rota                                                                   |
| ------ | ---------------------------------------------------------------------- |
| `GET`  | `/api/v1/recrutador/empresas`                                          |
| `GET`  | `/api/v1/recrutador/entrevistas/:id`                                   |
| `GET`  | `/api/v1/recrutador/vagas`                                             |
| `GET`  | `/api/v1/recrutador/vagas/:id`                                         |
| `POST` | `/api/v1/recrutador/vagas/:vagaId/candidatos/:candidatoId/entrevistas` |

## /api/v1/requerimentos

| Método | Rota                                                     |
| ------ | -------------------------------------------------------- |
| `GET`  | `/api/v1/requerimentos`                                  |
| `POST` | `/api/v1/requerimentos`                                  |
| `GET`  | `/api/v1/requerimentos/:id`                              |
| `PUT`  | `/api/v1/requerimentos/:id/admin`                        |
| `PUT`  | `/api/v1/requerimentos/:id/cancelar`                     |
| `POST` | `/api/v1/requerimentos/:id/comentario`                   |
| `GET`  | `/api/v1/requerimentos/admin/lista`                      |
| `GET`  | `/api/v1/requerimentos/admin/metricas`                   |
| `GET`  | `/api/v1/requerimentos/elegibilidade-reembolso/:planoId` |
| `POST` | `/api/v1/requerimentos/reembolso`                        |

## /api/v1/status-processo

| Método   | Rota                              |
| -------- | --------------------------------- |
| `GET`    | `/api/v1/status-processo`         |
| `POST`   | `/api/v1/status-processo`         |
| `DELETE` | `/api/v1/status-processo/:id`     |
| `GET`    | `/api/v1/status-processo/:id`     |
| `PUT`    | `/api/v1/status-processo/:id`     |
| `GET`    | `/api/v1/status-processo/active`  |
| `GET`    | `/api/v1/status-processo/default` |

## /api/v1/usuarios

| Método   | Rota                                                                     |
| -------- | ------------------------------------------------------------------------ |
| `GET`    | `/api/v1/usuarios`                                                       |
| `GET`    | `/api/v1/usuarios/alunos/:userId/bloqueios`                              |
| `POST`   | `/api/v1/usuarios/alunos/:userId/bloqueios`                              |
| `POST`   | `/api/v1/usuarios/alunos/:userId/bloqueios/revogar`                      |
| `GET`    | `/api/v1/usuarios/candidatos`                                            |
| `GET`    | `/api/v1/usuarios/candidatos/:userId`                                    |
| `GET`    | `/api/v1/usuarios/candidatos/:userId/logs`                               |
| `GET`    | `/api/v1/usuarios/candidatos/dashboard`                                  |
| `GET`    | `/api/v1/usuarios/curriculos/:curriculoId`                               |
| `GET`    | `/api/v1/usuarios/instrutores`                                           |
| `GET`    | `/api/v1/usuarios/instrutores/:instrutorId`                              |
| `PUT`    | `/api/v1/usuarios/instrutores/:instrutorId`                              |
| `GET`    | `/api/v1/usuarios/instrutores/:userId/bloqueios`                         |
| `POST`   | `/api/v1/usuarios/instrutores/:userId/bloqueios`                         |
| `POST`   | `/api/v1/usuarios/instrutores/:userId/bloqueios/revogar`                 |
| `POST`   | `/api/v1/usuarios/login`                                                 |
| `POST`   | `/api/v1/usuarios/logout`                                                |
| `GET`    | `/api/v1/usuarios/perfil`                                                |
| `PUT`    | `/api/v1/usuarios/perfil`                                                |
| `GET`    | `/api/v1/usuarios/recrutadores/:recrutadorId/empresas`                   |
| `POST`   | `/api/v1/usuarios/recrutadores/:recrutadorId/empresas`                   |
| `DELETE` | `/api/v1/usuarios/recrutadores/:recrutadorId/empresas/:empresaUsuarioId` |
| `GET`    | `/api/v1/usuarios/recrutadores/:recrutadorId/vagas`                      |
| `POST`   | `/api/v1/usuarios/recrutadores/:recrutadorId/vagas`                      |
| `DELETE` | `/api/v1/usuarios/recrutadores/:recrutadorId/vagas/:vagaId`              |
| `POST`   | `/api/v1/usuarios/recuperar-senha`                                       |
| `POST`   | `/api/v1/usuarios/recuperar-senha/redefinir`                             |
| `GET`    | `/api/v1/usuarios/recuperar-senha/validar/:token([a-fA-F0-9]{64})`       |
| `POST`   | `/api/v1/usuarios/refresh`                                               |
| `POST`   | `/api/v1/usuarios/registrar`                                             |
| `GET`    | `/api/v1/usuarios/usuarios`                                              |
| `POST`   | `/api/v1/usuarios/usuarios`                                              |
| `GET`    | `/api/v1/usuarios/usuarios/:userId`                                      |
| `PUT`    | `/api/v1/usuarios/usuarios/:userId`                                      |
| `GET`    | `/api/v1/usuarios/usuarios/:userId/bloqueios`                            |
| `POST`   | `/api/v1/usuarios/usuarios/:userId/bloqueios`                            |
| `POST`   | `/api/v1/usuarios/usuarios/:userId/bloqueios/revogar`                    |
| `PATCH`  | `/api/v1/usuarios/usuarios/:userId/role`                                 |
| `PATCH`  | `/api/v1/usuarios/usuarios/:userId/status`                               |

## /api/v1/vagas/solicitacoes

| Método | Rota                                      |
| ------ | ----------------------------------------- |
| `GET`  | `/api/v1/vagas/solicitacoes`              |
| `GET`  | `/api/v1/vagas/solicitacoes/:id`          |
| `PUT`  | `/api/v1/vagas/solicitacoes/:id/aprovar`  |
| `PUT`  | `/api/v1/vagas/solicitacoes/:id/rejeitar` |

## /api/v1/website

| Método   | Rota                                           |
| -------- | ---------------------------------------------- |
| `GET`    | `/api/v1/website`                              |
| `GET`    | `/api/v1/website/advance-ajuda`                |
| `POST`   | `/api/v1/website/advance-ajuda`                |
| `DELETE` | `/api/v1/website/advance-ajuda/:id`            |
| `GET`    | `/api/v1/website/advance-ajuda/:id`            |
| `PUT`    | `/api/v1/website/advance-ajuda/:id`            |
| `GET`    | `/api/v1/website/banner`                       |
| `POST`   | `/api/v1/website/banner`                       |
| `DELETE` | `/api/v1/website/banner/:id`                   |
| `GET`    | `/api/v1/website/banner/:id`                   |
| `PUT`    | `/api/v1/website/banner/:id`                   |
| `PUT`    | `/api/v1/website/banner/:id/reorder`           |
| `GET`    | `/api/v1/website/conexao-forte`                |
| `POST`   | `/api/v1/website/conexao-forte`                |
| `DELETE` | `/api/v1/website/conexao-forte/:id`            |
| `GET`    | `/api/v1/website/conexao-forte/:id`            |
| `PUT`    | `/api/v1/website/conexao-forte/:id`            |
| `GET`    | `/api/v1/website/consultoria`                  |
| `POST`   | `/api/v1/website/consultoria`                  |
| `DELETE` | `/api/v1/website/consultoria/:id`              |
| `GET`    | `/api/v1/website/consultoria/:id`              |
| `PUT`    | `/api/v1/website/consultoria/:id`              |
| `GET`    | `/api/v1/website/depoimentos`                  |
| `POST`   | `/api/v1/website/depoimentos`                  |
| `DELETE` | `/api/v1/website/depoimentos/:id`              |
| `GET`    | `/api/v1/website/depoimentos/:id`              |
| `PUT`    | `/api/v1/website/depoimentos/:id`              |
| `PUT`    | `/api/v1/website/depoimentos/:id/reorder`      |
| `GET`    | `/api/v1/website/diferenciais`                 |
| `POST`   | `/api/v1/website/diferenciais`                 |
| `DELETE` | `/api/v1/website/diferenciais/:id`             |
| `GET`    | `/api/v1/website/diferenciais/:id`             |
| `PUT`    | `/api/v1/website/diferenciais/:id`             |
| `GET`    | `/api/v1/website/header-pages`                 |
| `POST`   | `/api/v1/website/header-pages`                 |
| `DELETE` | `/api/v1/website/header-pages/:id`             |
| `GET`    | `/api/v1/website/header-pages/:id`             |
| `PUT`    | `/api/v1/website/header-pages/:id`             |
| `GET`    | `/api/v1/website/imagem-login`                 |
| `POST`   | `/api/v1/website/imagem-login`                 |
| `DELETE` | `/api/v1/website/imagem-login/:id`             |
| `GET`    | `/api/v1/website/imagem-login/:id`             |
| `PUT`    | `/api/v1/website/imagem-login/:id`             |
| `GET`    | `/api/v1/website/informacoes-gerais`           |
| `POST`   | `/api/v1/website/informacoes-gerais`           |
| `DELETE` | `/api/v1/website/informacoes-gerais/:id`       |
| `GET`    | `/api/v1/website/informacoes-gerais/:id`       |
| `PUT`    | `/api/v1/website/informacoes-gerais/:id`       |
| `GET`    | `/api/v1/website/logo-enterprises`             |
| `POST`   | `/api/v1/website/logo-enterprises`             |
| `DELETE` | `/api/v1/website/logo-enterprises/:id`         |
| `GET`    | `/api/v1/website/logo-enterprises/:id`         |
| `PUT`    | `/api/v1/website/logo-enterprises/:id`         |
| `PUT`    | `/api/v1/website/logo-enterprises/:id/reorder` |
| `GET`    | `/api/v1/website/planinhas`                    |
| `POST`   | `/api/v1/website/planinhas`                    |
| `DELETE` | `/api/v1/website/planinhas/:id`                |
| `GET`    | `/api/v1/website/planinhas/:id`                |
| `PUT`    | `/api/v1/website/planinhas/:id`                |
| `GET`    | `/api/v1/website/recrutamento`                 |
| `POST`   | `/api/v1/website/recrutamento`                 |
| `GET`    | `/api/v1/website/recrutamento-selecao`         |
| `POST`   | `/api/v1/website/recrutamento-selecao`         |
| `DELETE` | `/api/v1/website/recrutamento-selecao/:id`     |
| `GET`    | `/api/v1/website/recrutamento-selecao/:id`     |
| `PUT`    | `/api/v1/website/recrutamento-selecao/:id`     |
| `DELETE` | `/api/v1/website/recrutamento/:id`             |
| `GET`    | `/api/v1/website/recrutamento/:id`             |
| `PUT`    | `/api/v1/website/recrutamento/:id`             |
| `GET`    | `/api/v1/website/scripts`                      |
| `POST`   | `/api/v1/website/scripts`                      |
| `DELETE` | `/api/v1/website/scripts/:id`                  |
| `GET`    | `/api/v1/website/scripts/:id`                  |
| `PUT`    | `/api/v1/website/scripts/:id`                  |
| `GET`    | `/api/v1/website/sistema`                      |
| `POST`   | `/api/v1/website/sistema`                      |
| `DELETE` | `/api/v1/website/sistema/:id`                  |
| `GET`    | `/api/v1/website/sistema/:id`                  |
| `PUT`    | `/api/v1/website/sistema/:id`                  |
| `GET`    | `/api/v1/website/site-data`                    |
| `GET`    | `/api/v1/website/slider`                       |
| `POST`   | `/api/v1/website/slider`                       |
| `DELETE` | `/api/v1/website/slider/:id`                   |
| `GET`    | `/api/v1/website/slider/:id`                   |
| `PUT`    | `/api/v1/website/slider/:id`                   |
| `PUT`    | `/api/v1/website/slider/:id/reorder`           |
| `GET`    | `/api/v1/website/sobre`                        |
| `POST`   | `/api/v1/website/sobre`                        |
| `GET`    | `/api/v1/website/sobre-empresa`                |
| `POST`   | `/api/v1/website/sobre-empresa`                |
| `DELETE` | `/api/v1/website/sobre-empresa/:id`            |
| `GET`    | `/api/v1/website/sobre-empresa/:id`            |
| `PUT`    | `/api/v1/website/sobre-empresa/:id`            |
| `DELETE` | `/api/v1/website/sobre/:id`                    |
| `GET`    | `/api/v1/website/sobre/:id`                    |
| `PUT`    | `/api/v1/website/sobre/:id`                    |
| `GET`    | `/api/v1/website/team`                         |
| `POST`   | `/api/v1/website/team`                         |
| `DELETE` | `/api/v1/website/team/:id`                     |
| `GET`    | `/api/v1/website/team/:id`                     |
| `PUT`    | `/api/v1/website/team/:id`                     |
| `PUT`    | `/api/v1/website/team/:id/reorder`             |
| `GET`    | `/api/v1/website/treinamento-company`          |
| `POST`   | `/api/v1/website/treinamento-company`          |
| `DELETE` | `/api/v1/website/treinamento-company/:id`      |
| `GET`    | `/api/v1/website/treinamento-company/:id`      |
| `PUT`    | `/api/v1/website/treinamento-company/:id`      |
| `GET`    | `/api/v1/website/treinamentos-in-company`      |
| `POST`   | `/api/v1/website/treinamentos-in-company`      |
| `DELETE` | `/api/v1/website/treinamentos-in-company/:id`  |
| `GET`    | `/api/v1/website/treinamentos-in-company/:id`  |
| `PUT`    | `/api/v1/website/treinamentos-in-company/:id`  |

## Sistema

| Método | Rota               |
| ------ | ------------------ |
| `GET`  | `/`                |
| `ALL`  | `/*`               |
| `GET`  | `/docs/login`      |
| `GET`  | `/health`          |
| `GET`  | `/verificar-email` |
