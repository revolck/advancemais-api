import type { Application, RequestHandler } from 'express';
import swaggerJsdoc, { Options } from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { supabaseAuthMiddleware } from '../modules/usuarios/auth';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Advance+ API',
      version: '1.0.0',
      description:
        'Documentação detalhada da API Advance+. Todas as rotas protegidas exigem o header `Authorization: Bearer <token>` obtido via login. O acesso ao Swagger é restrito a administradores.',
    },
    tags: [
      {
        name: 'Default',
        description: 'Endpoints públicos da API',
      },
      { name: 'Brevo', description: 'Serviços de e-mail' },
      {
        name: 'Usuários',
        description:
          'Gerenciamento de contas e autenticação: registro, login, refresh, logout, perfil e recuperação de senha',
      },
      {
        name: 'Usuários - Admin',
        description: 'Gestão administrativa de usuários',
      },
      {
        name: 'Usuários - Stats',
        description: 'Métricas e relatórios de usuários',
      },
      { name: 'Website', description: 'Conteúdo público do site' },
      { name: 'Website - Banner', description: 'Gestão de banners' },
      { name: 'Website - LogoEnterprises', description: 'Logos de empresas' },
      { name: 'Website - Slider', description: 'Gestão de sliders' },
      { name: 'Website - Sobre', description: 'Conteúdos "Sobre"' },
      {
        name: 'Website - Consultoria',
        description: 'Conteúdos "Consultoria"',
      },
      {
        name: 'Website - Recrutamento',
        description: 'Conteúdos "Recrutamento"',
      },
      {
        name: 'Website - SobreEmpresa',
        description: 'Conteúdos "Sobre Empresa"',
      },
      {
        name: 'Website - Team',
        description: 'Conteúdos "Team"',
      },
      {
        name: 'Website - Depoimentos',
        description: 'Conteúdos "Depoimentos"',
      },
      {
        name: 'Website - Diferenciais',
        description: 'Conteúdos "Diferenciais"',
      },
      {
        name: 'Website - Planinhas',
        description: 'Conteúdos "Planinhas"',
      },
      {
        name: 'Website - Advance Ajuda',
        description: 'Conteúdos "Advance Ajuda"',
      },
      {
        name: 'Website - RecrutamentoSelecao',
        description: 'Conteúdos "RecrutamentoSelecao"',
      },
      {
        name: 'Website - Sistema',
        description: 'Conteúdos "Sistema"',
      },
      {
        name: 'Website - TreinamentoCompany',
        description: 'Conteúdos "TreinamentoCompany"',
      },
      {
        name: 'Website - ConexaoForte',
        description: 'Conteúdos "ConexaoForte"',
      },
      {
        name: 'Website - TreinamentosInCompany',
        description: 'Conteúdos "TreinamentosInCompany"',
      },
      {
        name: 'Website - InformacoesGerais',
        description: 'Informações gerais do site',
      },
      {
        name: 'Website - ImagemLogin',
        description: 'Imagem exibida na página de login',
      },
      {
        name: 'Website - Header Pages',
        description: 'Cabeçalhos de páginas',
      },
      {
        name: 'Website - Scripts',
        description: 'Scripts e pixels do site',
      },
      {
        name: 'Empresas - Planos Empresariais',
        description: 'Gestão dos planos empresariais corporativos',
      },
      {
        name: 'Empresas - Clientes',
        description: 'Clientes (empresas) vinculados a planos pagos',
      },
      {
        name: 'Empresas - EmpresasVagas',
        description: 'Administração de vagas corporativas vinculadas às empresas',
      },
      {
        name: 'Empresas - VagasProcessos',
        description: 'Gestão das etapas e candidatos vinculados aos processos seletivos das vagas',
      },
      {
        name: 'Empresas - Admin',
        description:
          'Gestão administrativa completa das empresas: cadastro, planos, pagamentos, vagas, bloqueios e monitoramento operacional',
      },
      {
        name: 'Candidatos',
        description: 'Recursos públicos e administrativos relacionados aos candidatos',
      },
      {
        name: 'Candidatos - Áreas de Interesse',
        description: 'Gestão das áreas de interesse disponíveis para candidatos',
      },
      {
        name: 'Cursos',
        description: 'Gerenciamento de cursos, cargas horárias e instrutores',
      },
      {
        name: 'Cursos - Turmas',
        description: 'Gestão de turmas e inscrições dos cursos',
      },
      {
        name: 'Cursos - Aulas',
        description: 'Gestão de aulas e materiais vinculados às turmas',
      },
      {
        name: 'Cursos - Notas',
        description: 'Lançamento e acompanhamento das notas dos alunos em provas e trabalhos',
      },
      {
        name: 'Cursos - Frequências',
        description: 'Registro e acompanhamento da presença dos alunos nas turmas e aulas',
      },
      {
        name: 'Cursos - Estágios',
        description: 'Gestão dos estágios supervisionados vinculados às inscrições dos cursos',
      },
      {
        name: 'Comercial - Cupons de Desconto',
        description: 'Administração de cupons promocionais aplicados a assinaturas e cursos',
      },
      {
        name: 'MercadoPago - Assinaturas',
        description: 'Assinaturas e cobranças recorrentes (Mercado Pago)',
      },
    ],
    'x-tagGroups': [
      { name: 'Default', tags: ['Default'] },
      { name: 'Brevo', tags: ['Brevo'] },
      {
        name: 'Usuários',
        tags: ['Usuários', 'Usuários - Admin', 'Usuários - Stats'],
      },
      {
        name: 'Websites',
        tags: [
          'Website',
          'Website - Banner',
          'Website - LogoEnterprises',
          'Website - Slider',
          'Website - Sobre',
          'Website - Consultoria',
          'Website - Recrutamento',
          'Website - SobreEmpresa',
          'Website - Team',
          'Website - Depoimentos',
          'Website - Diferenciais',
          'Website - Planinhas',
          'Website - Advance Ajuda',
          'Website - RecrutamentoSelecao',
          'Website - Sistema',
          'Website - TreinamentoCompany',
          'Website - ConexaoForte',
          'Website - TreinamentosInCompany',
          'Website - InformacoesGerais',
          'Website - ImagemLogin',
          'Website - Header Pages',
          'Website - Scripts',
        ],
      },
      {
        name: 'Empresas',
        tags: [
          'Empresas - Planos Empresariais',
          'Empresas - Clientes',
          'Empresas - EmpresasVagas',
          'Empresas - VagasProcessos',
          'Empresas - Admin',
        ],
      },
      {
        name: 'Candidatos',
        tags: ['Candidatos', 'Candidatos - Áreas de Interesse'],
      },
      {
        name: 'Cursos',
        tags: [
          'Cursos',
          'Cursos - Turmas',
          'Cursos - Aulas',
          'Cursos - Notas',
          'Cursos - Frequências',
          'Cursos - Estágios',
          'Cursos - Certificados',
        ],
      },
      { name: 'Pagamentos', tags: ['MercadoPago - Assinaturas'] },
      { name: 'Comercial', tags: ['Comercial - Cupons de Desconto'] },
    ],
    components: {
      schemas: {
        // Enums de Pagamento (para uso geral)
        StatusPagamento: {
          type: 'string',
          enum: [
            'PENDENTE',
            'EM_PROCESSAMENTO',
            'APROVADO',
            'CONCLUIDO',
            'RECUSADO',
            'ESTORNADO',
            'CANCELADO',
          ],
          example: 'PENDENTE',
          description: 'Estados possíveis de um pagamento/processamento de transação',
        },
        ModeloPagamento: {
          type: 'string',
          enum: ['ASSINATURA', 'PAGAMENTO_UNICO', 'PAGAMENTO_PARCELADO'],
          example: 'ASSINATURA',
          description: 'Modelos de cobrança suportados',
        },
        MetodoPagamento: {
          type: 'string',
          enum: ['CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'BOLETO', 'TRANSFERENCIA', 'DINHEIRO'],
          example: 'PIX',
          description: 'Meios de pagamento aceitos',
        },
        CuponsTipoDesconto: {
          type: 'string',
          enum: ['PORCENTAGEM', 'VALOR_FIXO'],
          example: 'PORCENTAGEM',
          description: 'Define como o valor do desconto será aplicado (percentual ou valor fixo)',
        },
        CuponsAplicarEm: {
          type: 'string',
          enum: ['TODA_PLATAFORMA', 'APENAS_ASSINATURA', 'APENAS_CURSOS'],
          example: 'APENAS_ASSINATURA',
          description: 'Escopo de aplicação do cupom dentro da plataforma',
        },
        CuponsLimiteUso: {
          type: 'string',
          enum: ['ILIMITADO', 'LIMITADO'],
          example: 'LIMITADO',
          description: 'Define se o cupom tem limite total de utilizações',
        },
        CuponsLimiteUsuario: {
          type: 'string',
          enum: ['ILIMITADO', 'LIMITADO', 'PRIMEIRA_COMPRA'],
          example: 'PRIMEIRA_COMPRA',
          description: 'Regra de limite de uso por usuário',
        },
        CuponsPeriodo: {
          type: 'string',
          enum: ['ILIMITADO', 'PERIODO'],
          example: 'PERIODO',
          description: 'Determina se o cupom possui período de validade configurado',
        },
        CupomDescontoCursoAplicado: {
          type: 'object',
          properties: {
            cursoId: {
              type: 'integer',
              example: 12,
              description: 'Identificador interno do curso',
            },
            codigo: {
              type: 'string',
              nullable: true,
              example: 'CURS-001',
            },
            nome: {
              type: 'string',
              nullable: true,
              example: 'Curso de Liderança Estratégica',
            },
          },
        },
        CupomDescontoPlanoAplicado: {
          type: 'object',
          properties: {
            planoId: {
              type: 'string',
              format: 'uuid',
              example: '11111111-1111-1111-1111-111111111111',
            },
            nome: {
              type: 'string',
              nullable: true,
              example: 'Plano Premium Empresarial',
            },
          },
        },
        CupomDesconto: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '6b6f2f7a-3c6d-4a9a-9d21-1a2b3c4d5e6f' },
            codigo: { type: 'string', example: 'ADVANCE50' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Campanha especial de lançamento',
            },
            tipoDesconto: { $ref: '#/components/schemas/CuponsTipoDesconto' },
            valorPercentual: {
              type: 'number',
              nullable: true,
              example: 25,
              description: 'Percentual aplicado quando tipoDesconto for PORCENTAGEM',
            },
            valorFixo: {
              type: 'number',
              nullable: true,
              example: 150.5,
              description: 'Valor em reais aplicado quando tipoDesconto for VALOR_FIXO',
            },
            aplicarEm: { $ref: '#/components/schemas/CuponsAplicarEm' },
            aplicarEmTodosItens: { type: 'boolean', example: false },
            limiteUsoTotalTipo: { $ref: '#/components/schemas/CuponsLimiteUso' },
            limiteUsoTotalQuantidade: {
              type: 'integer',
              nullable: true,
              example: 100,
            },
            limitePorUsuarioTipo: { $ref: '#/components/schemas/CuponsLimiteUsuario' },
            limitePorUsuarioQuantidade: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            periodoTipo: { $ref: '#/components/schemas/CuponsPeriodo' },
            periodoInicio: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-01T00:00:00.000Z',
            },
            periodoFim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-03-01T23:59:59.000Z',
            },
            usosTotais: { type: 'integer', example: 12 },
            ativo: { type: 'boolean', example: true },
            criadoEm: { type: 'string', format: 'date-time' },
            atualizadoEm: { type: 'string', format: 'date-time' },
            criadoPor: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid', example: 'f1d2d2f9-1234-5678-90ab-abcdef123456' },
                nomeCompleto: { type: 'string', example: 'Maria Almeida' },
                email: { type: 'string', format: 'email', example: 'maria.almeida@example.com' },
                role: { $ref: '#/components/schemas/Roles' },
              },
            },
            cursosAplicados: {
              type: 'array',
              items: { $ref: '#/components/schemas/CupomDescontoCursoAplicado' },
            },
            planosAplicados: {
              type: 'array',
              items: { $ref: '#/components/schemas/CupomDescontoPlanoAplicado' },
            },
          },
        },
        CupomDescontoCreateInput: {
          type: 'object',
          required: [
            'codigo',
            'tipoDesconto',
            'aplicarEm',
            'limiteUsoTotalTipo',
            'limitePorUsuarioTipo',
            'periodoTipo',
          ],
          properties: {
            codigo: {
              type: 'string',
              example: 'ADVANCE10',
              description: 'Código que o cliente deverá informar no checkout',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Cupom comemorativo de aniversário',
            },
            tipoDesconto: { $ref: '#/components/schemas/CuponsTipoDesconto' },
            valorPercentual: {
              type: 'number',
              nullable: true,
              example: 10,
              description: 'Obrigatório quando tipoDesconto for PORCENTAGEM',
            },
            valorFixo: {
              type: 'number',
              nullable: true,
              example: 50,
              description: 'Obrigatório quando tipoDesconto for VALOR_FIXO',
            },
            aplicarEm: { $ref: '#/components/schemas/CuponsAplicarEm' },
            aplicarEmTodosItens: {
              type: 'boolean',
              nullable: true,
              example: false,
              description: 'Quando verdadeiro aplica o cupom a todos os itens da categoria escolhida',
            },
            cursosIds: {
              type: 'array',
              nullable: true,
              items: { type: 'integer', example: 5 },
              description: 'Obrigatório quando aplicarEm for APENAS_CURSOS e aplicarEmTodosItens for falso',
            },
            planosIds: {
              type: 'array',
              nullable: true,
              items: { type: 'string', format: 'uuid' },
              description: 'Obrigatório quando aplicarEm for APENAS_ASSINATURA e aplicarEmTodosItens for falso',
            },
            limiteUsoTotalTipo: { $ref: '#/components/schemas/CuponsLimiteUso' },
            limiteUsoTotalQuantidade: {
              type: 'integer',
              nullable: true,
              example: 500,
            },
            limitePorUsuarioTipo: { $ref: '#/components/schemas/CuponsLimiteUsuario' },
            limitePorUsuarioQuantidade: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            periodoTipo: { $ref: '#/components/schemas/CuponsPeriodo' },
            periodoInicio: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            periodoFim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            ativo: {
              type: 'boolean',
              nullable: true,
              example: true,
            },
          },
        },
        CupomDescontoUpdateInput: {
          type: 'object',
          additionalProperties: false,
          properties: {
            codigo: { type: 'string', example: 'ADVANCE15' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Atualização do cupom promocional',
            },
            tipoDesconto: { $ref: '#/components/schemas/CuponsTipoDesconto' },
            valorPercentual: {
              type: 'number',
              nullable: true,
            },
            valorFixo: {
              type: 'number',
              nullable: true,
            },
            aplicarEm: { $ref: '#/components/schemas/CuponsAplicarEm' },
            aplicarEmTodosItens: {
              type: 'boolean',
              nullable: true,
            },
            cursosIds: {
              type: 'array',
              nullable: true,
              items: { type: 'integer' },
            },
            planosIds: {
              type: 'array',
              nullable: true,
              items: { type: 'string', format: 'uuid' },
            },
            limiteUsoTotalTipo: { $ref: '#/components/schemas/CuponsLimiteUso' },
            limiteUsoTotalQuantidade: {
              type: 'integer',
              nullable: true,
            },
            limitePorUsuarioTipo: { $ref: '#/components/schemas/CuponsLimiteUsuario' },
            limitePorUsuarioQuantidade: {
              type: 'integer',
              nullable: true,
            },
            periodoTipo: { $ref: '#/components/schemas/CuponsPeriodo' },
            periodoInicio: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            periodoFim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            ativo: {
              type: 'boolean',
              nullable: true,
            },
          },
        },
        CupomDescontoDuplicateResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'CUPOM_DUPLICATE_CODE' },
            message: {
              type: 'string',
              example: 'Já existe um cupom cadastrado com este código',
            },
          },
        },
        TiposDeUsuarios: {
          type: 'string',
          enum: ['PESSOA_FISICA', 'PESSOA_JURIDICA'],
          example: 'PESSOA_FISICA',
          description:
            'Enum TiposDeUsuarios utilizado para classificar pessoas físicas e jurídicas.',
        },
        Roles: {
          type: 'string',
          enum: [
            'ADMIN',
            'MODERADOR',
            'FINANCEIRO',
            'PROFESSOR',
            'EMPRESA',
            'PEDAGOGICO',
            'RECRUTADOR',
            'PSICOLOGO',
            'ALUNO_CANDIDATO',
          ],
          example: 'ADMIN',
          description: 'Enum Roles que define os perfis e permissões de acesso da plataforma.',
        },
        CursosStatusPadrao: {
          type: 'string',
          enum: ['PUBLICADO', 'RASCUNHO', 'DESPUBLICADO'],
          example: 'RASCUNHO',
          description: 'Status base utilizado na configuração de visibilidade dos cursos.',
        },
        CursoStatus: {
          type: 'string',
          enum: [
            'RASCUNHO',
            'PUBLICADO',
            'INSCRICOES_ABERTAS',
            'INSCRICOES_ENCERRADAS',
            'EM_ANDAMENTO',
            'CONCLUIDO',
            'SUSPENSO',
            'CANCELADO',
          ],
          example: 'PUBLICADO',
          description: 'Status operacionais das turmas de cursos.',
        },
        CursosTurnos: {
          type: 'string',
          enum: ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'],
          example: 'NOITE',
          description: 'Turnos disponíveis para oferta das turmas.',
        },
        CursosMetodos: {
          type: 'string',
          enum: ['ONLINE', 'PRESENCIAL', 'LIVE', 'SEMIPRESENCIAL'],
          example: 'ONLINE',
          description: 'Formatos de entrega das turmas.',
        },
        CursosCertificados: {
          type: 'string',
          enum: ['SEM_CERTIFICADO', 'PARTICIPACAO', 'CONCLUSAO', 'APROVEITAMENTO', 'COMPETENCIA'],
          example: 'CONCLUSAO',
          description: 'Tipos de certificados acadêmicos disponíveis.',
        },
        CursosCertificadosTipos: {
          type: 'string',
          enum: ['DIGITAL', 'IMPRESSO', 'DIGITAL_E_IMPRESSO', 'VERIFICAVEL'],
          example: 'DIGITAL',
          description: 'Formato de disponibilização do certificado ao aluno.',
        },
        CursosCertificadosLogAcao: {
          type: 'string',
          enum: ['EMISSAO', 'VISUALIZACAO'],
          example: 'EMISSAO',
          description: 'Tipos de eventos registrados no histórico de certificados.',
        },
        CursosEstagioStatus: {
          type: 'string',
          enum: ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'REPROVADO', 'CANCELADO'],
          example: 'EM_ANDAMENTO',
          description: 'Status operacionais de acompanhamento do estágio do aluno.',
        },
        CursosEstagioDiaSemana: {
          type: 'string',
          enum: ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'],
          example: 'SEGUNDA',
          description: 'Dias da semana previstos para realização das atividades de estágio.',
        },
        CursosEstagioNotificacaoTipo: {
          type: 'string',
          enum: ['ASSINATURA_PENDENTE', 'INICIO_PROXIMO', 'ENCERRAMENTO_PROXIMO', 'CONCLUSAO_SOLICITADA'],
          example: 'ASSINATURA_PENDENTE',
          description: 'Tipos de comunicações automáticas enviadas ao longo do ciclo do estágio.',
        },
        CursosMateriais: {
          type: 'string',
          enum: [
            'APOSTILA',
            'SLIDE',
            'VIDEOAULA',
            'AUDIOAULA',
            'ARTIGO',
            'EXERCICIO',
            'SIMULADO',
            'LIVRO',
            'CERTIFICADO',
            'OUTRO',
          ],
          example: 'VIDEOAULA',
          description: 'Tipos de materiais pedagógicos vinculados às aulas das turmas.',
        },
        TiposDeArquivos: {
          type: 'string',
          enum: ['pdf', 'docx', 'xlsx', 'pptx', 'imagem', 'video', 'audio', 'zip', 'link', 'outro'],
          example: 'pdf',
          description: 'Extensões e formatos de arquivos aceitos para os materiais das aulas.',
        },
        CursoInstrutor: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'P-01' },
            nome: { type: 'string', example: 'João Silva' },
            email: { type: 'string', format: 'email', example: 'joao.silva@example.com' },
            codUsuario: {
              type: 'string',
              example: 'USR-0001',
              description: 'Código interno do usuário instrutor.',
            },
          },
        },
        CursoTurmaAluno: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'AL-001' },
            nome: { type: 'string', example: 'Maria Oliveira' },
            email: { type: 'string', format: 'email', example: 'maria.oliveira@example.com' },
            inscricao: { type: 'string', nullable: true, example: 'INS12345' },
            telefone: {
              type: 'string',
              nullable: true,
              example: '+55 11 91234-5678',
              description: 'Telefone de contato do aluno.',
            },
            endereco: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/CursoTurmaAlunoEndereco' }],
            },
          },
        },
        CursoTurmaAlunoEndereco: {
          type: 'object',
          properties: {
            logradouro: { type: 'string', nullable: true, example: 'Av. Paulista' },
            numero: { type: 'string', nullable: true, example: '1000' },
            bairro: { type: 'string', nullable: true, example: 'Bela Vista' },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            cep: { type: 'string', nullable: true, example: '01310-100' },
          },
        },
        CursoTurmaAulaMaterial: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'ins-001' },
            aulaId: { type: 'string', format: 'uuid', example: 'aul-001' },
            titulo: { type: 'string', example: 'Slides de apresentação' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Material de apoio utilizado na aula',
            },
            tipo: { $ref: '#/components/schemas/CursosMateriais' },
            tipoArquivo: { $ref: '#/components/schemas/TiposDeArquivos', nullable: true },
            url: { type: 'string', format: 'uri', nullable: true, example: 'https://cdn.example.com/video.mp4' },
            duracaoEmSegundos: { type: 'integer', nullable: true, example: 1800 },
            tamanhoEmBytes: { type: 'integer', nullable: true, example: 5242880 },
            ordem: { type: 'integer', example: 1 },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-02-10T14:30:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-02-11T09:00:00Z' },
          },
        },
        CursoTurmaAula: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'aul-001' },
            moduloId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              example: 'mod-001',
              description: 'Identificador do módulo associado à aula, quando aplicável',
            },
            nome: { type: 'string', example: 'Introdução ao Excel' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Apresentação dos conceitos básicos e visão geral do curso',
            },
            ordem: { type: 'integer', example: 1 },
            urlVideo: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://cdn.example.com/aulas/introducao.mp4',
              description: 'URL da aula gravada. Obrigatória para turmas online.',
            },
            sala: {
              type: 'string',
              nullable: true,
              example: 'Sala B',
              description: 'Sala presencial atribuída. Obrigatória para turmas presenciais.',
            },
            urlMeet: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://meet.google.com/abcd-efgh-ijk',
              description: 'Link Meet gerado automaticamente para turmas LIVE.',
            },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-02-10T14:00:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-02-10T15:00:00Z' },
            materiais: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaAulaMaterial' },
            },
          },
        },
        CursoTurma: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'f8a6c3b5-1234-4d9c-9a1b-abcdef123456' },
            codigo: { type: 'string', example: 'TRAB1234' },
            nome: { type: 'string', example: 'Turma 01 - Manhã' },
            turno: { $ref: '#/components/schemas/CursosTurnos' },
            metodo: { $ref: '#/components/schemas/CursosMetodos' },
            status: { $ref: '#/components/schemas/CursoStatus' },
            vagasTotais: { type: 'integer', example: 30 },
            vagasDisponiveis: { type: 'integer', example: 12 },
            dataInicio: { type: 'string', format: 'date-time', nullable: true },
            dataFim: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoInicio: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoFim: { type: 'string', format: 'date-time', nullable: true },
            alunos: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaAluno' },
            },
            aulas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaAula' },
            },
            modulos: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaModulo' },
              nullable: true,
            },
            provas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaProva' },
              nullable: true,
            },
            regrasAvaliacao: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/CursoTurmaRegrasAvaliacao' }],
            },
          },
        },
        Curso: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            codigo: { type: 'string', example: 'CRS1234' },
            nome: { type: 'string', example: 'Excel Avançado' },
            descricao: { type: 'string', nullable: true, example: 'Curso completo de Excel para negócios.' },
            cargaHoraria: { type: 'integer', example: 40 },
            estagioObrigatorio: {
              type: 'boolean',
              example: false,
              description: 'Indica se a conclusão do curso exige estágio supervisionado.',
            },
            statusPadrao: { $ref: '#/components/schemas/CursosStatusPadrao' },
            categoriaId: { type: 'integer', nullable: true, example: 2 },
            subcategoriaId: { type: 'integer', nullable: true, example: 5 },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-01-15T12:00:00Z' },
            instrutor: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/CursoInstrutor' }],
            },
            turmas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurma' },
              nullable: true,
            },
            turmasCount: { type: 'integer', nullable: true, example: 3 },
          },
        },
        CursoCreateInput: {
          type: 'object',
          required: ['nome', 'cargaHoraria', 'instrutorId'],
          properties: {
            nome: { type: 'string', example: 'Excel Avançado' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Curso completo de Excel para negócios.',
            },
            cargaHoraria: { type: 'integer', example: 40, minimum: 1 },
            estagioObrigatorio: {
              type: 'boolean',
              nullable: true,
              description: 'Define se novas inscrições do curso exigirão estágio obrigatório.',
            },
            instrutorId: { type: 'string', format: 'uuid', example: 'P-01' },
            categoriaId: { type: 'integer', nullable: true, example: 2 },
            subcategoriaId: { type: 'integer', nullable: true, example: 5 },
            statusPadrao: { $ref: '#/components/schemas/CursosStatusPadrao' },
          },
        },
        CursoUpdateInput: {
          type: 'object',
          properties: {
            nome: { type: 'string', example: 'Excel Avançado' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Curso completo de Excel para negócios.',
            },
            cargaHoraria: { type: 'integer', example: 60 },
            estagioObrigatorio: {
              type: 'boolean',
              nullable: true,
              description: 'Atualiza se o estágio é requisito obrigatório para conclusão do curso.',
            },
            instrutorId: { type: 'string', format: 'uuid', example: 'P-01' },
            categoriaId: { type: 'integer', nullable: true, example: 3 },
            subcategoriaId: { type: 'integer', nullable: true, example: 7 },
            statusPadrao: { $ref: '#/components/schemas/CursosStatusPadrao' },
          },
        },
        CursoTurmaCreateInput: {
          type: 'object',
          required: ['nome', 'vagasTotais'],
          properties: {
            nome: { type: 'string', example: 'Turma 01 - Manhã' },
            turno: {
              $ref: '#/components/schemas/CursosTurnos',
              description: 'Opcional. Se não informado, assume INTEGRAL.',
            },
            metodo: {
              $ref: '#/components/schemas/CursosMetodos',
              description: 'Opcional. Se não informado, assume ONLINE.',
            },
            dataInicio: { type: 'string', format: 'date-time', nullable: true },
            dataFim: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoInicio: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoFim: { type: 'string', format: 'date-time', nullable: true },
            vagasTotais: { type: 'integer', example: 30, minimum: 1 },
            vagasDisponiveis: { type: 'integer', nullable: true, example: 25 },
            status: { $ref: '#/components/schemas/CursoStatus' },
          },
        },
        CursoTurmaUpdateInput: {
          type: 'object',
          properties: {
            nome: { type: 'string', example: 'Turma 02 - Noite' },
            turno: {
              $ref: '#/components/schemas/CursosTurnos',
              description: 'Atualiza o turno da turma.',
            },
            metodo: {
              $ref: '#/components/schemas/CursosMetodos',
              description: 'Atualiza o formato/metodologia da turma.',
            },
            dataInicio: { type: 'string', format: 'date-time', nullable: true },
            dataFim: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoInicio: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoFim: { type: 'string', format: 'date-time', nullable: true },
            vagasTotais: { type: 'integer', example: 35 },
            vagasDisponiveis: { type: 'integer', nullable: true, example: 20 },
            status: { $ref: '#/components/schemas/CursoStatus' },
          },
        },
        CursoEstagioLocal: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'loc-123' },
            titulo: { type: 'string', nullable: true, example: 'Laboratório de informática' },
            empresaNome: { type: 'string', example: 'Tech Labs LTDA' },
            empresaDocumento: { type: 'string', nullable: true, example: '12.345.678/0001-90' },
            contatoNome: { type: 'string', nullable: true, example: 'Maria Souza' },
            contatoEmail: { type: 'string', nullable: true, example: 'maria@techlabs.com' },
            contatoTelefone: { type: 'string', nullable: true, example: '+55 11 98888-0000' },
            dataInicio: { type: 'string', format: 'date-time', nullable: true },
            dataFim: { type: 'string', format: 'date-time', nullable: true },
            horarioInicio: { type: 'string', nullable: true, example: '08:00' },
            horarioFim: { type: 'string', nullable: true, example: '12:00' },
            diasSemana: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursosEstagioDiaSemana' },
              example: ['SEGUNDA', 'QUARTA'],
            },
            cargaHorariaSemanal: { type: 'integer', nullable: true, example: 12 },
            cep: { type: 'string', nullable: true, example: '01310-100' },
            logradouro: { type: 'string', nullable: true, example: 'Av. Paulista' },
            numero: { type: 'string', nullable: true, example: '1000' },
            bairro: { type: 'string', nullable: true, example: 'Bela Vista' },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            complemento: { type: 'string', nullable: true, example: 'Conjunto 12' },
            pontoReferencia: { type: 'string', nullable: true, example: 'Próximo ao metrô Trianon' },
            observacoes: { type: 'string', nullable: true, example: 'Apresentar documento com foto na recepção.' },
            criadoEm: { type: 'string', format: 'date-time' },
            atualizadoEm: { type: 'string', format: 'date-time' },
          },
        },
        CursoEstagioConfirmacao: {
          type: 'object',
          properties: {
            confirmadoEm: { type: 'string', format: 'date-time', nullable: true },
            protocolo: { type: 'string', nullable: true, example: 'EST-9F2A3C4D5E6F' },
            token: {
              type: 'string',
              nullable: true,
              example: '9f2a3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
              description: 'Token único utilizado para confirmação da ciência via email.',
            },
            registro: {
              type: 'object',
              properties: {
                ip: { type: 'string', nullable: true, example: '200.200.10.1' },
                userAgent: { type: 'string', nullable: true, example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                deviceTipo: { type: 'string', nullable: true, example: 'DESKTOP' },
                deviceDescricao: { type: 'string', nullable: true, example: 'Windows 11 • Chrome 121' },
                deviceId: { type: 'string', nullable: true, example: '358240051111110' },
                sistemaOperacional: { type: 'string', nullable: true, example: 'Windows 11' },
                navegador: { type: 'string', nullable: true, example: 'Chrome' },
                localizacao: { type: 'string', nullable: true, example: 'São Paulo - SP' },
              },
            },
          },
        },
        CursoEstagioNotificacao: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'not-123' },
            tipo: { $ref: '#/components/schemas/CursosEstagioNotificacaoTipo' },
            canal: { type: 'string', nullable: true, example: 'EMAIL' },
            enviadoPara: { type: 'string', example: 'coordenacao@advancemais.com' },
            enviadoEm: { type: 'string', format: 'date-time' },
            detalhes: { type: 'string', nullable: true, example: 'Aviso enviado automaticamente pelo watcher.' },
          },
        },
        CursoEstagio: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'est-123' },
            cursoId: { type: 'integer', example: 10 },
            turmaId: { type: 'string', format: 'uuid', example: 'tur-123' },
            inscricaoId: { type: 'string', format: 'uuid', example: 'ins-789' },
            nome: { type: 'string', example: 'Estágio Supervisionado em RH' },
            descricao: { type: 'string', nullable: true, example: 'Atividades práticas em ambiente corporativo.' },
            obrigatorio: { type: 'boolean', example: true },
            status: { $ref: '#/components/schemas/CursosEstagioStatus' },
            dataInicio: { type: 'string', format: 'date-time', example: '2025-02-01T12:00:00.000Z' },
            dataFim: { type: 'string', format: 'date-time', example: '2025-04-30T23:59:59.000Z' },
            cargaHoraria: { type: 'integer', nullable: true, example: 160 },
            empresaPrincipal: { type: 'string', nullable: true, example: 'Advance Tecnologia' },
            observacoes: { type: 'string', nullable: true },
            confirmadoEm: { type: 'string', format: 'date-time', nullable: true },
            concluidoEm: { type: 'string', format: 'date-time', nullable: true },
            reprovadoEm: { type: 'string', format: 'date-time', nullable: true },
            reprovadoMotivo: { type: 'string', nullable: true },
            ultimoAvisoEncerramento: { type: 'string', format: 'date-time', nullable: true },
            criadoEm: { type: 'string', format: 'date-time' },
            atualizadoEm: { type: 'string', format: 'date-time' },
            criadoPor: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string' },
                email: { type: 'string', format: 'email' },
              },
            },
            atualizadoPor: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string' },
                email: { type: 'string', format: 'email' },
              },
            },
            aluno: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string' },
                email: { type: 'string', format: 'email' },
              },
            },
            curso: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nome: { type: 'string' },
                codigo: { type: 'string' },
                estagioObrigatorio: { type: 'boolean' },
              },
            },
            turma: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string' },
                codigo: { type: 'string' },
              },
            },
            locais: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoEstagioLocal' },
            },
            confirmacao: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/CursoEstagioConfirmacao' }],
            },
            notificacoes: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoEstagioNotificacao' },
            },
          },
        },
        CursoEstagioLocalInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', nullable: true },
            empresaNome: { type: 'string' },
            empresaDocumento: { type: 'string', nullable: true },
            contatoNome: { type: 'string', nullable: true },
            contatoEmail: { type: 'string', nullable: true },
            contatoTelefone: { type: 'string', nullable: true },
            dataInicio: { type: 'string', format: 'date-time', nullable: true },
            dataFim: { type: 'string', format: 'date-time', nullable: true },
            horarioInicio: { type: 'string', nullable: true },
            horarioFim: { type: 'string', nullable: true },
            diasSemana: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursosEstagioDiaSemana' },
            },
            cargaHorariaSemanal: { type: 'integer', nullable: true },
            cep: { type: 'string', nullable: true },
            logradouro: { type: 'string', nullable: true },
            numero: { type: 'string', nullable: true },
            bairro: { type: 'string', nullable: true },
            cidade: { type: 'string', nullable: true },
            estado: { type: 'string', nullable: true },
            complemento: { type: 'string', nullable: true },
            pontoReferencia: { type: 'string', nullable: true },
            observacoes: { type: 'string', nullable: true },
          },
          required: ['empresaNome'],
        },
        CursoEstagioCreateInput: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            descricao: { type: 'string', nullable: true },
            dataInicio: { type: 'string', format: 'date-time' },
            dataFim: { type: 'string', format: 'date-time' },
            cargaHoraria: { type: 'integer', nullable: true },
            empresaPrincipal: { type: 'string', nullable: true },
            obrigatorio: { type: 'boolean', nullable: true },
            observacoes: { type: 'string', nullable: true },
            locais: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/CursoEstagioLocalInput' },
            },
          },
          required: ['nome', 'dataInicio', 'dataFim', 'locais'],
        },
        CursoEstagioUpdateInput: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            descricao: { type: 'string', nullable: true },
            dataInicio: { type: 'string', format: 'date-time' },
            dataFim: { type: 'string', format: 'date-time' },
            cargaHoraria: { type: 'integer', nullable: true },
            empresaPrincipal: { type: 'string', nullable: true },
            obrigatorio: { type: 'boolean', nullable: true },
            observacoes: { type: 'string', nullable: true },
            locais: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoEstagioLocalInput' },
            },
          },
        },
        CursoEstagioStatusInput: {
          type: 'object',
          properties: {
            status: { $ref: '#/components/schemas/CursosEstagioStatus' },
            concluidoEm: { type: 'string', format: 'date-time', nullable: true },
            reprovadoMotivo: { type: 'string', nullable: true },
            observacoes: { type: 'string', nullable: true },
          },
          required: ['status'],
        },
        CursoEstagioConfirmacaoInput: {
          type: 'object',
          properties: {
            ip: { type: 'string', nullable: true },
            deviceTipo: { type: 'string', nullable: true },
            deviceDescricao: { type: 'string', nullable: true },
            deviceId: { type: 'string', nullable: true },
            sistemaOperacional: { type: 'string', nullable: true },
            navegador: { type: 'string', nullable: true },
            localizacao: { type: 'string', nullable: true },
          },
        },
        CursoEstagioReenviarInput: {
          type: 'object',
          properties: {
            destinatarioAlternativo: { type: 'string', nullable: true },
          },
        },
        CursoTurmaAulaMaterialInput: {
          type: 'object',
          required: ['titulo', 'tipo'],
          properties: {
            titulo: { type: 'string', example: 'Slides de apoio' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Conteúdo complementar apresentado em sala',
            },
            tipo: { $ref: '#/components/schemas/CursosMateriais' },
            tipoArquivo: { $ref: '#/components/schemas/TiposDeArquivos', nullable: true },
            url: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://cdn.example.com/material.pdf',
            },
            duracaoEmSegundos: { type: 'integer', nullable: true, example: 900 },
            tamanhoEmBytes: { type: 'integer', nullable: true, example: 2048000 },
            ordem: { type: 'integer', nullable: true, example: 1 },
          },
        },
        CursoTurmaAulaCreateInput: {
          type: 'object',
          required: ['nome'],
          properties: {
            moduloId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Vincula a aula a um módulo específico da turma',
            },
            nome: { type: 'string', example: 'Módulo 01 - Conceitos Básicos' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Introdução aos principais conceitos da disciplina',
            },
            ordem: { type: 'integer', nullable: true, example: 1 },
            urlVideo: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Informe a URL do vídeo quando a turma for online',
            },
            sala: {
              type: 'string',
              nullable: true,
              maxLength: 100,
              description: 'Informe a sala física quando a turma for presencial',
            },
            urlMeet: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Link Meet opcional para turmas LIVE (gerado automaticamente se omitido)',
            },
            materiais: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaAulaMaterialInput' },
              nullable: true,
            },
          },
        },
        CursoTurmaAulaUpdateInput: {
          type: 'object',
          properties: {
            moduloId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Atualiza o vínculo da aula com um módulo específico',
            },
            nome: { type: 'string', example: 'Módulo 01 - Revisado' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Atualização das instruções e materiais da aula',
            },
            ordem: { type: 'integer', nullable: true, example: 2 },
            urlVideo: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Atualiza o link da aula gravada (obrigatório para turmas online)',
            },
            sala: {
              type: 'string',
              nullable: true,
              maxLength: 100,
              description: 'Atualiza a sala física (obrigatória para turmas presenciais)',
            },
            urlMeet: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Atualiza ou regenera o link Meet para turmas LIVE',
            },
            materiais: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaAulaMaterialInput' },
              nullable: true,
            },
          },
        },
        CursosLocalProva: {
          type: 'string',
          enum: ['TURMA', 'MODULO'],
          example: 'TURMA',
        },
        CursosModelosRecuperacao: {
          type: 'string',
          enum: ['SUBSTITUI_MENOR', 'MEDIA_MINIMA_DIRETA', 'PROVA_FINAL_UNICA', 'NOTA_MAXIMA_LIMITADA'],
          example: 'SUBSTITUI_MENOR',
        },
        CursoTurmaModulo: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            turmaId: { type: 'string', format: 'uuid' },
            nome: { type: 'string', example: 'Módulo 1 - Fundamentos' },
            descricao: { type: 'string', nullable: true, example: 'Conteúdos essenciais do módulo.' },
            obrigatorio: { type: 'boolean', example: true },
            ordem: { type: 'integer', example: 1 },
            aulas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaAula' },
            },
            provas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaProva' },
            },
          },
        },
        CursoTurmaModuloCreateInput: {
          type: 'object',
          required: ['nome'],
          properties: {
            nome: { type: 'string', example: 'Módulo 1 - Fundamentos' },
            descricao: { type: 'string', nullable: true, example: 'Conteúdos essenciais do módulo.' },
            obrigatorio: { type: 'boolean', nullable: true, example: true },
            ordem: { type: 'integer', nullable: true, example: 1 },
          },
        },
        CursoTurmaModuloUpdateInput: {
          type: 'object',
          properties: {
            nome: { type: 'string', example: 'Módulo 1 - Atualizado' },
            descricao: { type: 'string', nullable: true },
            obrigatorio: { type: 'boolean', nullable: true },
            ordem: { type: 'integer', nullable: true },
          },
        },
        CursoTurmaProva: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            turmaId: { type: 'string', format: 'uuid' },
            moduloId: { type: 'string', format: 'uuid', nullable: true },
            titulo: { type: 'string', example: 'Prova Parcial' },
            etiqueta: { type: 'string', example: 'P1' },
            descricao: { type: 'string', nullable: true },
            peso: { type: 'number', format: 'float', example: 1 },
            ativo: { type: 'boolean', example: true },
            localizacao: { $ref: '#/components/schemas/CursosLocalProva' },
            ordem: { type: 'integer', example: 1 },
          },
        },
        CursoTurmaProvaCreateInput: {
          type: 'object',
          required: ['titulo', 'etiqueta', 'peso'],
          properties: {
            titulo: { type: 'string', example: 'Prova Parcial' },
            etiqueta: { type: 'string', example: 'P1' },
            descricao: { type: 'string', nullable: true },
            peso: { type: 'number', example: 1, minimum: 0.01 },
            moduloId: { type: 'string', format: 'uuid', nullable: true },
            ativo: { type: 'boolean', nullable: true },
            ordem: { type: 'integer', nullable: true },
          },
        },
        CursoTurmaProvaUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Prova Final' },
            etiqueta: { type: 'string', example: 'PF' },
            descricao: { type: 'string', nullable: true },
            peso: { type: 'number', nullable: true },
            moduloId: { type: 'string', format: 'uuid', nullable: true },
            ativo: { type: 'boolean', nullable: true },
            ordem: { type: 'integer', nullable: true },
          },
        },
        CursoTurmaProvaNotaInput: {
          type: 'object',
          required: ['inscricaoId', 'nota'],
          properties: {
            inscricaoId: { type: 'string', format: 'uuid' },
            nota: { type: 'number', example: 7.5, minimum: 0, maximum: 10 },
            pesoTotal: { type: 'number', nullable: true, example: 1 },
            realizadoEm: { type: 'string', format: 'date-time', nullable: true },
            observacoes: { type: 'string', nullable: true },
          },
        },
        CursosNotaTipo: {
          type: 'string',
          enum: ['PROVA', 'TRABALHO', 'ATIVIDADE', 'PROJETO', 'SEMINARIO', 'PARTICIPACAO', 'SIMULADO', 'BONUS', 'OUTRO'],
          description:
            'Tipo de lançamento da nota. Valores extras cobrem entregas diversas como atividades, projetos, seminários, participação, simulados, bônus e outros registros.',
          example: 'PROVA',
        },
        CursoNota: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            turmaId: { type: 'string', format: 'uuid' },
            inscricaoId: { type: 'string', format: 'uuid' },
            tipo: { $ref: '#/components/schemas/CursosNotaTipo' },
            provaId: { type: 'string', format: 'uuid', nullable: true },
            referenciaExterna: { type: 'string', nullable: true, example: 'TRAB-2025-01' },
            titulo: { type: 'string', example: 'Prova Parcial' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Avaliação dos conteúdos do módulo 1.',
            },
            nota: { type: 'number', format: 'float', nullable: true, example: 8.5 },
            peso: { type: 'number', format: 'float', nullable: true, example: 1 },
            valorMaximo: { type: 'number', format: 'float', nullable: true, example: 10 },
            dataReferencia: { type: 'string', format: 'date-time', nullable: true },
            observacoes: { type: 'string', nullable: true },
            criadoEm: { type: 'string', format: 'date-time' },
            atualizadoEm: { type: 'string', format: 'date-time' },
            prova: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                titulo: { type: 'string', example: 'Prova Parcial' },
                etiqueta: { type: 'string', example: 'P1' },
              },
            },
            inscricao: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                alunoId: { type: 'string', format: 'uuid' },
                aluno: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nome: { type: 'string', example: 'João da Silva' },
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
        },
        CursoNotaCreateInput: {
          type: 'object',
          required: ['inscricaoId', 'tipo'],
          properties: {
            inscricaoId: { type: 'string', format: 'uuid' },
            tipo: { $ref: '#/components/schemas/CursosNotaTipo' },
            provaId: { type: 'string', format: 'uuid', nullable: true },
            referenciaExterna: { type: 'string', nullable: true, maxLength: 120 },
            titulo: { type: 'string', nullable: true, example: 'Entrega Trabalho 1' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Resumo crítico sobre temas abordados na aula.',
            },
            nota: { type: 'number', nullable: true, example: 8 },
            peso: { type: 'number', nullable: true, example: 1 },
            valorMaximo: { type: 'number', nullable: true, example: 10 },
            dataReferencia: { type: 'string', format: 'date-time', nullable: true },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Aluno entregou com atraso de 1 dia.',
            },
          },
        },
        CursoNotaUpdateInput: {
          type: 'object',
          properties: {
            tipo: { $ref: '#/components/schemas/CursosNotaTipo' },
            provaId: { type: 'string', format: 'uuid', nullable: true },
            referenciaExterna: { type: 'string', nullable: true, maxLength: 120 },
            titulo: { type: 'string', nullable: true },
            descricao: { type: 'string', nullable: true },
            nota: { type: 'number', nullable: true },
            peso: { type: 'number', nullable: true },
            valorMaximo: { type: 'number', nullable: true },
            dataReferencia: { type: 'string', format: 'date-time', nullable: true },
            observacoes: { type: 'string', nullable: true },
          },
        },
        CursoNotaResumoInscricao: {
          type: 'object',
          properties: {
            inscricao: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                aluno: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nome: { type: 'string', example: 'Maria Souza' },
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
            curso: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                nome: { type: 'string', example: 'Formação Fullstack' },
              },
            },
            turma: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string', example: 'Turma 2025/1' },
                codigo: { type: 'string', example: 'TURMA001' },
              },
            },
            notas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoNota' },
            },
          },
        },
        CursosFrequenciaStatus: {
          type: 'string',
          enum: ['PRESENTE', 'AUSENTE', 'JUSTIFICADO', 'ATRASADO'],
          description: 'Situação da presença do aluno em aula ou período',
          example: 'PRESENTE',
        },
        CursosAgendaTipo: {
          type: 'string',
          enum: [
            'AULA',
            'PROVA',
            'EVENTO',
            'ATIVIDADE',
            'TRABALHO',
            'PROJETO',
            'SEMINARIO',
            'SIMULADO',
            'REUNIAO',
            'RECESSO',
            'FERIADO',
          ],
          description: 'Tipo de evento registrado na agenda da turma',
          example: 'AULA',
        },
        CursoAgendaEvento: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            turmaId: { type: 'string', format: 'uuid' },
            tipo: { $ref: '#/components/schemas/CursosAgendaTipo' },
            titulo: { type: 'string', example: 'Aula inaugural' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Aula de abertura com apresentação da metodologia do curso.',
            },
            inicio: { type: 'string', format: 'date-time', example: '2025-03-10T18:30:00.000Z' },
            fim: { type: 'string', format: 'date-time', nullable: true },
            criadoEm: { type: 'string', format: 'date-time' },
            atualizadoEm: { type: 'string', format: 'date-time' },
            turma: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string', example: 'Turma 2025/1 - Noite' },
                codigo: { type: 'string', example: 'TURMA001' },
                cursoId: { type: 'integer', example: 1 },
                curso: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'integer', example: 10 },
                    nome: { type: 'string', example: 'Formação Fullstack' },
                  },
                },
              },
            },
            referencia: {
              nullable: true,
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    tipo: { type: 'string', enum: ['AULA'] },
                    id: { type: 'string', format: 'uuid' },
                    nome: { type: 'string', example: 'Aula 01 - Fundamentos' },
                    moduloId: { type: 'string', format: 'uuid', nullable: true },
                    ordem: { type: 'integer', example: 1 },
                  },
                  required: ['tipo', 'id', 'nome', 'ordem'],
                },
                {
                  type: 'object',
                  properties: {
                    tipo: { type: 'string', enum: ['PROVA'] },
                    id: { type: 'string', format: 'uuid' },
                    titulo: { type: 'string', example: 'Prova 1 - Frontend' },
                    etiqueta: { type: 'string', example: 'P1' },
                    moduloId: { type: 'string', format: 'uuid', nullable: true },
                  },
                  required: ['tipo', 'id', 'titulo', 'etiqueta'],
                },
              ],
            },
          },
        },
        CursoAgendaEventoAluno: {
          allOf: [
            { $ref: '#/components/schemas/CursoAgendaEvento' },
            {
              type: 'object',
              properties: {
                inscricaoId: {
                  type: 'string',
                  format: 'uuid',
                  nullable: true,
                  description: 'Identificador da inscrição do aluno na turma relacionada ao evento',
                },
              },
            },
          ],
        },
        CursoAgendaCreateInput: {
          type: 'object',
          required: ['tipo', 'titulo', 'inicio'],
          properties: {
            tipo: { $ref: '#/components/schemas/CursosAgendaTipo' },
            titulo: {
              type: 'string',
              example: 'Prova final',
              minLength: 3,
              maxLength: 255,
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Prova presencial realizada na sede da escola.',
            },
            inicio: { type: 'string', format: 'date-time', example: '2025-07-20T13:00:00.000Z' },
            fim: { type: 'string', format: 'date-time', nullable: true },
            aulaId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Obrigatório quando tipo for AULA',
            },
            provaId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Obrigatório quando tipo for PROVA',
            },
          },
        },
        CursoAgendaUpdateInput: {
          type: 'object',
          properties: {
            tipo: { $ref: '#/components/schemas/CursosAgendaTipo' },
            titulo: {
              type: 'string',
              example: 'Aula prática de projeto',
              minLength: 3,
              maxLength: 255,
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Workshop com mentoria individual.',
            },
            inicio: { type: 'string', format: 'date-time' },
            fim: { type: 'string', format: 'date-time', nullable: true },
            aulaId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            provaId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
          },
        },
        CursoFrequencia: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            turmaId: { type: 'string', format: 'uuid' },
            inscricaoId: { type: 'string', format: 'uuid' },
            aulaId: { type: 'string', format: 'uuid', nullable: true },
            dataReferencia: { type: 'string', format: 'date-time' },
            status: { $ref: '#/components/schemas/CursosFrequenciaStatus' },
            justificativa: {
              type: 'string',
              nullable: true,
              example: 'Aluno apresentou atestado médico.',
            },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Aluno chegou com 10 minutos de atraso.',
            },
            criadoEm: { type: 'string', format: 'date-time' },
            atualizadoEm: { type: 'string', format: 'date-time' },
            aula: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string', example: 'Aula 05 - Fundamentos de SQL' },
                ordem: { type: 'integer', example: 5 },
                moduloId: { type: 'string', format: 'uuid', nullable: true },
                modulo: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nome: { type: 'string', example: 'Banco de Dados' },
                  },
                },
              },
            },
            inscricao: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                alunoId: { type: 'string', format: 'uuid' },
                aluno: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nome: { type: 'string', example: 'João da Silva' },
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
        },
        CursoFrequenciaCreateInput: {
          type: 'object',
          required: ['inscricaoId', 'status'],
          properties: {
            inscricaoId: { type: 'string', format: 'uuid' },
            aulaId: { type: 'string', format: 'uuid', nullable: true },
            dataReferencia: { type: 'string', format: 'date-time', nullable: true },
            status: { $ref: '#/components/schemas/CursosFrequenciaStatus' },
            justificativa: {
              type: 'string',
              nullable: true,
              maxLength: 500,
              example: 'Falta justificada com atestado.',
            },
            observacoes: {
              type: 'string',
              nullable: true,
              maxLength: 500,
              example: 'Aluno participou remotamente.',
            },
          },
        },
        CursoFrequenciaUpdateInput: {
          type: 'object',
          properties: {
            aulaId: { type: 'string', format: 'uuid', nullable: true },
            dataReferencia: { type: 'string', format: 'date-time', nullable: true },
            status: { $ref: '#/components/schemas/CursosFrequenciaStatus' },
            justificativa: {
              type: 'string',
              nullable: true,
              maxLength: 500,
            },
            observacoes: {
              type: 'string',
              nullable: true,
              maxLength: 500,
            },
          },
        },
        CursoFrequenciaResumoInscricao: {
          type: 'object',
          properties: {
            inscricao: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                aluno: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nome: { type: 'string', example: 'Maria Souza' },
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
            curso: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                nome: { type: 'string', example: 'Formação Fullstack' },
              },
            },
            turma: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string', example: 'Turma 2025/1' },
                codigo: { type: 'string', example: 'TURMA001' },
              },
            },
            frequencias: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoFrequencia' },
            },
          },
        },
        CursoTurmaRegrasAvaliacao: {
          type: 'object',
          properties: {
            mediaMinima: { type: 'number', example: 7 },
            politicaRecuperacaoAtiva: { type: 'boolean', example: true },
            modelosRecuperacao: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursosModelosRecuperacao' },
            },
            ordemAplicacaoRecuperacao: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursosModelosRecuperacao' },
            },
            notaMaximaRecuperacao: { type: 'number', nullable: true, example: 7 },
            pesoProvaFinal: { type: 'number', nullable: true, example: 1 },
            observacoes: { type: 'string', nullable: true },
          },
        },
        CursoTurmaRegrasAvaliacaoInput: {
          type: 'object',
          properties: {
            mediaMinima: { type: 'number', nullable: true },
            politicaRecuperacaoAtiva: { type: 'boolean', nullable: true },
            modelosRecuperacao: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursosModelosRecuperacao' },
              nullable: true,
            },
            ordemAplicacaoRecuperacao: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursosModelosRecuperacao' },
              nullable: true,
            },
            notaMaximaRecuperacao: { type: 'number', nullable: true },
            pesoProvaFinal: { type: 'number', nullable: true },
            observacoes: { type: 'string', nullable: true },
          },
        },
        CursoTurmaRecuperacaoInput: {
          type: 'object',
          required: ['inscricaoId'],
          properties: {
            inscricaoId: { type: 'string', format: 'uuid' },
            provaId: { type: 'string', format: 'uuid', nullable: true },
            envioId: { type: 'string', format: 'uuid', nullable: true },
            notaRecuperacao: { type: 'number', nullable: true, example: 8 },
            notaFinal: { type: 'number', nullable: true, example: 8 },
            mediaCalculada: { type: 'number', nullable: true, example: 7.5 },
            modeloAplicado: {
              nullable: true,
              $ref: '#/components/schemas/CursosModelosRecuperacao',
            },
            observacoes: { type: 'string', nullable: true },
            aplicadoEm: { type: 'string', format: 'date-time', nullable: true },
            detalhes: {
              type: 'object',
              nullable: true,
              additionalProperties: true,
            },
          },
        },
        CursoCertificadoLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            acao: { $ref: '#/components/schemas/CursosCertificadosLogAcao' },
            formato: { $ref: '#/components/schemas/CursosCertificadosTipos' },
            detalhes: { type: 'string', nullable: true },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        CursoCertificado: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            codigo: { type: 'string', example: 'CERTAB12345' },
            tipo: { $ref: '#/components/schemas/CursosCertificados' },
            formato: { $ref: '#/components/schemas/CursosCertificadosTipos' },
            cargaHoraria: { type: 'integer', example: 40 },
            assinaturaUrl: { type: 'string', format: 'uri', nullable: true },
            emitidoEm: { type: 'string', format: 'date-time' },
            observacoes: { type: 'string', nullable: true },
            aluno: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string', example: 'João da Silva' },
                email: { type: 'string', format: 'email', example: 'joao@email.com' },
                cpf: { type: 'string', nullable: true, example: '123.456.789-00' },
                cpfMascarado: { type: 'string', nullable: true, example: '***.***.***-00' },
                inscricao: { type: 'string', nullable: true, example: 'INS12345' },
              },
            },
            curso: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                nome: { type: 'string', example: 'Excel Avançado' },
                codigo: { type: 'string', example: 'CRS1234' },
                cargaHoraria: { type: 'integer', example: 40 },
              },
            },
            turma: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string', example: 'Turma 2025/1' },
                codigo: { type: 'string', example: 'TRAB1234' },
              },
            },
            emitidoPor: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string', example: 'Maria Oliveira' },
                email: { type: 'string', format: 'email', example: 'maria@advancemais.com' },
              },
            },
            logs: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoCertificadoLog' },
            },
          },
        },
        CursoCertificadoCreateInput: {
          type: 'object',
          required: ['inscricaoId', 'tipo', 'formato'],
          properties: {
            inscricaoId: { type: 'string', format: 'uuid' },
            tipo: { $ref: '#/components/schemas/CursosCertificados' },
            formato: { $ref: '#/components/schemas/CursosCertificadosTipos' },
            cargaHoraria: { type: 'integer', minimum: 1, nullable: true, example: 40 },
            assinaturaUrl: { type: 'string', format: 'uri', nullable: true },
            observacoes: { type: 'string', nullable: true, maxLength: 500 },
          },
        },
        CursoCertificadoResumoInscricao: {
          type: 'object',
          properties: {
            inscricao: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                aluno: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nome: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    cpf: { type: 'string', nullable: true },
                    inscricao: { type: 'string', nullable: true },
                  },
                },
              },
            },
            curso: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nome: { type: 'string' },
                codigo: { type: 'string' },
                cargaHoraria: { type: 'integer' },
              },
            },
            turma: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string' },
                codigo: { type: 'string' },
              },
            },
            certificados: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoCertificado' },
            },
          },
        },
        CursoPublico: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            codigo: { type: 'string', example: 'CRS1234' },
            nome: { type: 'string', example: 'Excel Básico' },
            descricao: { type: 'string', nullable: true },
            cargaHoraria: { type: 'integer', example: 20 },
            estagioObrigatorio: {
              type: 'boolean',
              example: false,
              description: 'Identifica se o curso exige estágio para emissão do certificado.',
            },
            statusPadrao: { $ref: '#/components/schemas/CursosStatusPadrao' },
            turmas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaPublicResumo' },
            },
          },
        },
        TurmaPublicaDetalhada: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            codigo: { type: 'string' },
            nome: { type: 'string' },
            status: { $ref: '#/components/schemas/CursoStatus' },
            vagasTotais: { type: 'integer' },
            vagasDisponiveis: { type: 'integer' },
            dataInicio: { type: 'string', format: 'date-time', nullable: true },
            dataFim: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoInicio: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoFim: { type: 'string', format: 'date-time', nullable: true },
            modulos: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaModulo' },
            },
            aulas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaAula' },
            },
            provas: {
              type: 'array',
              items: { $ref: '#/components/schemas/CursoTurmaProva' },
            },
            regrasAvaliacao: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/CursoTurmaRegrasAvaliacao' }],
            },
          },
        },
        CursoPublicoDetalhado: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            codigo: { type: 'string' },
            nome: { type: 'string' },
            descricao: { type: 'string', nullable: true },
            cargaHoraria: { type: 'integer' },
            estagioObrigatorio: {
              type: 'boolean',
              example: false,
              description: 'Indica se o certificado depende da conclusão de estágio supervisionado.',
            },
            statusPadrao: { $ref: '#/components/schemas/CursosStatusPadrao' },
            instrutor: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string' },
              },
            },
            turmas: {
              type: 'array',
              items: { $ref: '#/components/schemas/TurmaPublicaDetalhada' },
            },
          },
        },
        CursoTurmaPublicResumo: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            codigo: { type: 'string' },
            nome: { type: 'string' },
            status: { $ref: '#/components/schemas/CursoStatus' },
            vagasTotais: { type: 'integer' },
            vagasDisponiveis: { type: 'integer' },
            dataInicio: { type: 'string', format: 'date-time', nullable: true },
            dataFim: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoInicio: { type: 'string', format: 'date-time', nullable: true },
            dataInscricaoFim: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        CursoTurmaInscricaoInput: {
          type: 'object',
          required: ['alunoId'],
          properties: {
            alunoId: {
              type: 'string',
              format: 'uuid',
              example: 'AL-001',
              description:
                'Identificador do aluno que receberá a inscrição. Após o encerramento do período de inscrição, apenas usuários ADMIN ou MODERADOR podem realizar esta operação.',
            },
          },
        },
        TiposDeEmails: {
          type: 'string',
          enum: ['BOAS_VINDAS', 'RECUPERACAO_SENHA', 'VERIFICACAO_EMAIL', 'NOTIFICACAO_SISTEMA'],
          example: 'BOAS_VINDAS',
          description: 'Enum TiposDeEmails utilizado nos logs transacionais de envio de email.',
        },
        WebsiteSlidersOrientations: {
          type: 'string',
          enum: ['DESKTOP', 'TABLET_MOBILE'],
          example: 'DESKTOP',
          description:
            'Enum WebsiteSlidersOrientations que determina em quais orientações os sliders são exibidos.',
        },
        CheckoutMetodo: {
          type: 'string',
          enum: ['pagamento', 'assinatura'],
          example: 'pagamento',
          description: 'Fluxo desejado: cobrança única ou assinatura recorrente',
        },
        CheckoutPagamento: {
          type: 'string',
          enum: ['pix', 'card', 'boleto'],
          example: 'pix',
          description: 'Meio de pagamento quando metodo=pagamento',
        },
        CheckoutCardData: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              description: 'Token do cartão retornado pelo Card Payment Brick',
              example: '9f0f9a0f-0acb-4bc8-8f10-1234567890ab',
            },
            installments: {
              type: 'integer',
              minimum: 1,
              maximum: 48,
              example: 1,
              description: 'Quantidade de parcelas desejada',
            },
          },
        },
        CheckoutIntent: {
          type: 'object',
          required: ['usuarioId', 'planosEmpresariaisId', 'metodo'],
          properties: {
            usuarioId: { type: 'string', format: 'uuid' },
            planosEmpresariaisId: { type: 'string', format: 'uuid' },
            metodo: { $ref: '#/components/schemas/CheckoutMetodo' },
            pagamento: {
              $ref: '#/components/schemas/CheckoutPagamento',
              description: 'Obrigatório quando metodo=pagamento. Para assinatura, utiliza-se card.',
            },
            card: {
              $ref: '#/components/schemas/CheckoutCardData',
              description:
                'Obrigatório para pagamento com cartão e para assinatura direta (sem redirect).',
            },
            successUrl: { type: 'string', format: 'uri', nullable: true },
            failureUrl: { type: 'string', format: 'uri', nullable: true },
            pendingUrl: { type: 'string', format: 'uri', nullable: true },
          },
        },
        CheckoutPaymentPixResponse: {
          type: 'object',
          required: ['tipo', 'status'],
          properties: {
            tipo: { type: 'string', enum: ['pix'] },
            status: { type: 'string', example: 'pending' },
            paymentId: { type: 'string', nullable: true },
            qrCode: { type: 'string', nullable: true },
            qrCodeBase64: { type: 'string', nullable: true },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        CheckoutPaymentCardResponse: {
          type: 'object',
          required: ['tipo', 'status'],
          properties: {
            tipo: { type: 'string', enum: ['card'] },
            status: { type: 'string', example: 'approved' },
            paymentId: { type: 'string', nullable: true },
            installments: { type: 'integer', nullable: true, example: 1 },
          },
        },
        CheckoutPaymentBoletoResponse: {
          type: 'object',
          required: ['tipo', 'status'],
          properties: {
            tipo: { type: 'string', enum: ['boleto'] },
            status: { type: 'string', example: 'pending' },
            paymentId: { type: 'string', nullable: true },
            boletoUrl: { type: 'string', format: 'uri', nullable: true },
            barcode: { type: 'string', nullable: true },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        CheckoutAssinaturaResponse: {
          type: 'object',
          required: ['preapprovalId', 'status'],
          properties: {
            preapprovalId: { type: 'string', nullable: true },
            status: { type: 'string', example: 'authorized' },
            initPoint: { type: 'string', format: 'uri', nullable: true },
            requiresRedirect: { type: 'boolean', example: false },
          },
        },
        CheckoutResponse: {
          type: 'object',
          properties: {
            checkoutId: { type: 'string', format: 'uuid' },
            plano: {
              type: 'object',
              description: 'Snapshot do vínculo criado ou atualizado para o checkout',
            },
            pagamento: {
              nullable: true,
              oneOf: [
                { $ref: '#/components/schemas/CheckoutPaymentPixResponse' },
                { $ref: '#/components/schemas/CheckoutPaymentCardResponse' },
                { $ref: '#/components/schemas/CheckoutPaymentBoletoResponse' },
              ],
            },
            assinatura: {
              nullable: true,
              $ref: '#/components/schemas/CheckoutAssinaturaResponse',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Erro de validação' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            error: { type: 'string', example: 'Detalhes adicionais do erro' },
          },
        },
        UnauthorizedResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Token de autorização necessário',
              description:
                'Mensagem informativa indicando ausência ou invalidação do token de acesso',
            },
            error: {
              type: 'string',
              nullable: true,
              example: 'Token inválido ou expirado',
            },
          },
        },
        ForbiddenResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Acesso negado: permissões insuficientes',
              description: 'Motivo pelo qual a requisição foi bloqueada pelo controle de acesso',
            },
            requiredRoles: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
              example: ['ADMIN', 'MODERADOR'],
              description: 'Roles esperadas para acessar o recurso quando disponíveis',
            },
            userRole: {
              type: 'string',
              nullable: true,
              example: 'EMPRESA',
              description: 'Role detectada para o usuário autenticado, se identificada',
            },
          },
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: {
              type: 'string',
              example: 'Dados inválidos para criação do recurso',
            },
            issues: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: { type: 'string' },
              },
              example: {
                campo: ['Este campo é obrigatório'],
              },
            },
          },
        },
        UserLoginRequest: {
          type: 'object',
          required: ['documento', 'senha'],
          properties: {
            documento: {
              type: 'string',
              description: 'CPF do usuário',
              example: '12345678900',
            },
            senha: {
              type: 'string',
              format: 'password',
              example: 'senha123',
            },
            rememberMe: {
              type: 'boolean',
              description:
                'Quando true, mantém o refresh token válido por mais tempo e o salva em cookie HTTP-only neste dispositivo.',
              default: false,
              example: true,
            },
          },
        },
        UserLoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login realizado com sucesso' },
            token: {
              type: 'string',
              description: 'JWT de acesso',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refreshToken: {
              type: 'string',
              description: 'Token para renovação de sessão',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            tokenType: { type: 'string', example: 'Bearer' },
            expiresIn: { type: 'string', example: '1h' },
            rememberMe: { type: 'boolean', example: true },
            refreshTokenExpiresIn: { type: 'string', example: '90d' },
            refreshTokenExpiresAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-06-10T12:00:00.000Z',
            },
            session: {
              type: 'object',
              description: 'Resumo da sessão criada para o refresh token.',
              properties: {
                id: { type: 'string', example: 'f9e88a12-0b88-4d43-9b1f-1234567890ab' },
                rememberMe: { type: 'boolean', example: true },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-03-12T10:15:00.000Z',
                },
                expiresAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-06-10T12:00:00.000Z',
                },
              },
            },
            usuario: {
              allOf: [{ $ref: '#/components/schemas/UserProfile' }],
              description: 'Perfil básico retornado no momento da autenticação.',
            },
            correlationId: {
              type: 'string',
              format: 'uuid',
              example: 'd4e8c2a7-ff52-4f42-b6de-1234567890ab',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-03-12T10:15:01.234Z',
            },
          },
        },
        UserRegisterPessoaFisicaRequest: {
          type: 'object',
          required: [
            'nomeCompleto',
            'telefone',
            'email',
            'senha',
            'confirmarSenha',
            'aceitarTermos',
            'supabaseId',
            'tipoUsuario',
            'cpf',
          ],
          properties: {
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            telefone: {
              type: 'string',
              example: '+55 11 99999-9999',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'joao@example.com',
            },
            senha: {
              type: 'string',
              format: 'password',
              example: 'Senha@1234',
              minLength: 8,
            },
            confirmarSenha: {
              type: 'string',
              format: 'password',
              example: 'Senha@1234',
            },
            aceitarTermos: { type: 'boolean', example: true },
            supabaseId: {
              type: 'string',
              description: 'Identificador do usuário no Supabase',
              example: 'uuid-supabase',
            },
            tipoUsuario: {
              type: 'string',
              enum: ['PESSOA_FISICA'],
              example: 'PESSOA_FISICA',
            },
            cpf: {
              type: 'string',
              description: 'CPF somente com números',
              example: '12345678900',
              minLength: 11,
              maxLength: 11,
            },
            dataNasc: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '1995-05-10',
            },
            genero: {
              type: 'string',
              nullable: true,
              example: 'FEMININO',
            },
            role: {
              allOf: [{ $ref: '#/components/schemas/Roles' }],
              nullable: true,
            },
          },
        },
        UserRegisterPessoaJuridicaRequest: {
          type: 'object',
          required: [
            'nomeCompleto',
            'telefone',
            'email',
            'senha',
            'confirmarSenha',
            'aceitarTermos',
            'supabaseId',
            'tipoUsuario',
            'cnpj',
          ],
          properties: {
            nomeCompleto: { type: 'string', example: 'Empresa Exemplo LTDA' },
            telefone: {
              type: 'string',
              example: '+55 11 98888-7777',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@empresaexemplo.com',
            },
            senha: {
              type: 'string',
              format: 'password',
              example: 'Senha@1234',
              minLength: 8,
            },
            confirmarSenha: {
              type: 'string',
              format: 'password',
              example: 'Senha@1234',
            },
            aceitarTermos: { type: 'boolean', example: true },
            supabaseId: {
              type: 'string',
              description: 'Identificador do usuário no Supabase',
              example: 'uuid-supabase',
            },
            tipoUsuario: {
              type: 'string',
              enum: ['PESSOA_JURIDICA'],
              example: 'PESSOA_JURIDICA',
            },
            cnpj: {
              type: 'string',
              description: 'CNPJ somente com números',
              example: '12345678000199',
              minLength: 14,
              maxLength: 14,
            },
            role: {
              allOf: [{ $ref: '#/components/schemas/Roles' }],
              nullable: true,
            },
          },
        },
        UserRegisterRequest: {
          oneOf: [
            { $ref: '#/components/schemas/UserRegisterPessoaFisicaRequest' },
            { $ref: '#/components/schemas/UserRegisterPessoaJuridicaRequest' },
          ],
          description:
            'Estrutura de cadastro público de usuários. Informe os campos obrigatórios conforme o tipo selecionado (pessoa física ou jurídica).',
        },
        UserRegisterResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example: 'Pessoa física cadastrada com sucesso',
            },
            usuario: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: 'b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab',
                },
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'joao@example.com',
                },
                nomeCompleto: {
                  type: 'string',
                  example: 'João da Silva',
                },
                tipoUsuario: {
                  allOf: [{ $ref: '#/components/schemas/TiposDeUsuarios' }],
                  example: 'PESSOA_FISICA',
                },
                role: {
                  allOf: [{ $ref: '#/components/schemas/Roles' }],
                  example: 'ALUNO_CANDIDATO',
                },
                status: {
                  type: 'string',
                  example: 'ATIVO',
                },
                criadoEm: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-03-01T12:00:00Z',
                },
                codUsuario: {
                  type: 'string',
                  example: 'USR-00001',
                },
              },
            },
            correlationId: {
              type: 'string',
              format: 'uuid',
              example: 'd4e8c2a7-ff52-4f42-b6de-1234567890ab',
            },
            duration: {
              type: 'string',
              example: '245ms',
              description: 'Tempo total de processamento da requisição.',
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          properties: {
            refreshToken: {
              type: 'string',
              description:
                'Token de renovação válido. Opcional quando o cookie HTTP-only (`AUTH_REFRESH_COOKIE_NAME`) ou o header `x-refresh-token` estiver presente.',
              example: '<refresh-token>',
            },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab' },
            email: { type: 'string', example: 'joao@example.com' },
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            telefone: { type: 'string', example: '+55 11 99999-0000' },
            genero: { type: 'string', nullable: true, example: 'MASCULINO' },
            dataNasc: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '1990-01-01',
            },
            inscricao: { type: 'string', nullable: true, example: 'INS123' },
            role: {
              allOf: [{ $ref: '#/components/schemas/Roles' }],
              description: 'Role do usuário',
              example: 'ADMIN',
            },
            tipoUsuario: {
              allOf: [{ $ref: '#/components/schemas/TiposDeUsuarios' }],
            },
            supabaseId: { type: 'string', example: 'uuid-supabase' },
            emailVerificado: { type: 'boolean', example: true },
            emailVerificadoEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-01T12:00:00Z',
            },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            codUsuario: { type: 'string', example: 'ABC1234' },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/avatar.png',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Profissional com experiência em atendimento.',
            },
            aceitarTermos: { type: 'boolean', example: true },
            informacoes: {
              allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }],
              description: 'Dados completos vindos da entidade UsuariosInformation.',
            },
            socialLinks: {
              allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
              nullable: true,
            },
            enderecos: {
              type: 'array',
              items: { $ref: '#/components/schemas/UsuarioEndereco' },
            },
            emailVerification: {
              type: 'object',
              description: 'Detalhes completos da verificação de email',
              properties: {
                verified: { type: 'boolean', example: true },
                verifiedAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-01-01T12:00:00Z',
                },
                tokenExpiration: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-01-02T12:00:00Z',
                },
                attempts: { type: 'integer', example: 2 },
                lastAttemptAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-01-01T13:00:00Z',
                },
              },
            },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        RefreshTokenResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Token renovado com sucesso' },
            token: {
              type: 'string',
              description: 'Novo JWT de acesso',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refreshToken: {
              type: 'string',
              description: 'Novo refresh token rotacionado',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            tokenType: { type: 'string', example: 'Bearer' },
            expiresIn: { type: 'string', example: '1h' },
            rememberMe: { type: 'boolean', example: true },
            refreshTokenExpiresIn: { type: 'string', example: '90d' },
            refreshTokenExpiresAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-06-10T12:00:00.000Z',
            },
            session: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'f9e88a12-0b88-4d43-9b1f-1234567890ab' },
                rememberMe: { type: 'boolean', example: true },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-03-12T10:15:00.000Z',
                },
                expiresAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-06-10T12:00:00.000Z',
                },
              },
            },
            usuario: { $ref: '#/components/schemas/UserProfile' },
            correlationId: {
              type: 'string',
              format: 'uuid',
              example: 'd4e8c2a7-ff52-4f42-b6de-1234567890ab',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-03-12T10:18:01.234Z',
            },
          },
        },
        UserProfileStats: {
          type: 'object',
          properties: {
            accountAge: {
              type: 'integer',
              description: 'Quantidade de dias desde a criação da conta.',
              example: 45,
            },
            hasCompletedProfile: {
              type: 'boolean',
              description: 'Indica se o usuário já preencheu os principais campos do perfil.',
              example: true,
            },
            hasAddress: {
              type: 'boolean',
              description: 'Define se ao menos um endereço foi cadastrado.',
              example: true,
            },
            totalOrders: {
              type: 'integer',
              description: 'Total de pedidos vinculados ao usuário (quando aplicável).',
              example: 0,
            },
            totalSubscriptions: {
              type: 'integer',
              description: 'Quantidade de assinaturas ativas vinculadas ao usuário.',
              example: 0,
            },
            emailVerificationStatus: {
              type: 'object',
              properties: {
                verified: { type: 'boolean', example: true },
                verifiedAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-01-01T12:00:00Z',
                },
                tokenExpiration: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-01-02T12:00:00Z',
                },
              },
            },
          },
        },
        UserProfileResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Perfil obtido com sucesso' },
            usuario: { $ref: '#/components/schemas/UserProfile' },
            stats: { $ref: '#/components/schemas/UserProfileStats' },
            correlationId: {
              type: 'string',
              format: 'uuid',
              example: 'd4e8c2a7-ff52-4f42-b6de-1234567890ab',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-03-12T10:25:01.234Z',
            },
          },
        },
        UserPasswordRecoveryRequest: {
          type: 'object',
          description:
            'Envie apenas um identificador válido (email, CPF ou CNPJ) para iniciar o fluxo de recuperação de senha.',
          properties: {
            identificador: {
              type: 'string',
              description: 'Email, CPF ou CNPJ associado à conta.',
              example: 'user@example.com',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email cadastrado para a conta.',
              example: 'user@example.com',
            },
            cpf: {
              type: 'string',
              description: 'CPF somente com números.',
              minLength: 11,
              maxLength: 11,
              example: '12345678909',
            },
            cnpj: {
              type: 'string',
              description: 'CNPJ somente com números.',
              minLength: 14,
              maxLength: 14,
              example: '12345678000199',
            },
          },
          oneOf: [
            { required: ['identificador'] },
            { required: ['email'] },
            { required: ['cpf'] },
            { required: ['cnpj'] },
          ],
        },
        UserPasswordRecoveryResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example:
                'Se o identificador estiver correto, você receberá um email com instruções para recuperação',
            },
          },
        },
        UserPasswordRecoveryValidateResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Token válido' },
            usuario: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email', example: 'user@example.com' },
                nomeCompleto: { type: 'string', example: 'Usuário Advance' },
              },
            },
          },
        },
        UserPasswordResetRequest: {
          type: 'object',
          required: ['token', 'novaSenha', 'confirmarSenha'],
          properties: {
            token: {
              type: 'string',
              description: 'Token hexadecimal recebido no email de recuperação.',
              example: '4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f',
            },
            novaSenha: {
              type: 'string',
              format: 'password',
              description: 'Nova senha que atende aos critérios vigentes (mínimo de 8 caracteres).',
              example: 'NovaSenha@2024',
            },
            confirmarSenha: {
              type: 'string',
              format: 'password',
              description: 'Confirmação da nova senha (deve ser igual a novaSenha).',
              example: 'NovaSenha@2024',
            },
          },
        },
        UserPasswordResetResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Senha redefinida com sucesso' },
          },
        },
        LogoutResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Logout realizado com sucesso' },
            correlationId: {
              type: 'string',
              format: 'uuid',
              example: 'd4e8c2a7-ff52-4f42-b6de-1234567890ab',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-03-12T10:20:01.234Z',
            },
          },
        },
        BasicMessage: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'OK' },
          },
        },
        ApiRootInfo: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Advance+ API' },
            version: { type: 'string', example: 'v3.0.3' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            environment: { type: 'string', example: 'development' },
            status: { type: 'string', example: 'operational' },
            express_version: { type: 'string', example: '4.x' },
            endpoints: {
              type: 'object',
              additionalProperties: { type: 'string' },
              example: {
                usuarios: '/api/v1/usuarios',
                brevo: '/api/v1/brevo',
                website: '/api/v1/website',
                empresas: '/api/v1/empresas',
                candidatos: '/api/v1/candidatos',
                candidatosAreasInteresse: '/api/v1/candidatos/areas-interesse',
                cursos: '/api/v1/cursos',
                health: '/health',
              },
            },
          },
        },
        GlobalHealthStatus: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'OK' },
            uptime: { type: 'number', example: 1 },
            version: { type: 'string', example: 'v3.0.3' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            environment: { type: 'string', example: 'development' },
            memory: {
              type: 'object',
              properties: {
                used: { type: 'string', example: '120 MB' },
                total: { type: 'string', example: '512 MB' },
              },
            },
            modules: {
              type: 'object',
              properties: {
                usuarios: { type: 'string', example: '✅ active' },
                brevo: { type: 'string', example: '✅ active' },
                website: { type: 'string', example: '✅ active' },
                empresas: { type: 'string', example: '✅ active' },
                candidatos: { type: 'string', example: '✅ active' },
                mercadopago: { type: 'string', example: '✅ active' },
                redis: { type: 'string', example: '✅ active' },
              },
            },
            metrics: {
              type: 'object',
              properties: {
                bans: {
                  type: 'object',
                  properties: {
                    totalProcessed: { type: 'integer', example: 42 },
                    processedLastRun: { type: 'integer', example: 3 },
                    lastRunAt: {
                      type: 'string',
                      format: 'date-time',
                      example: '2025-09-21T15:05:00Z',
                    },
                  },
                },
              },
            },
          },
        },
        BrevoModuleInfo: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              example: 'Brevo Communication Module',
            },
            version: { type: 'string', example: '7.3.0' },
            description: {
              type: 'string',
              example: 'Sistema completo de comunicação e verificação de email',
            },
            status: { type: 'string', example: 'active' },
            configured: { type: 'boolean', example: true },
            simulated: { type: 'boolean', example: false },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        BrevoHealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            module: { type: 'string', example: 'brevo' },
            configured: { type: 'boolean', example: true },
            simulated: { type: 'boolean', example: false },
            operational: { type: 'boolean', example: true },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            services: {
              type: 'object',
              properties: {
                email: { type: 'string', example: 'operational' },
                sms: { type: 'string', example: 'operational' },
                client: { type: 'string', example: 'operational' },
              },
            },
          },
        },
        BrevoConfigStatus: {
          type: 'object',
          properties: {
            module: { type: 'string', example: 'Brevo Configuration Status' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            configuration: {
              type: 'object',
              properties: {
                isConfigured: { type: 'boolean', example: true },
                environment: { type: 'string', example: 'development' },
                apiKeyProvided: { type: 'boolean', example: true },
                fromEmailConfigured: { type: 'boolean', example: true },
                fromName: { type: 'string', example: 'Advance+' },
              },
            },
            emailVerification: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean', example: true },
                tokenExpirationHours: { type: 'integer', example: 24 },
              },
            },
            client: {
              type: 'object',
              properties: {
                operational: { type: 'boolean', example: true },
                simulated: { type: 'boolean', example: false },
              },
            },
          },
        },
        BrevoVerifyEmailResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example: 'Email verificado com sucesso',
            },
            redirectUrl: {
              type: 'string',
              example: 'https://app.advance.com.br',
            },
            userId: {
              type: 'string',
              example: 'b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab',
            },
          },
        },
        BrevoResendVerificationRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
          },
        },
        BrevoResendVerificationResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example: 'Email de verificação reenviado com sucesso',
            },
            simulated: { type: 'boolean', example: false },
            messageId: { type: 'string', example: 'msg_123' },
          },
        },
        BrevoVerificationStatusResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  example: 'b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab',
                },
                email: { type: 'string', example: 'user@example.com' },
                emailVerified: { type: 'boolean', example: false },
                accountStatus: { type: 'string', example: 'ATIVO' },
                hasValidToken: { type: 'boolean', example: true },
                tokenExpiration: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-01T12:00:00Z',
                },
                emailVerification: {
                  type: 'object',
                  description: 'Informações detalhadas de verificação',
                  properties: {
                    verified: { type: 'boolean', example: false },
                    verifiedAt: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                      example: null,
                    },
                    tokenExpiration: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                      example: '2024-01-01T12:00:00Z',
                    },
                    attempts: { type: 'integer', example: 1 },
                    lastAttemptAt: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                      example: '2024-01-01T10:00:00Z',
                    },
                  },
                },
              },
            },
          },
        },
        BrevoTestEmailRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            name: { type: 'string', example: 'Usuário Teste' },
            type: { type: 'string', example: 'welcome' },
          },
        },
        BrevoTestEmailResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example: 'Teste de email welcome executado',
            },
            data: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'welcome' },
                recipient: { type: 'string', example: 'user@example.com' },
                simulated: { type: 'boolean', example: false },
                messageId: { type: 'string', example: 'msg_123' },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        BrevoTestSMSRequest: {
          type: 'object',
          required: ['to'],
          properties: {
            to: { type: 'string', example: '+55 11 99999-9999' },
            message: {
              type: 'string',
              example: 'Teste de SMS do Advance+ - Sistema funcionando!',
            },
          },
        },
        BrevoTestSMSResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Teste de SMS executado' },
            data: {
              type: 'object',
              properties: {
                recipient: {
                  type: 'string',
                  example: '+55 11 99999-9999',
                },
                message: {
                  type: 'string',
                  example: 'Teste de SMS do Advance+ - Sistema funcionando!',
                },
                simulated: { type: 'boolean', example: false },
                messageId: { type: 'string', example: 'sms_123' },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        EmpresasPlano: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'plan-uuid' },
            nome: { type: 'string', example: 'Plano Básico' },
            icone: { type: 'string', nullable: true, example: 'icone.png' },
            categoria: {
              type: 'string',
              enum: ['INICIAL', 'INTERMEDIARIO', 'AVANCADO', 'DESTAQUE'],
              example: 'INICIAL',
            },
            valor: { type: 'number', example: 49.9 },
            desconto: {
              type: 'number',
              nullable: true,
              example: 10,
              description: 'Desconto percentual aplicado ao plano',
            },
            descricao: { type: 'string', example: 'Acesso básico' },
            recursos: {
              type: 'array',
              items: { type: 'string' },
              example: ['feature1', 'feature2'],
            },
            ativo: { type: 'boolean', example: true },
            frequency: { type: 'integer', example: 1 },
            frequencyType: {
              type: 'string',
              enum: ['DIAS', 'MESES'],
              example: 'MESES',
            },
            repetitions: { type: 'integer', nullable: true, example: null },
            billingDay: {
              type: 'integer',
              nullable: true,
              example: 1,
              description: 'Dia de cobrança mensal (1-28)',
            },
            billingDayProportional: {
              type: 'boolean',
              example: true,
              description: 'Define se a primeira cobrança será proporcional',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        EmpresasPlanoCreateRequest: {
          type: 'object',
          required: [
            'nome',
            'categoria',
            'valor',
            'descricao',
            'recursos',
            'frequency',
            'frequencyType',
          ],
          properties: {
            nome: { type: 'string', example: 'Plano Básico' },
            icone: { type: 'string', nullable: true, example: 'icone.png' },
            categoria: {
              type: 'string',
              enum: ['INICIAL', 'INTERMEDIARIO', 'AVANCADO', 'DESTAQUE'],
              example: 'INICIAL',
            },
            valor: { type: 'number', example: 49.9 },
            desconto: {
              type: 'number',
              nullable: true,
              example: 0,
            },
            descricao: { type: 'string', example: 'Acesso básico' },
            recursos: {
              type: 'array',
              items: { type: 'string' },
              example: ['feature1', 'feature2'],
            },
            frequency: { type: 'integer', example: 1 },
            frequencyType: {
              type: 'string',
              enum: ['DIAS', 'MESES'],
              example: 'MESES',
            },
            repetitions: { type: 'integer', nullable: true, example: null },
            billingDay: {
              type: 'integer',
              nullable: true,
              example: 1,
              description: 'Dia de cobrança mensal (1-28)',
            },
            billingDayProportional: {
              type: 'boolean',
              example: true,
              description: 'Define se a primeira cobrança será proporcional',
            },
          },
        },
        EmpresasPlanoUpdateRequest: {
          type: 'object',
          properties: {
            nome: { type: 'string', example: 'Plano Atualizado' },
            icone: { type: 'string', nullable: true, example: 'icone.png' },
            categoria: {
              type: 'string',
              enum: ['INICIAL', 'INTERMEDIARIO', 'AVANCADO', 'DESTAQUE'],
              example: 'INICIAL',
            },
            valor: { type: 'number', example: 59.9 },
            desconto: {
              type: 'number',
              nullable: true,
              example: 0,
            },
            descricao: { type: 'string', example: 'Descrição' },
            recursos: {
              type: 'array',
              items: { type: 'string' },
            },
            ativo: { type: 'boolean', example: true },
            frequency: { type: 'integer', example: 1 },
            frequencyType: {
              type: 'string',
              enum: ['DIAS', 'MESES'],
              example: 'MESES',
            },
            repetitions: { type: 'integer', nullable: true, example: null },
            billingDay: {
              type: 'integer',
              nullable: true,
              example: 1,
              description: 'Dia de cobrança mensal (1-28)',
            },
            billingDayProportional: {
              type: 'boolean',
              example: true,
              description: 'Define se a primeira cobrança será proporcional',
            },
          },
        },
        EmpresasPlanoCreateResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Plano criado' },
            plan: { $ref: '#/components/schemas/EmpresasPlano' },
          },
        },
        EmpresasPlanoUpdateResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Plano atualizado' },
            plan: { $ref: '#/components/schemas/EmpresasPlano' },
          },
        },
        EmpresasPlanosResponse: {
          type: 'object',
          properties: {
            plans: {
              type: 'array',
              items: { $ref: '#/components/schemas/EmpresasPlano' },
            },
          },
        },
        EmpresasPlanoAssignRequest: {
          type: 'object',
          required: ['usuarioId', 'metodoPagamento'],
          properties: {
            usuarioId: { type: 'string', example: 'usuario-uuid' },
            metodoPagamento: {
              type: 'string',
              enum: ['PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'GRATUITO'],
              example: 'PIX',
            },
            tipo: {
              type: 'string',
              enum: ['STANDARD', 'PARTNER'],
              example: 'STANDARD',
            },
            validade: {
              type: 'string',
              enum: [
                'DIAS_15',
                'DIAS_30',
                'DIAS_60',
                'DIAS_90',
                'DIAS_120',
                'ANO_1',
                'SEM_VALIDADE',
              ],
              nullable: true,
              example: 'DIAS_30',
            },
          },
        },
        EmpresasPlanoAssignment: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'assignment-uuid' },
            usuarioId: { type: 'string', example: 'usuario-uuid' },
            planoId: { type: 'string', example: 'plan-uuid' },
            metodoPagamento: {
              type: 'string',
              enum: ['PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'GRATUITO'],
              example: 'PIX',
            },
            tipo: {
              type: 'string',
              enum: ['STANDARD', 'PARTNER'],
              example: 'STANDARD',
            },
            validade: {
              type: 'string',
              enum: [
                'DIAS_15',
                'DIAS_30',
                'DIAS_60',
                'DIAS_90',
                'DIAS_120',
                'ANO_1',
                'SEM_VALIDADE',
              ],
              nullable: true,
              example: 'DIAS_30',
            },
            inicio: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            fim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-02-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        EmpresasPlanoAssignResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Plano vinculado à empresa',
            },
            empresasPlano: {
              $ref: '#/components/schemas/EmpresasPlanoAssignment',
            },
          },
        },
        EmpresasPlanoUnassignResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Plano desvinculado da empresa',
            },
          },
        },
        CandidatosModuleInfo: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Candidatos Module API' },
            version: { type: 'string', example: 'v1' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            endpoints: {
              type: 'object',
              properties: {
                areasInteresse: { type: 'string', example: '/areas-interesse' },
                curriculos: { type: 'string', example: '/curriculos' },
                aplicar: { type: 'string', example: '/aplicar' },
              },
            },
            status: { type: 'string', example: 'operational' },
          },
        },
        VagaPublica: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            slug: { type: 'string' },
            titulo: { type: 'string' },
            inseridaEm: { type: 'string', format: 'date-time' },
            modalidade: { $ref: '#/components/schemas/ModalidadesDeVagas' },
            regimeDeTrabalho: { $ref: '#/components/schemas/RegimesDeTrabalhos' },
            senioridade: { $ref: '#/components/schemas/Senioridade' },
            cidade: { type: 'string', nullable: true },
            estado: { type: 'string', nullable: true },
            empresa: {
              type: 'object',
              properties: {
                id: { type: 'string', nullable: true },
                nome: { type: 'string', nullable: true },
              },
            },
          },
        },
        UsuarioCurriculo: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            usuarioId: { type: 'string', format: 'uuid' },
            titulo: { type: 'string', nullable: true },
            resumo: { type: 'string', nullable: true },
            objetivo: { type: 'string', nullable: true },
            principal: {
              type: 'boolean',
              description: 'Indica se o currículo é o principal do candidato',
            },
            areasInteresse: { type: 'object', nullable: true },
            preferencias: { type: 'object', nullable: true },
            habilidades: { type: 'object', nullable: true },
            idiomas: { type: 'array', nullable: true, items: { type: 'object' } },
            experiencias: { type: 'array', nullable: true, items: { type: 'object' } },
            formacao: { type: 'array', nullable: true, items: { type: 'object' } },
            cursosCertificacoes: { type: 'array', nullable: true, items: { type: 'object' } },
            premiosPublicacoes: { type: 'array', nullable: true, items: { type: 'object' } },
            acessibilidade: { type: 'object', nullable: true },
            consentimentos: { type: 'object', nullable: true },
            ultimaAtualizacao: { type: 'string', format: 'date-time' },
            criadoEm: { type: 'string', format: 'date-time' },
            atualizadoEm: { type: 'string', format: 'date-time' },
          },
        },
        UsuarioCurriculoCreate: { allOf: [{ $ref: '#/components/schemas/UsuarioCurriculo' }] },
        UsuarioCurriculoUpdate: { allOf: [{ $ref: '#/components/schemas/UsuarioCurriculo' }] },
        EmpresasCandidatos: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            vagaId: { type: 'string', format: 'uuid' },
            candidatoId: { type: 'string', format: 'uuid' },
            curriculoId: { type: 'string', format: 'uuid', nullable: true },
            empresaUsuarioId: { type: 'string', format: 'uuid' },
            status: { $ref: '#/components/schemas/StatusProcesso' },
            origem: { $ref: '#/components/schemas/OrigemVagas' },
            aplicadaEm: { type: 'string', format: 'date-time' },
            atualizadaEm: { type: 'string', format: 'date-time' },
            consentimentos: { type: 'object', nullable: true },
          },
        },
        EmpresasCandidatosResumo: { allOf: [{ $ref: '#/components/schemas/EmpresasCandidatos' }] },
        EmpresasCandidatosRecebida: {
          allOf: [{ $ref: '#/components/schemas/EmpresasCandidatos' }],
        },
        CandidatoAreaInteresse: {
          type: 'object',
          description: 'Representa um registro da tabela CandidatosAreasInteresse utilizando a nomenclatura padrão do schema Prisma.',
          properties: {
            id: { type: 'integer', example: 1 },
            categoria: {
              type: 'string',
              example: 'Tecnologia da Informação',
            },
            subareas: {
              type: 'array',
              items: {
                type: 'string',
                example: 'Desenvolvimento de Software',
              },
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        CandidatoAreaInteresseCreateInput: {
          type: 'object',
          description: 'Payload para criação de registros em CandidatosAreasInteresse e suas subáreas relacionadas.',
          required: ['categoria', 'subareas'],
          properties: {
            categoria: {
              type: 'string',
              example: 'Tecnologia da Informação',
              maxLength: 120,
            },
            subareas: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'string',
                example: 'Desenvolvimento de Software',
                maxLength: 120,
              },
            },
          },
        },
        CandidatoAreaInteresseUpdateInput: {
          type: 'object',
          description: 'Payload para atualização de registros em CandidatosAreasInteresse mantendo a convenção padrão de nomes.',
          properties: {
            categoria: {
              type: 'string',
              example: 'Tecnologia',
              maxLength: 120,
            },
            subareas: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'string',
                example: 'Segurança da Informação',
                maxLength: 120,
              },
            },
          },
        },
        WebsiteModuleInfo: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Website Module API' },
            version: { type: 'string', example: 'v1' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            endpoints: {
              type: 'object',
              properties: {
                sobre: { type: 'string', example: '/sobre' },
                slider: { type: 'string', example: '/slider' },
                banner: { type: 'string', example: '/banner' },
                logoEnterprises: {
                  type: 'string',
                  example: '/logo-enterprises',
                },
                consultoria: { type: 'string', example: '/consultoria' },
                recrutamento: { type: 'string', example: '/recrutamento' },
                sobreEmpresa: { type: 'string', example: '/sobre-empresa' },
                team: { type: 'string', example: '/team' },
                diferenciais: { type: 'string', example: '/diferenciais' },
                depoimentos: { type: 'string', example: '/depoimentos' },
                informacoesGerais: {
                  type: 'string',
                  example: '/informacoes-gerais',
                },
                imagemLogin: { type: 'string', example: '/imagem-login' },
                scripts: { type: 'string', example: '/scripts' },
              },
            },
            status: { type: 'string', example: 'operational' },
          },
        },
        WebsiteStatus: {
          type: 'string',
          enum: ['PUBLICADO', 'RASCUNHO'],
          example: 'PUBLICADO',
        },
        WebsiteScriptOrientation: {
          type: 'string',
          enum: ['HEADER', 'BODY', 'FOOTER'],
          example: 'HEADER',
          description: 'Define em qual parte do documento o script será injetado.',
        },
        WebsiteScriptAplicacao: {
          type: 'string',
          enum: ['WEBSITE', 'DASHBOARD'],
          example: 'WEBSITE',
          description: 'Determina onde o script será utilizado (site público ou dashboard).',
        },
        WebsiteScript: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'script-uuid' },
            nome: {
              type: 'string',
              nullable: true,
              example: 'Facebook Pixel',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Script utilizado para monitoramento de conversões.',
            },
            codigo: {
              type: 'string',
              description: 'Código completo do script/pixel a ser injetado.',
              example: '<script>/* código do pixel */</script>',
            },
            aplicacao: {
              $ref: '#/components/schemas/WebsiteScriptAplicacao',
            },
            orientacao: {
              $ref: '#/components/schemas/WebsiteScriptOrientation',
            },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-02T15:30:00Z',
            },
          },
        },
        WebsiteScriptCreateInput: {
          type: 'object',
          required: ['codigo', 'aplicacao', 'orientacao'],
          properties: {
            nome: {
              type: 'string',
              nullable: true,
              example: 'Facebook Pixel',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Script utilizado para monitoramento de conversões.',
            },
            codigo: {
              type: 'string',
              description: 'Conteúdo do script/pixel. Aceita HTML e JavaScript.',
              example: '<script>/* código do pixel */</script>',
            },
            aplicacao: {
              $ref: '#/components/schemas/WebsiteScriptAplicacao',
            },
            orientacao: {
              $ref: '#/components/schemas/WebsiteScriptOrientation',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: 'PUBLICADO',
            },
          },
        },
        WebsiteScriptUpdateInput: {
          type: 'object',
          properties: {
            nome: {
              type: 'string',
              nullable: true,
              example: 'Facebook Pixel',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Script utilizado para monitoramento de conversões.',
            },
            codigo: {
              type: 'string',
              description: 'Conteúdo atualizado do script/pixel.',
              example: '<script>/* novo código */</script>',
            },
            aplicacao: {
              $ref: '#/components/schemas/WebsiteScriptAplicacao',
            },
            orientacao: {
              $ref: '#/components/schemas/WebsiteScriptOrientation',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
          },
        },
        WebsiteBanner: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do banner',
              example: 'ordem-uuid',
            },
            bannerId: {
              type: 'string',
              description: 'ID do banner associado',
              example: 'banner-uuid',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL pública da imagem',
              example: 'https://cdn.example.com/banner.jpg',
            },
            imagemTitulo: {
              type: 'string',
              description: 'Título da imagem gerado a partir do arquivo',
              example: 'banner',
            },
            link: {
              type: 'string',
              description: 'URL opcional de redirecionamento',
              nullable: true,
              example: 'https://example.com',
            },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação',
            },
            ordem: {
              type: 'integer',
              description: 'Posição do banner',
              example: 1,
            },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do banner',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteBannerCreateInput: {
          type: 'object',
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do banner',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/banner.jpg',
            },
            link: {
              type: 'string',
              description: 'Link de redirecionamento',
              example: 'https://example.com',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
          },
        },
        WebsiteBannerUpdateInput: {
          type: 'object',
          properties: {
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/banner.jpg',
            },
            link: { type: 'string', example: 'https://example.com' },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição do banner; ao mudar este valor os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteBannerReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do banner. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteLogoEnterprise: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do logo',
              example: 'ordem-uuid',
            },
            logoId: {
              type: 'string',
              description: 'ID do logo associado',
              example: 'logo-uuid',
            },
            nome: { type: 'string', example: 'Empresa X' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/logo.png',
            },
            imagemAlt: { type: 'string', example: 'Logo da Empresa X' },
            website: { type: 'string', example: 'https://empresa.com' },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação',
            },
            ordem: { type: 'integer', example: 1, description: 'Posição do logo' },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do logo',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteLogoEnterpriseCreateInput: {
          type: 'object',
          required: ['nome'],
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do logo',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/logo.png',
            },
            nome: { type: 'string', example: 'Empresa X' },
            website: {
              type: 'string',
              example: 'https://empresa.com',
              description: 'URL do site da empresa (opcional)',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
            imagemAlt: { type: 'string', example: 'Logo da Empresa X' },
          },
        },
        WebsiteLogoEnterpriseUpdateInput: {
          type: 'object',
          properties: {
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/logo.png',
            },
            nome: { type: 'string', example: 'Empresa X' },
            website: { type: 'string', example: 'https://empresa.com' },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            imagemAlt: { type: 'string', example: 'Logo da Empresa X' },
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição do logo; ao mudar este valor os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteLogoEnterpriseReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do logo. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteImagemLogin: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'login-uuid' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/login.png',
            },
            imagemTitulo: { type: 'string', example: 'login' },
            link: { type: 'string', nullable: true, example: 'https://example.com' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteImagemLoginCreateInput: {
          type: 'object',
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/login.png',
            },
            link: {
              type: 'string',
              nullable: true,
              example: 'https://example.com',
            },
          },
        },
        WebsiteImagemLoginUpdateInput: {
          type: 'object',
          properties: {
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/login.png',
            },
            link: { type: 'string', nullable: true, example: 'https://example.com' },
          },
        },
        WebsiteSlider: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do slider',
              example: 'ordem-uuid',
            },
            sliderId: {
              type: 'string',
              description: 'ID do slider associado',
              example: 'slider-uuid',
            },
            sliderName: {
              type: 'string',
              description: 'Nome identificador do slider',
              example: 'Banner Principal',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL pública da imagem',
              example: 'https://cdn.example.com/slide.jpg',
            },
            link: {
              type: 'string',
              description: 'URL opcional de redirecionamento',
              nullable: true,
              example: 'https://example.com',
            },
            orientacao: {
              allOf: [{ $ref: '#/components/schemas/WebsiteSlidersOrientations' }],
              description: 'Orientação em que o slider será exibido.',
              example: 'DESKTOP',
            },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação',
            },
            ordem: {
              type: 'integer',
              description: 'Posição do slider',
              example: 1,
            },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do slider',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteSliderCreateInput: {
          type: 'object',
          required: ['sliderName', 'orientacao'],
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do slider',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/slide.jpg',
            },
            sliderName: {
              type: 'string',
              description: 'Nome identificador do slider',
              example: 'Banner Principal',
            },
            link: {
              type: 'string',
              description: 'URL opcional de redirecionamento',
              example: 'https://example.com',
            },
            orientacao: {
              allOf: [{ $ref: '#/components/schemas/WebsiteSlidersOrientations' }],
              description: 'Orientação em que o slider será exibido.',
              example: 'DESKTOP',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
          },
        },
        WebsiteSliderUpdateInput: {
          type: 'object',
          description: 'Envie apenas os campos que deseja atualizar.',
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do slider',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/slide.jpg',
            },
            sliderName: {
              type: 'string',
              description: 'Nome identificador do slider',
              example: 'Banner Atualizado',
            },
            link: {
              type: 'string',
              description: 'URL opcional de redirecionamento',
              example: 'https://example.com',
            },
            orientacao: {
              allOf: [{ $ref: '#/components/schemas/WebsiteSlidersOrientations' }],
              description: 'Orientação em que o slider será exibido.',
              example: 'TABLET_MOBILE',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            ordem: {
              type: 'integer',
              description:
                'Nova posição do slider; ao mudar este valor os demais serão reordenados automaticamente',
              example: 2,
            },
          },
        },
        WebsiteSliderReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do slider. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteSobre: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sobre-uuid' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/sobre.jpg',
            },
            imagemTitulo: { type: 'string', example: 'sobre' },
            titulo: { type: 'string', example: 'Quem somos' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteSobreCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao'],
          properties: {
            titulo: { type: 'string', example: 'Quem somos' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL da imagem',
              example: 'https://cdn.example.com/sobre.jpg',
            },
          },
        },
        WebsiteSobreUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Quem somos' },
            descricao: {
              type: 'string',
              example: 'Descrição atualizada',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/sobre.jpg',
            },
          },
        },
        WebsiteConsultoria: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'consultoria-uuid' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/consultoria.jpg',
            },
            imagemTitulo: { type: 'string', example: 'consultoria' },
            titulo: { type: 'string', example: 'Serviços de Consultoria' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre consultoria',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/consultoria',
            },
            buttonLabel: {
              type: 'string',
              example: 'Saiba mais',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteConsultoriaCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao', 'buttonUrl', 'buttonLabel'],
          properties: {
            titulo: {
              type: 'string',
              example: 'Serviços de Consultoria',
            },
            descricao: {
              type: 'string',
              example: 'Descrição sobre consultoria',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/consultoria',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do conteúdo',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/consultoria.jpg',
            },
          },
        },
        WebsiteConsultoriaUpdateInput: {
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              example: 'Serviços de Consultoria',
            },
            descricao: {
              type: 'string',
              example: 'Descrição atualizada',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/consultoria',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/consultoria.jpg',
            },
          },
        },
        WebsiteRecrutamento: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'recrutamento-uuid' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/recrutamento.jpg',
            },
            imagemTitulo: { type: 'string', example: 'recrutamento' },
            titulo: { type: 'string', example: 'Serviços de Recrutamento' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre recrutamento',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/recrutamento',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteRecrutamentoCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao', 'buttonUrl', 'buttonLabel'],
          properties: {
            titulo: {
              type: 'string',
              example: 'Serviços de Recrutamento',
            },
            descricao: {
              type: 'string',
              example: 'Descrição sobre recrutamento',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/recrutamento',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do conteúdo',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/recrutamento.jpg',
            },
          },
        },
        WebsiteRecrutamentoUpdateInput: {
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              example: 'Serviços de Recrutamento',
            },
            descricao: {
              type: 'string',
              example: 'Descrição atualizada',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/recrutamento',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/recrutamento.jpg',
            },
          },
        },
        WebsiteSobreEmpresa: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sobreempresa-uuid' },
            titulo: { type: 'string', example: 'Sobre a Empresa' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            descricaoVisao: {
              type: 'string',
              example: 'Nossa visão',
            },
            descricaoMissao: {
              type: 'string',
              example: 'Nossa missão',
            },
            descricaoValores: {
              type: 'string',
              example: 'Nossos valores',
            },
            videoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/video',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteSobreEmpresaCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'descricao',
            'descricaoVisao',
            'descricaoMissao',
            'descricaoValores',
            'videoUrl',
          ],
          properties: {
            titulo: { type: 'string', example: 'Sobre a Empresa' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            descricaoVisao: {
              type: 'string',
              example: 'Nossa visão',
            },
            descricaoMissao: {
              type: 'string',
              example: 'Nossa missão',
            },
            descricaoValores: {
              type: 'string',
              example: 'Nossos valores',
            },
            videoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/video',
            },
          },
        },
        WebsiteSobreEmpresaUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Sobre a Empresa' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            descricaoVisao: {
              type: 'string',
              example: 'Nossa visão',
            },
            descricaoMissao: {
              type: 'string',
              example: 'Nossa missão',
            },
            descricaoValores: {
              type: 'string',
              example: 'Nossos valores',
            },
            videoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/video',
            },
          },
        },
        WebsiteTeam: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do membro',
              example: 'ordem-uuid',
            },
            teamId: {
              type: 'string',
              description: 'ID do membro',
              example: 'team-uuid',
            },
            photoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/team.jpg',
            },
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Desenvolvedor' },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação do membro',
            },
            ordem: {
              type: 'integer',
              description: 'Posição do membro',
              example: 1,
            },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do membro',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteTeamCreateInput: {
          type: 'object',
          required: ['nome', 'cargo', 'photoUrl'],
          properties: {
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Desenvolvedor' },
            photoUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL da imagem do membro',
              example: 'https://cdn.example.com/team.jpg',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
          },
        },
        WebsiteTeamUpdateInput: {
          type: 'object',
          description: 'Envie apenas os campos que deseja atualizar.',
          properties: {
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Desenvolvedor' },
            photoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/team.jpg',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição do membro; ao mudar este valor os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteTeamReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do membro. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteDepoimento: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do depoimento',
              example: 'ordem-uuid',
            },
            depoimentoId: {
              type: 'string',
              description: 'ID do depoimento',
              example: 'depoimento-uuid',
            },
            depoimento: { type: 'string', example: 'Ótimo serviço' },
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Gerente' },
            fotoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/foto.jpg',
            },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação do depoimento',
            },
            ordem: {
              type: 'integer',
              description: 'Posição do depoimento',
              example: 1,
            },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do depoimento',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteDepoimentoCreateInput: {
          type: 'object',
          required: ['depoimento', 'nome', 'cargo', 'fotoUrl'],
          properties: {
            depoimento: { type: 'string', example: 'Ótimo serviço' },
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Gerente' },
            fotoUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL da foto do autor',
              example: 'https://cdn.example.com/foto.jpg',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
          },
        },
        WebsiteDepoimentoUpdateInput: {
          type: 'object',
          description: 'Envie apenas os campos que deseja atualizar.',
          properties: {
            depoimento: { type: 'string', example: 'Ótimo serviço' },
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Gerente' },
            fotoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/foto.jpg',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição do depoimento; ao mudar este valor os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteDepoimentoReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do depoimento. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteDiferenciais: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'diferenciais-uuid' },
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            titulo4: { type: 'string', example: 'Título 4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            titulo: { type: 'string', example: 'Nossos Diferenciais' },
            descricao: {
              type: 'string',
              example: 'Texto geral dos diferenciais',
            },
            botaoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            botaoLabel: { type: 'string', example: 'Saiba mais' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteDiferenciaisCreateInput: {
          type: 'object',
          required: [
            'icone1',
            'titulo1',
            'descricao1',
            'icone2',
            'titulo2',
            'descricao2',
            'icone3',
            'titulo3',
            'descricao3',
            'icone4',
            'titulo4',
            'descricao4',
            'titulo',
            'descricao',
            'botaoUrl',
            'botaoLabel',
          ],
          properties: {
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            titulo4: { type: 'string', example: 'Título 4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            titulo: { type: 'string', example: 'Nossos Diferenciais' },
            descricao: { type: 'string', example: 'Texto geral' },
            botaoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            botaoLabel: { type: 'string', example: 'Saiba mais' },
          },
        },
        WebsiteDiferenciaisUpdateInput: {
          type: 'object',
          properties: {
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            titulo4: { type: 'string', example: 'Título 4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            titulo: { type: 'string', example: 'Nossos Diferenciais' },
            descricao: { type: 'string', example: 'Texto geral' },
            botaoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            botaoLabel: { type: 'string', example: 'Saiba mais' },
          },
        },
        WebsitePlaninhas: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'planinhas-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição geral' },
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsitePlaninhasCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'descricao',
            'icone1',
            'titulo1',
            'descricao1',
            'icone2',
            'titulo2',
            'descricao2',
            'icone3',
            'titulo3',
            'descricao3',
          ],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição geral' },
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsitePlaninhasUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição geral' },
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteAdvanceAjuda: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'advanceajuda-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/img.jpg',
            },
            imagemTitulo: { type: 'string', example: 'imagem' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteAdvanceAjudaCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'descricao',
            'titulo1',
            'descricao1',
            'titulo2',
            'descricao2',
            'titulo3',
            'descricao3',
          ],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteAdvanceAjudaUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteRecrutamentoSelecao: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'recrutamento-selecao-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/img.jpg',
            },
            imagemTitulo: { type: 'string', example: 'imagem' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteRecrutamentoSelecaoCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao', 'titulo1', 'titulo2', 'titulo3', 'titulo4'],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
          },
        },
        WebsiteRecrutamentoSelecaoUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
          },
        },
        WebsiteSistema: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sistema-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            subtitulo: { type: 'string', example: 'Subtítulo' },
            etapa1Titulo: { type: 'string', example: 'Etapa 1' },
            etapa1Descricao: { type: 'string', example: 'Descrição 1' },
            etapa2Titulo: { type: 'string', example: 'Etapa 2' },
            etapa2Descricao: { type: 'string', example: 'Descrição 2' },
            etapa3Titulo: { type: 'string', example: 'Etapa 3' },
            etapa3Descricao: { type: 'string', example: 'Descrição 3' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteSistemaCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'descricao',
            'subtitulo',
            'etapa1Titulo',
            'etapa1Descricao',
            'etapa2Titulo',
            'etapa2Descricao',
            'etapa3Titulo',
            'etapa3Descricao',
          ],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            subtitulo: { type: 'string', example: 'Subtítulo' },
            etapa1Titulo: { type: 'string', example: 'Etapa 1' },
            etapa1Descricao: { type: 'string', example: 'Descrição 1' },
            etapa2Titulo: { type: 'string', example: 'Etapa 2' },
            etapa2Descricao: { type: 'string', example: 'Descrição 2' },
            etapa3Titulo: { type: 'string', example: 'Etapa 3' },
            etapa3Descricao: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteSistemaUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            subtitulo: { type: 'string', example: 'Subtítulo' },
            etapa1Titulo: { type: 'string', example: 'Etapa 1' },
            etapa1Descricao: { type: 'string', example: 'Descrição 1' },
            etapa2Titulo: { type: 'string', example: 'Etapa 2' },
            etapa2Descricao: { type: 'string', example: 'Descrição 2' },
            etapa3Titulo: { type: 'string', example: 'Etapa 3' },
            etapa3Descricao: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteTreinamentoCompany: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'treinamento-company-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              example: 'https://cdn.example.com/img.jpg',
            },
            imagemTitulo: { type: 'string', example: 'imagem' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteTreinamentoCompanyCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao', 'titulo1', 'titulo2', 'titulo3', 'titulo4'],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
          },
        },
        WebsiteTreinamentoCompanyUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
          },
        },
        WebsiteConexaoForte: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'conexao-forte-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl1: { type: 'string', format: 'uri', example: 'https://cdn.example.com/1.jpg' },
            imagemTitulo1: { type: 'string', example: 'img1' },
            imagemUrl2: { type: 'string', format: 'uri', example: 'https://cdn.example.com/2.jpg' },
            imagemTitulo2: { type: 'string', example: 'img2' },
            imagemUrl3: { type: 'string', format: 'uri', example: 'https://cdn.example.com/3.jpg' },
            imagemTitulo3: { type: 'string', example: 'img3' },
            imagemUrl4: { type: 'string', format: 'uri', example: 'https://cdn.example.com/4.jpg' },
            imagemTitulo4: { type: 'string', example: 'img4' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteConexaoForteCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao'],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem1: { type: 'string', format: 'binary' },
            imagem2: { type: 'string', format: 'binary' },
            imagem3: { type: 'string', format: 'binary' },
            imagem4: { type: 'string', format: 'binary' },
            imagemUrl1: { type: 'string', format: 'uri' },
            imagemUrl2: { type: 'string', format: 'uri' },
            imagemUrl3: { type: 'string', format: 'uri' },
            imagemUrl4: { type: 'string', format: 'uri' },
          },
        },
        WebsiteConexaoForteUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem1: { type: 'string', format: 'binary' },
            imagem2: { type: 'string', format: 'binary' },
            imagem3: { type: 'string', format: 'binary' },
            imagem4: { type: 'string', format: 'binary' },
            imagemUrl1: { type: 'string', format: 'uri' },
            imagemUrl2: { type: 'string', format: 'uri' },
            imagemUrl3: { type: 'string', format: 'uri' },
            imagemUrl4: { type: 'string', format: 'uri' },
          },
        },
        WebsiteTreinamentosInCompany: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'treinamentos-in-company-uuid' },
            titulo: { type: 'string', example: 'Título' },
            icone1: { type: 'string', example: 'icon1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            icone5: { type: 'string', example: 'icon5' },
            descricao5: { type: 'string', example: 'Descrição 5' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteTreinamentosInCompanyCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'icone1',
            'descricao1',
            'icone2',
            'descricao2',
            'icone3',
            'descricao3',
            'icone4',
            'descricao4',
            'icone5',
            'descricao5',
          ],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            icone1: { type: 'string', example: 'icon1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            icone5: { type: 'string', example: 'icon5' },
            descricao5: { type: 'string', example: 'Descrição 5' },
          },
        },
        WebsiteTreinamentosInCompanyUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            icone1: { type: 'string', example: 'icon1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            icone5: { type: 'string', example: 'icon5' },
            descricao5: { type: 'string', example: 'Descrição 5' },
          },
        },
        WebsiteHorarioFuncionamento: {
          type: 'object',
          properties: {
            diaDaSemana: { type: 'string', example: 'segunda' },
            horarioInicio: { type: 'string', example: '08:00' },
            horarioFim: { type: 'string', example: '18:00' },
          },
        },
        WebsiteInformacoes: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'info-uuid' },
            endereco: {
              type: 'string',
              nullable: true,
              example: 'Rua A, 123',
            },
            cep: {
              type: 'string',
              nullable: true,
              example: '12345-678',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: { type: 'string', nullable: true, example: 'SP' },
            telefone1: {
              type: 'string',
              nullable: true,
              example: '(11) 1234-5678',
            },
            telefone2: {
              type: 'string',
              nullable: true,
              example: '(11) 9876-5432',
            },
            whatsapp: {
              type: 'string',
              nullable: true,
              example: '(11) 91234-5678',
            },
            horarios: {
              type: 'array',
              nullable: true,
              items: {
                $ref: '#/components/schemas/WebsiteHorarioFuncionamento',
              },
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/example',
            },
            facebook: {
              type: 'string',
              nullable: true,
              example: 'https://facebook.com/example',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/example',
            },
            youtube: {
              type: 'string',
              nullable: true,
              example: 'https://youtube.com/example',
            },
            email: {
              type: 'string',
              nullable: true,
              example: 'contato@example.com',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteInformacoesCreateInput: {
          type: 'object',
          properties: {
            endereco: {
              type: 'string',
              nullable: true,
              example: 'Rua A, 123',
            },
            cep: {
              type: 'string',
              nullable: true,
              example: '12345-678',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: { type: 'string', nullable: true, example: 'SP' },
            telefone1: {
              type: 'string',
              nullable: true,
              example: '(11) 1234-5678',
            },
            telefone2: {
              type: 'string',
              nullable: true,
              example: '(11) 9876-5432',
            },
            whatsapp: {
              type: 'string',
              nullable: true,
              example: '(11) 91234-5678',
            },
            horarios: {
              type: 'array',
              nullable: true,
              items: {
                $ref: '#/components/schemas/WebsiteHorarioFuncionamento',
              },
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/example',
            },
            facebook: {
              type: 'string',
              nullable: true,
              example: 'https://facebook.com/example',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/example',
            },
            youtube: {
              type: 'string',
              nullable: true,
              example: 'https://youtube.com/example',
            },
            email: {
              type: 'string',
              nullable: true,
              example: 'contato@example.com',
            },
          },
        },
        WebsiteInformacoesUpdateInput: {
          type: 'object',
          properties: {
            endereco: {
              type: 'string',
              nullable: true,
              example: 'Rua A, 123',
            },
            cep: {
              type: 'string',
              nullable: true,
              example: '12345-678',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: { type: 'string', nullable: true, example: 'SP' },
            telefone1: {
              type: 'string',
              nullable: true,
              example: '(11) 1234-5678',
            },
            telefone2: {
              type: 'string',
              nullable: true,
              example: '(11) 9876-5432',
            },
            whatsapp: {
              type: 'string',
              nullable: true,
              example: '(11) 91234-5678',
            },
            horarios: {
              type: 'array',
              nullable: true,
              items: {
                $ref: '#/components/schemas/WebsiteHorarioFuncionamento',
              },
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/example',
            },
            facebook: {
              type: 'string',
              nullable: true,
              example: 'https://facebook.com/example',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/example',
            },
            youtube: {
              type: 'string',
              nullable: true,
              example: 'https://youtube.com/example',
            },
            email: {
              type: 'string',
              nullable: true,
              example: 'contato@example.com',
            },
          },
        },
        WebsiteHeaderPage: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'header-uuid' },
            subtitulo: { type: 'string', example: 'Subtítulo' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/header.jpg',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            buttonLink: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            page: {
              type: 'string',
              enum: [
                'SOBRE',
                'RECRUTAMENTO',
                'TREINAMENTO',
                'CONTATO',
                'BLOG',
                'CURSOS',
                'POLITICA_PRIVACIDADE',
                'OUVIDORIA',
              ],
              example: 'SOBRE',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteHeaderPageCreateInput: {
          type: 'object',
          required: [
            'subtitulo',
            'titulo',
            'descricao',
            'imagemUrl',
            'buttonLabel',
            'buttonLink',
            'page',
          ],
          properties: {
            subtitulo: { type: 'string', example: 'Subtítulo' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/header.jpg',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            buttonLink: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            page: {
              type: 'string',
              enum: [
                'SOBRE',
                'RECRUTAMENTO',
                'TREINAMENTO',
                'CONTATO',
                'BLOG',
                'CURSOS',
                'POLITICA_PRIVACIDADE',
                'OUVIDORIA',
              ],
              example: 'SOBRE',
            },
          },
        },
        WebsiteHeaderPageUpdateInput: {
          type: 'object',
          properties: {
            subtitulo: { type: 'string', example: 'Subtítulo' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/header.jpg',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            buttonLink: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            page: {
              type: 'string',
              enum: [
                'SOBRE',
                'RECRUTAMENTO',
                'TREINAMENTO',
                'CONTATO',
                'BLOG',
                'CURSOS',
                'POLITICA_PRIVACIDADE',
                'OUVIDORIA',
              ],
              example: 'SOBRE',
            },
          },
        },
        PlanosEmpresariais: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'plano-uuid' },
            icon: { type: 'string', example: 'ph-buildings' },
            nome: { type: 'string', example: 'Plano Corporativo' },
            descricao: {
              type: 'string',
              example: 'Soluções completas de RH e treinamento para empresas.',
            },
            valor: { type: 'string', example: '199.90' },
            desconto: {
              type: 'number',
              nullable: true,
              example: 10,
              description: 'Percentual de desconto aplicado sobre o valor do plano',
            },
            quantidadeVagas: {
              type: 'integer',
              example: 10,
              description:
                'Quantidade de vagas que a empresa pode manter entre PUBLICADO e EM_ANALISE',
            },
            vagaEmDestaque: {
              type: 'boolean',
              example: true,
              description: 'Indica se o plano permite vagas em destaque no site',
            },
            quantidadeVagasDestaque: {
              type: 'integer',
              nullable: true,
              example: 2,
              description: 'Limite de vagas simultâneas com destaque quando habilitado',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-02T12:00:00Z',
            },
          },
        },
        PlanosEmpresariaisCreateInput: {
          type: 'object',
          required: ['icon', 'nome', 'descricao', 'valor', 'quantidadeVagas', 'vagaEmDestaque'],
          properties: {
            icon: {
              type: 'string',
              example: 'ph-buildings',
              description: 'Identificador do ícone exibido no site',
            },
            nome: {
              type: 'string',
              example: 'Plano Corporativo',
              description: 'Nome comercial do plano',
            },
            descricao: {
              type: 'string',
              example: 'Soluções completas de RH e treinamento para empresas.',
            },
            valor: {
              type: 'string',
              example: '199.90',
              description: 'Valor monetário com até duas casas decimais',
            },
            desconto: {
              type: 'number',
              nullable: true,
              example: 10,
              description: 'Percentual de desconto opcional aplicado sobre o valor do plano',
            },
            quantidadeVagas: {
              type: 'integer',
              example: 10,
              description: 'Quantidade total de vagas permitidas no plano (PUBLICADO + EM_ANALISE)',
            },
            vagaEmDestaque: {
              type: 'boolean',
              example: true,
              description: 'Define se o plano permite cadastrar vagas em destaque',
            },
            quantidadeVagasDestaque: {
              type: 'integer',
              nullable: true,
              example: 2,
              description: 'Quantidade de vagas em destaque permitidas quando habilitado',
            },
          },
        },
        PlanosEmpresariaisUpdateInput: {
          type: 'object',
          properties: {
            icon: { type: 'string', example: 'ph-shield-check' },
            nome: { type: 'string', example: 'Plano Enterprise' },
            descricao: {
              type: 'string',
              example: 'Atualização do pacote com suporte dedicado para grandes contas.',
            },
            valor: {
              type: 'string',
              example: '249.90',
              description: 'Novo valor monetário do plano',
            },
            desconto: {
              type: 'number',
              nullable: true,
              example: 15,
              description: 'Percentual de desconto aplicado sobre o valor do plano',
            },
            quantidadeVagas: {
              type: 'integer',
              example: 15,
              description: 'Atualização da quantidade total de vagas permitidas',
            },
            vagaEmDestaque: {
              type: 'boolean',
              example: false,
              description: 'Permite habilitar ou desabilitar vagas em destaque',
            },
            quantidadeVagasDestaque: {
              type: 'integer',
              nullable: true,
              example: 0,
              description:
                'Limite de vagas em destaque. Deve ser omitido quando vagaEmDestaque for falso',
            },
          },
        },
        PlanosEmpresariaisLimitResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: {
              type: 'string',
              example: 'PLANOS_EMPRESARIAIS_LIMIT_REACHED',
            },
            message: {
              type: 'string',
              example: 'Limite máximo de 4 planos empresariais atingido',
            },
            limite: { type: 'integer', example: 4 },
          },
        },
        ClientePlanoModo: {
          type: 'string',
          enum: ['CLIENTE', 'TESTE', 'PARCEIRO'],
          example: 'CLIENTE',
          description:
            'Identifica se a assinatura é de um cliente pagante (CLIENTE) ou uma concessão de teste/parceria.',
        },
        ClientePlanoEmpresa: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'empresa-uuid' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/avatar.png',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
              description: 'Cidade derivada do endereço principal cadastrado para a empresa.',
            },
            estado: {
              type: 'string',
              nullable: true,
              example: 'SP',
              description: 'Estado derivado do endereço principal cadastrado para a empresa.',
            },
            enderecos: {
              type: 'array',
              description:
                'Relação completa de endereços da empresa. O primeiro item corresponde ao endereço principal.',
              items: { $ref: '#/components/schemas/UsuarioEndereco' },
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria em RH especializada em recrutamento.',
            },
            socialLinks: {
              allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
              nullable: true,
              description: 'Retorna null quando a vaga é publicada em modo anônimo.',
            },
            codUsuario: { type: 'string', example: 'ABC1234' },
            informacoes: {
              allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }],
              description: 'Dados complementares da empresa obtidos via UsuariosInformation.',
            },
          },
        },
        EmpresaClientePlano: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'parceria-uuid' },
            usuarioId: { type: 'string', example: 'usuario-uuid' },
            planosEmpresariaisId: { type: 'string', example: 'plano-uuid' },
            modo: {
              allOf: [{ $ref: '#/components/schemas/ClientePlanoModo' }],
              description: 'Modo da assinatura vinculada à empresa.',
            },
            origin: { type: 'string', enum: ['CHECKOUT', 'ADMIN', 'IMPORT'], example: 'CHECKOUT' },
            //
            //
            inicio: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00Z' },
            fim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-08T12:00:00Z',
            },
            status: {
              type: 'string',
              enum: ['ATIVO', 'SUSPENSO', 'EXPIRADO', 'CANCELADO'],
              example: 'ATIVO',
            },
            estaVigente: {
              type: 'boolean',
              example: true,
              description: 'Indica se o plano está válido considerando a data atual',
            },
            diasRestantes: {
              type: 'integer',
              nullable: true,
              example: 6,
              description: 'Quantidade de dias restantes até o encerramento do plano',
            },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-01-02T12:00:00Z' },
            empresa: {
              allOf: [{ $ref: '#/components/schemas/ClientePlanoEmpresa' }],
              nullable: true,
            },
            plano: { $ref: '#/components/schemas/PlanosEmpresariais' },
          },
        },
        EmpresaClientePlanoCreateInput: {
          type: 'object',
          required: ['usuarioId', 'planosEmpresariaisId', 'modo'],
          properties: {
            usuarioId: { type: 'string', format: 'uuid', example: 'usuario-uuid' },
            planosEmpresariaisId: { type: 'string', format: 'uuid', example: 'plano-uuid' },
            modo: { $ref: '#/components/schemas/ClientePlanoModo' },
            diasTeste: { type: 'integer', nullable: true, example: 7 },
            iniciarEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-01T08:00:00Z',
            },
          },
        },
        EmpresaClientePlanoUpdateInput: {
          type: 'object',
          properties: {
            planosEmpresariaisId: {
              type: 'string',
              format: 'uuid',
              example: 'novo-plano-uuid',
            },
            modo: { $ref: '#/components/schemas/ClientePlanoModo' },
            diasTeste: { type: 'integer', nullable: true, example: 14 },
            iniciarEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-05T09:00:00Z',
            },
          },
        },
        EmpresaSemPlanoAtivoResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'EMPRESA_SEM_PLANO_ATIVO' },
            message: {
              type: 'string',
              example: 'A empresa não possui um plano de assinatura ativo no momento.',
            },
          },
        },
        PlanoClienteLimiteVagasResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: {
              type: 'string',
              example: 'PLANO_EMPRESARIAL_LIMIT_VAGAS',
            },
            message: {
              type: 'string',
              example: 'O limite de vagas simultâneas do plano foi atingido.',
            },
            limite: { type: 'integer', example: 10 },
          },
        },
        PlanoClienteLimiteVagasDestaqueResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: {
              type: 'string',
              example: 'PLANO_EMPRESARIAL_LIMIT_DESTAQUE',
            },
            message: {
              type: 'string',
              example: 'O limite de vagas em destaque do plano foi atingido.',
            },
            limite: { type: 'integer', example: 3 },
          },
        },
        PlanoSemRecursoDestaqueResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: {
              type: 'string',
              example: 'PLANO_EMPRESARIAL_SEM_DESTAQUE',
            },
            message: {
              type: 'string',
              example: 'O plano atual não permite publicar vagas em destaque.',
            },
          },
        },
        StatusDeVagas: {
          type: 'string',
          description:
            'Etapas do fluxo de publicação da vaga (RASCUNHO, EM_ANALISE, PUBLICADO, DESPUBLICADA, PAUSADA, EXPIRADO ou ENCERRADA).',
          enum: [
            'RASCUNHO',
            'EM_ANALISE',
            'PUBLICADO',
            'DESPUBLICADA',
            'PAUSADA',
            'EXPIRADO',
            'ENCERRADA',
          ],
          example: 'PUBLICADO',
        },
        StatusProcesso: {
          type: 'string',
          description: 'Etapas do acompanhamento do candidato durante o processo seletivo da vaga.',
          enum: [
            'RECEBIDA',
            'EM_ANALISE',
            'EM_TRIAGEM',
            'ENTREVISTA',
            'DESAFIO',
            'DOCUMENTACAO',
            'CONTRATADO',
            'RECUSADO',
            'DESISTIU',
            'NAO_COMPARECEU',
            'ARQUIVADO',
            'CANCELADO',
          ],
          example: 'EM_ANALISE',
        },
        OrigemVagas: {
          type: 'string',
          description: 'Origem do cadastro do processo seletivo associado à vaga.',
          enum: ['SITE', 'DASHBOARD', 'OUTROS'],
          example: 'DASHBOARD',
        },
        RegimesDeTrabalhos: {
          type: 'string',
          description: 'Formatos de contratação oferecidos pelas empresas nas vagas.',
          enum: ['CLT', 'TEMPORARIO', 'ESTAGIO', 'PJ', 'HOME_OFFICE', 'JOVEM_APRENDIZ'],
          example: 'CLT',
        },
        Jornadas: {
          type: 'string',
          description:
            'Opções de jornada de trabalho oferecidas na vaga, alinhadas com a carga horária prevista.',
          enum: ['INTEGRAL', 'MEIO_PERIODO', 'FLEXIVEL', 'TURNOS', 'NOTURNO'],
          example: 'INTEGRAL',
        },
        ModalidadesDeVagas: {
          type: 'string',
          description: 'Modalidades de atuação disponíveis para a vaga.',
          enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'],
          example: 'REMOTO',
        },
        Senioridade: {
          type: 'string',
          description:
            'Faixas de senioridade aceitas pela empresa para a vaga (ABERTO, ESTAGIARIO, JUNIOR, PLENO, SENIOR, ESPECIALISTA ou LIDER).',
          enum: ['ABERTO', 'ESTAGIARIO', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA', 'LIDER'],
          example: 'PLENO',
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            pageSize: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 120 },
            totalPages: { type: 'integer', example: 6 },
          },
        },
        AdminEmpresasPlanoResumo: {
          type: 'object',
          description: 'Resumo do plano ativo vinculado à empresa',
          required: ['id', 'status'],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'plano-uuid' },
            nome: { type: 'string', nullable: true, example: 'Plano Avançado' },
            modo: {
              type: 'string',
              enum: ['TESTE', 'PARCEIRO'],
              nullable: true,
              example: 'PARCEIRO',
              description: 'Modo configurado para o plano ativo (TESTE ou PARCEIRO).',
            },
            status: {
              type: 'string',
              enum: ['ATIVO', 'SUSPENSO', 'EXPIRADO', 'CANCELADO'],
              example: 'ATIVO',
            },
            inicio: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-10T12:00:00Z',
            },
            fim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-02-10T12:00:00Z',
            },
            modeloPagamento: {
              allOf: [{ $ref: '#/components/schemas/ModeloPagamento' }],
              nullable: true,
            },
            metodoPagamento: {
              allOf: [{ $ref: '#/components/schemas/MetodoPagamento' }],
              nullable: true,
            },
            statusPagamento: {
              allOf: [{ $ref: '#/components/schemas/StatusPagamento' }],
              nullable: true,
            },
            valor: {
              type: 'string',
              nullable: true,
              example: '199.90',
              description: 'Valor bruto do plano associado, quando disponível',
            },
            quantidadeVagas: { type: 'integer', nullable: true, example: 3 },
            duracaoEmDias: {
              type: 'integer',
              nullable: true,
              example: 30,
              description:
                'Quantidade total de dias entre o início e o fim configurado para o plano',
            },
            diasRestantes: {
              type: 'integer',
              nullable: true,
              example: 12,
              description: 'Dias restantes até o término do plano considerando a data atual',
            },
          },
          example: {
            id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
            nome: 'Plano Avançado',
            modo: 'PARCEIRO',
            status: 'ATIVO',
            inicio: '2024-01-10T12:00:00Z',
            fim: null,
            modeloPagamento: 'ASSINATURA',
            metodoPagamento: 'PIX',
            statusPagamento: 'APROVADO',
            valor: '249.90',
            quantidadeVagas: 5,
            duracaoEmDias: null,
            diasRestantes: 18,
          },
        },
        UsuarioEndereco: {
          type: 'object',
          description:
            'Endereço cadastrado para o usuário, persistido na tabela UsuariosEnderecos (anteriormente Enderecos). Campos podem ser preenchidos parcialmente conforme o fluxo do microserviço de endereços.',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'end-uuid' },
            logradouro: { type: 'string', nullable: true, example: 'Av. Paulista' },
            numero: { type: 'string', nullable: true, example: '1578' },
            bairro: { type: 'string', nullable: true, example: 'Bela Vista' },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            cep: { type: 'string', nullable: true, example: '01310-200' },
          },
        },
        UsuarioInformacoes: {
          type: 'object',
          description:
            'Informações complementares do usuário persistidas na tabela UsuariosInformation após a refatoração do domínio.',
          properties: {
            telefone: { type: 'string', example: '+55 11 99999-0000' },
            genero: { type: 'string', nullable: true, example: 'MASCULINO' },
            dataNasc: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '1990-01-01',
            },
            inscricao: { type: 'string', nullable: true, example: 'INS123' },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/avatar.png',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria especializada em tecnologia e recrutamento.',
            },
            aceitarTermos: {
              type: 'boolean',
              example: true,
              description: 'Indica se o usuário aceitou os termos e políticas vigentes.',
            },
          },
        },
        UsuarioSocialLinks: {
          type: 'object',
          description: 'Links de redes sociais associados ao usuário ou empresa.',
          properties: {
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/advancemais',
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/advancemais',
            },
            facebook: {
              type: 'string',
              nullable: true,
              example: 'https://facebook.com/advancemais',
            },
            youtube: {
              type: 'string',
              nullable: true,
              example: 'https://youtube.com/advancemais',
            },
            twitter: {
              type: 'string',
              nullable: true,
              example: 'https://twitter.com/advancemais',
            },
            tiktok: {
              type: 'string',
              nullable: true,
              example: 'https://tiktok.com/@advancemais',
            },
          },
        },
        UsuarioRecuperacaoSenha: {
          type: 'object',
          description:
            'Estado de recuperação de senha associado ao usuário. Persistido na tabela UsuariosRecuperacaoSenha e utilizado para controlar tentativas, tokens e expiração.',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'c1d8c1e0-1234-4b2e-8c44-4f5123456789' },
            usuarioId: { type: 'string', format: 'uuid', example: 'usuario-uuid' },
            tokenRecuperacao: {
              type: 'string',
              nullable: true,
              example: 'd41d8cd98f00b204e9800998ecf8427e',
              description:
                'Token hex gerado para redefinição de senha. Nulo quando não há fluxo ativo.',
            },
            tokenRecuperacaoExp: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-03-13T14:30:00.000Z',
              description:
                'Data limite para utilização do token. Após expirar o token é invalidado automaticamente.',
            },
            tentativasRecuperacao: {
              type: 'integer',
              example: 1,
              description:
                'Quantidade de tentativas de disparo de e-mail de recuperação dentro do período de cooldown.',
            },
            ultimaTentativaRecuperacao: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-03-13T14:00:00.000Z',
              description: 'Momento da última solicitação registrada para cálculo do cooldown.',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2025-03-13T13:45:00.000Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2025-03-13T14:00:00.000Z',
            },
          },
        },
        VagaProcessoCandidato: {
          type: 'object',
          description: 'Resumo do candidato vinculado a um processo seletivo da vaga.',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'candidate-uuid' },
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            email: { type: 'string', example: 'candidato@example.com' },
            codUsuario: { type: 'string', example: 'ALU1234' },
            role: {
              allOf: [{ $ref: '#/components/schemas/Roles' }],
              example: 'ALUNO_CANDIDATO',
            },
            status: {
              allOf: [{ $ref: '#/components/schemas/Status' }],
              example: 'ATIVO',
            },
            tipoUsuario: {
              allOf: [{ $ref: '#/components/schemas/TiposDeUsuarios' }],
              example: 'PESSOA_FISICA',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-02-10T09:30:00Z',
            },
            telefone: { type: 'string', nullable: true, example: '+55 82 99999-0000' },
            genero: { type: 'string', nullable: true, example: 'FEMININO' },
            dataNasc: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '1995-07-15',
            },
            inscricao: { type: 'string', nullable: true, example: 'INS-2024-001' },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/candidates/avatar.png',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Desenvolvedora full-stack com foco em produtos digitais.',
            },
            aceitarTermos: {
              type: 'boolean',
              example: true,
              description: 'Indica se o candidato aceitou os termos durante o cadastro.',
            },
            informacoes: {
              allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }],
              description: 'Dados complementares persistidos na tabela UsuariosInformation.',
            },
            enderecos: {
              type: 'array',
              description:
                'Endereços cadastrados pelo candidato. O primeiro item representa o endereço principal.',
              items: { $ref: '#/components/schemas/UsuarioEndereco' },
            },
            cidade: { type: 'string', nullable: true, example: 'Maceió' },
            estado: { type: 'string', nullable: true, example: 'AL' },
          },
        },
        VagaProcesso: {
          type: 'object',
          description:
            'Representa o acompanhamento de um candidato dentro de uma vaga corporativa.',
          required: ['id', 'vagaId', 'candidatoId', 'status', 'origem', 'criadoEm', 'atualizadoEm'],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'processo-uuid' },
            vagaId: { type: 'string', format: 'uuid', example: 'vaga-uuid' },
            candidatoId: { type: 'string', format: 'uuid', example: 'candidate-uuid' },
            status: { allOf: [{ $ref: '#/components/schemas/StatusProcesso' }] },
            origem: { allOf: [{ $ref: '#/components/schemas/OrigemVagas' }] },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Candidato com excelente aderência técnica, aguardando entrevista final.',
            },
            agendadoEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-03-20T14:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2025-03-15T12:34:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2025-03-18T09:10:00Z',
            },
            candidato: {
              allOf: [{ $ref: '#/components/schemas/VagaProcessoCandidato' }],
              nullable: true,
            },
          },
        },
        VagaProcessoCreateInput: {
          type: 'object',
          required: ['candidatoId'],
          properties: {
            candidatoId: { type: 'string', format: 'uuid', example: 'candidate-uuid' },
            status: {
              allOf: [{ $ref: '#/components/schemas/StatusProcesso' }],
              nullable: true,
              description: 'Quando omitido, o status padrão RECEBIDA é aplicado automaticamente.',
            },
            origem: {
              allOf: [{ $ref: '#/components/schemas/OrigemVagas' }],
              nullable: true,
              description: 'Origem da candidatura. O valor padrão é SITE.',
            },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Candidato indicado por parceiro estratégico.',
            },
            agendadoEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-03-21T10:00:00Z',
            },
          },
        },
        VagaProcessoUpdateInput: {
          type: 'object',
          description:
            'Campos disponíveis para atualização parcial do processo seletivo vinculado à vaga.',
          properties: {
            status: { allOf: [{ $ref: '#/components/schemas/StatusProcesso' }] },
            origem: { allOf: [{ $ref: '#/components/schemas/OrigemVagas' }] },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Feedback registrado após a entrevista técnica.',
            },
            agendadoEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-03-22T15:00:00Z',
            },
          },
          minProperties: 1,
        },
        AdminEmpresaListItem: {
          type: 'object',
          description: 'Dados resumidos da empresa para listagem administrativa',
          required: [
            'id',
            'codUsuario',
            'nome',
            'email',
            'telefone',
            'enderecos',
            'criadoEm',
            'ativa',
            'parceira',
            'vagasPublicadas',
            'limiteVagasPlano',
            'bloqueada',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'empresa-uuid' },
            codUsuario: { type: 'string', example: 'EMP-123456' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advance.com.br',
              description: 'E-mail principal cadastrado pela empresa',
            },
            telefone: {
              type: 'string',
              example: '+55 11 99999-0000',
              description: 'Telefone de contato informado no cadastro',
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/logo.png',
            },
            cnpj: { type: 'string', nullable: true, example: '12345678000190' },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
              description: 'Cidade derivada do primeiro endereço cadastrado para a empresa.',
            },
            estado: {
              type: 'string',
              nullable: true,
              example: 'SP',
              description: 'Estado derivado do primeiro endereço cadastrado para a empresa.',
            },
            enderecos: {
              type: 'array',
              description:
                'Lista completa de endereços associados ao usuário. O primeiro item representa o endereço principal.',
              items: { $ref: '#/components/schemas/UsuarioEndereco' },
            },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-01-05T12:00:00Z' },
            informacoes: {
              allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }],
              description: 'Dados complementares consolidados da tabela UsuariosInformation.',
            },
            ativa: { type: 'boolean', example: true },
            parceira: { type: 'boolean', example: true },
            diasTesteDisponibilizados: { type: 'integer', nullable: true, example: 30 },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresasPlanoResumo' }],
              nullable: true,
            },
            vagasPublicadas: {
              type: 'integer',
              example: 8,
              description: 'Quantidade de vagas com status PUBLICADO criadas pela empresa',
            },
            limiteVagasPlano: {
              type: 'integer',
              nullable: true,
              example: 10,
              description: 'Limite de vagas simultâneas definido pelo plano atual',
            },
            bloqueada: {
              type: 'boolean',
              example: false,
              description: 'Indica se a empresa possui um bloqueio ativo no momento da consulta',
            },
            bloqueioAtivo: {
              allOf: [{ $ref: '#/components/schemas/AdminUsuariosEmBloqueiosResumo' }],
              nullable: true,
            },
          },
          example: {
            id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
            codUsuario: 'EMP-123456',
            nome: 'Advance Tech Consultoria',
            email: 'contato@advance.com.br',
            telefone: '+55 11 99999-0000',
            avatarUrl: 'https://cdn.advance.com.br/logo.png',
            cnpj: '12345678000190',
            cidade: 'São Paulo',
            estado: 'SP',
            enderecos: [
              {
                id: 'end-uuid',
                logradouro: 'Av. Paulista',
                numero: '1578',
                bairro: 'Bela Vista',
                cidade: 'São Paulo',
                estado: 'SP',
                cep: '01310-200',
              },
            ],
            criadoEm: '2024-01-05T12:00:00Z',
            ativa: true,
            parceira: true,
            diasTesteDisponibilizados: 30,
            plano: {
              id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
              nome: 'Plano Avançado',
              modo: 'PARCEIRO',
              inicio: '2024-01-10T12:00:00Z',
              fim: null,
              modeloPagamento: 'ASSINATURA',
              metodoPagamento: 'PIX',
              statusPagamento: 'APROVADO',
              valor: '249.90',
              quantidadeVagas: 10,
              duracaoEmDias: null,
              diasRestantes: 18,
            },
            vagasPublicadas: 8,
            limiteVagasPlano: 10,
            bloqueada: false,
            bloqueioAtivo: null,
          },
        },
        AdminEmpresasPlanoInput: {
          type: 'object',
          required: ['planosEmpresariaisId', 'modo'],
          properties: {
            planosEmpresariaisId: {
              type: 'string',
              format: 'uuid',
              example: 'plano-uuid',
              description: 'Identificador do plano empresarial que será vinculado à empresa',
            },
            modo: {
              allOf: [{ $ref: '#/components/schemas/ClientePlanoModo' }],
              description: 'Origem do vínculo do plano (CLIENTE, TESTE ou PARCEIRO)',
            },
            diasTeste: {
              type: 'integer',
              nullable: true,
              example: 30,
              description: 'Obrigatório quando modo=teste',
            },
            iniciarEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-01T12:00:00Z',
              description: 'Data de início do plano. Quando omitido, utiliza a data atual',
            },
          },
          example: {
            planosEmpresariaisId: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e',
            modo: 'TESTE',
            diasTeste: 30,
            iniciarEm: '2024-03-01T12:00:00Z',
          },
        },
        AdminEmpresasPlanoUpdateInput: {
          allOf: [
            { $ref: '#/components/schemas/AdminEmpresasPlanoInput' },
            {
              type: 'object',
              properties: {
                resetPeriodo: {
                  type: 'boolean',
                  description:
                    'Quando verdadeiro, reinicia os campos de início e fim do novo plano. Caso não seja enviado, mantém as datas anteriores.',
                  example: true,
                },
              },
            },
          ],
          example: {
            planosEmpresariaisId: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e',
            modo: 'PARCEIRO',
            resetPeriodo: true,
          },
        },
        AdminEmpresaCreateInput: {
          type: 'object',
          required: ['nome', 'email', 'telefone', 'senha', 'supabaseId', 'cnpj'],
          properties: {
            nome: {
              type: 'string',
              example: 'Advance Tech Consultoria',
              description: 'Nome fantasia da empresa',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advancetech.com.br',
              description: 'E-mail principal utilizado pela empresa',
            },
            telefone: {
              type: 'string',
              example: '11987654321',
              description: 'Telefone de contato direto com a empresa',
            },
            senha: {
              type: 'string',
              example: 'SenhaForte123!',
              description: 'Senha inicial que será criptografada antes de salvar',
            },
            supabaseId: {
              type: 'string',
              example: 'supabase-user-id',
              description: 'Identificador do usuário correspondente no Supabase',
            },
            cnpj: {
              type: 'string',
              example: '12345678000190',
              description: 'CNPJ da empresa, apenas números',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: {
              type: 'string',
              nullable: true,
              example: 'SP',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria especializada em recrutamento e seleção.',
            },
            socialLinks: {
              allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
              nullable: true,
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/logo.png',
            },
            aceitarTermos: {
              type: 'boolean',
              example: true,
              description: 'Indica se os termos de uso já foram aceitos em nome da empresa',
            },
            status: {
              type: 'string',
              nullable: true,
              enum: ['ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
              description: 'Status inicial da conta da empresa. Padrão: ATIVO',
            },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresasPlanoInput' }],
              nullable: true,
              description: 'Dados opcionais para já vincular um plano empresarial ativo',
            },
          },
          example: {
            nome: 'Advance Tech Consultoria',
            email: 'contato@advancetech.com.br',
            telefone: '11987654321',
            senha: 'SenhaForte123!',
            supabaseId: 'supabase-user-id',
            cnpj: '12345678000190',
            cidade: 'São Paulo',
            estado: 'SP',
            descricao: 'Consultoria especializada em recrutamento e seleção.',
            socialLinks: {
              instagram: 'https://instagram.com/advancemais',
              linkedin: 'https://linkedin.com/company/advancemais',
            },
            avatarUrl: 'https://cdn.advance.com.br/logo.png',
            aceitarTermos: true,
            plano: {
              planosEmpresariaisId: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e',
              modo: 'TESTE',
              diasTeste: 30,
            },
          },
        },
        AdminEmpresaUpdateInput: {
          type: 'object',
          description: 'Informe ao menos um campo para atualização',
          properties: {
            nome: {
              type: 'string',
              example: 'Advance Tech Consultoria LTDA',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advancetech.com.br',
            },
            telefone: {
              type: 'string',
              example: '11912345678',
            },
            cnpj: {
              type: 'string',
              nullable: true,
              example: '12345678000190',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: {
              type: 'string',
              nullable: true,
              example: 'SP',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example:
                'Consultoria especializada em recrutamento e seleção com foco em tecnologia.',
            },
            socialLinks: {
              allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
              nullable: true,
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/logo.png',
            },
            status: {
              type: 'string',
              nullable: true,
              enum: ['ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
            },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresasPlanoUpdateInput' }],
              nullable: true,
              description: 'Envie null para encerrar o plano atual da empresa',
            },
          },
          example: {
            nome: 'Advance Tech Consultoria LTDA',
            telefone: '11912345678',
            descricao: 'Consultoria especializada em tecnologia e inovação.',
            socialLinks: {
              instagram: 'https://instagram.com/advancetech',
            },
            status: 'ATIVO',
            plano: {
              planosEmpresariaisId: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e',
              modo: 'PARCEIRO',
              resetPeriodo: false,
            },
          },
        },
        AdminEmpresasDashboardListItem: {
          type: 'object',
          description: 'Resumo otimizado de empresas para exibição em dashboards administrativos.',
          required: [
            'id',
            'codUsuario',
            'nome',
            'email',
            'status',
            'criadoEm',
            'vagasPublicadas',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'empresa-uuid' },
            codUsuario: { type: 'string', example: 'EMP-123456' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advance.com.br',
              description: 'E-mail principal cadastrado pela empresa.',
            },
            telefone: {
              type: 'string',
              nullable: true,
              example: '+55 11 99999-0000',
              description: 'Telefone exibido no painel do dashboard.',
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/logo.png',
            },
            cnpj: {
              type: 'string',
              nullable: true,
              example: '12345678000190',
              description: 'Documento da empresa (quando informado).',
            },
            status: {
              type: 'string',
              enum: ['ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
              description: 'Status atual do cadastro da empresa.',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-05T12:00:00Z',
              description: 'Data de criação do cadastro.',
            },
            vagasPublicadas: {
              type: 'integer',
              example: 8,
              description: 'Quantidade de vagas publicadas pela empresa.',
            },
            limiteVagasPlano: {
              type: 'integer',
              nullable: true,
              example: 10,
              description: 'Limite de vagas simultâneas permitido pelo plano atual.',
            },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresasPlanoResumo' }],
              nullable: true,
            },
          },
        },
        AdminEmpresasDashboardListResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresasDashboardListItem' },
            },
            pagination: {
              allOf: [{ $ref: '#/components/schemas/PaginationMeta' }],
            },
          },
          example: {
            data: [
              {
                id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
                codUsuario: 'EMP-123456',
                nome: 'Advance Tech Consultoria',
                email: 'contato@advance.com.br',
                telefone: '+55 11 99999-0000',
                avatarUrl: 'https://cdn.advance.com.br/logo.png',
                cnpj: '12345678000190',
                status: 'ATIVO',
                criadoEm: '2024-01-05T12:00:00Z',
                vagasPublicadas: 8,
                limiteVagasPlano: 10,
                plano: {
                  id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
                  nome: 'Plano Avançado',
                  modo: 'PARCEIRO',
                  status: 'ATIVO',
                  inicio: '2024-01-10T12:00:00Z',
                  fim: null,
                  modeloPagamento: 'ASSINATURA',
                  metodoPagamento: 'PIX',
                  statusPagamento: 'APROVADO',
                  valor: '249.90',
                  quantidadeVagas: 10,
                  duracaoEmDias: null,
                  diasRestantes: 18,
                },
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              total: 42,
              totalPages: 5,
            },
          },
        },
        AdminEmpresasListResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaListItem' },
            },
            pagination: {
              allOf: [{ $ref: '#/components/schemas/PaginationMeta' }],
            },
          },
          example: {
            data: [
              {
                id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
                codUsuario: 'EMP-123456',
                nome: 'Advance Tech Consultoria',
                email: 'contato@advance.com.br',
                telefone: '+55 11 99999-0000',
                avatarUrl: 'https://cdn.advance.com.br/logo.png',
                cnpj: '12345678000190',
                cidade: 'São Paulo',
                estado: 'SP',
                enderecos: [
                  {
                    id: 'end-uuid',
                    logradouro: 'Av. Paulista',
                    numero: '1578',
                    bairro: 'Bela Vista',
                    cidade: 'São Paulo',
                    estado: 'SP',
                    cep: '01310-200',
                  },
                ],
                criadoEm: '2024-01-05T12:00:00Z',
                informacoes: {
                  telefone: '+55 11 99999-0000',
                  descricao: 'Consultoria especializada em tecnologia e recrutamento.',
                  avatarUrl: 'https://cdn.advance.com.br/logo.png',
                  aceitarTermos: true,
                },
                ativa: true,
                parceira: true,
                diasTesteDisponibilizados: 30,
                plano: {
                  id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
                  nome: 'Plano Avançado',
                  modo: 'PARCEIRO',
                  status: 'ATIVO',
                  inicio: '2024-01-10T12:00:00Z',
                  fim: null,
                  modeloPagamento: 'ASSINATURA',
                  metodoPagamento: 'PIX',
                  statusPagamento: 'APROVADO',
                  valor: '249.90',
                  quantidadeVagas: 10,
                  duracaoEmDias: null,
                  diasRestantes: 18,
                },
                vagasPublicadas: 8,
                limiteVagasPlano: 10,
                bloqueada: false,
                bloqueioAtivo: null,
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminEmpresaDetail: {
          type: 'object',
          description: 'Informações detalhadas da empresa para o painel administrativo',
          required: [
            'id',
            'codUsuario',
            'nome',
            'email',
            'telefone',
            'enderecos',
            'criadoEm',
            'status',
            'ativa',
            'parceira',
            'vagas',
            'bloqueada',
            'pagamento',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'empresa-uuid' },
            codUsuario: { type: 'string', example: 'EMP-123456' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advance.com.br',
              description: 'E-mail principal cadastrado pela empresa',
            },
            telefone: {
              type: 'string',
              example: '+55 11 99999-0000',
              description: 'Telefone de contato informado no cadastro',
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/logo.png',
            },
            cnpj: { type: 'string', nullable: true, example: '12345678000190' },
            descricao: {
              type: 'string',
              nullable: true,
              example:
                'Consultoria especializada em recrutamento e seleção para empresas de tecnologia.',
            },
            informacoes: {
              allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }],
              description:
                'Dados complementares da empresa conforme armazenados em UsuariosInformation.',
            },
            socialLinks: {
              allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
              nullable: true,
            },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            criadoEm: { type: 'string', format: 'date-time', example: '2023-11-01T08:30:00Z' },
            status: {
              type: 'string',
              enum: ['ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
            },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-03-15T18:45:00Z',
            },
            ativa: { type: 'boolean', example: true },
            parceira: { type: 'boolean', example: true },
            diasTesteDisponibilizados: { type: 'integer', nullable: true, example: 30 },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresasPlanoResumo' }],
              nullable: true,
            },
            bloqueioAtivo: {
              allOf: [{ $ref: '#/components/schemas/AdminUsuariosEmBloqueiosResumo' }],
              nullable: true,
            },
            vagas: {
              type: 'object',
              properties: {
                publicadas: { type: 'integer', example: 1 },
                limitePlano: { type: 'integer', nullable: true, example: 3 },
              },
            },
            bloqueada: {
              type: 'boolean',
              example: false,
              description: 'Indica se a empresa possui um bloqueio ativo',
            },
            pagamento: {
              type: 'object',
              properties: {
                modelo: {
                  allOf: [{ $ref: '#/components/schemas/ModeloPagamento' }],
                  nullable: true,
                },
                metodo: {
                  allOf: [{ $ref: '#/components/schemas/MetodoPagamento' }],
                  nullable: true,
                },
                status: {
                  allOf: [{ $ref: '#/components/schemas/StatusPagamento' }],
                  nullable: true,
                },
                ultimoPagamentoEm: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-01-15T14:20:00Z',
                },
              },
            },
          },
          example: {
            id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
            codUsuario: 'EMP-123456',
            nome: 'Advance Tech Consultoria',
            email: 'contato@advance.com.br',
            telefone: '+55 11 99999-0000',
            avatarUrl: 'https://cdn.advance.com.br/logo.png',
            cnpj: '12345678000190',
            descricao:
              'Consultoria especializada em recrutamento e seleção para empresas de tecnologia.',
            socialLinks: {
              instagram: 'https://instagram.com/advancemais',
              linkedin: 'https://linkedin.com/company/advancemais',
            },
            cidade: 'São Paulo',
            estado: 'SP',
            criadoEm: '2023-11-01T08:30:00Z',
            status: 'ATIVO',
            ultimoLogin: '2024-03-15T18:45:00Z',
            ativa: true,
            parceira: true,
            diasTesteDisponibilizados: 30,
            plano: {
              id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
              nome: 'Plano Avançado',
              modo: 'PARCEIRO',
              status: 'ATIVO',
              inicio: '2024-01-10T12:00:00Z',
              fim: null,
              modeloPagamento: 'ASSINATURA',
              metodoPagamento: 'PIX',
              statusPagamento: 'APROVADO',
              valor: '249.90',
              quantidadeVagas: 10,
              duracaoEmDias: null,
              diasRestantes: 18,
            },
            bloqueioAtivo: null,
            vagas: {
              publicadas: 8,
              limitePlano: 10,
            },
            bloqueada: false,
            pagamento: {
              modelo: 'ASSINATURA',
              metodo: 'PIX',
              status: 'APROVADO',
              ultimoPagamentoEm: '2024-02-15T14:20:00Z',
            },
            informacoes: {
              telefone: '+55 11 99999-0000',
              descricao: 'Consultoria especializada em tecnologia e recrutamento.',
              avatarUrl: 'https://cdn.advance.com.br/logo.png',
              aceitarTermos: true,
            },
          },
        },
        AdminEmpresaDetailResponse: {
          type: 'object',
          required: ['empresa'],
          properties: {
            empresa: { $ref: '#/components/schemas/AdminEmpresaDetail' },
          },
          example: {
            empresa: {
              id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
              codUsuario: 'EMP-123456',
              nome: 'Advance Tech Consultoria',
              email: 'contato@advance.com.br',
              telefone: '+55 11 99999-0000',
              avatarUrl: 'https://cdn.advance.com.br/logo.png',
              cnpj: '12345678000190',
              descricao:
                'Consultoria especializada em recrutamento e seleção para empresas de tecnologia.',
              socialLinks: {
                instagram: 'https://instagram.com/advancemais',
                linkedin: 'https://linkedin.com/company/advancemais',
              },
              cidade: 'São Paulo',
              estado: 'SP',
              criadoEm: '2023-11-01T08:30:00Z',
              status: 'ATIVO',
              ultimoLogin: '2024-03-15T18:45:00Z',
              ativa: true,
              parceira: true,
              diasTesteDisponibilizados: 30,
              plano: {
                id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
                nome: 'Plano Avançado',
                modo: 'PARCEIRO',
                status: 'ATIVO',
                inicio: '2024-01-10T12:00:00Z',
                fim: null,
                modeloPagamento: 'ASSINATURA',
                metodoPagamento: 'PIX',
                statusPagamento: 'APROVADO',
                valor: '249.90',
                quantidadeVagas: 10,
                duracaoEmDias: null,
                diasRestantes: 18,
              },
              bloqueioAtivo: null,
              vagas: {
                publicadas: 8,
                limitePlano: 10,
              },
              bloqueada: false,
              pagamento: {
                modelo: 'ASSINATURA',
                metodo: 'PIX',
                status: 'APROVADO',
                ultimoPagamentoEm: '2024-02-15T14:20:00Z',
              },
              informacoes: {
                telefone: '+55 11 99999-0000',
                descricao: 'Consultoria especializada em tecnologia e recrutamento.',
                avatarUrl: 'https://cdn.advance.com.br/logo.png',
                aceitarTermos: true,
              },
            },
          },
        },
        AdminEmpresaPlanoHistoricoItem: {
          allOf: [
            { $ref: '#/components/schemas/AdminEmpresasPlanoResumo' },
            {
              type: 'object',
              required: ['origin', 'criadoEm', 'atualizadoEm'],
              properties: {
                origin: {
                  type: 'string',
                  enum: ['CHECKOUT', 'ADMIN', 'IMPORT'],
                  example: 'ADMIN',
                },
                criadoEm: { type: 'string', format: 'date-time', example: '2024-01-05T12:00:00Z' },
                atualizadoEm: { type: 'string', format: 'date-time', example: '2024-03-01T12:00:00Z' },
                proximaCobranca: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-04-10T12:00:00Z',
                },
                graceUntil: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: null,
                },
              },
            },
          ],
        },
        AdminEmpresaPlanosOverview: {
          type: 'object',
          required: ['ativos', 'historico'],
          properties: {
            ativos: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaPlanoHistoricoItem' },
            },
            historico: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaPlanoHistoricoItem' },
            },
          },
        },
        AdminEmpresaStatusVagasResumo: {
          type: 'object',
          additionalProperties: false,
          properties: {
            RASCUNHO: { type: 'integer', minimum: 0, example: 3 },
            EM_ANALISE: { type: 'integer', minimum: 0, example: 2 },
            PUBLICADO: { type: 'integer', minimum: 0, example: 8 },
            EXPIRADO: { type: 'integer', minimum: 0, example: 1 },
            DESPUBLICADA: { type: 'integer', minimum: 0, example: 0 },
            PAUSADA: { type: 'integer', minimum: 0, example: 2 },
            ENCERRADA: { type: 'integer', minimum: 0, example: 2 },
          },
        },
        AdminEmpresaStatusProcessoResumo: {
          type: 'object',
          additionalProperties: false,
          properties: {
            RECEBIDA: { type: 'integer', minimum: 0, example: 80 },
            EM_ANALISE: { type: 'integer', minimum: 0, example: 20 },
            EM_TRIAGEM: { type: 'integer', minimum: 0, example: 5 },
            ENTREVISTA: { type: 'integer', minimum: 0, example: 10 },
            DESAFIO: { type: 'integer', minimum: 0, example: 6 },
            DOCUMENTACAO: { type: 'integer', minimum: 0, example: 5 },
            CONTRATADO: { type: 'integer', minimum: 0, example: 4 },
            RECUSADO: { type: 'integer', minimum: 0, example: 7 },
            DESISTIU: { type: 'integer', minimum: 0, example: 1 },
            NAO_COMPARECEU: { type: 'integer', minimum: 0, example: 1 },
            ARQUIVADO: { type: 'integer', minimum: 0, example: 0 },
            CANCELADO: { type: 'integer', minimum: 0, example: 0 },
          },
        },
        AdminEmpresaVagasOverview: {
          type: 'object',
          required: ['total', 'porStatus', 'recentes'],
          properties: {
            total: { type: 'integer', minimum: 0, example: 18 },
            porStatus: { $ref: '#/components/schemas/AdminEmpresaStatusVagasResumo' },
            recentes: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaVagaResumo' },
            },
          },
        },
        AdminEmpresaCandidaturasOverview: {
          type: 'object',
          required: ['total', 'porStatus'],
          properties: {
            total: { type: 'integer', minimum: 0, example: 134 },
            porStatus: { $ref: '#/components/schemas/AdminEmpresaStatusProcessoResumo' },
          },
        },
        AdminEmpresaBloqueiosOverview: {
          type: 'object',
          required: ['ativos', 'historico'],
          properties: {
            ativos: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminUsuariosEmBloqueiosResumo' },
            },
            historico: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminUsuariosEmBloqueiosResumo' },
            },
          },
        },
        AdminEmpresaOverviewResponse: {
          type: 'object',
          required: ['empresa', 'planos', 'pagamentos', 'vagas', 'candidaturas', 'bloqueios'],
          properties: {
            empresa: { $ref: '#/components/schemas/AdminEmpresaDetail' },
            planos: { $ref: '#/components/schemas/AdminEmpresaPlanosOverview' },
            pagamentos: {
              type: 'object',
              required: ['total', 'recentes'],
              properties: {
                total: { type: 'integer', minimum: 0, example: 12 },
                recentes: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AdminEmpresaPagamentoLog' },
                },
              },
            },
            vagas: { $ref: '#/components/schemas/AdminEmpresaVagasOverview' },
            candidaturas: { $ref: '#/components/schemas/AdminEmpresaCandidaturasOverview' },
            bloqueios: { $ref: '#/components/schemas/AdminEmpresaBloqueiosOverview' },
          },
        },
        AdminUsuariosBloqueioAlvo: {
          type: 'object',
          description: 'Identificação do alvo bloqueado',
          required: ['tipo', 'id', 'nome', 'role'],
          properties: {
            tipo: {
              type: 'string',
              enum: ['EMPRESA', 'USUARIO', 'ESTUDANTE'],
              example: 'EMPRESA',
              description: 'Tipo de perfil afetado pelo bloqueio.',
            },
            id: {
              type: 'string',
              example: 'cmp_112233',
              description: 'Identificador do usuário bloqueado no sistema.',
            },
            nome: {
              type: 'string',
              example: 'Empresa XPTO',
              description: 'Nome exibido para o alvo do bloqueio.',
            },
            role: {
              type: 'string',
              example: 'EMPRESA',
              description: 'Perfil do usuário (role) no sistema.',
            },
          },
        },
        AdminUsuariosBloqueioResponsavel: {
          type: 'object',
          description: 'Responsável pela aplicação do bloqueio',
          required: ['id', 'nome', 'role'],
          properties: {
            id: { type: 'string', example: 'adm_002' },
            nome: { type: 'string', example: 'Carlos Supervisor' },
            role: { type: 'string', example: 'ADMIN' },
          },
        },
        AdminUsuariosBloqueioDados: {
          type: 'object',
          description: 'Detalhes do bloqueio',
          required: ['tipo', 'motivo', 'status', 'inicio'],
          properties: {
            tipo: {
              type: 'string',
              enum: ['TEMPORARIO', 'PERMANENTE', 'RESTRICAO_DE_RECURSO'],
              example: 'TEMPORARIO',
            },
            motivo: {
              type: 'string',
              enum: ['SPAM', 'VIOLACAO_POLITICAS', 'FRAUDE', 'ABUSO_DE_RECURSOS', 'OUTROS'],
              example: 'VIOLACAO_POLITICAS',
            },
            status: {
              type: 'string',
              enum: ['ATIVO', 'EM_REVISAO', 'REVOGADO', 'EXPIRADO'],
              example: 'ATIVO',
            },
            inicio: {
              type: 'string',
              format: 'date-time',
              example: '2025-09-20T14:00:00Z',
            },
            fim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-10-20T14:00:00Z',
            },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Uso indevido de dados pessoais de candidatos.',
            },
          },
        },
        AdminUsuariosBloqueioAuditoria: {
          type: 'object',
          description: 'Metadados de criação e atualização do bloqueio',
          required: ['criadoEm', 'atualizadoEm'],
          properties: {
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2025-09-20T14:05:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2025-09-20T14:05:00Z',
            },
          },
        },
        AdminUsuariosEmBloqueiosResumo: {
          type: 'object',
          description: 'Resumo completo do bloqueio aplicado ao usuário',
          required: ['id', 'alvo', 'bloqueio', 'auditoria'],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'bloq_123456' },
            alvo: { allOf: [{ $ref: '#/components/schemas/AdminUsuariosBloqueioAlvo' }] },
            bloqueio: { allOf: [{ $ref: '#/components/schemas/AdminUsuariosBloqueioDados' }] },
            aplicadoPor: {
              allOf: [{ $ref: '#/components/schemas/AdminUsuariosBloqueioResponsavel' }],
              nullable: true,
            },
            auditoria: {
              allOf: [{ $ref: '#/components/schemas/AdminUsuariosBloqueioAuditoria' }],
            },
          },
          example: {
            id: 'bloq_123456',
            alvo: {
              tipo: 'EMPRESA',
              id: 'cmp_112233',
              nome: 'Empresa XPTO',
              role: 'EMPRESA',
            },
            bloqueio: {
              tipo: 'TEMPORARIO',
              motivo: 'VIOLACAO_POLITICAS',
              status: 'ATIVO',
              inicio: '2025-09-20T14:00:00Z',
              fim: '2025-10-20T14:00:00Z',
              observacoes: 'Uso indevido de dados pessoais de candidatos.',
            },
            aplicadoPor: {
              id: 'adm_002',
              nome: 'Carlos Supervisor',
              role: 'ADMIN',
            },
            auditoria: {
              criadoEm: '2025-09-20T14:05:00Z',
              atualizadoEm: '2025-09-20T14:05:00Z',
            },
          },
        },
        AdminEmpresaPagamentoLog: {
          type: 'object',
          description: 'Evento de pagamento registrado para a empresa',
          required: [
            'id',
            'tipo',
            'status',
            'mensagem',
            'externalRef',
            'mpResourceId',
            'criadoEm',
            'plano',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'log-uuid' },
            tipo: { type: 'string', example: 'ASSINATURA' },
            status: { type: 'string', nullable: true, example: 'APROVADO' },
            mensagem: {
              type: 'string',
              nullable: true,
              example: 'Pagamento confirmado pelo provedor',
            },
            externalRef: {
              type: 'string',
              nullable: true,
              example: 'MP-123456789',
            },
            mpResourceId: {
              type: 'string',
              nullable: true,
              example: 'res_ABC123',
            },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-02-10T12:00:00Z' },
            plano: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid', example: 'plano-uuid' },
                nome: { type: 'string', nullable: true, example: 'Plano Premium' },
              },
            },
          },
          example: {
            id: '729480a9-8e05-4b42-b826-f8db7e5a4d2c',
            tipo: 'ASSINATURA',
            status: 'APROVADO',
            mensagem: 'Pagamento confirmado pelo provedor',
            externalRef: 'MP-123456789',
            mpResourceId: 'res_ABC123',
            criadoEm: '2024-02-10T12:00:00Z',
            plano: {
              id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
              nome: 'Plano Avançado',
            },
          },
        },
        AdminEmpresasPagamentosResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaPagamentoLog' },
            },
            pagination: { allOf: [{ $ref: '#/components/schemas/PaginationMeta' }] },
          },
          example: {
            data: [
              {
                id: '729480a9-8e05-4b42-b826-f8db7e5a4d2c',
                tipo: 'ASSINATURA',
                status: 'APROVADO',
                mensagem: 'Pagamento confirmado pelo provedor',
                externalRef: 'MP-123456789',
                mpResourceId: 'res_ABC123',
                criadoEm: '2024-02-10T12:00:00Z',
                plano: {
                  id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
                  nome: 'Plano Avançado',
                },
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminUsuariosBloqueiosResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminUsuariosEmBloqueiosResumo' },
            },
            pagination: { allOf: [{ $ref: '#/components/schemas/PaginationMeta' }] },
          },
          example: {
            data: [
              {
                id: 'bloq_123456',
                alvo: {
                  tipo: 'EMPRESA',
                  id: 'cmp_112233',
                  nome: 'Empresa XPTO',
                  role: 'EMPRESA',
                },
                bloqueio: {
                  tipo: 'TEMPORARIO',
                  motivo: 'VIOLACAO_POLITICAS',
                  status: 'ATIVO',
                  inicio: '2025-09-20T14:00:00Z',
                  fim: '2025-10-20T14:00:00Z',
                  observacoes: 'Uso indevido de dados pessoais de candidatos.',
                },
                aplicadoPor: {
                  id: 'adm_002',
                  nome: 'Carlos Supervisor',
                  role: 'ADMIN',
                },
                auditoria: {
                  criadoEm: '2025-09-20T14:05:00Z',
                  atualizadoEm: '2025-09-20T14:05:00Z',
                },
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminUsuariosEmBloqueiosCreate: {
          type: 'object',
          required: ['tipo', 'motivo'],
          properties: {
            tipo: {
              type: 'string',
              enum: ['TEMPORARIO', 'PERMANENTE', 'RESTRICAO_DE_RECURSO'],
              example: 'TEMPORARIO',
              description: 'Tipo do bloqueio aplicado.',
            },
            motivo: {
              type: 'string',
              enum: ['SPAM', 'VIOLACAO_POLITICAS', 'FRAUDE', 'ABUSO_DE_RECURSOS', 'OUTROS'],
              example: 'VIOLACAO_POLITICAS',
              description: 'Motivo categorizado do bloqueio.',
            },
            dias: {
              type: 'integer',
              minimum: 1,
              maximum: 3650,
              nullable: true,
              example: 30,
              description: 'Vigência em dias (obrigatório para bloqueios temporários).',
            },
            observacoes: {
              type: 'string',
              nullable: true,
              maxLength: 500,
              example: 'Uso indevido de dados pessoais de candidatos.',
              description: 'Observações adicionais registradas pelo administrador.',
            },
          },
        },
        AdminUsuariosEmBloqueiosResponse: {
          type: 'object',
          required: ['bloqueio'],
          properties: {
            bloqueio: { $ref: '#/components/schemas/AdminUsuariosEmBloqueiosResumo' },
          },
          example: {
            bloqueio: {
              id: 'bloq_123456',
              alvo: {
                tipo: 'EMPRESA',
                id: 'cmp_112233',
                nome: 'Empresa XPTO',
                role: 'EMPRESA',
              },
              bloqueio: {
                tipo: 'TEMPORARIO',
                motivo: 'VIOLACAO_POLITICAS',
                status: 'ATIVO',
                inicio: '2025-09-20T14:00:00Z',
                fim: '2025-10-20T14:00:00Z',
                observacoes: 'Uso indevido de dados pessoais de candidatos.',
              },
              aplicadoPor: {
                id: 'adm_002',
                nome: 'Carlos Supervisor',
                role: 'ADMIN',
              },
              auditoria: {
                criadoEm: '2025-09-20T14:05:00Z',
                atualizadoEm: '2025-09-20T14:05:00Z',
              },
            },
          },
        },
        AdminEmpresaVagaResumo: {
          type: 'object',
          description: 'Resumo de vaga para listagens administrativas',
          required: [
            'id',
            'codigo',
            'slug',
            'titulo',
            'status',
            'inseridaEm',
            'atualizadoEm',
            'modoAnonimo',
            'modalidade',
            'regimeDeTrabalho',
            'paraPcd',
            'senioridade',
            'jornada',
            'numeroVagas',
            'requisitos',
            'atividades',
            'beneficios',
            'areaInteresseId',
            'subareaInteresseId',
            'areaInteresse',
            'subareaInteresse',
            'salarioConfidencial',
            'vagaEmDestaque',
            'destaqueInfo',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'vaga-uuid' },
            codigo: {
              type: 'string',
              maxLength: 6,
              example: 'B24N56',
              description:
                'Identificador curto utilizado pelos administradores para localizar a vaga com rapidez.',
            },
            slug: {
              type: 'string',
              maxLength: 120,
              example: 'analista-dados-pleno-sao-paulo',
              description: 'Identificador amigável utilizado nas rotas públicas da vaga.',
            },
            titulo: {
              type: 'string',
              maxLength: 255,
              example: 'Analista de Dados Pleno',
              description: 'Nome público da vaga informado pela empresa no momento do cadastro.',
            },
            status: { allOf: [{ $ref: '#/components/schemas/StatusDeVagas' }] },
            inseridaEm: { type: 'string', format: 'date-time', example: '2024-05-10T09:00:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-05-12T11:30:00Z' },
            inscricoesAte: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-06-01T23:59:59Z',
            },
            modoAnonimo: { type: 'boolean', example: false },
            modalidade: { allOf: [{ $ref: '#/components/schemas/ModalidadesDeVagas' }] },
            regimeDeTrabalho: { allOf: [{ $ref: '#/components/schemas/RegimesDeTrabalhos' }] },
            paraPcd: { type: 'boolean', example: false },
            senioridade: { allOf: [{ $ref: '#/components/schemas/Senioridade' }] },
            jornada: { allOf: [{ $ref: '#/components/schemas/Jornadas' }] },
            numeroVagas: {
              type: 'integer',
              example: 2,
              minimum: 1,
              description: 'Quantidade de posições abertas para a vaga.',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Responsável por construir dashboards e monitorar KPIs do time de negócios.',
            },
            requisitos: {
              type: 'object',
              required: ['obrigatorios', 'desejaveis'],
              properties: {
                obrigatorios: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Experiência com SQL', 'Conhecimento em Python'],
                },
                desejaveis: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Vivência com Looker Studio'],
                },
              },
            },
            atividades: {
              type: 'object',
              required: ['principais', 'extras'],
              properties: {
                principais: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Construir pipelines de dados', 'Acompanhar resultados de campanhas'],
                },
                extras: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Participar de eventos do setor'],
                },
              },
            },
            beneficios: {
              type: 'object',
              required: ['lista', 'observacoes'],
              properties: {
                lista: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Vale refeição', 'Plano de saúde', 'Gympass'],
                },
                observacoes: {
                  type: 'string',
                  nullable: true,
                  example: 'Auxílio home office de R$ 120,00',
                },
              },
            },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Processo seletivo com etapas presenciais na sede da empresa.',
            },
            localizacao: {
              type: 'object',
              nullable: true,
              properties: {
                cidade: { type: 'string', example: 'São Paulo' },
                estado: { type: 'string', example: 'SP' },
                bairro: { type: 'string', example: 'Pinheiros' },
              },
              additionalProperties: { type: 'string' },
            },
            salarioMin: {
              type: 'string',
              nullable: true,
              example: '4500.00',
              description: 'Valor mínimo da faixa salarial mensal (em BRL).',
            },
            salarioMax: {
              type: 'string',
              nullable: true,
              example: '6500.00',
              description: 'Valor máximo da faixa salarial mensal (em BRL).',
            },
            salarioConfidencial: {
              type: 'boolean',
              example: true,
              description:
                'Indica se a faixa salarial deve permanecer confidencial para candidatos.',
            },
            maxCandidaturasPorUsuario: {
              type: 'integer',
              nullable: true,
              example: 1,
              description: 'Limite de candidaturas permitidas por usuário nesta vaga.',
            },
            areaInteresseId: {
              type: 'integer',
              nullable: true,
              example: 3,
              description: 'Identificador da área de interesse selecionada para a vaga.',
            },
            subareaInteresseId: {
              type: 'integer',
              nullable: true,
              example: 7,
              description:
                'Identificador da subárea vinculada (sempre pertencente à área selecionada).',
            },
            areaInteresse: {
              type: 'object',
              nullable: true,
              description: 'Dados da área de interesse definida pela empresa.',
              properties: {
                id: { type: 'integer', example: 3 },
                categoria: { type: 'string', example: 'Tecnologia da Informação' },
              },
            },
            subareaInteresse: {
              type: 'object',
              nullable: true,
              description: 'Dados da subárea de interesse definida para a vaga.',
              properties: {
                id: { type: 'integer', example: 7 },
                nome: { type: 'string', example: 'Desenvolvimento Front-end' },
                areaId: { type: 'integer', example: 3 },
              },
            },
            vagaEmDestaque: {
              type: 'boolean',
              example: true,
              description:
                'Informa se a vaga está utilizando um slot de destaque do plano ativo da empresa.',
            },
            destaqueInfo: {
              type: 'object',
              nullable: true,
              description:
                'Metadados do vínculo da vaga com o recurso de destaque do plano empresarial.',
              properties: {
                empresasPlanoId: {
                  type: 'string',
                  format: 'uuid',
                  example: '8c5e0d56-4f2b-4c8f-9a18-91b3f4d2c7a1',
                },
                ativo: { type: 'boolean', example: true },
                ativadoEm: { type: 'string', format: 'date-time', example: '2024-05-10T09:00:00Z' },
                desativadoEm: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: null,
                },
              },
            },
          },
          example: {
            id: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
            codigo: 'B24N56',
            slug: 'analista-dados-pleno-sao-paulo',
            titulo: 'Analista de Dados Pleno',
            status: 'PUBLICADO',
            inseridaEm: '2024-05-10T09:00:00Z',
            atualizadoEm: '2024-05-12T11:30:00Z',
            inscricoesAte: '2024-06-01T23:59:59Z',
            modoAnonimo: false,
            modalidade: 'REMOTO',
            regimeDeTrabalho: 'CLT',
            paraPcd: false,
            senioridade: 'PLENO',
            jornada: 'INTEGRAL',
            numeroVagas: 2,
            descricao: 'Oportunidade para compor o time de dados com foco em análises preditivas.',
            requisitos: {
              obrigatorios: ['Experiência com SQL', 'Vivência com Python'],
              desejaveis: ['Conhecimento em Power BI'],
            },
            atividades: {
              principais: ['Construir dashboards executivos', 'Garantir a governança dos dados'],
              extras: ['Representar a área em encontros estratégicos'],
            },
            beneficios: {
              lista: ['Vale alimentação', 'Plano de saúde', 'Seguro de vida'],
              observacoes: 'Auxílio home office de R$ 150,00',
            },
            observacoes: 'Processo seletivo com etapas remotas e presenciais.',
            localizacao: { cidade: 'São Paulo', estado: 'SP' },
            salarioMin: '4500.00',
            salarioMax: '6500.00',
            salarioConfidencial: false,
            maxCandidaturasPorUsuario: 1,
            areaInteresseId: 3,
            subareaInteresseId: 7,
            areaInteresse: { id: 3, categoria: 'Tecnologia da Informação' },
            subareaInteresse: { id: 7, nome: 'Desenvolvimento Front-end', areaId: 3 },
            vagaEmDestaque: true,
            destaqueInfo: {
              empresasPlanoId: '8c5e0d56-4f2b-4c8f-9a18-91b3f4d2c7a1',
              ativo: true,
              ativadoEm: '2024-05-10T09:00:00Z',
              desativadoEm: null,
            },
          },
        },
        AdminEmpresasVagasResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaVagaResumo' },
            },
            pagination: { allOf: [{ $ref: '#/components/schemas/PaginationMeta' }] },
          },
          example: {
            data: [
              {
                id: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
                codigo: 'B24N56',
                slug: 'analista-dados-pleno-sao-paulo',
                titulo: 'Analista de Dados Pleno',
                status: 'PUBLICADO',
                inseridaEm: '2024-05-10T09:00:00Z',
                atualizadoEm: '2024-05-12T11:30:00Z',
                inscricoesAte: '2024-06-01T23:59:59Z',
                modoAnonimo: false,
                modalidade: 'REMOTO',
                regimeDeTrabalho: 'CLT',
                paraPcd: false,
                senioridade: 'PLENO',
                jornada: 'INTEGRAL',
                numeroVagas: 2,
                requisitos: {
                  obrigatorios: ['Experiência com SQL'],
                  desejaveis: ['Conhecimento em Power BI'],
                },
                atividades: {
                  principais: ['Construir dashboards executivos'],
                  extras: [],
                },
                beneficios: {
                  lista: ['Vale alimentação', 'Plano de saúde'],
                  observacoes: 'Auxílio home office de R$ 150,00',
                },
                observacoes: 'Processo seletivo híbrido.',
                localizacao: { cidade: 'São Paulo', estado: 'SP' },
                salarioMin: '4500.00',
                salarioMax: '6500.00',
                salarioConfidencial: false,
                maxCandidaturasPorUsuario: 1,
                areaInteresseId: 3,
                subareaInteresseId: 7,
                areaInteresse: { id: 3, categoria: 'Tecnologia da Informação' },
                subareaInteresse: { id: 7, nome: 'Desenvolvimento Front-end', areaId: 3 },
                vagaEmDestaque: true,
                destaqueInfo: {
                  empresasPlanoId: '8c5e0d56-4f2b-4c8f-9a18-91b3f4d2c7a1',
                  ativo: true,
                  ativadoEm: '2024-05-10T09:00:00Z',
                  desativadoEm: null,
                },
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminEmpresaVagaAprovacaoResponse: {
          type: 'object',
          required: ['vaga'],
          properties: {
            vaga: { $ref: '#/components/schemas/AdminEmpresaVagaResumo' },
          },
          example: {
            vaga: {
              id: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
              codigo: 'B24N56',
              slug: 'analista-dados-pleno-sao-paulo',
              titulo: 'Analista de Dados Pleno',
              status: 'PUBLICADO',
              inseridaEm: '2024-05-10T09:00:00Z',
              atualizadoEm: '2024-05-12T11:30:00Z',
              inscricoesAte: '2024-06-01T23:59:59Z',
              modoAnonimo: false,
              modalidade: 'REMOTO',
              regimeDeTrabalho: 'CLT',
              paraPcd: false,
              senioridade: 'PLENO',
              jornada: 'INTEGRAL',
              numeroVagas: 2,
              requisitos: {
                obrigatorios: ['Experiência com SQL'],
                desejaveis: ['Conhecimento em Power BI'],
              },
              atividades: {
                principais: ['Construir dashboards executivos'],
                extras: [],
              },
              beneficios: {
                lista: ['Vale alimentação', 'Plano de saúde'],
                observacoes: 'Auxílio home office de R$ 150,00',
              },
              observacoes: 'Processo seletivo híbrido.',
              localizacao: { cidade: 'São Paulo', estado: 'SP' },
              salarioMin: '4500.00',
              salarioMax: '6500.00',
              salarioConfidencial: false,
              maxCandidaturasPorUsuario: 1,
              areaInteresseId: 3,
              subareaInteresseId: 7,
              areaInteresse: { id: 3, categoria: 'Tecnologia da Informação' },
              subareaInteresse: { id: 7, nome: 'Desenvolvimento Front-end', areaId: 3 },
              vagaEmDestaque: true,
              destaqueInfo: {
                empresasPlanoId: '8c5e0d56-4f2b-4c8f-9a18-91b3f4d2c7a1',
                ativo: true,
                ativadoEm: '2024-05-10T09:00:00Z',
                desativadoEm: null,
              },
            },
          },
        },
        AdminVagaUsuarioResumo: {
          type: 'object',
          description: 'Informações completas do usuário (empresa ou candidato) associadas à vaga em contexto administrativo',
          required: [
            'id',
            'codUsuario',
            'nomeCompleto',
            'email',
            'role',
            'tipoUsuario',
            'status',
            'criadoEm',
            'aceitarTermos',
            'enderecos',
            'informacoes',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'user-uuid' },
            codUsuario: { type: 'string', example: 'EMP-123456' },
            nomeCompleto: { type: 'string', example: 'Advance Tech Consultoria' },
            email: { type: 'string', format: 'email', example: 'contato@advance.com.br' },
            cpf: {
              type: 'string',
              nullable: true,
              example: '12345678901',
              description: 'Presente quando o usuário é pessoa física/candidato.',
            },
            cnpj: {
              type: 'string',
              nullable: true,
              example: '12345678000190',
              description: 'Presente quando o usuário é pessoa jurídica/empresa.',
            },
            role: { allOf: [{ $ref: '#/components/schemas/Roles' }] },
            tipoUsuario: { allOf: [{ $ref: '#/components/schemas/TiposDeUsuarios' }] },
            status: { allOf: [{ $ref: '#/components/schemas/Status' }] },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-01-05T12:00:00Z' },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-05-20T08:15:00Z',
            },
            telefone: { type: 'string', nullable: true, example: '+55 11 99999-0000' },
            genero: { type: 'string', nullable: true, example: 'FEMININO' },
            dataNasc: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '1995-08-12T00:00:00Z',
            },
            inscricao: { type: 'string', nullable: true },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/avatar.png',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria especializada em recrutamento e seleção.',
            },
            aceitarTermos: { type: 'boolean', example: true },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            enderecos: {
              type: 'array',
              items: { $ref: '#/components/schemas/UsuarioEndereco' },
            },
            socialLinks: {
              allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
              nullable: true,
            },
            informacoes: { allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }] },
          },
          example: {
            id: '5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11',
            codUsuario: 'EMP-123456',
            nomeCompleto: 'Advance Tech Consultoria',
            email: 'contato@advance.com.br',
            cnpj: '12345678000190',
            role: 'EMPRESA',
            tipoUsuario: 'PESSOA_JURIDICA',
            status: 'ATIVO',
            criadoEm: '2024-01-05T12:00:00Z',
            ultimoLogin: '2024-05-20T08:15:00Z',
            telefone: '+55 11 99999-0000',
            avatarUrl: 'https://cdn.advance.com.br/logo.png',
            descricao: 'Consultoria especializada em recrutamento e seleção.',
            aceitarTermos: true,
            cidade: 'São Paulo',
            estado: 'SP',
            enderecos: [
              {
                id: 'end-1',
                logradouro: 'Av. Paulista',
                numero: '1000',
                bairro: 'Bela Vista',
                cidade: 'São Paulo',
                estado: 'SP',
                cep: '01310000',
              },
            ],
            socialLinks: { linkedin: 'https://linkedin.com/company/advance' },
            informacoes: {
              telefone: '+55 11 99999-0000',
              genero: null,
              dataNasc: null,
              inscricao: null,
              avatarUrl: 'https://cdn.advance.com.br/logo.png',
              descricao: 'Consultoria especializada em recrutamento e seleção.',
              aceitarTermos: true,
            },
          },
        },
        AdminVagaCandidatura: {
          type: 'object',
          required: [
            'id',
            'vagaId',
            'candidatoId',
            'empresaUsuarioId',
            'status',
            'origem',
            'aplicadaEm',
            'atualizadaEm',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'candidatura-uuid' },
            vagaId: { type: 'string', format: 'uuid', example: 'vaga-uuid' },
            candidatoId: { type: 'string', format: 'uuid', example: 'usuario-uuid' },
            curriculoId: { type: 'string', format: 'uuid', nullable: true },
            empresaUsuarioId: { type: 'string', format: 'uuid', example: 'empresa-uuid' },
            status: { allOf: [{ $ref: '#/components/schemas/StatusProcesso' }] },
            origem: { allOf: [{ $ref: '#/components/schemas/OrigemVagas' }] },
            aplicadaEm: { type: 'string', format: 'date-time', example: '2024-05-11T10:00:00Z' },
            atualizadaEm: { type: 'string', format: 'date-time', example: '2024-05-11T10:00:00Z' },
            consentimentos: { type: 'object', nullable: true },
            candidato: {
              allOf: [{ $ref: '#/components/schemas/AdminVagaUsuarioResumo' }],
              nullable: true,
            },
            curriculo: {
              allOf: [{ $ref: '#/components/schemas/UsuarioCurriculo' }],
              nullable: true,
            },
          },
        },
        AdminVagaProcesso: {
          type: 'object',
          required: [
            'id',
            'vagaId',
            'candidatoId',
            'status',
            'origem',
            'criadoEm',
            'atualizadoEm',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'processo-uuid' },
            vagaId: { type: 'string', format: 'uuid', example: 'vaga-uuid' },
            candidatoId: { type: 'string', format: 'uuid', example: 'usuario-uuid' },
            status: { allOf: [{ $ref: '#/components/schemas/StatusProcesso' }] },
            origem: { allOf: [{ $ref: '#/components/schemas/OrigemVagas' }] },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Entrevista técnica agendada.',
            },
            agendadoEm: { type: 'string', format: 'date-time', nullable: true },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-05-15T10:00:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-05-16T16:30:00Z' },
            candidato: {
              allOf: [{ $ref: '#/components/schemas/AdminVagaUsuarioResumo' }],
              nullable: true,
            },
          },
        },
        AdminVagaDetalhe: {
          allOf: [
            { $ref: '#/components/schemas/AdminEmpresaVagaResumo' },
            {
              type: 'object',
              required: [
                'usuarioId',
                'empresa',
                'candidaturas',
                'processos',
                'candidaturasResumo',
                'processosResumo',
              ],
              properties: {
                usuarioId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Identificador da empresa proprietária da vaga.',
                  example: '5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11',
                },
                empresa: {
                  allOf: [{ $ref: '#/components/schemas/AdminVagaUsuarioResumo' }],
                  nullable: true,
                  description: 'Dados completos da empresa responsável pela vaga.',
                },
                candidaturas: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AdminVagaCandidatura' },
                },
                processos: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AdminVagaProcesso' },
                },
                candidaturasResumo: {
                  type: 'object',
                  required: ['total', 'porStatus'],
                  properties: {
                    total: { type: 'integer', example: 3 },
                    porStatus: {
                      type: 'object',
                      additionalProperties: { type: 'integer' },
                      example: { RECEBIDA: 2, ENTREVISTA: 1 },
                    },
                  },
                },
                processosResumo: {
                  type: 'object',
                  required: ['total', 'porStatus'],
                  properties: {
                    total: { type: 'integer', example: 2 },
                    porStatus: {
                      type: 'object',
                      additionalProperties: { type: 'integer' },
                      example: { ENTREVISTA: 2 },
                    },
                  },
                },
              },
            },
          ],
        },
        AdminVagasListResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminVagaDetalhe' },
            },
            pagination: { allOf: [{ $ref: '#/components/schemas/PaginationMeta' }] },
          },
          example: {
            data: [
              {
                id: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
                codigo: 'B24N56',
                slug: 'analista-dados-pleno-sao-paulo',
                usuarioId: '5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11',
                titulo: 'Analista de Dados Pleno',
                status: 'PUBLICADO',
                inseridaEm: '2024-05-10T09:00:00Z',
                atualizadoEm: '2024-05-12T11:30:00Z',
                inscricoesAte: '2024-06-01T23:59:59Z',
                modoAnonimo: false,
                modalidade: 'REMOTO',
                regimeDeTrabalho: 'CLT',
                paraPcd: false,
                senioridade: 'PLENO',
                jornada: 'INTEGRAL',
                numeroVagas: 2,
                descricao: 'Oportunidade focada em análises preditivas e governança de dados.',
                requisitos: {
                  obrigatorios: ['Experiência com SQL', 'Vivência com Python'],
                  desejaveis: ['Conhecimento em Power BI'],
                },
                atividades: {
                  principais: ['Construir dashboards executivos', 'Garantir qualidade dos dados'],
                  extras: ['Atuar com stakeholders de negócios'],
                },
                beneficios: {
                  lista: ['Vale alimentação', 'Plano de saúde'],
                  observacoes: 'Auxílio home office de R$ 150,00',
                },
                observacoes: 'Processo seletivo com etapas remotas e presenciais.',
                localizacao: { cidade: 'São Paulo', estado: 'SP' },
                salarioMin: '4500.00',
                salarioMax: '6500.00',
                salarioConfidencial: false,
                maxCandidaturasPorUsuario: 1,
                areaInteresseId: 3,
                subareaInteresseId: 7,
                areaInteresse: { id: 3, categoria: 'Tecnologia da Informação' },
                subareaInteresse: { id: 7, nome: 'Desenvolvimento Front-end', areaId: 3 },
                vagaEmDestaque: true,
                destaqueInfo: {
                  empresasPlanoId: '8c5e0d56-4f2b-4c8f-9a18-91b3f4d2c7a1',
                  ativo: true,
                  ativadoEm: '2024-05-10T09:00:00Z',
                  desativadoEm: null,
                },
                empresa: {
                  id: '5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11',
                  codUsuario: 'EMP-123456',
                  nomeCompleto: 'Advance Tech Consultoria',
                  email: 'contato@advance.com.br',
                  cnpj: '12345678000190',
                  role: 'EMPRESA',
                  tipoUsuario: 'PESSOA_JURIDICA',
                  status: 'ATIVO',
                  criadoEm: '2024-01-05T12:00:00Z',
                  ultimoLogin: '2024-05-20T08:15:00Z',
                  telefone: '+55 11 99999-0000',
                  avatarUrl: 'https://cdn.advance.com.br/logo.png',
                  descricao: 'Consultoria especializada em recrutamento e seleção.',
                  aceitarTermos: true,
                  cidade: 'São Paulo',
                  estado: 'SP',
                  enderecos: [
                    {
                      id: 'end-1',
                      logradouro: 'Av. Paulista',
                      numero: '1000',
                      bairro: 'Bela Vista',
                      cidade: 'São Paulo',
                      estado: 'SP',
                      cep: '01310000',
                    },
                  ],
                  socialLinks: { linkedin: 'https://linkedin.com/company/advance' },
                  informacoes: {
                    telefone: '+55 11 99999-0000',
                    genero: null,
                    dataNasc: null,
                    inscricao: null,
                    avatarUrl: 'https://cdn.advance.com.br/logo.png',
                    descricao: 'Consultoria especializada em recrutamento e seleção.',
                    aceitarTermos: true,
                  },
                },
                candidaturas: [
                  {
                    id: '9f5c2be1-8b1f-4a24-8a55-df0f3ccf13c0',
                    vagaId: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
                    candidatoId: '8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20',
                    curriculoId: '6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10',
                    empresaUsuarioId: '5cefd77b-7a20-47b2-95fe-3eb5bf2c7c11',
                    status: 'RECEBIDA',
                    origem: 'SITE',
                    aplicadaEm: '2024-05-11T10:00:00Z',
                    atualizadaEm: '2024-05-11T10:00:00Z',
                    candidato: {
                      id: '8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20',
                      codUsuario: 'CAND-332211',
                      nomeCompleto: 'João da Silva',
                      email: 'joao.silva@example.com',
                      cpf: '12345678901',
                      role: 'ALUNO_CANDIDATO',
                      tipoUsuario: 'PESSOA_FISICA',
                      status: 'ATIVO',
                      criadoEm: '2023-11-02T12:00:00Z',
                      ultimoLogin: '2024-05-18T09:30:00Z',
                      telefone: '+55 11 98888-7777',
                      avatarUrl: 'https://cdn.advance.com.br/avatars/joao.png',
                      descricao: 'Analista de dados com 5 anos de experiência.',
                      aceitarTermos: true,
                      cidade: 'São Paulo',
                      estado: 'SP',
                      enderecos: [
                        {
                          id: 'cand-end-1',
                          logradouro: 'Rua das Flores',
                          numero: '200',
                          bairro: 'Centro',
                          cidade: 'São Paulo',
                          estado: 'SP',
                          cep: '01010000',
                        },
                      ],
                      socialLinks: { linkedin: 'https://linkedin.com/in/joaodasilva' },
                      informacoes: {
                        telefone: '+55 11 98888-7777',
                        genero: 'MASCULINO',
                        dataNasc: '1995-08-12T00:00:00Z',
                        inscricao: null,
                        avatarUrl: 'https://cdn.advance.com.br/avatars/joao.png',
                        descricao: 'Analista de dados com 5 anos de experiência.',
                        aceitarTermos: true,
                      },
                    },
                    curriculo: {
                      id: '6d1f9b8a-3c21-4fb2-8a8f-f6e2c21a7f10',
                      usuarioId: '8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20',
                      titulo: 'Currículo principal',
                      resumo: 'Profissional com experiência em analytics e BI.',
                      objetivo: 'Atuar como analista de dados pleno.',
                      principal: true,
                      areasInteresse: { primaria: 'Tecnologia' },
                      preferencias: null,
                      habilidades: { tecnicas: ['SQL', 'Python'] },
                      idiomas: [{ idioma: 'Inglês', nivel: 'Avançado' }],
                      experiencias: [],
                      formacao: [],
                      cursosCertificacoes: [],
                      premiosPublicacoes: [],
                      acessibilidade: null,
                      consentimentos: null,
                      ultimaAtualizacao: '2024-04-30T15:00:00Z',
                      criadoEm: '2023-11-02T12:05:00Z',
                      atualizadoEm: '2024-04-30T15:00:00Z',
                    },
                  },
                ],
                processos: [
                  {
                    id: '8fd4c1e2-5f11-4a5c-9ab2-bc401ea77e10',
                    vagaId: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
                    candidatoId: '8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20',
                    status: 'ENTREVISTA',
                    origem: 'SITE',
                    observacoes: 'Entrevista técnica agendada.',
                    agendadoEm: '2024-05-18T14:00:00Z',
                    criadoEm: '2024-05-15T10:00:00Z',
                    atualizadoEm: '2024-05-16T16:30:00Z',
                    candidato: {
                      id: '8b1f9c2a-2c41-4f3a-9b7d-15a1a4d9ce20',
                      codUsuario: 'CAND-332211',
                      nomeCompleto: 'João da Silva',
                      email: 'joao.silva@example.com',
                      cpf: '12345678901',
                      role: 'ALUNO_CANDIDATO',
                      tipoUsuario: 'PESSOA_FISICA',
                      status: 'ATIVO',
                      criadoEm: '2023-11-02T12:00:00Z',
                      ultimoLogin: '2024-05-18T09:30:00Z',
                      telefone: '+55 11 98888-7777',
                      avatarUrl: 'https://cdn.advance.com.br/avatars/joao.png',
                      descricao: 'Analista de dados com 5 anos de experiência.',
                      aceitarTermos: true,
                      cidade: 'São Paulo',
                      estado: 'SP',
                      enderecos: [
                        {
                          id: 'cand-end-1',
                          logradouro: 'Rua das Flores',
                          numero: '200',
                          bairro: 'Centro',
                          cidade: 'São Paulo',
                          estado: 'SP',
                          cep: '01010000',
                        },
                      ],
                      socialLinks: { linkedin: 'https://linkedin.com/in/joaodasilva' },
                      informacoes: {
                        telefone: '+55 11 98888-7777',
                        genero: 'MASCULINO',
                        dataNasc: '1995-08-12T00:00:00Z',
                        inscricao: null,
                        avatarUrl: 'https://cdn.advance.com.br/avatars/joao.png',
                        descricao: 'Analista de dados com 5 anos de experiência.',
                        aceitarTermos: true,
                      },
                    },
                  },
                ],
                candidaturasResumo: {
                  total: 1,
                  porStatus: { RECEBIDA: 1 },
                },
                processosResumo: {
                  total: 1,
                  porStatus: { ENTREVISTA: 1 },
                },
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminCandidatoCurriculo: {
          description: 'Currículo completo do candidato em contexto administrativo',
          allOf: [{ $ref: '#/components/schemas/UsuarioCurriculo' }],
        },
        AdminCandidatoVagaResumo: {
          type: 'object',
          description: 'Informações detalhadas da vaga associada à candidatura do candidato',
          required: [
            'id',
            'codigo',
            'slug',
            'usuarioId',
            'titulo',
            'status',
            'inseridaEm',
            'atualizadoEm',
            'modoAnonimo',
            'modalidade',
            'regimeDeTrabalho',
            'paraPcd',
            'senioridade',
            'jornada',
            'numeroVagas',
            'salarioConfidencial',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'vaga-uuid' },
            codigo: { type: 'string', example: 'B24N56' },
            slug: { type: 'string', example: 'analista-dados-pleno-sao-paulo' },
            usuarioId: { type: 'string', format: 'uuid', example: 'empresa-uuid' },
            titulo: { type: 'string', example: 'Analista de Dados Pleno' },
            status: { allOf: [{ $ref: '#/components/schemas/StatusDeVagas' }] },
            inseridaEm: { type: 'string', format: 'date-time', example: '2024-05-10T09:00:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-05-12T11:30:00Z' },
            inscricoesAte: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-06-01T23:59:59Z',
            },
            modoAnonimo: { type: 'boolean', example: false },
            modalidade: { allOf: [{ $ref: '#/components/schemas/ModalidadesDeVagas' }] },
            regimeDeTrabalho: { allOf: [{ $ref: '#/components/schemas/RegimesDeTrabalhos' }] },
            paraPcd: { type: 'boolean', example: false },
            senioridade: { allOf: [{ $ref: '#/components/schemas/Senioridade' }] },
            jornada: { allOf: [{ $ref: '#/components/schemas/Jornadas' }] },
            numeroVagas: { type: 'integer', example: 2 },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Oportunidade focada em análises preditivas e governança de dados.',
            },
            requisitos: { type: 'object', nullable: true },
            atividades: { type: 'object', nullable: true },
            beneficios: { type: 'object', nullable: true },
            observacoes: { type: 'string', nullable: true },
            localizacao: {
              type: 'object',
              nullable: true,
              properties: {
                cidade: { type: 'string', nullable: true, example: 'São Paulo' },
                estado: { type: 'string', nullable: true, example: 'SP' },
              },
            },
            salarioMin: { type: 'string', nullable: true, example: '4500.00' },
            salarioMax: { type: 'string', nullable: true, example: '6500.00' },
            salarioConfidencial: { type: 'boolean', example: false },
            maxCandidaturasPorUsuario: { type: 'integer', nullable: true, example: 1 },
            areaInteresseId: { type: 'integer', nullable: true, example: 3 },
            subareaInteresseId: { type: 'integer', nullable: true, example: 7 },
            areaInteresse: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'integer', example: 3 },
                categoria: { type: 'string', example: 'Tecnologia da Informação' },
              },
            },
            subareaInteresse: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'integer', example: 7 },
                nome: { type: 'string', example: 'Desenvolvimento Front-end' },
                areaId: { type: 'integer', example: 3 },
              },
            },
            empresa: {
              allOf: [{ $ref: '#/components/schemas/AdminVagaUsuarioResumo' }],
              nullable: true,
            },
          },
        },
        AdminCandidatoCandidatura: {
          type: 'object',
          description: 'Candidatura realizada pelo candidato com currículo e vaga associados',
          required: [
            'id',
            'vagaId',
            'candidatoId',
            'empresaUsuarioId',
            'status',
            'origem',
            'aplicadaEm',
            'atualizadaEm',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'candidatura-uuid' },
            vagaId: { type: 'string', format: 'uuid', example: 'vaga-uuid' },
            candidatoId: { type: 'string', format: 'uuid', example: 'usuario-uuid' },
            curriculoId: { type: 'string', format: 'uuid', nullable: true },
            empresaUsuarioId: { type: 'string', format: 'uuid', example: 'empresa-uuid' },
            status: { allOf: [{ $ref: '#/components/schemas/StatusProcesso' }] },
            origem: { allOf: [{ $ref: '#/components/schemas/OrigemVagas' }] },
            aplicadaEm: { type: 'string', format: 'date-time', example: '2024-05-11T10:00:00Z' },
            atualizadaEm: { type: 'string', format: 'date-time', example: '2024-05-11T10:00:00Z' },
            consentimentos: { type: 'object', nullable: true },
            curriculo: {
              allOf: [{ $ref: '#/components/schemas/AdminCandidatoCurriculo' }],
              nullable: true,
            },
            vaga: {
              allOf: [{ $ref: '#/components/schemas/AdminCandidatoVagaResumo' }],
              nullable: true,
            },
            empresa: {
              allOf: [{ $ref: '#/components/schemas/AdminVagaUsuarioResumo' }],
              nullable: true,
            },
          },
        },
        AdminCandidatoDetalhe: {
          allOf: [
            { $ref: '#/components/schemas/AdminVagaUsuarioResumo' },
            {
              type: 'object',
              required: ['curriculos', 'candidaturas', 'curriculosResumo', 'candidaturasResumo'],
              properties: {
                curriculos: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AdminCandidatoCurriculo' },
                },
                candidaturas: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AdminCandidatoCandidatura' },
                },
                curriculosResumo: {
                  type: 'object',
                  required: ['total', 'principais'],
                  properties: {
                    total: { type: 'integer', example: 2 },
                    principais: { type: 'integer', example: 1 },
                  },
                },
                candidaturasResumo: {
                  type: 'object',
                  required: ['total', 'porStatus'],
                  properties: {
                    total: { type: 'integer', example: 3 },
                    porStatus: {
                      type: 'object',
                      additionalProperties: { type: 'integer' },
                      example: { RECEBIDA: 2, ENTREVISTA: 1 },
                    },
                  },
                },
              },
            },
          ],
        },
        AdminCandidatosListResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminCandidatoDetalhe' },
            },
            pagination: { allOf: [{ $ref: '#/components/schemas/PaginationMeta' }] },
          },
        },
        EmpresaResumo: {
          type: 'object',
          description: 'Informações públicas da empresa vinculada à vaga',
          properties: {
            id: { type: 'string', example: 'empresa-uuid' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/assets/empresa/avatar.png',
            },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria em RH e tecnologia especializada em recrutamento.',
            },
            socialLinks: {
              allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
              nullable: true,
            },
            codUsuario: { type: 'string', example: 'ABC1234' },
            informacoes: {
              allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }],
              description:
                'Dados complementares utilizados para montar a exibição da empresa na vaga.',
            },
          },
        },
        Vaga: {
          type: 'object',
          description: 'Representação completa da vaga cadastrada pela empresa',
          properties: {
            id: { type: 'string', example: 'vaga-uuid' },
            codigo: {
              type: 'string',
              maxLength: 6,
              example: 'B24N56',
              description:
                'Identificador curto da vaga gerado automaticamente para facilitar buscas internas.',
              readOnly: true,
            },
            slug: {
              type: 'string',
              maxLength: 120,
              example: 'analista-dados-pleno-sao-paulo',
              description: 'Identificador amigável usado nas rotas públicas e compartilhamentos.',
            },
            usuarioId: { type: 'string', example: 'usuario-uuid' },
            empresa: {
              allOf: [{ $ref: '#/components/schemas/EmpresaResumo' }],
              nullable: true,
            },
            modoAnonimo: { type: 'boolean', example: true },
            regimeDeTrabalho: { allOf: [{ $ref: '#/components/schemas/RegimesDeTrabalhos' }] },
            modalidade: { allOf: [{ $ref: '#/components/schemas/ModalidadesDeVagas' }] },
            titulo: {
              type: 'string',
              maxLength: 255,
              example: 'Coordenador de Projetos TI',
            },
            paraPcd: { type: 'boolean', example: false },
            numeroVagas: {
              type: 'integer',
              minimum: 1,
              example: 2,
              description: 'Quantidade de posições abertas para esta vaga.',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example:
                'Responsável por liderar projetos multidisciplinares e garantir a execução do roadmap.',
            },
            requisitos: {
              type: 'object',
              required: ['obrigatorios', 'desejaveis'],
              properties: {
                obrigatorios: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Experiência com gestão de projetos', 'Domínio de metodologias ágeis'],
                },
                desejaveis: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Certificação PMP', 'Conhecimento em OKRs'],
                },
              },
            },
            atividades: {
              type: 'object',
              required: ['principais', 'extras'],
              properties: {
                principais: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Coordenar squads multidisciplinares', 'Monitorar KPIs estratégicos'],
                },
                extras: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Representar a empresa em eventos do setor'],
                },
              },
            },
            beneficios: {
              type: 'object',
              required: ['lista', 'observacoes'],
              properties: {
                lista: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Vale refeição', 'Plano odontológico', 'Gympass'],
                },
                observacoes: {
                  type: 'string',
                  nullable: true,
                  example: 'Auxílio home office de R$ 120,00',
                },
              },
            },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Processo seletivo confidencial com etapas online.',
            },
            jornada: {
              allOf: [{ $ref: '#/components/schemas/Jornadas' }],
              description: 'Classificação padronizada da carga horária da vaga.',
            },
            senioridade: {
              allOf: [{ $ref: '#/components/schemas/Senioridade' }],
              description: 'Faixa de senioridade aceita para a posição.',
            },
            localizacao: {
              type: 'object',
              nullable: true,
              properties: {
                logradouro: { type: 'string', example: 'Av. Paulista' },
                numero: { type: 'string', example: '1000' },
                bairro: { type: 'string', example: 'Bela Vista' },
                cidade: { type: 'string', example: 'São Paulo' },
                estado: { type: 'string', example: 'SP' },
                cep: { type: 'string', example: '01310-100' },
              },
              additionalProperties: { type: 'string' },
            },
            inscricoesAte: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-12-20T23:59:59Z',
            },
            inseridaEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-01T09:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-05T09:00:00Z',
            },
            status: {
              allOf: [{ $ref: '#/components/schemas/StatusDeVagas' }],
              description: 'Status atual da vaga dentro do fluxo de aprovação',
            },
            salarioMin: {
              type: 'string',
              nullable: true,
              example: '4500.00',
            },
            salarioMax: {
              type: 'string',
              nullable: true,
              example: '6500.00',
            },
            salarioConfidencial: { type: 'boolean', example: true },
            maxCandidaturasPorUsuario: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            areaInteresseId: {
              type: 'integer',
              nullable: true,
              example: 3,
              description: 'Identificador da área de interesse associada à vaga.',
            },
            subareaInteresseId: {
              type: 'integer',
              nullable: true,
              example: 7,
              description: 'Identificador da subárea de interesse associada à vaga.',
            },
            areaInteresse: {
              type: 'object',
              nullable: true,
              description:
                'Dados resumidos da área de interesse escolhida para classificar a vaga.',
              properties: {
                id: { type: 'integer', example: 3 },
                categoria: { type: 'string', example: 'Tecnologia da Informação' },
              },
            },
            subareaInteresse: {
              type: 'object',
              nullable: true,
              description: 'Dados resumidos da subárea vinculada à vaga.',
              properties: {
                id: { type: 'integer', example: 7 },
                nome: { type: 'string', example: 'Desenvolvimento Front-end' },
                areaId: { type: 'integer', example: 3 },
              },
            },
            nomeExibicao: {
              type: 'string',
              nullable: true,
              example: 'Oportunidade Confidencial #A1B2C',
            },
            logoExibicao: {
              type: 'string',
              nullable: true,
              example: null,
            },
            mensagemAnonimato: {
              type: 'string',
              nullable: true,
              example:
                'Esta empresa optou por manter suas informações confidenciais até avançar nas etapas do processo seletivo.',
            },
            descricaoExibicao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria em RH e tecnologia especializada em recrutamento.',
            },
          },
        },
        VagaCreateInput: {
          type: 'object',
          description:
            'Dados necessários para cadastrar uma vaga. O status inicial é definido automaticamente como EM_ANALISE e o código alfanumérico de 6 caracteres é gerado pelo sistema.',
          required: [
            'usuarioId',
            'areaInteresseId',
            'subareaInteresseId',
            'slug',
            'regimeDeTrabalho',
            'modalidade',
            'titulo',
            'requisitos',
            'atividades',
            'beneficios',
            'jornada',
            'senioridade',
          ],
          properties: {
            usuarioId: {
              type: 'string',
              format: 'uuid',
              example: 'f1d7a9c2-4e0b-4f6d-90ad-8c6b84a0f1a1',
            },
            areaInteresseId: {
              type: 'integer',
              example: 3,
              description: 'ID da categoria (área) selecionada na jornada de cadastro da vaga.',
            },
            subareaInteresseId: {
              type: 'integer',
              example: 7,
              description: 'ID da subcategoria associada à área escolhida para a vaga.',
            },
            slug: {
              type: 'string',
              maxLength: 120,
              pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
              example: 'analista-marketing-digital-sao-paulo',
              description:
                'Identificador amigável da vaga utilizado nas rotas públicas (apenas letras minúsculas, números e hífens).',
            },
            modoAnonimo: {
              type: 'boolean',
              example: true,
              description:
                'Quando verdadeiro, oculta o nome e a logo da empresa nas listagens públicas',
            },
            regimeDeTrabalho: { allOf: [{ $ref: '#/components/schemas/RegimesDeTrabalhos' }] },
            modalidade: { allOf: [{ $ref: '#/components/schemas/ModalidadesDeVagas' }] },
            titulo: {
              type: 'string',
              maxLength: 255,
              example: 'Analista de Marketing Digital',
              description:
                'Nome da vaga que será exibido nos portais e dashboards administrativos.',
            },
            paraPcd: { type: 'boolean', example: false },
            vagaEmDestaque: {
              type: 'boolean',
              example: false,
              description:
                'Quando verdadeiro, reserva um slot de destaque do plano ativo da empresa (requer plano com recurso habilitado).',
            },
            numeroVagas: {
              type: 'integer',
              minimum: 1,
              example: 2,
              description: 'Quantidade de posições disponíveis. Quando omitido, assume 1.',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example:
                'Responsável por executar estratégias de marketing digital e otimizar campanhas.',
            },
            requisitos: {
              type: 'object',
              required: ['obrigatorios'],
              properties: {
                obrigatorios: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  example: ['Experiência com inbound marketing', 'Domínio de Google Analytics'],
                },
                desejaveis: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Certificação HubSpot'],
                  description: 'Competências desejáveis (opcional).',
                },
              },
            },
            atividades: {
              type: 'object',
              required: ['principais'],
              properties: {
                principais: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  example: ['Planejar calendário editorial', 'Monitorar métricas de campanhas'],
                },
                extras: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Participar de eventos do setor'],
                },
              },
            },
            beneficios: {
              type: 'object',
              required: ['lista'],
              properties: {
                lista: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  example: ['Vale refeição', 'Plano de saúde', 'Day-off no aniversário'],
                },
                observacoes: {
                  type: 'string',
                  nullable: true,
                  example: 'Auxílio home office de R$ 150,00',
                },
              },
            },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Processo seletivo confidencial com etapas online.',
            },
            jornada: {
              allOf: [{ $ref: '#/components/schemas/Jornadas' }],
              description: 'Selecione a jornada que melhor descreve a carga horária combinada.',
              example: 'INTEGRAL',
            },
            senioridade: {
              allOf: [{ $ref: '#/components/schemas/Senioridade' }],
              description: 'Informe a faixa de senioridade aceita para a vaga.',
              example: 'PLENO',
            },
            localizacao: {
              type: 'object',
              nullable: true,
              properties: {
                logradouro: { type: 'string', example: 'Av. Paulista' },
                numero: { type: 'string', example: '1000' },
                bairro: { type: 'string', example: 'Bela Vista' },
                cidade: { type: 'string', example: 'São Paulo' },
                estado: { type: 'string', example: 'SP' },
                cep: { type: 'string', example: '01310-100' },
                complemento: { type: 'string', example: 'Conjunto 1201' },
                referencia: { type: 'string', example: 'Próximo ao metrô Trianon-Masp' },
              },
            },
            inscricoesAte: {
              type: 'string',
              format: 'date-time',
              example: '2024-12-20T23:59:59Z',
            },
            inseridaEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-01T09:00:00Z',
            },
            salarioMin: {
              type: 'string',
              nullable: true,
              pattern: '^\\d+(?:[.,]\\d{1,2})?$',
              example: '4500.00',
            },
            salarioMax: {
              type: 'string',
              nullable: true,
              pattern: '^\\d+(?:[.,]\\d{1,2})?$',
              example: '6500.00',
            },
            salarioConfidencial: {
              type: 'boolean',
              example: true,
              description: 'Indica se a faixa salarial ficará visível para candidatos.',
            },
            maxCandidaturasPorUsuario: {
              type: 'integer',
              nullable: true,
              minimum: 1,
              example: 1,
              description: 'Limite de candidaturas permitidas por usuário.',
            },
          },
        },
        VagaUpdateInput: {
          type: 'object',
          description:
            'Campos permitidos para atualização da vaga, inclusive o status do fluxo de aprovação (RASCUNHO, EM_ANALISE, PUBLICADO, DESPUBLICADA, PAUSADA, EXPIRADO ou ENCERRADA).',
          properties: {
            usuarioId: {
              type: 'string',
              format: 'uuid',
              example: 'f1d7a9c2-4e0b-4f6d-90ad-8c6b84a0f1a1',
            },
            areaInteresseId: {
              type: 'integer',
              example: 3,
              description:
                'Atualize a categoria (área) associada à vaga. Informe junto uma subárea válida.',
            },
            subareaInteresseId: {
              type: 'integer',
              example: 7,
              description: 'Atualize a subcategoria vinculada à área informada.',
            },
            modoAnonimo: { type: 'boolean', example: false },
            regimeDeTrabalho: { allOf: [{ $ref: '#/components/schemas/RegimesDeTrabalhos' }] },
            modalidade: { allOf: [{ $ref: '#/components/schemas/ModalidadesDeVagas' }] },
            titulo: {
              type: 'string',
              maxLength: 255,
              example: 'Gerente de Operações',
            },
            slug: {
              type: 'string',
              maxLength: 120,
              pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
              example: 'gerente-operacoes-rio-de-janeiro',
            },
            paraPcd: { type: 'boolean', example: true },
            vagaEmDestaque: {
              type: 'boolean',
              description: 'Ativa ou remove o destaque da vaga conforme as regras do plano ativo.',
              example: true,
            },
            numeroVagas: { type: 'integer', minimum: 1, example: 3 },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Atuação no planejamento e evolução dos sistemas corporativos.',
            },
            requisitos: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    obrigatorios: { type: 'array', items: { type: 'string' } },
                    desejaveis: { type: 'array', items: { type: 'string' } },
                  },
                },
                { type: 'null' },
              ],
            },
            atividades: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    principais: { type: 'array', items: { type: 'string' } },
                    extras: { type: 'array', items: { type: 'string' } },
                  },
                },
                { type: 'null' },
              ],
            },
            beneficios: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    lista: { type: 'array', items: { type: 'string' } },
                    observacoes: { type: 'string', nullable: true },
                  },
                },
                { type: 'null' },
              ],
            },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Processo seletivo com etapas online.',
            },
            jornada: {
              allOf: [{ $ref: '#/components/schemas/Jornadas' }],
              description: 'Atualize a jornada quando houver mudança na carga horária prevista.',
              example: 'MEIO_PERIODO',
            },
            senioridade: {
              allOf: [{ $ref: '#/components/schemas/Senioridade' }],
              description: 'Atualize a faixa de senioridade aceita para a vaga.',
              example: 'SENIOR',
            },
            inscricoesAte: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-11-15T23:59:59Z',
            },
            inseridaEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-05T09:00:00Z',
            },
            status: {
              allOf: [{ $ref: '#/components/schemas/StatusDeVagas' }],
              description: 'Atualização manual do status da vaga',
            },
            localizacao: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    logradouro: { type: 'string' },
                    numero: { type: 'string' },
                    bairro: { type: 'string' },
                    cidade: { type: 'string' },
                    estado: { type: 'string' },
                    cep: { type: 'string' },
                    complemento: { type: 'string' },
                    referencia: { type: 'string' },
                  },
                },
                { type: 'null' },
              ],
            },
            salarioMin: {
              oneOf: [{ type: 'string', pattern: '^\\d+(?:[.,]\\d{1,2})?$' }, { type: 'null' }],
              example: '5000.00',
            },
            salarioMax: {
              oneOf: [{ type: 'string', pattern: '^\\d+(?:[.,]\\d{1,2})?$' }, { type: 'null' }],
              example: '7000.00',
            },
            salarioConfidencial: { type: 'boolean', example: false },
            maxCandidaturasPorUsuario: {
              oneOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }],
              example: 1,
            },
          },
        },
        AdminModuleInfo: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Área administrativa' },
            usuario: { $ref: '#/components/schemas/UserProfile' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            permissions: {
              type: 'array',
              items: { type: 'string' },
              example: ['read', 'write'],
            },
          },
        },
        AdminUserSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user-uuid' },
            email: { type: 'string', example: 'user@example.com' },
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            role: {
              allOf: [{ $ref: '#/components/schemas/Roles' }],
              example: 'ALUNO_CANDIDATO',
            },
            status: { type: 'string', example: 'ATIVO' },
            tipoUsuario: {
              allOf: [{ $ref: '#/components/schemas/TiposDeUsuarios' }],
              example: 'PESSOA_FISICA',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T12:00:00Z',
            },
            _count: {
              type: 'object',
              properties: {},
            },
          },
        },
        AdminCandidateSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'candidate-uuid' },
            email: { type: 'string', example: 'candidato@example.com' },
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            role: {
              allOf: [
                { $ref: '#/components/schemas/Roles' },
                {
                  type: 'string',
                  enum: ['ALUNO_CANDIDATO'],
                  example: 'ALUNO_CANDIDATO',
                  description: 'Role atribuído automaticamente aos perfis de candidato',
                },
              ],
            },
            status: {
              type: 'string',
              enum: ['ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
            },
            tipoUsuario: {
              allOf: [{ $ref: '#/components/schemas/TiposDeUsuarios' }],
              example: 'PESSOA_FISICA',
            },
            cidade: { type: 'string', nullable: true, example: 'Maceió' },
            estado: { type: 'string', nullable: true, example: 'AL' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-10T12:00:00Z',
            },
          },
        },
        AdminCandidateListResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Lista de candidatos' },
            candidatos: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminCandidateSummary' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  example: 1,
                  minimum: 1,
                  description: 'Página atual da paginação',
                },
                limit: {
                  type: 'integer',
                  example: 10,
                  minimum: 1,
                  maximum: 100,
                  description:
                    'Quantidade de registros retornados por página. Na visão de dashboard o valor é fixado em 10.',
                },
                total: {
                  type: 'integer',
                  example: 100,
                  minimum: 0,
                  description: 'Total de candidatos que atendem aos filtros',
                },
                pages: {
                  type: 'integer',
                  example: 2,
                  minimum: 0,
                  description: 'Total de páginas calculado a partir do limite informado',
                },
              },
            },
          },
        },
        AdminUserListResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Lista de usuários' },
            usuarios: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminUserSummary' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 50 },
                total: { type: 'integer', example: 100 },
                pages: { type: 'integer', example: 2 },
              },
            },
          },
        },
        AdminUserDetail: {
          allOf: [
            { $ref: '#/components/schemas/AdminUserSummary' },
            {
              type: 'object',
              properties: {
                cpf: { type: 'string', example: '12345678900' },
                cnpj: { type: 'string', example: '12345678000199' },
                telefone: { type: 'string', example: '+55 11 99999-0000' },
                dataNasc: {
                  type: 'string',
                  format: 'date',
                  example: '1990-01-01',
                },
                genero: { type: 'string', example: 'MASCULINO' },
                inscricao: { type: 'string', example: 'INS123' },
                supabaseId: { type: 'string', example: 'uuid-supabase' },
                cidade: { type: 'string', nullable: true, example: 'Maceió' },
                estado: { type: 'string', nullable: true, example: 'AL' },
                avatarUrl: {
                  type: 'string',
                  nullable: true,
                  example: 'https://cdn.advance.com.br/avatar.png',
                },
                descricao: {
                  type: 'string',
                  nullable: true,
                  example: 'Empresa focada em soluções tecnológicas para RH.',
                },
                aceitarTermos: {
                  type: 'boolean',
                  example: true,
                  description: 'Indica se o usuário aceitou os termos vigentes durante o cadastro.',
                },
                informacoes: {
                  allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }],
                  description:
                    'Objeto com os dados complementares provenientes da tabela UsuariosInformation.',
                },
                socialLinks: {
                  allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
                  nullable: true,
                },
                codUsuario: { type: 'string', example: 'ABC1234' },
                enderecos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'end-1' },
                      logradouro: { type: 'string', example: 'Rua A' },
                      numero: { type: 'string', example: '100' },
                      bairro: { type: 'string', example: 'Centro' },
                      cidade: { type: 'string', example: 'São Paulo' },
                      estado: { type: 'string', example: 'SP' },
                      cep: { type: 'string', example: '01000-000' },
                    },
                  },
                },
              },
            },
          ],
        },
        AdminUserDetailResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Usuário encontrado' },
            usuario: { $ref: '#/components/schemas/AdminUserDetail' },
          },
        },
        AdminCreateUserBase: {
          type: 'object',
          required: [
            'nomeCompleto',
            'telefone',
            'email',
            'senha',
            'confirmarSenha',
            'tipoUsuario',
          ],
          properties: {
            nomeCompleto: {
              type: 'string',
              example: 'Maria Souza',
              description: 'Nome completo do usuário a ser criado.',
            },
            telefone: {
              type: 'string',
              example: '+55 11 99999-0000',
              description: 'Telefone principal do usuário.',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'maria@example.com',
            },
            senha: {
              type: 'string',
              format: 'password',
              minLength: 8,
              example: 'SenhaForte123',
            },
            confirmarSenha: {
              type: 'string',
              format: 'password',
              example: 'SenhaForte123',
            },
            aceitarTermos: {
              type: 'boolean',
              default: true,
              description: 'Indica se os termos de uso foram aceitos em nome do usuário.',
            },
            supabaseId: {
              type: 'string',
              nullable: true,
              example: 'uuid-gerado',
              description: 'Identificador no Supabase. Se omitido, será gerado automaticamente.',
            },
            tipoUsuario: {
              allOf: [{ $ref: '#/components/schemas/TiposDeUsuarios' }],
            },
            role: {
              allOf: [{ $ref: '#/components/schemas/Roles' }],
              description:
                'Role atribuída ao usuário. Caso não seja informada, será definida automaticamente conforme o tipo.',
            },
            status: {
              type: 'string',
              enum: ['ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
              description: 'Status inicial do usuário. O padrão é ATIVO.',
            },
            redesSociais: {
              allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
              nullable: true,
            },
          },
        },
        AdminCreatePessoaFisica: {
          allOf: [
            { $ref: '#/components/schemas/AdminCreateUserBase' },
            {
              type: 'object',
              required: ['cpf'],
              properties: {
                tipoUsuario: {
                  type: 'string',
                  enum: ['PESSOA_FISICA'],
                  example: 'PESSOA_FISICA',
                },
                cpf: {
                  type: 'string',
                  example: '12345678900',
                  description: 'Documento CPF sem máscara.',
                },
                dataNasc: {
                  type: 'string',
                  format: 'date',
                  nullable: true,
                  example: '1990-05-20',
                },
                genero: {
                  type: 'string',
                  nullable: true,
                  example: 'FEMININO',
                },
              },
            },
          ],
        },
        AdminCreatePessoaJuridica: {
          allOf: [
            { $ref: '#/components/schemas/AdminCreateUserBase' },
            {
              type: 'object',
              required: ['cnpj'],
              properties: {
                tipoUsuario: {
                  type: 'string',
                  enum: ['PESSOA_JURIDICA'],
                  example: 'PESSOA_JURIDICA',
                },
                cnpj: {
                  type: 'string',
                  example: '12345678000199',
                  description: 'Documento CNPJ sem máscara.',
                },
              },
            },
          ],
        },
        AdminCreateUserRequest: {
          oneOf: [
            { $ref: '#/components/schemas/AdminCreatePessoaFisica' },
            { $ref: '#/components/schemas/AdminCreatePessoaJuridica' },
          ],
          discriminator: {
            propertyName: 'tipoUsuario',
          },
        },
        AdminCreateUserResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Usuário criado com sucesso' },
            usuario: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'user-uuid' },
                email: { type: 'string', example: 'maria@example.com' },
                nomeCompleto: { type: 'string', example: 'Maria Souza' },
                tipoUsuario: { allOf: [{ $ref: '#/components/schemas/TiposDeUsuarios' }] },
                role: { allOf: [{ $ref: '#/components/schemas/Roles' }] },
                status: {
                  type: 'string',
                  enum: ['ATIVO', 'INATIVO', 'BLOQUEADO', 'PENDENTE', 'SUSPENSO'],
                  example: 'ATIVO',
                },
                criadoEm: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-15T12:00:00Z',
                },
                codUsuario: { type: 'string', example: 'ABC1234' },
                emailVerificado: { type: 'boolean', example: true },
                emailVerificadoEm: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-15T12:00:05Z',
                },
                socialLinks: {
                  allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
                  nullable: true,
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                correlationId: {
                  type: 'string',
                  nullable: true,
                  example: 'req-123',
                },
                createdBy: {
                  type: 'string',
                  nullable: true,
                  example: 'admin-uuid',
                  description: 'Identificador do administrador responsável pela criação.',
                },
                emailVerificationBypassed: {
                  type: 'boolean',
                  example: true,
                  description: 'Indica que a verificação de email foi dispensada no fluxo administrativo.',
                },
              },
            },
          },
        },
        AdminCandidateDetail: {
          allOf: [
            { $ref: '#/components/schemas/AdminCandidateSummary' },
            {
              type: 'object',
              properties: {
                cpf: { type: 'string', nullable: true, example: '12345678900' },
                telefone: { type: 'string', example: '+55 11 99999-0000' },
                dataNasc: {
                  type: 'string',
                  format: 'date',
                  nullable: true,
                  example: '1990-01-01',
                },
                genero: { type: 'string', nullable: true, example: 'MASCULINO' },
                inscricao: { type: 'string', nullable: true, example: 'INS123' },
                supabaseId: { type: 'string', example: 'uuid-supabase' },
                avatarUrl: {
                  type: 'string',
                  nullable: true,
                  example: 'https://cdn.advance.com.br/avatar.png',
                },
                descricao: {
                  type: 'string',
                  nullable: true,
                  example: 'Profissional com experiência em atendimento.',
                },
                aceitarTermos: {
                  type: 'boolean',
                  example: true,
                  description: 'Confirma o aceite dos termos pelo candidato.',
                },
                informacoes: {
                  allOf: [{ $ref: '#/components/schemas/UsuarioInformacoes' }],
                  description: 'Dados complementares extraídos da entidade UsuariosInformation.',
                },
                socialLinks: {
                  allOf: [{ $ref: '#/components/schemas/UsuarioSocialLinks' }],
                  nullable: true,
                },
                codUsuario: { type: 'string', example: 'CAN1234' },
                enderecos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'end-1' },
                      logradouro: { type: 'string', example: 'Rua A' },
                      numero: { type: 'string', example: '100' },
                      bairro: { type: 'string', example: 'Centro' },
                      cidade: { type: 'string', example: 'São Paulo' },
                      estado: { type: 'string', example: 'SP' },
                      cep: { type: 'string', example: '01000-000' },
                    },
                  },
                },
              },
            },
          ],
        },
        AdminCandidateDetailResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Candidato encontrado' },
            candidato: { $ref: '#/components/schemas/AdminCandidateDetail' },
          },
        },
        AdminCandidateLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'log-uuid' },
            usuarioId: { type: 'string', format: 'uuid', example: 'candidate-uuid' },
            tipo: {
              type: 'string',
              enum: [
                'CURRICULO_CRIADO',
                'CURRICULO_ATUALIZADO',
                'CURRICULO_REMOVIDO',
                'CANDIDATO_ATIVADO',
                'CANDIDATO_DESATIVADO',
                'CANDIDATURA_CRIADA',
                'CANDIDATURA_CANCELADA_CURRICULO',
                'CANDIDATURA_CANCELADA_BLOQUEIO',
              ],
              example: 'CANDIDATURA_CANCELADA_CURRICULO',
            },
            descricao: { type: 'string', nullable: true, example: 'Candidatura cancelada após exclusão do currículo.' },
            metadata: {
              type: 'object',
              nullable: true,
              example: {
                candidaturaId: 'cand-uuid',
                vagaId: 'vaga-uuid',
                curriculoId: 'curriculo-uuid',
                motivo: 'CURRICULO_REMOVIDO',
              },
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-05-01T12:00:00Z',
            },
          },
        },
        AdminCandidateLogListResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Logs do candidato' },
            logs: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminCandidateLog' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 5 },
                pages: { type: 'integer', example: 1 },
              },
            },
          },
        },
        AdminStatusUpdateRequest: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ATIVO' },
            motivo: { type: 'string', example: 'Regularização' },
          },
          required: ['status'],
        },
        AdminStatusUpdateResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Status do usuário atualizado com sucesso',
            },
            usuario: { $ref: '#/components/schemas/AdminUserSummary' },
            statusAnterior: { type: 'string', example: 'SUSPENSO' },
          },
        },
        AdminRoleUpdateRequest: {
          type: 'object',
          properties: {
            role: {
              allOf: [{ $ref: '#/components/schemas/Roles' }],
              example: 'MODERADOR',
            },
            motivo: { type: 'string', example: 'Promoção' },
          },
          required: ['role'],
        },
        AdminRoleUpdateResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Role do usuário atualizada com sucesso',
            },
            usuario: { $ref: '#/components/schemas/AdminUserSummary' },
          },
        },
        UserCoursePaymentRequest: {
          type: 'object',
          properties: {
            cursoId: { type: 'string', example: 'curso-uuid' },
            paymentToken: { type: 'string', example: 'tok_123' },
            paymentMethodId: { type: 'string', example: 'visa' },
            installments: { type: 'integer', example: 1 },
            issuerId: { type: 'string', example: 'issuer' },
          },
          required: ['cursoId', 'paymentToken', 'paymentMethodId'],
        },
        UserCoursePaymentResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Pagamento iniciado com sucesso',
            },
            order: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '123' },
                status: { type: 'string', example: 'pending' },
              },
            },
            curso: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'curso-uuid' },
                titulo: { type: 'string', example: 'Curso X' },
                preco: { type: 'number', example: 100 },
              },
            },
          },
        },
        UserSubscriptionCreateRequest: {
          type: 'object',
          properties: {
            plano: { type: 'string', example: 'plano-premium' },
            cardToken: { type: 'string', example: 'tok_123' },
            frequencia: { type: 'integer', example: 1 },
            periodo: { type: 'string', example: 'months' },
          },
          required: ['plano', 'cardToken'],
        },
        UserSubscriptionCreateResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Assinatura criada' },
            subscription: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'sub-123' },
                status: { type: 'string', example: 'authorized' },
              },
            },
          },
        },
        UserSubscriptionCancelRequest: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', example: 'sub-123' },
            motivo: { type: 'string', example: 'Opção do usuário' },
          },
          required: ['subscriptionId'],
        },
        UserSubscriptionCancelResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Assinatura cancelada' },
          },
        },
        UserPaymentHistoryResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Histórico de pagamentos' },
            orders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'order-1' },
                  status: { type: 'string', example: 'paid' },
                  totalAmount: { type: 'number', example: 100 },
                  criadoEm: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-01T12:00:00Z',
                  },
                },
              },
            },
            subscriptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'sub-1' },
                  status: { type: 'string', example: 'authorized' },
                  transactionAmount: { type: 'number', example: 99.9 },
                  criadoEm: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-01T12:00:00Z',
                  },
                },
              },
            },
          },
        },
        DashboardStatsResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Estatísticas do dashboard' },
            stats: {
              type: 'object',
              additionalProperties: true,
              example: { usuariosTotais: 100, receitaTotal: 1000 },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        UserStatsResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Estatísticas de usuários' },
            stats: {
              type: 'object',
              additionalProperties: true,
              example: { novosUsuarios: 10 },
            },
            periodo: { type: 'string', example: '30d' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        PaymentStatsResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Estatísticas de pagamentos' },
            stats: {
              type: 'object',
              additionalProperties: true,
              example: { totalPagamentos: 100, totalReceita: 5000 },
            },
            periodo: { type: 'string', example: '30d' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
      },
      responses: {},
      parameters: {},
      examples: {},
      requestBodies: {},
      headers: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      links: {},
      callbacks: {},
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desenvolvimento',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/modules/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  const swaggerServeHandlers = swaggerUi.serve as RequestHandler[];

  const resolveSwaggerAsset = (file: string): string => {
    const distPath = path.join(__dirname, file);
    if (fs.existsSync(distPath)) return distPath;
    return path.join(process.cwd(), 'src', 'config', file);
  };

  const swaggerCustomJs = fs.readFileSync(resolveSwaggerAsset('swagger-custom.js'), 'utf8');
  const swaggerCustomCss = fs.readFileSync(resolveSwaggerAsset('swagger-custom.css'), 'utf8');

  app.get('/swagger-custom.js', (_req, res) => {
    res.type('application/javascript').send(swaggerCustomJs);
  });

  app.get('/swagger-custom.css', (_req, res) => {
    res.type('text/css').send(swaggerCustomCss);
  });

  app.use(
    '/docs',
    (req, res, next) => {
      if (req.path === '/login') return next();
      return supabaseAuthMiddleware(['ADMIN'])(req, res, next);
    },
    ...swaggerServeHandlers.map(
      (handler): RequestHandler =>
        (req, res, next) => {
          if (req.path === '/login') return next();
          return handler(req, res, next);
        },
    ),
    ((req, res, next) => {
      if (req.path === '/login') return next();
      return swaggerUi.setup(swaggerSpec, {
        customJs: '/swagger-custom.js',
        customCssUrl: '/swagger-custom.css',
        swaggerOptions: {
          layout: 'BaseLayout',
          tagsSorter: (a: string, b: string) => {
            const order = [
              'Default',
              'Brevo',
              'Usuários',
              'Usuários - Admin',
              'Usuários - Stats',
              'Website',
              'Website - Banner',
              'Website - LogoEnterprises',
              'Website - Slider',
              'Website - Sobre',
              'Website - Consultoria',
              'Website - Recrutamento',
              'Website - SobreEmpresa',
              'Website - Team',
              'Website - Depoimentos',
              'Website - Diferenciais',
              'Website - Planinhas',
              'Website - Advance Ajuda',
              'Website - RecrutamentoSelecao',
              'Website - Sistema',
              'Website - TreinamentoCompany',
              'Website - ConexaoForte',
              'Website - TreinamentosInCompany',
              'Website - InformacoesGerais',
              'Website - ImagemLogin',
              'Website - Header Pages',
              'MercadoPago - Assinaturas',
              // Empresas - após Website - Header Pages
              'Empresas - Planos Empresariais',
              'Empresas - Clientes',
              'Empresas - EmpresasVagas',
              'Empresas - VagasProcessos',
            ];
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            // Tags não listadas vão para o final mantendo ordem alfabética entre elas
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          },
        },
      })(req, res, next);
    }) as RequestHandler,
  );

  app.get('/docs.json', supabaseAuthMiddleware(['ADMIN']), (req, res) => res.json(swaggerSpec));

  app.get('/redoc', supabaseAuthMiddleware(['ADMIN']), (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>Advance+ API - ReDoc</title>
    <meta charset="utf-8" />
    <style>body { margin: 0; padding: 0; }</style>
    <link rel="icon" href="data:," />
  </head>
  <body>
    <redoc spec-url="/docs.json"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
  </body>
</html>`);
  });
}
