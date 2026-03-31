import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import {
  EntrevistaStatus,
  Jornadas,
  ModalidadesDeVagas,
  PrismaClient,
  RegimesDeTrabalhos,
  Roles,
  Senioridade,
  Status,
  StatusDeVagas,
  TiposDeUsuarios,
} from '@prisma/client';
import { randomUUID } from 'crypto';

import { googleCalendarService } from '@/modules/cursos/aulas/services/google-calendar.service';
import { encodeInterviewChannel } from '@/modules/entrevistas/utils/presentation';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const prisma = new PrismaClient();

const MARKER = 'FRONT_ENTREVISTAS_20260330';

type UserSeedInput = {
  email: string;
  password: string;
  nomeCompleto: string;
  role: Roles;
  tipoUsuario: TiposDeUsuarios;
  codUsuario: string;
  cpf?: string | null;
  cnpj?: string | null;
  telefone: string;
  descricao?: string | null;
  cidade?: string | null;
  estado?: string | null;
  bairro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  cep?: string | null;
};

async function ensureUser(input: UserSeedInput) {
  const senhaHash = await bcrypt.hash(input.password, 10);

  const existing = await prisma.usuarios.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  const user = existing
    ? await prisma.usuarios.update({
        where: { email: input.email },
        data: {
          nomeCompleto: input.nomeCompleto,
          senha: senhaHash,
          codUsuario: input.codUsuario,
          tipoUsuario: input.tipoUsuario,
          role: input.role,
          status: Status.ATIVO,
          cpf: input.cpf ?? null,
          cnpj: input.cnpj ?? null,
          atualizadoEm: new Date(),
        },
        select: { id: true, email: true, nomeCompleto: true, codUsuario: true, role: true },
      })
    : await prisma.usuarios.create({
        data: {
          id: randomUUID(),
          authId: `seed-${input.role.toLowerCase()}-${randomUUID()}`,
          nomeCompleto: input.nomeCompleto,
          email: input.email,
          senha: senhaHash,
          codUsuario: input.codUsuario,
          tipoUsuario: input.tipoUsuario,
          role: input.role,
          status: Status.ATIVO,
          cpf: input.cpf ?? null,
          cnpj: input.cnpj ?? null,
          atualizadoEm: new Date(),
        },
        select: { id: true, email: true, nomeCompleto: true, codUsuario: true, role: true },
      });

  await prisma.usuariosInformation.upsert({
    where: { usuarioId: user.id },
    create: {
      usuarioId: user.id,
      telefone: input.telefone,
      descricao: input.descricao ?? null,
      aceitarTermos: true,
    },
    update: {
      telefone: input.telefone,
      descricao: input.descricao ?? null,
      aceitarTermos: true,
    },
  });

  await prisma.usuariosVerificacaoEmail.upsert({
    where: { usuarioId: user.id },
    create: {
      usuarioId: user.id,
      emailVerificado: true,
      emailVerificadoEm: new Date(),
      emailVerificationAttempts: 0,
    },
    update: {
      emailVerificado: true,
      emailVerificadoEm: new Date(),
      emailVerificationAttempts: 0,
    },
  });

  await prisma.usuariosEnderecos.deleteMany({
    where: { usuarioId: user.id },
  });

  if (
    input.cidade ||
    input.estado ||
    input.bairro ||
    input.logradouro ||
    input.numero ||
    input.cep
  ) {
    await prisma.usuariosEnderecos.create({
      data: {
        usuarioId: user.id,
        cidade: input.cidade ?? null,
        estado: input.estado ?? null,
        bairro: input.bairro ?? null,
        logradouro: input.logradouro ?? null,
        numero: input.numero ?? null,
        cep: input.cep ?? null,
      },
    });
  }

  return user;
}

async function ensureStatusProcessoId() {
  const byName = await prisma.statusProcessosCandidatos.findFirst({
    where: {
      nome: 'ENTREVISTA',
      ativo: true,
    },
    select: { id: true, nome: true },
  });

  if (byName) {
    return byName.id;
  }

  const fallback = await prisma.statusProcessosCandidatos.findFirst({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });

  if (!fallback) {
    throw new Error('Nenhum status de processo ativo encontrado.');
  }

  return fallback.id;
}

