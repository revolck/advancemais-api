-- CreateEnum
CREATE TYPE "AcoesDeLogDeBloqueio" AS ENUM ('CRIACAO', 'ATUALIZACAO', 'REVOGACAO', 'REAVALIACAO');

-- CreateEnum
CREATE TYPE "AuditoriaCategoria" AS ENUM ('SISTEMA', 'USUARIO', 'EMPRESA', 'VAGA', 'CURSO', 'PAGAMENTO', 'SCRIPT', 'SEGURANCA');

-- CreateEnum
CREATE TYPE "CandidatoLogTipo" AS ENUM ('CURRICULO_CRIADO', 'CURRICULO_ATUALIZADO', 'CURRICULO_REMOVIDO', 'CANDIDATO_ATIVADO', 'CANDIDATO_DESATIVADO', 'CANDIDATURA_CRIADA', 'CANDIDATURA_CANCELADA_CURRICULO', 'CANDIDATURA_CANCELADA_BLOQUEIO');

-- CreateEnum
CREATE TYPE "CuponsAplicarEm" AS ENUM ('TODA_PLATAFORMA', 'APENAS_ASSINATURA', 'APENAS_CURSOS');

-- CreateEnum
CREATE TYPE "CuponsLimiteUso" AS ENUM ('ILIMITADO', 'LIMITADO');

-- CreateEnum
CREATE TYPE "CuponsLimiteUsuario" AS ENUM ('ILIMITADO', 'LIMITADO', 'PRIMEIRA_COMPRA');

-- CreateEnum
CREATE TYPE "CuponsPeriodo" AS ENUM ('ILIMITADO', 'PERIODO');

-- CreateEnum
CREATE TYPE "CuponsTipoDesconto" AS ENUM ('PORCENTAGEM', 'VALOR_FIXO');

