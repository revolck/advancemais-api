-- CreateEnum
CREATE TYPE "public"."CursosSituacaoFinal" AS ENUM ('EM_ANALISE', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "public"."CursosModelosRecuperacao" AS ENUM ('SUBSTITUI_MENOR', 'MEDIA_MINIMA_DIRETA', 'PROVA_FINAL_UNICA', 'NOTA_MAXIMA_LIMITADA');

-- CreateEnum
CREATE TYPE "public"."CursosLocalProva" AS ENUM ('TURMA', 'MODULO');

-- CreateEnum
CREATE TYPE "public"."CursosStatusPadrao" AS ENUM ('PUBLICADO', 'RASCUNHO', 'DESPUBLICADO');

-- CreateEnum
CREATE TYPE "public"."CursosMateriais" AS ENUM ('APOSTILA', 'SLIDE', 'VIDEOAULA', 'AUDIOAULA', 'ARTIGO', 'EXERCICIO', 'SIMULADO', 'LIVRO', 'CERTIFICADO', 'OUTRO');

-- CreateEnum
CREATE TYPE "public"."TiposDeArquivos" AS ENUM ('pdf', 'docx', 'xlsx', 'pptx', 'imagem', 'video', 'audio', 'zip', 'link', 'outro');

-- CreateEnum
CREATE TYPE "public"."TiposDeUsuarios" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA');

-- CreateEnum
CREATE TYPE "public"."Roles" AS ENUM ('ADMIN', 'MODERADOR', 'FINANCEIRO', 'PROFESSOR', 'EMPRESA', 'PEDAGOGICO', 'RECRUTADOR', 'PSICOLOGO', 'ALUNO_CANDIDATO');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('ATIVO', 'INATIVO', 'BANIDO', 'PENDENTE', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "public"."TiposDeEmails" AS ENUM ('BOAS_VINDAS', 'RECUPERACAO_SENHA', 'VERIFICACAO_EMAIL', 'NOTIFICACAO_SISTEMA');

-- CreateEnum
CREATE TYPE "public"."StatusEmail" AS ENUM ('ENVIADO', 'FALHA', 'PENDENTE');

-- CreateEnum
CREATE TYPE "public"."TipoSMS" AS ENUM ('VERIFICACAO', 'NOTIFICACAO', 'MARKETING');

-- CreateEnum
CREATE TYPE "public"."StatusSMS" AS ENUM ('ENVIADO', 'FALHA', 'PENDENTE');

-- CreateEnum
CREATE TYPE "public"."WebsiteSlidersOrientations" AS ENUM ('DESKTOP', 'TABLET_MOBILE');

-- CreateEnum
CREATE TYPE "public"."WebsiteStatus" AS ENUM ('PUBLICADO', 'RASCUNHO');

-- CreateEnum
CREATE TYPE "public"."WebsiteHeaderPageType" AS ENUM ('SOBRE', 'RECRUTAMENTO', 'VAGAS', 'TREINAMENTO', 'CONTATO', 'BLOG', 'CURSOS', 'POLITICA_PRIVACIDADE', 'OUVIDORIA');

-- CreateEnum
CREATE TYPE "public"."WebsiteScriptOrientation" AS ENUM ('HEADER', 'BODY', 'FOOTER');

-- CreateEnum
CREATE TYPE "public"."STATUS_PAGAMENTO" AS ENUM ('PENDENTE', 'EM_PROCESSAMENTO', 'APROVADO', 'CONCLUIDO', 'RECUSADO', 'ESTORNADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "public"."MODELO_PAGAMENTO" AS ENUM ('ASSINATURA', 'PAGAMENTO_UNICO', 'PAGAMENTO_PARCELADO');

-- CreateEnum
CREATE TYPE "public"."METODO_PAGAMENTO" AS ENUM ('CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'BOLETO', 'TRANSFERENCIA', 'DINHEIRO');

-- CreateEnum
CREATE TYPE "public"."RegimesDeTrabalhos" AS ENUM ('CLT', 'TEMPORARIO', 'ESTAGIO', 'PJ', 'HOME_OFFICE', 'JOVEM_APRENDIZ');

-- CreateEnum
CREATE TYPE "public"."ModalidadesDeVagas" AS ENUM ('PRESENCIAL', 'REMOTO', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "public"."Jornadas" AS ENUM ('INTEGRAL', 'MEIO_PERIODO', 'FLEXIVEL', 'TURNOS', 'NOTURNO');

-- CreateEnum
CREATE TYPE "public"."StatusDeVagas" AS ENUM ('RASCUNHO', 'EM_ANALISE', 'PUBLICADO', 'EXPIRADO', 'DESPUBLICADA', 'PAUSADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "public"."StatusProcesso" AS ENUM ('RECEBIDA', 'EM_ANALISE', 'EM_TRIAGEM', 'ENTREVISTA', 'DESAFIO', 'DOCUMENTACAO', 'CONTRATADO', 'RECUSADO', 'DESISTIU', 'NAO_COMPARECEU', 'ARQUIVADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "public"."OrigemVagas" AS ENUM ('SITE', 'DASHBOARD', 'OUTROS');

-- CreateEnum
CREATE TYPE "public"."Senioridade" AS ENUM ('ABERTO', 'ESTAGIARIO', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA', 'LIDER');

-- CreateEnum
CREATE TYPE "public"."CursosTurnos" AS ENUM ('MANHA', 'TARDE', 'NOITE', 'INTEGRAL');

-- CreateEnum
CREATE TYPE "public"."CursoStatus" AS ENUM ('RASCUNHO', 'PUBLICADO', 'INSCRICOES_ABERTAS', 'INSCRICOES_ENCERRADAS', 'EM_ANDAMENTO', 'CONCLUIDO', 'SUSPENSO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "public"."CursosMetodos" AS ENUM ('ONLINE', 'PRESENCIAL', 'LIVE', 'SEMIPRESENCIAL');

-- CreateEnum
CREATE TYPE "public"."CursosCertificados" AS ENUM ('SEM_CERTIFICADO', 'PARTICIPACAO', 'CONCLUSAO', 'APROVEITAMENTO', 'COMPETENCIA');

-- CreateEnum
CREATE TYPE "public"."CursosCertificadosTipos" AS ENUM ('DIGITAL', 'IMPRESSO', 'DIGITAL_E_IMPRESSO', 'VERIFICAVEL');

-- CreateEnum
CREATE TYPE "public"."EmpresasPlanoStatus" AS ENUM ('ATIVO', 'SUSPENSO', 'EXPIRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "public"."EmpresasPlanoModo" AS ENUM ('TESTE', 'PARCEIRO');

-- CreateEnum
CREATE TYPE "public"."EmpresasPlanoOrigin" AS ENUM ('CHECKOUT', 'ADMIN', 'IMPORT');

-- CreateEnum
CREATE TYPE "public"."TiposDeBanimentos" AS ENUM ('TEMPORARIO', 'PERMANENTE', 'RESTRICAO_DE_RECURSO');

-- CreateEnum
CREATE TYPE "public"."StatusDeBanimentos" AS ENUM ('ATIVO', 'EM_REVISAO', 'REVOGADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "public"."MotivosDeBanimentos" AS ENUM ('SPAM', 'VIOLACAO_POLITICAS', 'FRAUDE', 'ABUSO_DE_RECURSOS', 'OUTROS');

-- CreateEnum
CREATE TYPE "public"."AcoesDeLogDeBanimento" AS ENUM ('CRIACAO', 'ATUALIZACAO', 'REVOGACAO', 'REAVALIACAO');

-- CreateTable
CREATE TABLE "public"."Usuarios" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "cpf" TEXT,
    "cnpj" TEXT,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "codUsuario" TEXT NOT NULL,
    "tipoUsuario" "public"."TiposDeUsuarios" NOT NULL,
    "role" "public"."Roles" NOT NULL,
    "status" "public"."Status" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimoLogin" TIMESTAMP(3),
    "refreshToken" TEXT,

    CONSTRAINT "Usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsuariosInformation" (
    "usuarioId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "genero" TEXT,
    "dataNasc" TIMESTAMP(3),
    "matricula" TEXT,
    "avatarUrl" TEXT,
    "descricao" VARCHAR(500),
    "aceitarTermos" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UsuariosInformation_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "public"."CandidatosAreasInteresse" (
    "id" SERIAL NOT NULL,
    "categoria" VARCHAR(120) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatosAreasInteresse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CandidatosSubareasInteresse" (
    "id" SERIAL NOT NULL,
    "areaId" INTEGER NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatosSubareasInteresse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosCategorias" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255),

    CONSTRAINT "CursosCategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosSubcategorias" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255),
    "categoriaId" INTEGER NOT NULL,

    CONSTRAINT "CursosSubcategorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cursos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(12) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "cargaHoraria" INTEGER NOT NULL,
    "instrutorId" TEXT,
    "statusPadrao" "public"."CursosStatusPadrao" NOT NULL DEFAULT 'RASCUNHO',
    "categoriaId" INTEGER,
    "subcategoriaId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosTurmas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(12) NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "dataInscricaoInicio" TIMESTAMP(3),
    "dataInscricaoFim" TIMESTAMP(3),
    "vagasTotais" INTEGER NOT NULL,
    "vagasDisponiveis" INTEGER NOT NULL,
    "status" "public"."CursoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosTurmasModulos" (
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
CREATE TABLE "public"."CursosTurmasAulas" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "moduloId" TEXT,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasAulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosTurmasAulasMateriais" (
    "id" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" VARCHAR(2000),
    "tipo" "public"."CursosMateriais" NOT NULL,
    "tipoArquivo" "public"."TiposDeArquivos",
    "url" VARCHAR(2048),
    "duracaoEmSegundos" INTEGER,
    "tamanhoEmBytes" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasAulasMateriais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosTurmasMatriculas" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursosTurmasMatriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosTurmasProvas" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "moduloId" TEXT,
    "titulo" VARCHAR(255) NOT NULL,
    "etiqueta" VARCHAR(30) NOT NULL,
    "descricao" TEXT,
    "peso" DECIMAL(5,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "localizacao" "public"."CursosLocalProva" NOT NULL DEFAULT 'TURMA',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasProvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosTurmasProvasEnvios" (
    "id" TEXT NOT NULL,
    "provaId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "nota" DECIMAL(4,1),
    "pesoTotal" DECIMAL(5,2),
    "realizadoEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasProvasEnvios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosTurmasRegrasAvaliacao" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "mediaMinima" DECIMAL(4,1) NOT NULL,
    "politicaRecuperacaoAtiva" BOOLEAN NOT NULL DEFAULT false,
    "modelosRecuperacao" "public"."CursosModelosRecuperacao"[] DEFAULT ARRAY[]::"public"."CursosModelosRecuperacao"[],
    "ordemAplicacaoRecuperacao" "public"."CursosModelosRecuperacao"[] DEFAULT ARRAY[]::"public"."CursosModelosRecuperacao"[],
    "notaMaximaRecuperacao" DECIMAL(4,1),
    "pesoProvaFinal" DECIMAL(5,2),
    "observacoes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasRegrasAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CursosTurmasRecuperacoes" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "regraId" TEXT,
    "provaId" TEXT,
    "envioId" TEXT,
    "notaRecuperacao" DECIMAL(4,1),
    "notaFinal" DECIMAL(4,1),
    "mediaCalculada" DECIMAL(4,2),
    "modeloAplicado" "public"."CursosModelosRecuperacao",
    "statusFinal" "public"."CursosSituacaoFinal" NOT NULL DEFAULT 'EM_ANALISE',
    "detalhes" JSONB,
    "observacoes" VARCHAR(500),
    "aplicadoEm" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursosTurmasRecuperacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsuariosVerificacaoEmail" (
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
CREATE TABLE "public"."UsuariosRecuperacaoSenha" (
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
CREATE TABLE "public"."UsuariosSessoes" (
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
CREATE TABLE "public"."EmpresasVagas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(6) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "areaInteresseId" INTEGER,
    "subareaInteresseId" INTEGER,
    "modoAnonimo" BOOLEAN NOT NULL DEFAULT false,
    "regimeDeTrabalho" "public"."RegimesDeTrabalhos" NOT NULL,
    "modalidade" "public"."ModalidadesDeVagas" NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "paraPcd" BOOLEAN NOT NULL DEFAULT false,
    "numeroVagas" INTEGER NOT NULL DEFAULT 1,
    "descricao" TEXT,
    "requisitos" JSONB NOT NULL,
    "atividades" JSONB NOT NULL,
    "beneficios" JSONB NOT NULL,
    "observacoes" TEXT,
    "jornada" "public"."Jornadas" NOT NULL DEFAULT 'INTEGRAL',
    "senioridade" "public"."Senioridade" NOT NULL DEFAULT 'ABERTO',
    "inscricoesAte" TIMESTAMP(3),
    "inseridaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "status" "public"."StatusDeVagas" NOT NULL DEFAULT 'RASCUNHO',
    "localizacao" JSONB,
    "salarioMin" DECIMAL(12,2),
    "salarioMax" DECIMAL(12,2),
    "salarioConfidencial" BOOLEAN NOT NULL DEFAULT true,
    "maxCandidaturasPorUsuario" INTEGER,
    "destaque" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmpresasVagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpresasVagasProcesso" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "status" "public"."StatusProcesso" NOT NULL DEFAULT 'RECEBIDA',
    "origem" "public"."OrigemVagas" NOT NULL DEFAULT 'SITE',
    "observacoes" VARCHAR(1000),
    "agendadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresasVagasProcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpresasVagasDestaque" (
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
CREATE TABLE "public"."UsuariosCurriculos" (
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
CREATE TABLE "public"."EmpresasCandidatos" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "curriculoId" TEXT NOT NULL,
    "empresaUsuarioId" TEXT NOT NULL,
    "status" "public"."StatusProcesso" NOT NULL DEFAULT 'RECEBIDA',
    "origem" "public"."OrigemVagas" NOT NULL DEFAULT 'SITE',
    "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    "consentimentos" JSONB,

    CONSTRAINT "EmpresasCandidatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpresasPlano" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "planosEmpresariaisId" TEXT NOT NULL,
    "modo" "public"."EmpresasPlanoModo",
    "status" "public"."EmpresasPlanoStatus" NOT NULL DEFAULT 'SUSPENSO',
    "origin" "public"."EmpresasPlanoOrigin" NOT NULL DEFAULT 'CHECKOUT',
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "modeloPagamento" "public"."MODELO_PAGAMENTO",
    "metodoPagamento" "public"."METODO_PAGAMENTO",
    "statusPagamento" "public"."STATUS_PAGAMENTO" DEFAULT 'PENDENTE',
    "mpPreapprovalId" TEXT,
    "mpSubscriptionId" TEXT,
    "mpPayerId" TEXT,
    "mpPaymentId" TEXT,
    "proximaCobranca" TIMESTAMP(3),
    "graceUntil" TIMESTAMP(3),

    CONSTRAINT "EmpresasPlano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LogsPagamentosDeAssinaturas" (
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
CREATE TABLE "public"."UsuariosEmBanimentos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "aplicadoPorId" TEXT NOT NULL,
    "tipo" "public"."TiposDeBanimentos" NOT NULL,
    "motivo" "public"."MotivosDeBanimentos" NOT NULL,
    "status" "public"."StatusDeBanimentos" NOT NULL DEFAULT 'ATIVO',
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "observacoes" VARCHAR(500),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuariosEmBanimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsuariosEmBanimentosLogs" (
    "id" TEXT NOT NULL,
    "banimentoId" TEXT NOT NULL,
    "acao" "public"."AcoesDeLogDeBanimento" NOT NULL,
    "descricao" VARCHAR(500),
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuariosEmBanimentosLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanosEmpresariais" (
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
CREATE TABLE "public"."UsuariosEnderecos" (
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
CREATE TABLE "public"."LogEmail" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "email" TEXT NOT NULL,
    "tipoEmail" "public"."TiposDeEmails" NOT NULL,
    "status" "public"."StatusEmail" NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "erro" TEXT,
    "messageId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LogSMS" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "telefone" TEXT NOT NULL,
    "tipoSMS" "public"."TipoSMS" NOT NULL,
    "status" "public"."StatusSMS" NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "erro" TEXT,
    "messageId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogSMS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteSobre" (
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
CREATE TABLE "public"."WebsiteConsultoria" (
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
CREATE TABLE "public"."WebsiteRecrutamento" (
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
CREATE TABLE "public"."WebsiteSobreEmpresa" (
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
CREATE TABLE "public"."WebsiteTeam" (
    "id" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteTeamOrdem" (
    "id" TEXT NOT NULL,
    "websiteTeamId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "public"."WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteTeamOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteDepoimento" (
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
CREATE TABLE "public"."WebsiteDepoimentoOrdem" (
    "id" TEXT NOT NULL,
    "websiteDepoimentoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "public"."WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteDepoimentoOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteDiferenciais" (
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
CREATE TABLE "public"."WebsiteSlider" (
    "id" TEXT NOT NULL,
    "sliderName" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "link" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteSlider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteSliderOrdem" (
    "id" TEXT NOT NULL,
    "websiteSliderId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "orientacao" "public"."WebsiteSlidersOrientations" NOT NULL,
    "status" "public"."WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteSliderOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteBanner" (
    "id" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "link" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteBannerOrdem" (
    "id" TEXT NOT NULL,
    "websiteBannerId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "public"."WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteBannerOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteLogoEnterprise" (
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
CREATE TABLE "public"."WebsiteLogoEnterpriseOrdem" (
    "id" TEXT NOT NULL,
    "websiteLogoEnterpriseId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "public"."WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteLogoEnterpriseOrdem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteImagemLogin" (
    "id" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemTitulo" TEXT NOT NULL,
    "link" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteImagemLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteScript" (
    "id" TEXT NOT NULL,
    "nome" TEXT,
    "descricao" TEXT,
    "codigo" TEXT NOT NULL,
    "orientacao" "public"."WebsiteScriptOrientation" NOT NULL,
    "status" "public"."WebsiteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsitePlaninhas" (
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
CREATE TABLE "public"."WebsiteAdvanceAjuda" (
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
CREATE TABLE "public"."WebsiteRecrutamentoSelecao" (
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
CREATE TABLE "public"."WebsiteSistema" (
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
CREATE TABLE "public"."WebsiteTreinamentoCompany" (
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
CREATE TABLE "public"."WebsiteConexaoForte" (
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
CREATE TABLE "public"."WebsiteTreinamentosInCompany" (
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
CREATE TABLE "public"."WebsiteInformacoes" (
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
CREATE TABLE "public"."UsuariosRedesSociais" (
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
CREATE TABLE "public"."WebsiteHorarioFuncionamento" (
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
CREATE TABLE "public"."WebsiteHeaderPage" (
    "id" TEXT NOT NULL,
    "subtitulo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "buttonLabel" TEXT NOT NULL,
    "buttonLink" TEXT NOT NULL,
    "page" "public"."WebsiteHeaderPageType" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteHeaderPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_supabaseId_key" ON "public"."Usuarios"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_cpf_key" ON "public"."Usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_cnpj_key" ON "public"."Usuarios"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_email_key" ON "public"."Usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_codUsuario_key" ON "public"."Usuarios"("codUsuario");

-- CreateIndex
CREATE INDEX "Usuarios_status_idx" ON "public"."Usuarios"("status");

-- CreateIndex
CREATE INDEX "Usuarios_role_idx" ON "public"."Usuarios"("role");

-- CreateIndex
CREATE INDEX "Usuarios_tipoUsuario_idx" ON "public"."Usuarios"("tipoUsuario");

-- CreateIndex
CREATE INDEX "Usuarios_criadoEm_idx" ON "public"."Usuarios"("criadoEm");

-- CreateIndex
CREATE INDEX "usuarios_role_status_criadoem_idx" ON "public"."Usuarios"("role", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "usuarios_tipo_role_status_criadoem_idx" ON "public"."Usuarios"("tipoUsuario", "role", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "CandidatosAreasInteresse_categoria_idx" ON "public"."CandidatosAreasInteresse"("categoria");

-- CreateIndex
CREATE INDEX "CandidatosSubareasInteresse_nome_idx" ON "public"."CandidatosSubareasInteresse"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatosSubareasInteresse_areaId_nome_key" ON "public"."CandidatosSubareasInteresse"("areaId", "nome");

-- CreateIndex
CREATE INDEX "CursosCategorias_nome_idx" ON "public"."CursosCategorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CursosCategorias_nome_key" ON "public"."CursosCategorias"("nome");

-- CreateIndex
CREATE INDEX "CursosSubcategorias_nome_idx" ON "public"."CursosSubcategorias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CursosSubcategorias_categoriaId_nome_key" ON "public"."CursosSubcategorias"("categoriaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Cursos_codigo_key" ON "public"."Cursos"("codigo");

-- CreateIndex
CREATE INDEX "Cursos_categoriaId_idx" ON "public"."Cursos"("categoriaId");

-- CreateIndex
CREATE INDEX "Cursos_subcategoriaId_idx" ON "public"."Cursos"("subcategoriaId");

-- CreateIndex
CREATE INDEX "Cursos_instrutorId_idx" ON "public"."Cursos"("instrutorId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmas_codigo_key" ON "public"."CursosTurmas"("codigo");

-- CreateIndex
CREATE INDEX "CursosTurmas_cursoId_idx" ON "public"."CursosTurmas"("cursoId");

-- CreateIndex
CREATE INDEX "CursosTurmas_status_idx" ON "public"."CursosTurmas"("status");

-- CreateIndex
CREATE INDEX "CursosTurmasModulos_turmaId_idx" ON "public"."CursosTurmasModulos"("turmaId");

-- CreateIndex
CREATE INDEX "CursosTurmasModulos_turmaId_ordem_idx" ON "public"."CursosTurmasModulos"("turmaId", "ordem");

-- CreateIndex
CREATE INDEX "CursosTurmasAulas_turmaId_idx" ON "public"."CursosTurmasAulas"("turmaId");

-- CreateIndex
CREATE INDEX "CursosTurmasAulas_moduloId_idx" ON "public"."CursosTurmasAulas"("moduloId");

-- CreateIndex
CREATE INDEX "CursosTurmasAulas_turmaId_ordem_idx" ON "public"."CursosTurmasAulas"("turmaId", "ordem");

-- CreateIndex
CREATE INDEX "CursosTurmasAulasMateriais_aulaId_idx" ON "public"."CursosTurmasAulasMateriais"("aulaId");

-- CreateIndex
CREATE INDEX "CursosTurmasAulasMateriais_tipo_idx" ON "public"."CursosTurmasAulasMateriais"("tipo");

-- CreateIndex
CREATE INDEX "CursosTurmasMatriculas_alunoId_idx" ON "public"."CursosTurmasMatriculas"("alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasMatriculas_turmaId_alunoId_key" ON "public"."CursosTurmasMatriculas"("turmaId", "alunoId");

-- CreateIndex
CREATE INDEX "CursosTurmasProvas_turmaId_idx" ON "public"."CursosTurmasProvas"("turmaId");

-- CreateIndex
CREATE INDEX "CursosTurmasProvas_moduloId_idx" ON "public"."CursosTurmasProvas"("moduloId");

-- CreateIndex
CREATE INDEX "CursosTurmasProvas_turmaId_ativo_idx" ON "public"."CursosTurmasProvas"("turmaId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasProvas_turmaId_etiqueta_key" ON "public"."CursosTurmasProvas"("turmaId", "etiqueta");

-- CreateIndex
CREATE INDEX "CursosTurmasProvasEnvios_matriculaId_idx" ON "public"."CursosTurmasProvasEnvios"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasProvasEnvios_provaId_matriculaId_key" ON "public"."CursosTurmasProvasEnvios"("provaId", "matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "CursosTurmasRegrasAvaliacao_turmaId_key" ON "public"."CursosTurmasRegrasAvaliacao"("turmaId");

-- CreateIndex
CREATE INDEX "CursosTurmasRecuperacoes_turmaId_idx" ON "public"."CursosTurmasRecuperacoes"("turmaId");

-- CreateIndex
CREATE INDEX "CursosTurmasRecuperacoes_matriculaId_idx" ON "public"."CursosTurmasRecuperacoes"("matriculaId");

-- CreateIndex
CREATE INDEX "CursosTurmasRecuperacoes_statusFinal_idx" ON "public"."CursosTurmasRecuperacoes"("statusFinal");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosVerificacaoEmail_emailVerificationToken_key" ON "public"."UsuariosVerificacaoEmail"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "UsuariosVerificacaoEmail_emailVerificationToken_idx" ON "public"."UsuariosVerificacaoEmail"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "UsuariosVerificacaoEmail_emailVerificationTokenExp_idx" ON "public"."UsuariosVerificacaoEmail"("emailVerificationTokenExp");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosRecuperacaoSenha_usuarioId_key" ON "public"."UsuariosRecuperacaoSenha"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuariosRecuperacaoSenha_tokenRecuperacao_idx" ON "public"."UsuariosRecuperacaoSenha"("tokenRecuperacao");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosSessoes_refreshToken_key" ON "public"."UsuariosSessoes"("refreshToken");

-- CreateIndex
CREATE INDEX "UsuariosSessoes_usuarioId_rememberMe_idx" ON "public"."UsuariosSessoes"("usuarioId", "rememberMe");

-- CreateIndex
CREATE INDEX "UsuariosSessoes_expiraEm_idx" ON "public"."UsuariosSessoes"("expiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagas_codigo_key" ON "public"."EmpresasVagas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagas_slug_key" ON "public"."EmpresasVagas"("slug");

-- CreateIndex
CREATE INDEX "EmpresasVagas_usuarioId_idx" ON "public"."EmpresasVagas"("usuarioId");

-- CreateIndex
CREATE INDEX "EmpresasVagas_areaInteresseId_idx" ON "public"."EmpresasVagas"("areaInteresseId");

-- CreateIndex
CREATE INDEX "EmpresasVagas_subareaInteresseId_idx" ON "public"."EmpresasVagas"("subareaInteresseId");

-- CreateIndex
CREATE INDEX "EmpresasVagas_status_inseridaEm_idx" ON "public"."EmpresasVagas"("status", "inseridaEm");

-- CreateIndex
CREATE INDEX "EmpresasVagasProcesso_vagaId_idx" ON "public"."EmpresasVagasProcesso"("vagaId");

-- CreateIndex
CREATE INDEX "EmpresasVagasProcesso_candidatoId_idx" ON "public"."EmpresasVagasProcesso"("candidatoId");

-- CreateIndex
CREATE INDEX "EmpresasVagasProcesso_status_idx" ON "public"."EmpresasVagasProcesso"("status");

-- CreateIndex
CREATE INDEX "EmpresasVagasProcesso_origem_idx" ON "public"."EmpresasVagasProcesso"("origem");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagasProcesso_vagaId_candidatoId_key" ON "public"."EmpresasVagasProcesso"("vagaId", "candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasVagasDestaque_vagaId_key" ON "public"."EmpresasVagasDestaque"("vagaId");

-- CreateIndex
CREATE INDEX "EmpresasVagasDestaque_empresasPlanoId_ativo_idx" ON "public"."EmpresasVagasDestaque"("empresasPlanoId", "ativo");

-- CreateIndex
CREATE INDEX "UsuariosCurriculos_usuarioId_criadoEm_idx" ON "public"."UsuariosCurriculos"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "EmpresasCandidatos_vagaId_candidatoId_idx" ON "public"."EmpresasCandidatos"("vagaId", "candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasCandidatos_vagaId_candidatoId_curriculoId_key" ON "public"."EmpresasCandidatos"("vagaId", "candidatoId", "curriculoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasPlano_mpPreapprovalId_key" ON "public"."EmpresasPlano"("mpPreapprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresasPlano_mpSubscriptionId_key" ON "public"."EmpresasPlano"("mpSubscriptionId");

-- CreateIndex
CREATE INDEX "EmpresasPlano_usuarioId_status_idx" ON "public"."EmpresasPlano"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "EmpresasPlano_planosEmpresariaisId_idx" ON "public"."EmpresasPlano"("planosEmpresariaisId");

-- CreateIndex
CREATE INDEX "LogsPagamentosDeAssinaturas_usuarioId_idx" ON "public"."LogsPagamentosDeAssinaturas"("usuarioId");

-- CreateIndex
CREATE INDEX "LogsPagamentosDeAssinaturas_empresasPlanoId_idx" ON "public"."LogsPagamentosDeAssinaturas"("empresasPlanoId");

-- CreateIndex
CREATE INDEX "LogsPagamentosDeAssinaturas_tipo_idx" ON "public"."LogsPagamentosDeAssinaturas"("tipo");

-- CreateIndex
CREATE INDEX "LogsPagamentosDeAssinaturas_criadoEm_idx" ON "public"."LogsPagamentosDeAssinaturas"("criadoEm");

-- CreateIndex
CREATE INDEX "UsuariosEmBanimentos_usuarioId_idx" ON "public"."UsuariosEmBanimentos"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuariosEmBanimentos_status_idx" ON "public"."UsuariosEmBanimentos"("status");

-- CreateIndex
CREATE INDEX "UsuariosEmBanimentos_fim_idx" ON "public"."UsuariosEmBanimentos"("fim");

-- CreateIndex
CREATE INDEX "UsuariosEmBanimentosLogs_banimentoId_idx" ON "public"."UsuariosEmBanimentosLogs"("banimentoId");

-- CreateIndex
CREATE INDEX "UsuariosEmBanimentosLogs_criadoPorId_idx" ON "public"."UsuariosEmBanimentosLogs"("criadoPorId");

-- CreateIndex
CREATE INDEX "UsuariosEmBanimentosLogs_criadoEm_idx" ON "public"."UsuariosEmBanimentosLogs"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "PlanosEmpresariais_mpPreapprovalPlanId_key" ON "public"."PlanosEmpresariais"("mpPreapprovalPlanId");

-- CreateIndex
CREATE INDEX "LogEmail_usuarioId_idx" ON "public"."LogEmail"("usuarioId");

-- CreateIndex
CREATE INDEX "LogEmail_email_idx" ON "public"."LogEmail"("email");

-- CreateIndex
CREATE INDEX "LogEmail_tipoEmail_idx" ON "public"."LogEmail"("tipoEmail");

-- CreateIndex
CREATE INDEX "LogEmail_criadoEm_idx" ON "public"."LogEmail"("criadoEm");

-- CreateIndex
CREATE INDEX "LogSMS_usuarioId_idx" ON "public"."LogSMS"("usuarioId");

-- CreateIndex
CREATE INDEX "LogSMS_telefone_idx" ON "public"."LogSMS"("telefone");

-- CreateIndex
CREATE INDEX "LogSMS_tipoSMS_idx" ON "public"."LogSMS"("tipoSMS");

-- CreateIndex
CREATE INDEX "LogSMS_criadoEm_idx" ON "public"."LogSMS"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteTeamOrdem_websiteTeamId_key" ON "public"."WebsiteTeamOrdem"("websiteTeamId");

-- CreateIndex
CREATE INDEX "WebsiteTeamOrdem_ordem_idx" ON "public"."WebsiteTeamOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteTeamOrdem_status_idx" ON "public"."WebsiteTeamOrdem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteTeamOrdem_ordem_key" ON "public"."WebsiteTeamOrdem"("ordem");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteDepoimentoOrdem_websiteDepoimentoId_key" ON "public"."WebsiteDepoimentoOrdem"("websiteDepoimentoId");

-- CreateIndex
CREATE INDEX "WebsiteDepoimentoOrdem_ordem_idx" ON "public"."WebsiteDepoimentoOrdem"("ordem");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteDepoimentoOrdem_ordem_key" ON "public"."WebsiteDepoimentoOrdem"("ordem");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteSliderOrdem_websiteSliderId_key" ON "public"."WebsiteSliderOrdem"("websiteSliderId");

-- CreateIndex
CREATE INDEX "WebsiteSliderOrdem_ordem_idx" ON "public"."WebsiteSliderOrdem"("ordem");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteSliderOrdem_ordem_orientacao_key" ON "public"."WebsiteSliderOrdem"("ordem", "orientacao");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteBannerOrdem_websiteBannerId_key" ON "public"."WebsiteBannerOrdem"("websiteBannerId");

-- CreateIndex
CREATE INDEX "WebsiteBannerOrdem_ordem_idx" ON "public"."WebsiteBannerOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteBannerOrdem_status_idx" ON "public"."WebsiteBannerOrdem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteBannerOrdem_ordem_key" ON "public"."WebsiteBannerOrdem"("ordem");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteLogoEnterpriseOrdem_websiteLogoEnterpriseId_key" ON "public"."WebsiteLogoEnterpriseOrdem"("websiteLogoEnterpriseId");

-- CreateIndex
CREATE INDEX "WebsiteLogoEnterpriseOrdem_ordem_idx" ON "public"."WebsiteLogoEnterpriseOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteLogoEnterpriseOrdem_status_idx" ON "public"."WebsiteLogoEnterpriseOrdem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteLogoEnterpriseOrdem_ordem_key" ON "public"."WebsiteLogoEnterpriseOrdem"("ordem");

-- CreateIndex
CREATE INDEX "WebsiteScript_orientacao_status_idx" ON "public"."WebsiteScript"("orientacao", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosRedesSociais_usuarioId_key" ON "public"."UsuariosRedesSociais"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuariosRedesSociais_usuarioId_idx" ON "public"."UsuariosRedesSociais"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteHeaderPage_page_key" ON "public"."WebsiteHeaderPage"("page");

-- AddForeignKey
ALTER TABLE "public"."UsuariosInformation" ADD CONSTRAINT "UsuariosInformation_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CandidatosSubareasInteresse" ADD CONSTRAINT "CandidatosSubareasInteresse_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "public"."CandidatosAreasInteresse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosSubcategorias" ADD CONSTRAINT "CursosSubcategorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."CursosCategorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cursos" ADD CONSTRAINT "Cursos_instrutorId_fkey" FOREIGN KEY ("instrutorId") REFERENCES "public"."Usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cursos" ADD CONSTRAINT "Cursos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."CursosCategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cursos" ADD CONSTRAINT "Cursos_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "public"."CursosSubcategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmas" ADD CONSTRAINT "CursosTurmas_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "public"."Cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasModulos" ADD CONSTRAINT "CursosTurmasModulos_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "public"."CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasAulas" ADD CONSTRAINT "CursosTurmasAulas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "public"."CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasAulas" ADD CONSTRAINT "CursosTurmasAulas_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "public"."CursosTurmasModulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasAulasMateriais" ADD CONSTRAINT "CursosTurmasAulasMateriais_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "public"."CursosTurmasAulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasMatriculas" ADD CONSTRAINT "CursosTurmasMatriculas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "public"."CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasMatriculas" ADD CONSTRAINT "CursosTurmasMatriculas_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasProvas" ADD CONSTRAINT "CursosTurmasProvas_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "public"."CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasProvas" ADD CONSTRAINT "CursosTurmasProvas_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "public"."CursosTurmasModulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasProvasEnvios" ADD CONSTRAINT "CursosTurmasProvasEnvios_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "public"."CursosTurmasProvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasProvasEnvios" ADD CONSTRAINT "CursosTurmasProvasEnvios_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "public"."CursosTurmasMatriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasRegrasAvaliacao" ADD CONSTRAINT "CursosTurmasRegrasAvaliacao_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "public"."CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "public"."CursosTurmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "public"."CursosTurmasMatriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "public"."CursosTurmasRegrasAvaliacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "public"."CursosTurmasProvas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CursosTurmasRecuperacoes" ADD CONSTRAINT "CursosTurmasRecuperacoes_envioId_fkey" FOREIGN KEY ("envioId") REFERENCES "public"."CursosTurmasProvasEnvios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosVerificacaoEmail" ADD CONSTRAINT "UsuariosVerificacaoEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosRecuperacaoSenha" ADD CONSTRAINT "UsuariosRecuperacaoSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosSessoes" ADD CONSTRAINT "UsuariosSessoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasVagas" ADD CONSTRAINT "EmpresasVagas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasVagas" ADD CONSTRAINT "EmpresasVagas_areaInteresseId_fkey" FOREIGN KEY ("areaInteresseId") REFERENCES "public"."CandidatosAreasInteresse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasVagas" ADD CONSTRAINT "EmpresasVagas_subareaInteresseId_fkey" FOREIGN KEY ("subareaInteresseId") REFERENCES "public"."CandidatosSubareasInteresse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasVagasProcesso" ADD CONSTRAINT "EmpresasVagasProcesso_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "public"."EmpresasVagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasVagasProcesso" ADD CONSTRAINT "EmpresasVagasProcesso_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasVagasDestaque" ADD CONSTRAINT "EmpresasVagasDestaque_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "public"."EmpresasVagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasVagasDestaque" ADD CONSTRAINT "EmpresasVagasDestaque_empresasPlanoId_fkey" FOREIGN KEY ("empresasPlanoId") REFERENCES "public"."EmpresasPlano"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosCurriculos" ADD CONSTRAINT "UsuariosCurriculos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "public"."EmpresasVagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_curriculoId_fkey" FOREIGN KEY ("curriculoId") REFERENCES "public"."UsuariosCurriculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasCandidatos" ADD CONSTRAINT "EmpresasCandidatos_empresaUsuarioId_fkey" FOREIGN KEY ("empresaUsuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasPlano" ADD CONSTRAINT "EmpresasPlano_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpresasPlano" ADD CONSTRAINT "EmpresasPlano_planosEmpresariaisId_fkey" FOREIGN KEY ("planosEmpresariaisId") REFERENCES "public"."PlanosEmpresariais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosEmBanimentos" ADD CONSTRAINT "UsuariosEmBanimentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosEmBanimentos" ADD CONSTRAINT "UsuariosEmBanimentos_aplicadoPorId_fkey" FOREIGN KEY ("aplicadoPorId") REFERENCES "public"."Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosEmBanimentosLogs" ADD CONSTRAINT "UsuariosEmBanimentosLogs_banimentoId_fkey" FOREIGN KEY ("banimentoId") REFERENCES "public"."UsuariosEmBanimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosEmBanimentosLogs" ADD CONSTRAINT "UsuariosEmBanimentosLogs_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosEnderecos" ADD CONSTRAINT "UsuariosEnderecos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteTeamOrdem" ADD CONSTRAINT "WebsiteTeamOrdem_websiteTeamId_fkey" FOREIGN KEY ("websiteTeamId") REFERENCES "public"."WebsiteTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteDepoimentoOrdem" ADD CONSTRAINT "WebsiteDepoimentoOrdem_websiteDepoimentoId_fkey" FOREIGN KEY ("websiteDepoimentoId") REFERENCES "public"."WebsiteDepoimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteSliderOrdem" ADD CONSTRAINT "WebsiteSliderOrdem_websiteSliderId_fkey" FOREIGN KEY ("websiteSliderId") REFERENCES "public"."WebsiteSlider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteBannerOrdem" ADD CONSTRAINT "WebsiteBannerOrdem_websiteBannerId_fkey" FOREIGN KEY ("websiteBannerId") REFERENCES "public"."WebsiteBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteLogoEnterpriseOrdem" ADD CONSTRAINT "WebsiteLogoEnterpriseOrdem_websiteLogoEnterpriseId_fkey" FOREIGN KEY ("websiteLogoEnterpriseId") REFERENCES "public"."WebsiteLogoEnterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuariosRedesSociais" ADD CONSTRAINT "UsuariosRedesSociais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteHorarioFuncionamento" ADD CONSTRAINT "WebsiteHorarioFuncionamento_informacoesId_fkey" FOREIGN KEY ("informacoesId") REFERENCES "public"."WebsiteInformacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