async function ensureVaga(params: {
  codigo: string;
  slug: string;
  titulo: string;
  usuarioId: string;
  modalidade?: ModalidadesDeVagas;
}) {
  return prisma.empresasVagas.upsert({
    where: { codigo: params.codigo },
    update: {
      slug: params.slug,
      usuarioId: params.usuarioId,
      titulo: params.titulo,
      status: StatusDeVagas.PUBLICADO,
      modalidade: params.modalidade ?? ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      jornada: Jornadas.INTEGRAL,
      senioridade: Senioridade.PLENO,
      descricao: `${MARKER} - Vaga preparada para visualização do dashboard de entrevistas.`,
      requisitos: {
        obrigatorios: ['Comunicação clara', 'Experiência com entrevistas'],
        desejaveis: ['Experiência com dashboard'],
      },
      atividades: {
        principais: ['Conduzir entrevistas', 'Avaliar candidatos'],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição'],
      },
      atualizadoEm: new Date(),
    },
    create: {
      codigo: params.codigo,
      slug: params.slug,
      usuarioId: params.usuarioId,
      titulo: params.titulo,
      status: StatusDeVagas.PUBLICADO,
      modalidade: params.modalidade ?? ModalidadesDeVagas.HIBRIDO,
      regimeDeTrabalho: RegimesDeTrabalhos.CLT,
      jornada: Jornadas.INTEGRAL,
      senioridade: Senioridade.PLENO,
      descricao: `${MARKER} - Vaga preparada para visualização do dashboard de entrevistas.`,
      requisitos: {
        obrigatorios: ['Comunicação clara', 'Experiência com entrevistas'],
        desejaveis: ['Experiência com dashboard'],
      },
      atividades: {
        principais: ['Conduzir entrevistas', 'Avaliar candidatos'],
      },
      beneficios: {
        lista: ['Plano de saúde', 'Vale refeição'],
      },
    },
    select: {
      id: true,
      codigo: true,
      titulo: true,
      usuarioId: true,
    },
  });
}