-- CreateEnum
CREATE TYPE "CursoStatus" AS ENUM ('RASCUNHO', 'PUBLICADO', 'INSCRICOES_ABERTAS', 'INSCRICOES_ENCERRADAS', 'EM_ANDAMENTO', 'CONCLUIDO', 'SUSPENSO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CursosAgendaTipo" AS ENUM ('AULA', 'PROVA', 'EVENTO', 'ATIVIDADE', 'TRABALHO', 'PROJETO', 'SEMINARIO', 'SIMULADO', 'REUNIAO', 'RECESSO', 'FERIADO');

-- CreateEnum
CREATE TYPE "CursosCertificados" AS ENUM ('SEM_CERTIFICADO', 'PARTICIPACAO', 'CONCLUSAO', 'APROVEITAMENTO', 'COMPETENCIA');

-- CreateEnum
CREATE TYPE "CursosCertificadosLogAcao" AS ENUM ('EMISSAO', 'VISUALIZACAO');

-- CreateEnum
CREATE TYPE "CursosCertificadosTipos" AS ENUM ('DIGITAL', 'IMPRESSO', 'DIGITAL_E_IMPRESSO', 'VERIFICAVEL');

-- CreateEnum
CREATE TYPE "CursosEstagioDiaSemana" AS ENUM ('DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO');

-- CreateEnum
CREATE TYPE "CursosEstagioNotificacaoTipo" AS ENUM ('ASSINATURA_PENDENTE', 'INICIO_PROXIMO', 'ENCERRAMENTO_PROXIMO', 'CONCLUSAO_SOLICITADA');

-- CreateEnum
CREATE TYPE "CursosEstagioStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'REPROVADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CursosFrequenciaStatus" AS ENUM ('PRESENTE', 'AUSENTE', 'JUSTIFICADO', 'ATRASADO');

-- CreateEnum
CREATE TYPE "CursosLocalProva" AS ENUM ('TURMA', 'MODULO');

-- CreateEnum
CREATE TYPE "CursosMateriais" AS ENUM ('APOSTILA', 'SLIDE', 'VIDEOAULA', 'AUDIOAULA', 'ARTIGO', 'EXERCICIO', 'SIMULADO', 'LIVRO', 'CERTIFICADO', 'OUTRO');

-- CreateEnum
CREATE TYPE "CursosMetodos" AS ENUM ('ONLINE', 'PRESENCIAL', 'LIVE', 'SEMIPRESENCIAL');

-- CreateEnum
CREATE TYPE "CursosModelosRecuperacao" AS ENUM ('SUBSTITUI_MENOR', 'MEDIA_MINIMA_DIRETA', 'PROVA_FINAL_UNICA', 'NOTA_MAXIMA_LIMITADA');

-- CreateEnum
CREATE TYPE "CursosNotasTipo" AS ENUM ('PROVA', 'TRABALHO', 'ATIVIDADE', 'PROJETO', 'SEMINARIO', 'PARTICIPACAO', 'SIMULADO', 'BONUS', 'OUTRO');

-- CreateEnum
CREATE TYPE "CursosSituacaoFinal" AS ENUM ('EM_ANALISE', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "CursosStatusPadrao" AS ENUM ('PUBLICADO', 'RASCUNHO');

-- CreateEnum
CREATE TYPE "CursosTurnos" AS ENUM ('MANHA', 'TARDE', 'NOITE', 'INTEGRAL');

-- CreateEnum
CREATE TYPE "EmpresasAuditoriaAcao" AS ENUM ('EMPRESA_CRIADA', 'EMPRESA_ATUALIZADA', 'PLANO_ASSIGNADO', 'PLANO_ATUALIZADO', 'PLANO_CANCELADO', 'PLANO_EXPIRADO', 'BLOQUEIO_APLICADO', 'BLOQUEIO_REVOGADO', 'STATUS_ALTERADO', 'DADOS_ALTERADOS');

-- CreateEnum
CREATE TYPE "EmpresasPlanoModo" AS ENUM ('CLIENTE', 'TESTE', 'PARCEIRO');

-- CreateEnum
CREATE TYPE "EmpresasPlanoOrigin" AS ENUM ('CHECKOUT', 'ADMIN', 'IMPORT');

-- CreateEnum
CREATE TYPE "EmpresasPlanoStatus" AS ENUM ('ATIVO', 'SUSPENSO', 'EXPIRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "Jornadas" AS ENUM ('INTEGRAL', 'MEIO_PERIODO', 'FLEXIVEL', 'TURNOS', 'NOTURNO');

-- CreateEnum
CREATE TYPE "METODO_PAGAMENTO" AS ENUM ('CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'BOLETO', 'TRANSFERENCIA', 'DINHEIRO');

-- CreateEnum
CREATE TYPE "MODELO_PAGAMENTO" AS ENUM ('ASSINATURA', 'PAGAMENTO_UNICO', 'PAGAMENTO_PARCELADO');

-- CreateEnum
CREATE TYPE "ModalidadesDeVagas" AS ENUM ('PRESENCIAL', 'REMOTO', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "MotivosDeBloqueios" AS ENUM ('SPAM', 'VIOLACAO_POLITICAS', 'FRAUDE', 'ABUSO_DE_RECURSOS', 'OUTROS');

-- CreateEnum
CREATE TYPE "OrigemVagas" AS ENUM ('SITE', 'DASHBOARD', 'OUTROS');

-- CreateEnum
CREATE TYPE "RegimesDeTrabalhos" AS ENUM ('CLT', 'TEMPORARIO', 'ESTAGIO', 'PJ', 'HOME_OFFICE', 'JOVEM_APRENDIZ');

-- CreateEnum
CREATE TYPE "Roles" AS ENUM ('ADMIN', 'MODERADOR', 'FINANCEIRO', 'INSTRUTOR', 'EMPRESA', 'PEDAGOGICO', 'SETOR_DE_VAGAS', 'RECRUTADOR', 'ALUNO_CANDIDATO');

-- CreateEnum
CREATE TYPE "STATUS_PAGAMENTO" AS ENUM ('PENDENTE', 'EM_PROCESSAMENTO', 'APROVADO', 'CONCLUIDO', 'RECUSADO', 'ESTORNADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('PENDENTE', 'EXECUTANDO', 'CONCLUIDO', 'ERRO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ScriptTipo" AS ENUM ('MIGRACAO', 'BACKUP', 'LIMPEZA', 'RELATORIO', 'INTEGRACAO', 'MANUTENCAO');

-- CreateEnum
CREATE TYPE "Senioridade" AS ENUM ('ABERTO', 'ESTAGIARIO', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA', 'LIDER');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "StatusDeBloqueios" AS ENUM ('ATIVO', 'EM_REVISAO', 'REVOGADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "StatusDeVagas" AS ENUM ('RASCUNHO', 'EM_ANALISE', 'PUBLICADO', 'EXPIRADO', 'DESPUBLICADA', 'PAUSADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "StatusEmail" AS ENUM ('ENVIADO', 'FALHA', 'PENDENTE');

-- CreateEnum
CREATE TYPE "StatusInscricao" AS ENUM ('INSCRITO', 'EM_ANDAMENTO', 'CONCLUIDO', 'REPROVADO', 'EM_ESTAGIO', 'CANCELADO', 'TRANCADO');

-- CreateEnum
CREATE TYPE "StatusSMS" AS ENUM ('ENVIADO', 'FALHA', 'PENDENTE');

-- CreateEnum
CREATE TYPE "TipoSMS" AS ENUM ('VERIFICACAO', 'NOTIFICACAO', 'MARKETING');

-- CreateEnum
CREATE TYPE "TiposDeArquivos" AS ENUM ('pdf', 'docx', 'xlsx', 'pptx', 'imagem', 'video', 'audio', 'zip', 'link', 'outro');

-- CreateEnum
CREATE TYPE "TiposDeBloqueios" AS ENUM ('TEMPORARIO', 'PERMANENTE', 'RESTRICAO_DE_RECURSO');

-- CreateEnum
CREATE TYPE "TiposDeEmails" AS ENUM ('BOAS_VINDAS', 'RECUPERACAO_SENHA', 'VERIFICACAO_EMAIL', 'NOTIFICACAO_SISTEMA');

-- CreateEnum
CREATE TYPE "TiposDeUsuarios" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA');

-- CreateEnum
CREATE TYPE "TransacaoStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'APROVADA', 'RECUSADA', 'CANCELADA', 'ESTORNADA');

-- CreateEnum
CREATE TYPE "TransacaoTipo" AS ENUM ('PAGAMENTO', 'REEMBOLSO', 'ESTORNO', 'ASSINATURA', 'CUPOM', 'TAXA');

-- CreateEnum
CREATE TYPE "WebsiteHeaderPageType" AS ENUM ('SOBRE', 'RECRUTAMENTO', 'VAGAS', 'TREINAMENTO', 'CONTATO', 'BLOG', 'CURSOS', 'POLITICA_PRIVACIDADE', 'OUVIDORIA');

-- CreateEnum
CREATE TYPE "WebsiteScriptAplicacao" AS ENUM ('WEBSITE', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "WebsiteScriptOrientation" AS ENUM ('HEADER', 'BODY', 'FOOTER');

-- CreateEnum
CREATE TYPE "WebsiteSlidersOrientations" AS ENUM ('DESKTOP', 'TABLET_MOBILE');

-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('PUBLICADO', 'RASCUNHO');

-- CreateTable
CREATE TABLE "AuditoriaLogs" (
    "id" TEXT NOT NULL,
    "categoria" "AuditoriaCategoria" NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "acao" VARCHAR(100) NOT NULL,
    "usuarioId" TEXT,
    "entidadeId" TEXT,
    "entidadeTipo" TEXT,
    "descricao" VARCHAR(500) NOT NULL,
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "metadata" JSONB,
    "ip" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaScripts" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" VARCHAR(500),
    "tipo" "ScriptTipo" NOT NULL,
    "status" "ScriptStatus" NOT NULL,
    "executadoPor" TEXT NOT NULL,
    "parametros" JSONB,
    "resultado" JSONB,
    "erro" TEXT,
    "duracaoMs" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executadoEm" TIMESTAMP(3),

    CONSTRAINT "AuditoriaScripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaTransacoes" (
    "id" TEXT NOT NULL,
    "tipo" "TransacaoTipo" NOT NULL,
    "status" "TransacaoStatus" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "moeda" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "referencia" VARCHAR(100),
    "gateway" VARCHAR(50),
    "gatewayId" VARCHAR(100),
    "usuarioId" TEXT,
    "empresaId" TEXT,
    "metadata" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "AuditoriaTransacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatosAreasInteresse" (
    "id" SERIAL NOT NULL,
    "categoria" VARCHAR(120) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatosAreasInteresse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatosSubareasInteresse" (
    "id" SERIAL NOT NULL,
    "areaId" INTEGER NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatosSubareasInteresse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuponsDesconto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" VARCHAR(300),
    "tipoDesconto" "CuponsTipoDesconto" NOT NULL,
    "valorPorcentagem" DECIMAL(5,2),
    "valorFixo" DECIMAL(12,2),
    "aplicarEm" "CuponsAplicarEm" NOT NULL,
    "aplicarEmTodosItens" BOOLEAN NOT NULL DEFAULT false,
    "limiteUsoTotalTipo" "CuponsLimiteUso" NOT NULL DEFAULT 'ILIMITADO',
    "limiteUsoTotalQuantidade" INTEGER,
    "limitePorUsuarioTipo" "CuponsLimiteUsuario" NOT NULL DEFAULT 'ILIMITADO',
    "limitePorUsuarioQuantidade" INTEGER,
    "periodoTipo" "CuponsPeriodo" NOT NULL DEFAULT 'ILIMITADO',
    "periodoInicio" TIMESTAMP(3),
    "periodoFim" TIMESTAMP(3),
    "usosTotais" INTEGER NOT NULL DEFAULT 0,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'PUBLICADO',
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuponsDesconto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuponsDescontoCursos" (
    "id" SERIAL NOT NULL,
    "cupomId" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,

    CONSTRAINT "CuponsDescontoCursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuponsDescontoPlanos" (
    "id" SERIAL NOT NULL,
    "cupomId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,

    CONSTRAINT "CuponsDescontoPlanos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cursos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(12) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "imagemUrl" VARCHAR(2048),
    "cargaHoraria" INTEGER NOT NULL,
    "statusPadrao" "CursosStatusPadrao" NOT NULL DEFAULT 'RASCUNHO',
    "categoriaId" INTEGER,
    "subcategoriaId" INTEGER,
    "estagioObrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosCategorias" (
    "id" SERIAL NOT NULL,
    "codCategoria" VARCHAR(12) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosCategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosCertificadosEmitidos" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "tipo" "CursosCertificados" NOT NULL,
    "formato" "CursosCertificadosTipos" NOT NULL,
    "cargaHoraria" INTEGER NOT NULL,
    "assinaturaUrl" VARCHAR(2048),
    "alunoNome" VARCHAR(255) NOT NULL,
    "alunoCpf" VARCHAR(14),
    "cursoNome" VARCHAR(255) NOT NULL,
    "turmaNome" VARCHAR(255) NOT NULL,
    "emitidoPorId" TEXT,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" VARCHAR(500),

    CONSTRAINT "CursosCertificadosEmitidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosCertificadosLogs" (
    "id" TEXT NOT NULL,
    "certificadoId" TEXT NOT NULL,
    "acao" "CursosCertificadosLogAcao" NOT NULL,
    "formato" "CursosCertificadosTipos" NOT NULL,
    "detalhes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosCertificadosLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosEstagios" (
    "id" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "turmaId" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "status" "CursosEstagioStatus" NOT NULL DEFAULT 'PENDENTE',
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "cargaHoraria" INTEGER,
    "empresaPrincipal" VARCHAR(255),
    "observacoes" TEXT,
    "criadoPorId" TEXT,
    "atualizadoPorId" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "reprovadoEm" TIMESTAMP(3),
    "reprovadoMotivo" TEXT,
    "ultimoAvisoEncerramento" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosEstagios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosEstagiosConfirmacoes" (
    "id" TEXT NOT NULL,
    "estagioId" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "protocolo" VARCHAR(40),
    "confirmadoEm" TIMESTAMP(3),
    "ip" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "deviceTipo" VARCHAR(50),
    "deviceDescricao" VARCHAR(120),
    "deviceId" VARCHAR(120),
    "sistemaOperacional" VARCHAR(120),
    "navegador" VARCHAR(120),
    "localizacao" VARCHAR(255),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosEstagiosConfirmacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosEstagiosLocais" (
    "id" TEXT NOT NULL,
    "estagioId" TEXT NOT NULL,
    "titulo" VARCHAR(120),
    "empresaNome" VARCHAR(255) NOT NULL,
    "empresaDocumento" VARCHAR(20),
    "contatoNome" VARCHAR(120),
    "contatoEmail" VARCHAR(255),
    "contatoTelefone" VARCHAR(30),
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "horarioInicio" VARCHAR(5),
    "horarioFim" VARCHAR(5),
    "diasSemana" "CursosEstagioDiaSemana"[],
    "cargaHorariaSemanal" INTEGER,
    "cep" VARCHAR(12),
    "logradouro" VARCHAR(255),
    "numero" VARCHAR(20),
    "bairro" VARCHAR(120),
    "cidade" VARCHAR(120),
    "estado" VARCHAR(2),
    "complemento" VARCHAR(120),
    "pontoReferencia" VARCHAR(255),
    "observacoes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosEstagiosLocais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosEstagiosNotificacoes" (
    "id" TEXT NOT NULL,
    "estagioId" TEXT NOT NULL,
    "tipo" "CursosEstagioNotificacaoTipo" NOT NULL,
    "canal" VARCHAR(50),
    "enviadoPara" VARCHAR(255) NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalhes" VARCHAR(500),

    CONSTRAINT "CursosEstagiosNotificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosFrequenciaAlunos" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "aulaId" TEXT,
    "dataReferencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CursosFrequenciaStatus" NOT NULL DEFAULT 'PRESENTE',
    "justificativa" VARCHAR(500),
    "observacoes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosFrequenciaAlunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosNotas" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "tipo" "CursosNotasTipo" NOT NULL,
    "provaId" TEXT,
    "referenciaExterna" VARCHAR(120),
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" VARCHAR(1000),
    "nota" DECIMAL(4,1),
    "peso" DECIMAL(5,2),
    "valorMaximo" DECIMAL(4,1),
    "dataReferencia" TIMESTAMP(3),
    "observacoes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosNotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosSubcategorias" (
    "id" SERIAL NOT NULL,
    "codSubcategoria" VARCHAR(12) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255),
    "categoriaId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosSubcategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(12) NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "instrutorId" TEXT,
    "nome" VARCHAR(255) NOT NULL,
    "turno" "CursosTurnos" NOT NULL DEFAULT 'INTEGRAL',
    "metodo" "CursosMetodos" NOT NULL DEFAULT 'ONLINE',
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "dataInscricaoInicio" TIMESTAMP(3),
    "dataInscricaoFim" TIMESTAMP(3),
    "vagasTotais" INTEGER NOT NULL,
    "vagasDisponiveis" INTEGER NOT NULL,
    "status" "CursoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasAgenda" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "tipo" "CursosAgendaTipo" NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" VARCHAR(1000),
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "aulaId" TEXT,
    "provaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasAulas" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "moduloId" TEXT,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "urlVideo" VARCHAR(2048),
    "sala" VARCHAR(100),
    "urlMeet" VARCHAR(2048),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasAulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasAulasMateriais" (
    "id" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" VARCHAR(2000),
    "tipo" "CursosMateriais" NOT NULL,
    "tipoArquivo" "TiposDeArquivos",
    "url" VARCHAR(2048),
    "duracaoEmSegundos" INTEGER,
    "tamanhoEmBytes" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasAulasMateriais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasInscricoes" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusInscricao" NOT NULL DEFAULT 'INSCRITO',

    CONSTRAINT "CursosTurmasInscricoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasModulos" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasModulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasProvas" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "moduloId" TEXT,
    "titulo" VARCHAR(255) NOT NULL,
    "etiqueta" VARCHAR(30) NOT NULL,
    "descricao" TEXT,
    "peso" DECIMAL(5,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "localizacao" "CursosLocalProva" NOT NULL DEFAULT 'TURMA',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasProvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasProvasEnvios" (
    "id" TEXT NOT NULL,
    "provaId" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "nota" DECIMAL(4,1),
    "pesoTotal" DECIMAL(5,2),
    "realizadoEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasProvasEnvios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasRecuperacoes" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "regraId" TEXT,
    "provaId" TEXT,
    "envioId" TEXT,
    "notaRecuperacao" DECIMAL(4,1),
    "notaFinal" DECIMAL(4,1),
    "mediaCalculada" DECIMAL(4,2),
    "modeloAplicado" "CursosModelosRecuperacao",
    "statusFinal" "CursosSituacaoFinal" NOT NULL DEFAULT 'EM_ANALISE',
    "detalhes" JSONB,
    "observacoes" VARCHAR(500),
    "aplicadoEm" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasRecuperacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursosTurmasRegrasAvaliacao" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "mediaMinima" DECIMAL(4,1) NOT NULL,
    "politicaRecuperacaoAtiva" BOOLEAN NOT NULL DEFAULT false,
    "modelosRecuperacao" "CursosModelosRecuperacao"[] DEFAULT ARRAY[]::"CursosModelosRecuperacao"[],
    "ordemAplicacaoRecuperacao" "CursosModelosRecuperacao"[] DEFAULT ARRAY[]::"CursosModelosRecuperacao"[],
    "notaMaximaRecuperacao" DECIMAL(4,1),
    "pesoProvaFinal" DECIMAL(5,2),
    "observacoes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasRegrasAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresasAuditoria" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "alteradoPor" TEXT NOT NULL,
    "acao" "EmpresasAuditoriaAcao" NOT NULL,
    "campo" VARCHAR(100),
    "valorAnterior" VARCHAR(500),
    "valorNovo" VARCHAR(500),
    "descricao" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpresasAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresasCandidatos" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "curriculoId" TEXT,
    "empresaUsuarioId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "origem" "OrigemVagas" NOT NULL DEFAULT 'SITE',
    "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    "consentimentos" JSONB,

    CONSTRAINT "EmpresasCandidatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresasPlano" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "planosEmpresariaisId" TEXT NOT NULL,
    "modo" "EmpresasPlanoModo" NOT NULL DEFAULT 'CLIENTE',
    "status" "EmpresasPlanoStatus" NOT NULL DEFAULT 'SUSPENSO',
    "origin" "EmpresasPlanoOrigin" NOT NULL DEFAULT 'CHECKOUT',
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "modeloPagamento" "MODELO_PAGAMENTO",
    "metodoPagamento" "METODO_PAGAMENTO",
    "statusPagamento" "STATUS_PAGAMENTO" DEFAULT 'PENDENTE',
    "mpPreapprovalId" TEXT,
    "mpSubscriptionId" TEXT,
    "mpPayerId" TEXT,
    "mpPaymentId" TEXT,
    "proximaCobranca" TIMESTAMP(3),
    "graceUntil" TIMESTAMP(3),

    CONSTRAINT "EmpresasPlano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresasVagas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(6) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "categoriaVagaId" TEXT,
    "subcategoriaVagaId" TEXT,
    "areaInteresseId" INTEGER,
    "subareaInteresseId" INTEGER,
    "modoAnonimo" BOOLEAN NOT NULL DEFAULT false,
    "regimeDeTrabalho" "RegimesDeTrabalhos" NOT NULL,
    "modalidade" "ModalidadesDeVagas" NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "paraPcd" BOOLEAN NOT NULL DEFAULT false,
    "numeroVagas" INTEGER NOT NULL DEFAULT 1,
    "descricao" TEXT,
    "requisitos" JSONB NOT NULL,
    "atividades" JSONB NOT NULL,
    "beneficios" JSONB NOT NULL,
    "observacoes" TEXT,
    "jornada" "Jornadas" NOT NULL DEFAULT 'INTEGRAL',
    "senioridade" "Senioridade" NOT NULL DEFAULT 'ABERTO',
    "inscricoesAte" TIMESTAMP(3),
    "inseridaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "status" "StatusDeVagas" NOT NULL DEFAULT 'RASCUNHO',
    "localizacao" JSONB,
    "salarioMin" DECIMAL(12,2),
    "salarioMax" DECIMAL(12,2),
    "salarioConfidencial" BOOLEAN NOT NULL DEFAULT true,
    "destaque" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmpresasVagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresasVagasCategorias" (
    "id" TEXT NOT NULL,
    "codCategoria" VARCHAR(12) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresasVagasCategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresasVagasDestaque" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "empresasPlanoId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ativadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desativadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresasVagasDestaque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresasVagasProcesso" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "origem" "OrigemVagas" NOT NULL DEFAULT 'SITE',
    "observacoes" VARCHAR(1000),
    "agendadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresasVagasProcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresasVagasSubcategorias" (
    "id" TEXT NOT NULL,
    "codSubcategoria" VARCHAR(12) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255),
    "categoriaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresasVagasSubcategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEmail" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "email" TEXT NOT NULL,
    "tipoEmail" "TiposDeEmails" NOT NULL,
    "status" "StatusEmail" NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "erro" TEXT,
    "messageId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogSMS" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "telefone" TEXT NOT NULL,
    "tipoSMS" "TipoSMS" NOT NULL,
    "status" "StatusSMS" NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "erro" TEXT,
    "messageId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogSMS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogsPagamentosDeAssinaturas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "empresasPlanoId" TEXT,
    "tipo" TEXT NOT NULL,
    "status" TEXT,
    "externalRef" TEXT,
    "mpResourceId" TEXT,
    "payload" JSONB,
    "mensagem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogsPagamentosDeAssinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanosEmpresariais" (
    "id" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "desconto" DOUBLE PRECISION,
    "quantidadeVagas" INTEGER NOT NULL,
    "vagaEmDestaque" BOOLEAN NOT NULL DEFAULT false,
    "quantidadeVagasDestaque" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "mpPreapprovalPlanId" TEXT,

    CONSTRAINT "PlanosEmpresariais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuarios" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "cpf" TEXT,
    "cnpj" TEXT,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "codUsuario" TEXT NOT NULL,
    "tipoUsuario" "TiposDeUsuarios" NOT NULL,
    "role" "Roles" NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimoLogin" TIMESTAMP(3),
    "refreshToken" TEXT,

    CONSTRAINT "Usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosCandidatosLogs" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "CandidatoLogTipo" NOT NULL,
    "descricao" VARCHAR(500),
    "metadata" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuariosCandidatosLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosCurriculos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" VARCHAR(255),
    "resumo" TEXT,
    "objetivo" VARCHAR(1000),
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "areasInteresse" JSONB,
    "preferencias" JSONB,
    "habilidades" JSONB,
    "idiomas" JSONB,
    "experiencias" JSONB,
    "formacao" JSONB,
    "cursosCertificacoes" JSONB,
    "premiosPublicacoes" JSONB,
    "acessibilidade" JSONB,
    "consentimentos" JSONB,
    "ultimaAtualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuariosCurriculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosEmBloqueios" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "aplicadoPorId" TEXT NOT NULL,
    "tipo" "TiposDeBloqueios" NOT NULL,
    "motivo" "MotivosDeBloqueios" NOT NULL,
    "status" "StatusDeBloqueios" NOT NULL DEFAULT 'ATIVO',
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "observacoes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuariosEmBloqueios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosEmBloqueiosLogs" (
    "id" TEXT NOT NULL,
    "bloqueioId" TEXT NOT NULL,
    "acao" "AcoesDeLogDeBloqueio" NOT NULL,
    "descricao" VARCHAR(500),
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuariosEmBloqueiosLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosEnderecos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuariosEnderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosInformation" (
    "usuarioId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "genero" TEXT,
    "dataNasc" TIMESTAMP(3),
    "inscricao" TEXT,
    "avatarUrl" TEXT,
    "descricao" VARCHAR(500),
    "aceitarTermos" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UsuariosInformation_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "UsuariosRecuperacaoSenha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenRecuperacao" TEXT,
    "tokenRecuperacaoExp" TIMESTAMP(3),
    "tentativasRecuperacao" INTEGER NOT NULL DEFAULT 0,
    "ultimaTentativaRecuperacao" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuariosRecuperacaoSenha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosRedesSociais" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "instagram" TEXT,
    "linkedin" TEXT,
    "facebook" TEXT,
    "youtube" TEXT,
    "twitter" TEXT,
    "tiktok" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuariosRedesSociais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosSessoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "ip" VARCHAR(45),
    "userAgent" VARCHAR(512),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "UsuariosSessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuariosVerificacaoEmail" (
    "usuarioId" TEXT NOT NULL,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificadoEm" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "emailVerificationTokenExp" TIMESTAMP(3),
    "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "ultimaTentativaVerificacao" TIMESTAMP(3),

    CONSTRAINT "UsuariosVerificacaoEmail_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "WebsiteAdvanceAjuda" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "titulo1" TEXT NOT NULL,
    "descricao1" TEXT NOT NULL,
    "titulo2" TEXT NOT NULL,
    "descricao2" TEXT NOT NULL,
    "titulo3" TEXT NOT NULL,
    "descricao3" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteAdvanceAjuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteBanner" (
    "id" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "link" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteBannerOrdem" (
    "id" TEXT NOT NULL,
    "websiteBannerId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteBannerOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteConexaoForte" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl1" TEXT NOT NULL,
    "imagemTitulo1" TEXT NOT NULL,
    "imagemUrl2" TEXT NOT NULL,
    "imagemTitulo2" TEXT NOT NULL,
    "imagemUrl3" TEXT NOT NULL,
    "imagemTitulo3" TEXT NOT NULL,
    "imagemUrl4" TEXT NOT NULL,
    "imagemTitulo4" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteConexaoForte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteConsultoria" (
    "id" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "buttonUrl" TEXT NOT NULL,
    "buttonLabel" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteConsultoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteDepoimento" (
    "id" TEXT NOT NULL,
    "depoimento" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "fotoUrl" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteDepoimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteDepoimentoOrdem" (
    "id" TEXT NOT NULL,
    "websiteDepoimentoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteDepoimentoOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteDiferenciais" (
    "id" TEXT NOT NULL,
    "icone1" TEXT NOT NULL,
    "titulo1" TEXT NOT NULL,
    "descricao1" TEXT NOT NULL,
    "icone2" TEXT NOT NULL,
    "titulo2" TEXT NOT NULL,
    "descricao2" TEXT NOT NULL,
    "icone3" TEXT NOT NULL,
    "titulo3" TEXT NOT NULL,
    "descricao3" TEXT NOT NULL,
    "icone4" TEXT NOT NULL,
    "titulo4" TEXT NOT NULL,
    "descricao4" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "botaoUrl" TEXT NOT NULL,
    "botaoLabel" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteDiferenciais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteHeaderPage" (
    "id" TEXT NOT NULL,
    "subtitulo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "buttonLabel" TEXT NOT NULL,
    "buttonLink" TEXT NOT NULL,
    "page" "WebsiteHeaderPageType" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteHeaderPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteHorarioFuncionamento" (
    "id" TEXT NOT NULL,
    "diaDaSemana" TEXT NOT NULL,
    "horarioInicio" TEXT NOT NULL,
    "horarioFim" TEXT NOT NULL,
    "informacoesId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteHorarioFuncionamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteImagemLogin" (
    "id" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "link" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteImagemLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteInformacoes" (
    "id" TEXT NOT NULL,
    "endereco" TEXT,
    "cep" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "telefone1" TEXT,
    "telefone2" TEXT,
    "whatsapp" TEXT,
    "linkedin" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "youtube" TEXT,
    "email" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteInformacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteLogoEnterprise" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemAlt" TEXT NOT NULL,
    "website" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteLogoEnterprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteLogoEnterpriseOrdem" (
    "id" TEXT NOT NULL,
    "websiteLogoEnterpriseId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteLogoEnterpriseOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsitePlaninhas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "icone1" TEXT NOT NULL,
    "titulo1" TEXT NOT NULL,
    "descricao1" TEXT NOT NULL,
    "icone2" TEXT NOT NULL,
    "titulo2" TEXT NOT NULL,
    "descricao2" TEXT NOT NULL,
    "icone3" TEXT NOT NULL,
    "titulo3" TEXT NOT NULL,
    "descricao3" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsitePlaninhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteRecrutamento" (
    "id" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "buttonUrl" TEXT NOT NULL,
    "buttonLabel" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteRecrutamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteRecrutamentoSelecao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "titulo1" TEXT NOT NULL,
    "titulo2" TEXT NOT NULL,
    "titulo3" TEXT NOT NULL,
    "titulo4" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteRecrutamentoSelecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteScript" (
    "id" TEXT NOT NULL,
    "nome" TEXT,
    "descricao" TEXT,
    "codigo" TEXT NOT NULL,
    "aplicacao" "WebsiteScriptAplicacao" NOT NULL DEFAULT 'WEBSITE',
    "orientacao" "WebsiteScriptOrientation" NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteSistema" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "subtitulo" TEXT NOT NULL,
    "etapa1Titulo" TEXT NOT NULL,
    "etapa1Descricao" TEXT NOT NULL,
    "etapa2Titulo" TEXT NOT NULL,
    "etapa2Descricao" TEXT NOT NULL,
    "etapa3Titulo" TEXT NOT NULL,
    "etapa3Descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteSlider" (
    "id" TEXT NOT NULL,
    "sliderName" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "link" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSlider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteSliderOrdem" (
    "id" TEXT NOT NULL,
    "websiteSliderId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "orientacao" "WebsiteSlidersOrientations" NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteSliderOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteSobre" (
    "id" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSobre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteSobreEmpresa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "descricaoVisao" TEXT NOT NULL,
    "descricaoMissao" TEXT NOT NULL,
    "descricaoValores" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSobreEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteTeam" (
    "id" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteTeamOrdem" (
    "id" TEXT NOT NULL,
    "websiteTeamId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteTeamOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteTreinamentoCompany" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "titulo1" TEXT NOT NULL,
    "titulo2" TEXT NOT NULL,
    "titulo3" TEXT NOT NULL,
    "titulo4" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteTreinamentoCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteTreinamentosInCompany" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "icone1" TEXT NOT NULL,
    "descricao1" TEXT NOT NULL,
    "icone2" TEXT NOT NULL,
    "descricao2" TEXT NOT NULL,
    "icone3" TEXT NOT NULL,
    "descricao3" TEXT NOT NULL,
    "icone4" TEXT NOT NULL,
    "descricao4" TEXT NOT NULL,
    "icone5" TEXT NOT NULL,
    "descricao5" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteTreinamentosInCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_processo" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" VARCHAR(500),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "criadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_processo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditoriaLogs_categoria_idx" ON "AuditoriaLogs"("categoria");

-- CreateIndex
CREATE INDEX "AuditoriaLogs_criadoEm_idx" ON "AuditoriaLogs"("criadoEm");

-- CreateIndex
CREATE INDEX "AuditoriaLogs_entidadeId_idx" ON "AuditoriaLogs"("entidadeId");

-- CreateIndex
CREATE INDEX "AuditoriaLogs_tipo_idx" ON "AuditoriaLogs"("tipo");

-- CreateIndex
CREATE INDEX "AuditoriaLogs_usuarioId_idx" ON "AuditoriaLogs"("usuarioId");

-- CreateIndex
CREATE INDEX "AuditoriaScripts_criadoEm_idx" ON "AuditoriaScripts"("criadoEm");

-- CreateIndex
CREATE INDEX "AuditoriaScripts_executadoPor_idx" ON "AuditoriaScripts"("executadoPor");

-- CreateIndex
CREATE INDEX "AuditoriaScripts_status_idx" ON "AuditoriaScripts"("status");

-- CreateIndex
CREATE INDEX "AuditoriaScripts_tipo_idx" ON "AuditoriaScripts"("tipo");

-- CreateIndex
CREATE INDEX "AuditoriaTransacoes_criadoEm_idx" ON "AuditoriaTransacoes"("criadoEm");

-- CreateIndex
CREATE INDEX "AuditoriaTransacoes_empresaId_idx" ON "AuditoriaTransacoes"("empresaId");

-- CreateIndex
CREATE INDEX "AuditoriaTransacoes_status_idx" ON "AuditoriaTransacoes"("status");

-- CreateIndex
CREATE INDEX "AuditoriaTransacoes_tipo_idx" ON "AuditoriaTransacoes"("tipo");

-- CreateIndex
CREATE INDEX "AuditoriaTransacoes_usuarioId_idx" ON "AuditoriaTransacoes"("usuarioId");

-- CreateIndex
CREATE INDEX "CandidatosAreasInteresse_categoria_idx" ON "CandidatosAreasInteresse"("categoria");

-- CreateIndex
CREATE INDEX "CandidatosSubareasInteresse_nome_idx" ON "CandidatosSubareasInteresse"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatosSubareasInteresse_areaId_nome_key" ON "CandidatosSubareasInteresse"("areaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "CuponsDesconto_codigo_key" ON "CuponsDesconto"("codigo");

-- CreateIndex
CREATE INDEX "CuponsDesconto_aplicarEm_status_idx" ON "CuponsDesconto"("aplicarEm", "status");

-- CreateIndex
CREATE INDEX "CuponsDesconto_codigo_idx" ON "CuponsDesconto"("codigo");

-- CreateIndex
CREATE INDEX "CuponsDesconto_status_idx" ON "CuponsDesconto"("status");

-- CreateIndex
CREATE INDEX "CuponsDescontoCursos_cursoId_idx" ON "CuponsDescontoCursos"("cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "CuponsDescontoCursos_cupomId_cursoId_key" ON "CuponsDescontoCursos"("cupomId", "cursoId");

-- CreateIndex
CREATE INDEX "CuponsDescontoPlanos_planoId_idx" ON "CuponsDescontoPlanos"("planoId");

-- CreateIndex
CREATE UNIQUE INDEX "CuponsDescontoPlanos_cupomId_planoId_key" ON "CuponsDescontoPlanos"("cupomId", "planoId");

-- CreateIndex
CREATE UNIQUE INDEX "Cursos_codigo_key" ON "Cursos"("codigo");

-- CreateIndex
CREATE INDEX "Cursos_categoriaId_idx" ON "Cursos"("categoriaId");

-- CreateIndex
CREATE INDEX "Cursos_subcategoriaId_idx" ON "Cursos"("subcategoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosCategorias_codCategoria_key" ON "CursosCategorias"("codCategoria");

-- CreateIndex
CREATE UNIQUE INDEX "CursosCategorias_nome_key" ON "CursosCategorias"("nome");

-- CreateIndex
CREATE INDEX "CursosCategorias_nome_idx" ON "CursosCategorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CursosCertificadosEmitidos_codigo_key" ON "CursosCertificadosEmitidos"("codigo");

-- CreateIndex
CREATE INDEX "CursosCertificadosEmitidos_emitidoEm_idx" ON "CursosCertificadosEmitidos"("emitidoEm");

-- CreateIndex
CREATE INDEX "CursosCertificadosEmitidos_emitidoPorId_idx" ON "CursosCertificadosEmitidos"("emitidoPorId");

-- CreateIndex
CREATE INDEX "CursosCertificadosEmitidos_inscricaoId_idx" ON "CursosCertificadosEmitidos"("inscricaoId");

-- CreateIndex
CREATE INDEX "CursosCertificadosLogs_acao_idx" ON "CursosCertificadosLogs"("acao");

-- CreateIndex
CREATE INDEX "CursosCertificadosLogs_certificadoId_idx" ON "CursosCertificadosLogs"("certificadoId");

-- CreateIndex
CREATE INDEX "CursosCertificadosLogs_criadoEm_idx" ON "CursosCertificadosLogs"("criadoEm");

-- CreateIndex
CREATE INDEX "CursosEstagios_alunoId_idx" ON "CursosEstagios"("alunoId");

-- CreateIndex
CREATE INDEX "CursosEstagios_cursoId_idx" ON "CursosEstagios"("cursoId");

-- CreateIndex
CREATE INDEX "CursosEstagios_dataFim_idx" ON "CursosEstagios"("dataFim");

-- CreateIndex
CREATE INDEX "CursosEstagios_inscricaoId_idx" ON "CursosEstagios"("inscricaoId");

-- CreateIndex
CREATE INDEX "CursosEstagios_status_idx" ON "CursosEstagios"("status");

-- CreateIndex
CREATE INDEX "CursosEstagios_turmaId_idx" ON "CursosEstagios"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosEstagiosConfirmacoes_estagioId_key" ON "CursosEstagiosConfirmacoes"("estagioId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosEstagiosConfirmacoes_token_key" ON "CursosEstagiosConfirmacoes"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CursosEstagiosConfirmacoes_protocolo_key" ON "CursosEstagiosConfirmacoes"("protocolo");

-- CreateIndex
CREATE INDEX "CursosEstagiosLocais_estagioId_idx" ON "CursosEstagiosLocais"("estagioId");

-- CreateIndex
CREATE INDEX "CursosEstagiosNotificacoes_estagioId_idx" ON "CursosEstagiosNotificacoes"("estagioId");

-- CreateIndex
CREATE INDEX "CursosEstagiosNotificacoes_tipo_idx" ON "CursosEstagiosNotificacoes"("tipo");

-- CreateIndex
CREATE INDEX "CursosFrequenciaAlunos_aulaId_idx" ON "CursosFrequenciaAlunos"("aulaId");

-- CreateIndex
CREATE INDEX "CursosFrequenciaAlunos_dataReferencia_idx" ON "CursosFrequenciaAlunos"("dataReferencia");

-- CreateIndex
CREATE INDEX "CursosFrequenciaAlunos_inscricaoId_idx" ON "CursosFrequenciaAlunos"("inscricaoId");

-- CreateIndex
CREATE INDEX "CursosFrequenciaAlunos_turmaId_idx" ON "CursosFrequenciaAlunos"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_frequencia_unico" ON "CursosFrequenciaAlunos"("turmaId", "inscricaoId", "aulaId", "dataReferencia");

-- CreateIndex
CREATE INDEX "CursosNotas_inscricaoId_idx" ON "CursosNotas"("inscricaoId");

-- CreateIndex
CREATE INDEX "CursosNotas_tipo_idx" ON "CursosNotas"("tipo");

-- CreateIndex
CREATE INDEX "CursosNotas_turmaId_idx" ON "CursosNotas"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosNotas_inscricaoId_provaId_key" ON "CursosNotas"("inscricaoId", "provaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosSubcategorias_codSubcategoria_key" ON "CursosSubcategorias"("codSubcategoria");

-- CreateIndex
CREATE INDEX "CursosSubcategorias_nome_idx" ON "CursosSubcategorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CursosSubcategorias_categoriaId_nome_key" ON "CursosSubcategorias"("categoriaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmas_codigo_key" ON "CursosTurmas"("codigo");

-- CreateIndex
CREATE INDEX "CursosTurmas_cursoId_idx" ON "CursosTurmas"("cursoId");

-- CreateIndex
CREATE INDEX "CursosTurmas_instrutorId_idx" ON "CursosTurmas"("instrutorId");

-- CreateIndex
CREATE INDEX "CursosTurmas_status_idx" ON "CursosTurmas"("status");

-- CreateIndex
CREATE INDEX "CursosTurmasAgenda_aulaId_idx" ON "CursosTurmasAgenda"("aulaId");

-- CreateIndex
CREATE INDEX "CursosTurmasAgenda_provaId_idx" ON "CursosTurmasAgenda"("provaId");

-- CreateIndex
CREATE INDEX "CursosTurmasAgenda_tipo_idx" ON "CursosTurmasAgenda"("tipo");

-- CreateIndex
CREATE INDEX "CursosTurmasAgenda_turmaId_inicio_idx" ON "CursosTurmasAgenda"("turmaId", "inicio");

-- CreateIndex
CREATE INDEX "CursosTurmasAulas_moduloId_idx" ON "CursosTurmasAulas"("moduloId");

-- CreateIndex
CREATE INDEX "CursosTurmasAulas_turmaId_idx" ON "CursosTurmasAulas"("turmaId");

-- CreateIndex
CREATE INDEX "CursosTurmasAulas_turmaId_ordem_idx" ON "CursosTurmasAulas"("turmaId", "ordem");

-- CreateIndex
CREATE INDEX "CursosTurmasAulasMateriais_aulaId_idx" ON "CursosTurmasAulasMateriais"("aulaId");

-- CreateIndex
CREATE INDEX "CursosTurmasAulasMateriais_tipo_idx" ON "CursosTurmasAulasMateriais"("tipo");

-- CreateIndex
CREATE INDEX "CursosTurmasInscricoes_alunoId_idx" ON "CursosTurmasInscricoes"("alunoId");

-- CreateIndex
CREATE INDEX "CursosTurmasInscricoes_status_idx" ON "CursosTurmasInscricoes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasInscricoes_turmaId_alunoId_key" ON "CursosTurmasInscricoes"("turmaId", "alunoId");

-- CreateIndex
CREATE INDEX "CursosTurmasModulos_turmaId_idx" ON "CursosTurmasModulos"("turmaId");

-- CreateIndex
CREATE INDEX "CursosTurmasModulos_turmaId_ordem_idx" ON "CursosTurmasModulos"("turmaId", "ordem");

-- CreateIndex
CREATE INDEX "CursosTurmasProvas_moduloId_idx" ON "CursosTurmasProvas"("moduloId");

-- CreateIndex
CREATE INDEX "CursosTurmasProvas_turmaId_ativo_idx" ON "CursosTurmasProvas"("turmaId", "ativo");

-- CreateIndex
CREATE INDEX "CursosTurmasProvas_turmaId_idx" ON "CursosTurmasProvas"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasProvas_turmaId_etiqueta_key" ON "CursosTurmasProvas"("turmaId", "etiqueta");

-- CreateIndex
CREATE INDEX "CursosTurmasProvasEnvios_inscricaoId_idx" ON "CursosTurmasProvasEnvios"("inscricaoId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasProvasEnvios_provaId_inscricaoId_key" ON "CursosTurmasProvasEnvios"("provaId", "inscricaoId");

-- CreateIndex
CREATE INDEX "CursosTurmasRecuperacoes_inscricaoId_idx" ON "CursosTurmasRecuperacoes"("inscricaoId");

-- CreateIndex
CREATE INDEX "CursosTurmasRecuperacoes_statusFinal_idx" ON "CursosTurmasRecuperacoes"("statusFinal");

-- CreateIndex
CREATE INDEX "CursosTurmasRecuperacoes_turmaId_idx" ON "CursosTurmasRecuperacoes"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasRegrasAvaliacao_turmaId_key" ON "CursosTurmasRegrasAvaliacao"("turmaId");

-- CreateIndex
CREATE INDEX "EmpresasAuditoria_acao_idx" ON "EmpresasAuditoria"("acao");

-- CreateIndex
CREATE INDEX "EmpresasAuditoria_alteradoPor_idx" ON "EmpresasAuditoria"("alteradoPor");

-- CreateIndex
CREATE INDEX "EmpresasAuditoria_criadoEm_idx" ON "EmpresasAuditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "EmpresasAuditoria_empresaId_idx" ON "EmpresasAuditoria"("empresaId");

-- CreateIndex
CREATE INDEX "EmpresasCandidatos_statusId_idx" ON "EmpresasCandidatos"("statusId");

-- CreateIndex
CREATE INDEX "EmpresasCandidatos_vagaId_candidatoId_idx" ON "EmpresasCandidatos"("vagaId", "candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasCandidatos_vagaId_candidatoId_curriculoId_key" ON "EmpresasCandidatos"("vagaId", "candidatoId", "curriculoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasPlano_mpPreapprovalId_key" ON "EmpresasPlano"("mpPreapprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasPlano_mpSubscriptionId_key" ON "EmpresasPlano"("mpSubscriptionId");

-- CreateIndex
CREATE INDEX "EmpresasPlano_planosEmpresariaisId_idx" ON "EmpresasPlano"("planosEmpresariaisId");

-- CreateIndex
CREATE INDEX "EmpresasPlano_usuarioId_status_idx" ON "EmpresasPlano"("usuarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagas_codigo_key" ON "EmpresasVagas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagas_slug_key" ON "EmpresasVagas"("slug");

-- CreateIndex
CREATE INDEX "EmpresasVagas_areaInteresseId_idx" ON "EmpresasVagas"("areaInteresseId");

-- CreateIndex
CREATE INDEX "EmpresasVagas_categoriaVagaId_idx" ON "EmpresasVagas"("categoriaVagaId");

-- CreateIndex
CREATE INDEX "EmpresasVagas_status_inseridaEm_idx" ON "EmpresasVagas"("status", "inseridaEm");

-- CreateIndex
CREATE INDEX "EmpresasVagas_subareaInteresseId_idx" ON "EmpresasVagas"("subareaInteresseId");

-- CreateIndex
CREATE INDEX "EmpresasVagas_subcategoriaVagaId_idx" ON "EmpresasVagas"("subcategoriaVagaId");

-- CreateIndex
CREATE INDEX "EmpresasVagas_usuarioId_idx" ON "EmpresasVagas"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagasCategorias_codCategoria_key" ON "EmpresasVagasCategorias"("codCategoria");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagasCategorias_nome_key" ON "EmpresasVagasCategorias"("nome");

-- CreateIndex
CREATE INDEX "EmpresasVagasCategorias_nome_idx" ON "EmpresasVagasCategorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagasDestaque_vagaId_key" ON "EmpresasVagasDestaque"("vagaId");

-- CreateIndex
CREATE INDEX "EmpresasVagasDestaque_empresasPlanoId_ativo_idx" ON "EmpresasVagasDestaque"("empresasPlanoId", "ativo");

-- CreateIndex
CREATE INDEX "EmpresasVagasProcesso_candidatoId_idx" ON "EmpresasVagasProcesso"("candidatoId");

-- CreateIndex
CREATE INDEX "EmpresasVagasProcesso_origem_idx" ON "EmpresasVagasProcesso"("origem");

-- CreateIndex
CREATE INDEX "EmpresasVagasProcesso_statusId_idx" ON "EmpresasVagasProcesso"("statusId");

-- CreateIndex
CREATE INDEX "EmpresasVagasProcesso_vagaId_idx" ON "EmpresasVagasProcesso"("vagaId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagasProcesso_vagaId_candidatoId_key" ON "EmpresasVagasProcesso"("vagaId", "candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagasSubcategorias_codSubcategoria_key" ON "EmpresasVagasSubcategorias"("codSubcategoria");

-- CreateIndex
CREATE INDEX "EmpresasVagasSubcategorias_nome_idx" ON "EmpresasVagasSubcategorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagasSubcategorias_categoriaId_nome_key" ON "EmpresasVagasSubcategorias"("categoriaId", "nome");

-- CreateIndex
CREATE INDEX "LogEmail_criadoEm_idx" ON "LogEmail"("criadoEm");

-- CreateIndex
CREATE INDEX "LogEmail_email_idx" ON "LogEmail"("email");

-- CreateIndex
CREATE INDEX "LogEmail_tipoEmail_idx" ON "LogEmail"("tipoEmail");

-- CreateIndex
CREATE INDEX "LogEmail_usuarioId_idx" ON "LogEmail"("usuarioId");

-- CreateIndex
CREATE INDEX "LogSMS_criadoEm_idx" ON "LogSMS"("criadoEm");

-- CreateIndex
CREATE INDEX "LogSMS_telefone_idx" ON "LogSMS"("telefone");

-- CreateIndex
CREATE INDEX "LogSMS_tipoSMS_idx" ON "LogSMS"("tipoSMS");

-- CreateIndex
CREATE INDEX "LogSMS_usuarioId_idx" ON "LogSMS"("usuarioId");

-- CreateIndex
CREATE INDEX "LogsPagamentosDeAssinaturas_criadoEm_idx" ON "LogsPagamentosDeAssinaturas"("criadoEm");

-- CreateIndex
CREATE INDEX "LogsPagamentosDeAssinaturas_empresasPlanoId_idx" ON "LogsPagamentosDeAssinaturas"("empresasPlanoId");

-- CreateIndex
CREATE INDEX "LogsPagamentosDeAssinaturas_tipo_idx" ON "LogsPagamentosDeAssinaturas"("tipo");

-- CreateIndex
CREATE INDEX "LogsPagamentosDeAssinaturas_usuarioId_idx" ON "LogsPagamentosDeAssinaturas"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanosEmpresariais_mpPreapprovalPlanId_key" ON "PlanosEmpresariais"("mpPreapprovalPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_supabaseId_key" ON "Usuarios"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_cpf_key" ON "Usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_cnpj_key" ON "Usuarios"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_email_key" ON "Usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_codUsuario_key" ON "Usuarios"("codUsuario");

-- CreateIndex
CREATE INDEX "Usuarios_criadoEm_idx" ON "Usuarios"("criadoEm");

-- CreateIndex
CREATE INDEX "Usuarios_role_idx" ON "Usuarios"("role");

-- CreateIndex
CREATE INDEX "Usuarios_status_idx" ON "Usuarios"("status");

-- CreateIndex
CREATE INDEX "Usuarios_tipoUsuario_idx" ON "Usuarios"("tipoUsuario");

-- CreateIndex
CREATE INDEX "usuarios_role_status_criadoem_idx" ON "Usuarios"("role", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "usuarios_tipo_role_status_criadoem_idx" ON "Usuarios"("tipoUsuario", "role", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "UsuariosCandidatosLogs_usuarioId_criadoEm_idx" ON "UsuariosCandidatosLogs"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "UsuariosCurriculos_usuarioId_criadoEm_idx" ON "UsuariosCurriculos"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "UsuariosEmBloqueios_fim_idx" ON "UsuariosEmBloqueios"("fim");

-- CreateIndex
CREATE INDEX "UsuariosEmBloqueios_status_idx" ON "UsuariosEmBloqueios"("status");

-- CreateIndex
CREATE INDEX "UsuariosEmBloqueios_usuarioId_idx" ON "UsuariosEmBloqueios"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuariosEmBloqueiosLogs_bloqueioId_idx" ON "UsuariosEmBloqueiosLogs"("bloqueioId");

-- CreateIndex
CREATE INDEX "UsuariosEmBloqueiosLogs_criadoEm_idx" ON "UsuariosEmBloqueiosLogs"("criadoEm");

-- CreateIndex
CREATE INDEX "UsuariosEmBloqueiosLogs_criadoPorId_idx" ON "UsuariosEmBloqueiosLogs"("criadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosRecuperacaoSenha_usuarioId_key" ON "UsuariosRecuperacaoSenha"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuariosRecuperacaoSenha_tokenRecuperacao_idx" ON "UsuariosRecuperacaoSenha"("tokenRecuperacao");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosRedesSociais_usuarioId_key" ON "UsuariosRedesSociais"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuariosRedesSociais_usuarioId_idx" ON "UsuariosRedesSociais"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosSessoes_refreshToken_key" ON "UsuariosSessoes"("refreshToken");

-- CreateIndex
CREATE INDEX "UsuariosSessoes_expiraEm_idx" ON "UsuariosSessoes"("expiraEm");

-- CreateIndex
CREATE INDEX "UsuariosSessoes_usuarioId_rememberMe_idx" ON "UsuariosSessoes"("usuarioId", "rememberMe");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosVerificacaoEmail_emailVerificationToken_key" ON "UsuariosVerificacaoEmail"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "UsuariosVerificacaoEmail_emailVerificationTokenExp_idx" ON "UsuariosVerificacaoEmail"("emailVerificationTokenExp");

-- CreateIndex
CREATE INDEX "UsuariosVerificacaoEmail_emailVerificationToken_idx" ON "UsuariosVerificacaoEmail"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteBannerOrdem_websiteBannerId_key" ON "WebsiteBannerOrdem"("websiteBannerId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteBannerOrdem_ordem_key" ON "WebsiteBannerOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteBannerOrdem_ordem_idx" ON "WebsiteBannerOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteBannerOrdem_status_idx" ON "WebsiteBannerOrdem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteDepoimentoOrdem_websiteDepoimentoId_key" ON "WebsiteDepoimentoOrdem"("websiteDepoimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteDepoimentoOrdem_ordem_key" ON "WebsiteDepoimentoOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteDepoimentoOrdem_ordem_idx" ON "WebsiteDepoimentoOrdem"("ordem");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteHeaderPage_page_key" ON "WebsiteHeaderPage"("page");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteLogoEnterpriseOrdem_websiteLogoEnterpriseId_key" ON "WebsiteLogoEnterpriseOrdem"("websiteLogoEnterpriseId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteLogoEnterpriseOrdem_ordem_key" ON "WebsiteLogoEnterpriseOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteLogoEnterpriseOrdem_ordem_idx" ON "WebsiteLogoEnterpriseOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteLogoEnterpriseOrdem_status_idx" ON "WebsiteLogoEnterpriseOrdem"("status");

-- CreateIndex
CREATE INDEX "WebsiteScript_aplicacao_orientacao_status_idx" ON "WebsiteScript"("aplicacao", "orientacao", "status");

-- CreateIndex
CREATE INDEX "WebsiteScript_orientacao_status_idx" ON "WebsiteScript"("orientacao", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteSliderOrdem_websiteSliderId_key" ON "WebsiteSliderOrdem"("websiteSliderId");

-- CreateIndex
CREATE INDEX "WebsiteSliderOrdem_ordem_idx" ON "WebsiteSliderOrdem"("ordem");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteSliderOrdem_ordem_orientacao_key" ON "WebsiteSliderOrdem"("ordem", "orientacao");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteTeamOrdem_websiteTeamId_key" ON "WebsiteTeamOrdem"("websiteTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteTeamOrdem_ordem_key" ON "WebsiteTeamOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteTeamOrdem_ordem_idx" ON "WebsiteTeamOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteTeamOrdem_status_idx" ON "WebsiteTeamOrdem"("status");

-- AddForeignKey
ALTER TABLE "AuditoriaLogs" ADD CONSTRAINT "AuditoriaLogs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaScripts" ADD CONSTRAINT "AuditoriaScripts_executadoPor_fkey" FOREIGN KEY ("executadoPor") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaTransacoes" ADD CONSTRAINT "AuditoriaTransacoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaTransacoes" ADD CONSTRAINT "AuditoriaTransacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatosSubareasInteresse" ADD CONSTRAINT "CandidatosSubareasInteresse_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "CandidatosAreasInteresse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponsDesconto" ADD CONSTRAINT "CuponsDesconto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponsDescontoCursos" ADD CONSTRAINT "CuponsDescontoCursos_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "CuponsDesconto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponsDescontoCursos" ADD CONSTRAINT "CuponsDescontoCursos_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponsDescontoPlanos" ADD CONSTRAINT "CuponsDescontoPlanos_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "CuponsDesconto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponsDescontoPlanos" ADD CONSTRAINT "CuponsDescontoPlanos_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanosEmpresariais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cursos" ADD CONSTRAINT "Cursos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CursosCategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cursos" ADD CONSTRAINT "Cursos_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "CursosSubcategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosCertificadosEmitidos" ADD CONSTRAINT "CursosCertificadosEmitidos_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosCertificadosEmitidos" ADD CONSTRAINT "CursosCertificadosEmitidos_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosCertificadosLogs" ADD CONSTRAINT "CursosCertificadosLogs_certificadoId_fkey" FOREIGN KEY ("certificadoId") REFERENCES "CursosCertificadosEmitidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagios" ADD CONSTRAINT "CursosEstagios_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagios" ADD CONSTRAINT "CursosEstagios_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagios" ADD CONSTRAINT "CursosEstagios_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagios" ADD CONSTRAINT "CursosEstagios_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagios" ADD CONSTRAINT "CursosEstagios_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagios" ADD CONSTRAINT "CursosEstagios_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosConfirmacoes" ADD CONSTRAINT "CursosEstagiosConfirmacoes_estagioId_fkey" FOREIGN KEY ("estagioId") REFERENCES "CursosEstagios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosLocais" ADD CONSTRAINT "CursosEstagiosLocais_estagioId_fkey" FOREIGN KEY ("estagioId") REFERENCES "CursosEstagios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosEstagiosNotificacoes" ADD CONSTRAINT "CursosEstagiosNotificacoes_estagioId_fkey" FOREIGN KEY ("estagioId") REFERENCES "CursosEstagios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosFrequenciaAlunos" ADD CONSTRAINT "CursosFrequenciaAlunos_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "CursosTurmasAulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosFrequenciaAlunos" ADD CONSTRAINT "CursosFrequenciaAlunos_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosFrequenciaAlunos" ADD CONSTRAINT "CursosFrequenciaAlunos_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosNotas" ADD CONSTRAINT "CursosNotas_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosNotas" ADD CONSTRAINT "CursosNotas_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "CursosTurmasProvas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosNotas" ADD CONSTRAINT "CursosNotas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosSubcategorias" ADD CONSTRAINT "CursosSubcategorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CursosCategorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmas" ADD CONSTRAINT "CursosTurmas_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmas" ADD CONSTRAINT "CursosTurmas_instrutorId_fkey" FOREIGN KEY ("instrutorId") REFERENCES "Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasAgenda" ADD CONSTRAINT "CursosTurmasAgenda_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "CursosTurmasAulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasAgenda" ADD CONSTRAINT "CursosTurmasAgenda_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "CursosTurmasProvas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasAgenda" ADD CONSTRAINT "CursosTurmasAgenda_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasAulas" ADD CONSTRAINT "CursosTurmasAulas_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "CursosTurmasModulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasAulas" ADD CONSTRAINT "CursosTurmasAulas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasAulasMateriais" ADD CONSTRAINT "CursosTurmasAulasMateriais_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "CursosTurmasAulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasInscricoes" ADD CONSTRAINT "CursosTurmasInscricoes_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasInscricoes" ADD CONSTRAINT "CursosTurmasInscricoes_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasModulos" ADD CONSTRAINT "CursosTurmasModulos_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasProvas" ADD CONSTRAINT "CursosTurmasProvas_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "CursosTurmasModulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasProvas" ADD CONSTRAINT "CursosTurmasProvas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasProvasEnvios" ADD CONSTRAINT "CursosTurmasProvasEnvios_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasProvasEnvios" ADD CONSTRAINT "CursosTurmasProvasEnvios_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "CursosTurmasProvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_envioId_fkey" FOREIGN KEY ("envioId") REFERENCES "CursosTurmasProvasEnvios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "CursosTurmasInscricoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "CursosTurmasProvas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "CursosTurmasRegrasAvaliacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursosTurmasRegrasAvaliacao" ADD CONSTRAINT "CursosTurmasRegrasAvaliacao_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasAuditoria" ADD CONSTRAINT "EmpresasAuditoria_alteradoPor_fkey" FOREIGN KEY ("alteradoPor") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasAuditoria" ADD CONSTRAINT "EmpresasAuditoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_curriculoId_fkey" FOREIGN KEY ("curriculoId") REFERENCES "UsuariosCurriculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_empresaUsuarioId_fkey" FOREIGN KEY ("empresaUsuarioId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status_processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "EmpresasVagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasPlano" ADD CONSTRAINT "EmpresasPlano_planosEmpresariaisId_fkey" FOREIGN KEY ("planosEmpresariaisId") REFERENCES "PlanosEmpresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasPlano" ADD CONSTRAINT "EmpresasPlano_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagas" ADD CONSTRAINT "EmpresasVagas_areaInteresseId_fkey" FOREIGN KEY ("areaInteresseId") REFERENCES "CandidatosAreasInteresse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagas" ADD CONSTRAINT "EmpresasVagas_categoriaVagaId_fkey" FOREIGN KEY ("categoriaVagaId") REFERENCES "EmpresasVagasCategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagas" ADD CONSTRAINT "EmpresasVagas_subareaInteresseId_fkey" FOREIGN KEY ("subareaInteresseId") REFERENCES "CandidatosSubareasInteresse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagas" ADD CONSTRAINT "EmpresasVagas_subcategoriaVagaId_fkey" FOREIGN KEY ("subcategoriaVagaId") REFERENCES "EmpresasVagasSubcategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagas" ADD CONSTRAINT "EmpresasVagas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagasDestaque" ADD CONSTRAINT "EmpresasVagasDestaque_empresasPlanoId_fkey" FOREIGN KEY ("empresasPlanoId") REFERENCES "EmpresasPlano"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagasDestaque" ADD CONSTRAINT "EmpresasVagasDestaque_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "EmpresasVagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagasProcesso" ADD CONSTRAINT "EmpresasVagasProcesso_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagasProcesso" ADD CONSTRAINT "EmpresasVagasProcesso_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status_processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagasProcesso" ADD CONSTRAINT "EmpresasVagasProcesso_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "EmpresasVagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresasVagasSubcategorias" ADD CONSTRAINT "EmpresasVagasSubcategorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "EmpresasVagasCategorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosCandidatosLogs" ADD CONSTRAINT "UsuariosCandidatosLogs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosCurriculos" ADD CONSTRAINT "UsuariosCurriculos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosEmBloqueios" ADD CONSTRAINT "UsuariosEmBloqueios_aplicadoPorId_fkey" FOREIGN KEY ("aplicadoPorId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosEmBloqueios" ADD CONSTRAINT "UsuariosEmBloqueios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosEmBloqueiosLogs" ADD CONSTRAINT "UsuariosEmBloqueiosLogs_bloqueioId_fkey" FOREIGN KEY ("bloqueioId") REFERENCES "UsuariosEmBloqueios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosEmBloqueiosLogs" ADD CONSTRAINT "UsuariosEmBloqueiosLogs_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosEnderecos" ADD CONSTRAINT "UsuariosEnderecos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosInformation" ADD CONSTRAINT "UsuariosInformation_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosRecuperacaoSenha" ADD CONSTRAINT "UsuariosRecuperacaoSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosRedesSociais" ADD CONSTRAINT "UsuariosRedesSociais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosSessoes" ADD CONSTRAINT "UsuariosSessoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuariosVerificacaoEmail" ADD CONSTRAINT "UsuariosVerificacaoEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteBannerOrdem" ADD CONSTRAINT "WebsiteBannerOrdem_websiteBannerId_fkey" FOREIGN KEY ("websiteBannerId") REFERENCES "WebsiteBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteDepoimentoOrdem" ADD CONSTRAINT "WebsiteDepoimentoOrdem_websiteDepoimentoId_fkey" FOREIGN KEY ("websiteDepoimentoId") REFERENCES "WebsiteDepoimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteHorarioFuncionamento" ADD CONSTRAINT "WebsiteHorarioFuncionamento_informacoesId_fkey" FOREIGN KEY ("informacoesId") REFERENCES "WebsiteInformacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteLogoEnterpriseOrdem" ADD CONSTRAINT "WebsiteLogoEnterpriseOrdem_websiteLogoEnterpriseId_fkey" FOREIGN KEY ("websiteLogoEnterpriseId") REFERENCES "WebsiteLogoEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteSliderOrdem" ADD CONSTRAINT "WebsiteSliderOrdem_websiteSliderId_fkey" FOREIGN KEY ("websiteSliderId") REFERENCES "WebsiteSlider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteTeamOrdem" ADD CONSTRAINT "WebsiteTeamOrdem_websiteTeamId_fkey" FOREIGN KEY ("websiteTeamId") REFERENCES "WebsiteTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_processo" ADD CONSTRAINT "status_processo_criadoPor_fkey" FOREIGN KEY ("criadoPor") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