async function ensureCandidatura(params: {
  vagaId: string;
  candidatoId: string;
  empresaUsuarioId: string;
  statusId: string;
}) {
  const existing = await prisma.empresasCandidatos.findFirst({
    where: {
      vagaId: params.vagaId,
      candidatoId: params.candidatoId,
      empresaUsuarioId: params.empresaUsuarioId,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.empresasCandidatos.update({
      where: { id: existing.id },
      data: {
        statusId: params.statusId,
        atualizadaEm: new Date(),
      },
      select: { id: true, candidatoId: true, vagaId: true, empresaUsuarioId: true },
    });
  }

  return prisma.empresasCandidatos.create({
    data: {
      vagaId: params.vagaId,
      candidatoId: params.candidatoId,
      empresaUsuarioId: params.empresaUsuarioId,
      statusId: params.statusId,
    },
    select: { id: true, candidatoId: true, vagaId: true, empresaUsuarioId: true },
  });
}

async function main() {
  console.log(`🌱 Criando dados do dashboard de entrevistas (${MARKER})...\n`);

  const company = await ensureUser({
    email: 'front.entrevistas.empresa@advancemais.com.br',
    password: 'EmpresaFront@123',
    nomeCompleto: 'Front Entrevistas Labs LTDA',
    role: Roles.EMPRESA,
    tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
    codUsuario: 'EMP-FE01',
    cnpj: '71836792000105',
    telefone: '82990000001',
    descricao: 'Empresa de demonstração para o dashboard de entrevistas.',
    cidade: 'Maceió',
    estado: 'AL',
    bairro: 'Benedito Bentes',
    logradouro: 'Rua Manoel Pedro de Oliveira',
    numero: '245',
    cep: '57084028',
  });

  const recruiter = await ensureUser({
    email: 'front.entrevistas.recrutador@advancemais.com.br',
    password: 'RecrutadorFront@123',
    nomeCompleto: 'Marina Recrutadora Front',
    role: Roles.RECRUTADOR,
    tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
    codUsuario: 'REC-FE01',
    cpf: '68745612009',
    telefone: '82990000002',
    descricao: 'Recrutadora de demonstração para entrevistas.',
    cidade: 'Maceió',
    estado: 'AL',
    bairro: 'Jatiúca',
    logradouro: 'Av. Álvaro Otacílio',
    numero: '300',
    cep: '57035000',
  });

  const baseCandidateInputs: UserSeedInput[] = [
    {
      email: 'front.entrevistas.candidato.online@advancemais.com.br',
      password: 'CandidatoFront@123',
      nomeCompleto: 'João Front Online',
      role: Roles.ALUNO_CANDIDATO,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      codUsuario: 'MAT-FE01',
      cpf: '16324587001',
      telefone: '82990000011',
      descricao: 'Candidato de demonstração para entrevista online.',
      cidade: 'Maceió',
      estado: 'AL',
      bairro: 'Farol',
      logradouro: 'Rua das Flores',
      numero: '101',
      cep: '57051000',
    },
    {
      email: 'front.entrevistas.candidato.presencial@advancemais.com.br',
      password: 'CandidatoFront@123',
      nomeCompleto: 'Maria Front Presencial',
      role: Roles.ALUNO_CANDIDATO,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      codUsuario: 'MAT-FE02',
      cpf: '41793652008',
      telefone: '82990000012',
      descricao: 'Candidata de demonstração para entrevista presencial.',
      cidade: 'Rio Largo',
      estado: 'AL',
      bairro: 'Centro',
      logradouro: 'Rua do Comércio',
      numero: '55',
      cep: '57100000',
    },
    {
      email: 'front.entrevistas.candidato.cancelada@advancemais.com.br',
      password: 'CandidatoFront@123',
      nomeCompleto: 'Ana Front Cancelada',
      role: Roles.ALUNO_CANDIDATO,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      codUsuario: 'MAT-FE03',
      cpf: '27591468050',
      telefone: '82990000013',
      descricao: 'Candidata de demonstração com entrevista cancelada.',
      cidade: 'Arapiraca',
      estado: 'AL',
      bairro: 'Centro',
      logradouro: 'Rua do Sol',
      numero: '88',
      cep: '57300000',
    },
    {
      email: 'front.entrevistas.candidato.elegivel@advancemais.com.br',
      password: 'CandidatoFront@123',
      nomeCompleto: 'Pedro Front Elegível',
      role: Roles.ALUNO_CANDIDATO,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      codUsuario: 'MAT-FE04',
      cpf: '51807462088',
      telefone: '82990000014',
      descricao: 'Candidato elegível sem entrevista ativa para testar o modal.',
      cidade: 'Maceió',
      estado: 'AL',
      bairro: 'Ponta Verde',
      logradouro: 'Rua Verde Mar',
      numero: '40',
      cep: '57035000',
    },
    {
      email: 'front.entrevistas.candidato.internal@advancemais.com.br',
      password: 'CandidatoFront@123',
      nomeCompleto: 'Lucas Front Agenda Interna',
      role: Roles.ALUNO_CANDIDATO,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      codUsuario: 'MAT-FE05',
      cpf: '64315029012',
      telefone: '82990000015',
      descricao: 'Candidato de demonstração para entrevista online sem Meet.',
      cidade: 'Satuba',
      estado: 'AL',
      bairro: 'Centro',
      logradouro: 'Rua da Estação',
      numero: '12',
      cep: '57120000',
    },
  ];

  const generatedCandidateInputs: UserSeedInput[] = Array.from({ length: 22 }, (_, index) => {
    const order = index + 6;
    const cityCycle = ['Maceió', 'Arapiraca', 'Rio Largo', 'Satuba'];
    const bairroCycle = ['Centro', 'Jatiúca', 'Farol', 'Ponta Verde'];
    const city = cityCycle[index % cityCycle.length];
    const bairro = bairroCycle[index % bairroCycle.length];

    return {
      email: `front.entrevistas.candidato.${String(order).padStart(2, '0')}@advancemais.com.br`,
      password: 'CandidatoFront@123',
      nomeCompleto: `Candidato Front ${String(order).padStart(2, '0')}`,
      role: Roles.ALUNO_CANDIDATO,
      tipoUsuario: TiposDeUsuarios.PESSOA_FISICA,
      codUsuario: `MAT-FE${String(order).padStart(2, '0')}`,
      cpf: String(50000000000 + order),
      telefone: `829900001${String(order).padStart(2, '0')}`,
      descricao: `${MARKER} - candidato de demonstração ${order}.`,
      cidade: city,
      estado: 'AL',
      bairro,
      logradouro: `Rua Dashboard ${order}`,
      numero: String(100 + order),
      cep: `570${String(10000 + order).slice(-5)}`,
    };
  });

  const candidates = await Promise.all(
    [...baseCandidateInputs, ...generatedCandidateInputs].map((candidate) => ensureUser(candidate)),
  );

  await prisma.usuariosEmpresasVinculos.upsert({
    where: {
      recrutadorId_empresaUsuarioId: {
        recrutadorId: recruiter.id,
        empresaUsuarioId: company.id,
      },
    },
    create: {
      recrutadorId: recruiter.id,
      empresaUsuarioId: company.id,
    },
    update: {
      atualizadoEm: new Date(),
    },
  });

  const vagaFrontend = await ensureVaga({
    codigo: 'F92001',
    slug: 'front-entrevistas-react',
    titulo: 'Desenvolvedor Frontend React',
    usuarioId: company.id,
    modalidade: ModalidadesDeVagas.HIBRIDO,
  });

  const vagaProduto = await ensureVaga({
    codigo: 'F92002',
    slug: 'front-entrevistas-produto',
    titulo: 'Analista de Produto Digital',
    usuarioId: company.id,
    modalidade: ModalidadesDeVagas.PRESENCIAL,
  });

  for (const vaga of [vagaFrontend, vagaProduto]) {
    await prisma.usuariosVagasVinculos.upsert({
      where: {
        recrutadorId_vagaId: {
          recrutadorId: recruiter.id,
          vagaId: vaga.id,
        },
      },
      create: {
        recrutadorId: recruiter.id,
        vagaId: vaga.id,
      },
      update: {
        atualizadoEm: new Date(),
      },
    });
  }

  const statusProcessoId = await ensureStatusProcessoId();
  const googleMeetSystemUserId =
    process.env.GOOGLE_MEET_SYSTEM_USER_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_SYSTEM_USER_ID?.trim() ||
    null;

  const candidaturas = await Promise.all(
    candidates.map((candidate, index) =>
      ensureCandidatura({
        vagaId: index % 2 === 0 ? vagaFrontend.id : vagaProduto.id,
        candidatoId: candidate.id,
        empresaUsuarioId: company.id,
        statusId: statusProcessoId,
      }),
    ),
  );

  await prisma.empresasVagasEntrevistas.deleteMany({
    where: {
      empresaUsuarioId: company.id,
    },
  });

  const baseDate = new Date('2026-04-02T14:00:00.000Z');
  const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);

  const interviewsToCreate = candidaturas.slice(0, 24).map((candidatura, index) => {
    const candidate = candidates[index];
    const vaga = candidatura.vagaId === vagaFrontend.id ? vagaFrontend : vagaProduto;
    const sequence = index + 1;
    const status = sequence % 5 === 0 ? EntrevistaStatus.CANCELADA : EntrevistaStatus.AGENDADA;
    const modeIndex = sequence % 3;
    const dataInicio = addHours(baseDate, index * 6 - 36);
    const dataFim = addHours(dataInicio, 1);

    if (modeIndex === 1) {
      return {
        mode: 'ONLINE_MEET' as const,
        candidateEmail: candidate.email,
        vagaId: candidatura.vagaId,
        candidatoId: candidatura.candidatoId,
        empresaUsuarioId: company.id,
        recrutadorId: recruiter.id,
        titulo: `${MARKER} | Entrevista Online ${String(sequence).padStart(2, '0')}`,
        descricao: `${MARKER} | Entrevista online com Meet para ${candidate.nomeCompleto} na vaga ${vaga.titulo}.`,
        dataInicio,
        dataFim,
        meetUrl: encodeInterviewChannel({
          modalidade: 'ONLINE',
        }),
        meetEventId: null,
        status,
      };
    }

    if (modeIndex === 2) {
      return {
        mode: 'PRESENCIAL' as const,
        candidateEmail: candidate.email,
        vagaId: candidatura.vagaId,
        candidatoId: candidatura.candidatoId,
        empresaUsuarioId: company.id,
        recrutadorId: recruiter.id,
        titulo: `${MARKER} | Entrevista Presencial ${String(sequence).padStart(2, '0')}`,
        descricao: `${MARKER} | Entrevista presencial para ${candidate.nomeCompleto} na vaga ${vaga.titulo}.`,
        dataInicio,
        dataFim,
        meetUrl: encodeInterviewChannel({
          modalidade: 'PRESENCIAL',
          enderecoPresencial: {
            cep: '57084-028',
            logradouro: 'Rua Manoel Pedro de Oliveira',
            numero: String(200 + sequence),
            complemento: `Sala ${((sequence - 1) % 6) + 1}`,
            bairro: 'Benedito Bentes',
            cidade: 'Maceió',
            estado: 'AL',
            pontoReferencia: 'Próximo ao shopping',
          },
        }),
        meetEventId: null,
        status,
      };
    }

    return {
      mode: 'ONLINE_INTERNAL' as const,
      candidateEmail: candidate.email,
      vagaId: candidatura.vagaId,
      candidatoId: candidatura.candidatoId,
      empresaUsuarioId: company.id,
      recrutadorId: recruiter.id,
      titulo: `${MARKER} | Entrevista Agenda Interna ${String(sequence).padStart(2, '0')}`,
      descricao: `${MARKER} | Entrevista online com agenda interna para ${candidate.nomeCompleto} na vaga ${vaga.titulo}.`,
      dataInicio,
      dataFim,
      meetUrl: encodeInterviewChannel({
        modalidade: 'ONLINE',
      }),
      meetEventId: null,
      status,
    };
  });

  const entrevistas = await Promise.all(
    interviewsToCreate.map(async ({ mode: _mode, candidateEmail: _candidateEmail, ...data }) =>
      prisma.empresasVagasEntrevistas.create({
        data,
        select: { id: true, status: true },
      }),
    ),
  );

  let entrevistasComMeetReal = 0;

  if (googleMeetSystemUserId) {
    for (const [index, entrevista] of entrevistas.entries()) {
      const interviewSeed = interviewsToCreate[index];
      if (!interviewSeed || interviewSeed.mode !== 'ONLINE_MEET') {
        continue;
      }

      if (entrevista.status !== EntrevistaStatus.AGENDADA) {
        continue;
      }

      try {
        const meet = await googleCalendarService.createMeetEvent({
          titulo: interviewSeed.titulo,
          descricao: interviewSeed.descricao,
          dataInicio: interviewSeed.dataInicio,
          dataFim: interviewSeed.dataFim,
          instrutorId: googleMeetSystemUserId,
          alunoEmails: interviewSeed.candidateEmail ? [interviewSeed.candidateEmail] : [],
          requestId: entrevista.id,
          externalReferenceId: entrevista.id,
        });

        await prisma.empresasVagasEntrevistas.update({
          where: { id: entrevista.id },
          data: {
            meetUrl: meet.meetUrl,
            meetEventId: meet.eventId,
          },
        });

        entrevistasComMeetReal++;
      } catch (error: any) {
        console.warn(
          `  ⚠️ Não foi possível criar Meet real para a entrevista ${entrevista.id}: ${error?.message ?? error}`,
        );
      }
    }
  } else {
    console.warn(
      '  ⚠️ GOOGLE_MEET_SYSTEM_USER_ID/GOOGLE_CALENDAR_SYSTEM_USER_ID não configurado. Entrevistas online permanecerão com agenda interna.',
    );
  }

  const entrevistasAgendadas = entrevistas.filter(
    (entrevista) => entrevista.status === EntrevistaStatus.AGENDADA,
  ).length;
  const entrevistasCanceladas = entrevistas.filter(
    (entrevista) => entrevista.status === EntrevistaStatus.CANCELADA,
  ).length;
  const candidaturasSemEntrevistaAtiva = Array.from(
    new Map(
      candidaturas
        .slice(24)
        .concat(candidaturas.filter((_, index) => (index + 1) % 5 === 0))
        .map((candidatura) => [candidatura.id, candidatura]),
    ).values(),
  );

  console.log('✅ Dados criados/atualizados com sucesso.\n');
  console.log('Credenciais para visualizar no frontend:');
  console.log('  SETOR_DE_VAGAS');
  console.log('    email: setor.vagas@advancemais.com.br');
  console.log('    senha: SetorVagas@123');
  console.log('  EMPRESA');
  console.log('    email: front.entrevistas.empresa@advancemais.com.br');
  console.log('    senha: EmpresaFront@123');
  console.log('  RECRUTADOR');
  console.log('    email: front.entrevistas.recrutador@advancemais.com.br');
  console.log('    senha: RecrutadorFront@123');
  console.log('\nTermos para busca no frontend:');
  console.log(`  marcador: ${MARKER}`);
  console.log(`  empresa: ${company.nomeCompleto}`);
  console.log(`  vagas: ${vagaFrontend.titulo} | ${vagaProduto.titulo}`);
  console.log(
    `  candidatos-chave: ${candidates
      .slice(0, 8)
      .map((candidate) => candidate.nomeCompleto)
      .join(' | ')}`,
  );
  console.log('\nResumo:');
  console.log(`  entrevistas criadas: ${entrevistas.length}`);
  console.log(`  entrevistas agendadas: ${entrevistasAgendadas}`);
  console.log(`  entrevistas canceladas: ${entrevistasCanceladas}`);
  console.log(`  entrevistas online com Meet real: ${entrevistasComMeetReal}`);
  console.log(`  candidaturas sem entrevista ativa: ${candidaturasSemEntrevistaAtiva.length}`);
  console.log(
    `    exemplos: ${candidaturasSemEntrevistaAtiva
      .slice(0, 4)
      .map((candidatura) => candidatura.id)
      .join(' | ')}`,
  );
  console.log(`  total de candidatos seedados: ${candidates.length}`);
  console.log('  sugestão de paginação: use pageSize=10 ou pageSize=20 no frontend');
}

main()
  .catch((error) => {
    console.error('❌ Erro ao criar dados do dashboard de entrevistas:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
