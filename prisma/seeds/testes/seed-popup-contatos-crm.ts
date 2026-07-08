import {
  PrismaClient,
  WebsitePopupLeadInterestSource,
  WebsitePopupLeadOpportunityStatus,
  WebsitePopupLeadStatus,
} from '@prisma/client';
import { assertTestSeedEnvironment } from './assert-test-seed';

const CRM_POPUP_TAG = 'crm-seed';

type SeedPopupDefinition = {
  nome: string;
  templateSlug: string;
  title: string;
  subtitle: string;
  buttonText: string;
  backgroundColor: string;
};

type SeedContactDefinition = {
  popupName: string;
  nome: string;
  email: string;
  telefone: string;
  whatsapp: string;
  origemPath: string;
  payload: Record<string, unknown>;
  createdAtOffsetMinutes: number;
};

const popupDefinitions: SeedPopupDefinition[] = [
  {
    nome: 'CRM Lead Seed Newsletter',
    templateSlug: 'newsletter-seed',
    title: 'Receba novidades em primeira mão',
    subtitle: 'Lead de teste para validar listagem, histórico e CRM.',
    buttonText: 'Cadastrar',
    backgroundColor: '#f8fafc',
  },
  {
    nome: 'CRM Lead Seed Roleta',
    templateSlug: 'roulette-seed',
    title: 'Gire para tentar liberar um benefício',
    subtitle: 'Pop-up de roleta para validar cenários de captação.',
    buttonText: 'Girar agora',
    backgroundColor: '#eef6ff',
  },
];

const contactDefinitions: SeedContactDefinition[] = [
  {
    popupName: 'CRM Lead Seed Newsletter',
    nome: 'Lead CRM Automatizado',
    email: 'lead-crm-seed@example.com',
    telefone: '82999990001',
    whatsapp: '82988880001',
    origemPath: '/newsletter/e2e',
    payload: {
      campanha: 'Newsletter E2E',
      origem: 'seed',
    },
    createdAtOffsetMinutes: 10,
  },
  {
    popupName: 'CRM Lead Seed Newsletter',
    nome: 'Lead CRM Automatizado',
    email: 'lead-crm-seed@example.com',
    telefone: '82999990001',
    whatsapp: '82988880001',
    origemPath: '/newsletter/e2e/segunda-captura',
    payload: {
      campanha: 'Newsletter E2E',
      origem: 'seed-retorno',
    },
    createdAtOffsetMinutes: 2,
  },
  {
    popupName: 'CRM Lead Seed Roleta',
    nome: 'Lead Popup Seed',
    email: 'lead-popup-seed@example.com',
    telefone: '82999990002',
    whatsapp: '82988880002',
    origemPath: '/popup/roleta',
    payload: {
      premio: '15% OFF',
      origem: 'roleta-seed',
    },
    createdAtOffsetMinutes: 5,
  },
];

function buildPopupBuilderTree(title: string, subtitle: string, buttonText: string) {
  return {
    id: 'root_builder',
    kind: 'ROOT',
    structure: 'SINGLE',
    reverse: false,
    areas: [
      {
        id: 'area_main',
        kind: 'AREA',
        children: [
          {
            id: 'title_primary',
            kind: 'ATOMIC',
            type: 'TITLE',
            content: title,
          },
          {
            id: 'paragraph_primary',
            kind: 'ATOMIC',
            type: 'PARAGRAPH',
            content: subtitle,
          },
          {
            id: 'email_primary',
            kind: 'ATOMIC',
            type: 'INPUT',
            inputKind: 'EMAIL',
            label: 'Email',
            placeholder: 'seuemail@exemplo.com',
            required: true,
          },
          {
            id: 'button_primary',
            kind: 'ATOMIC',
            type: 'BUTTON',
            content: buttonText,
          },
        ],
      },
    ],
  };
}

function buildContactKey(input: {
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
}) {
  const email = input.email?.trim().toLowerCase();
  if (email) return `email:${email}`;

  const telefone = input.telefone?.replace(/\D/g, '');
  if (telefone) return `phone:${telefone}`;

  const whatsapp = input.whatsapp?.replace(/\D/g, '');
  if (whatsapp) return `whatsapp:${whatsapp}`;

  return null;
}

export async function seedPopupContatosCrm(prisma?: PrismaClient) {
  assertTestSeedEnvironment('seed-popup-contatos-crm');

  const client = prisma ?? new PrismaClient();
  console.log('🎯 Iniciando seed de pop-ups e contatos CRM...');

  const admin = await client.usuarios.findFirst({
    where: {
      email: 'admin.teste@advancemais.com.br',
    },
    select: {
      id: true,
    },
  });

  if (!admin) {
    throw new Error('Administrador de teste não encontrado para o seed de CRM.');
  }

  const contactKeys = contactDefinitions
    .map((definition) => buildContactKey(definition))
    .filter((value): value is string => Boolean(value));

  await client.websitePopupLeadOpportunity.deleteMany({
    where: {
      OR: [
        {
          Lead: {
            tag: CRM_POPUP_TAG,
          },
        },
        {
          Lead: {
            contactKey: {
              in: contactKeys,
            },
          },
        },
      ],
    },
  });
  await client.websitePopupLeadInterest.deleteMany({
    where: {
      OR: [
        {
          Lead: {
            tag: CRM_POPUP_TAG,
          },
        },
        {
          Lead: {
            contactKey: {
              in: contactKeys,
            },
          },
        },
      ],
    },
  });
  await client.websitePopupLeadNote.deleteMany({
    where: {
      OR: [
        {
          Lead: {
            tag: CRM_POPUP_TAG,
          },
        },
        {
          Lead: {
            contactKey: {
              in: contactKeys,
            },
          },
        },
      ],
    },
  });
  await client.websitePopupLead.deleteMany({
    where: {
      OR: [
        { tag: CRM_POPUP_TAG },
        {
          contactKey: {
            in: contactKeys,
          },
        },
      ],
    },
  });
  await client.websitePopupContato.deleteMany({
    where: {
      tag: CRM_POPUP_TAG,
    },
  });
  await client.websitePopup.deleteMany({
    where: {
      tag: CRM_POPUP_TAG,
    },
  });

  const popupMap = new Map<string, { id: string; nome: string }>();

  for (const definition of popupDefinitions) {
    const popup = await client.websitePopup.create({
      data: {
        nome: definition.nome,
        templateSlug: definition.templateSlug,
        status: 'PUBLICADO',
        dispositivo: 'AMBOS',
        escopo: 'WEBSITE',
        posicaoDesktop: 'CENTRO',
        posicaoMobile: 'CENTRO',
        gatilho: 'ATRASO',
        atrasoSegundos: 5,
        inatividadeSegundos: null,
        scrollPercentual: null,
        seletorAlvo: null,
        triggerTarget: null,
        cronograma: 'EXIBIR_AGORA',
        inicioEm: null,
        fimEm: null,
        frequencia: 'UMA_VEZ_A_CADA_6_HORAS',
        tag: CRM_POPUP_TAG,
        redirectUrl: null,
        redirectNovaAba: false,
        prioridade: 0,
        contentConfig: {
          titulo: definition.title,
          subtitulo: definition.subtitle,
          botaoTexto: definition.buttonText,
          textoLegal: 'Concordo em receber comunicações da Advance+.',
          builderTree: buildPopupBuilderTree(
            definition.title,
            definition.subtitle,
            definition.buttonText,
          ),
        },
        formFields: [
          {
            id: 'email',
            type: 'email',
            label: 'Email',
            placeholder: 'seuemail@exemplo.com',
            required: true,
            order: 0,
          },
        ],
        designConfig: {
          backgroundColor: definition.backgroundColor,
          layout: 'SEM_PLANO_DE_FUNDO',
          imageUrl: null,
          imageAlt: null,
          imageDisposition: 'PREENCHER',
          imagePosition: 'CENTRO',
          imageProportion: '50',
          showImageOnMobile: true,
        },
        subscriptionConfig: {
          email: 'QUALQUER_UM',
          whatsapp: 'QUALQUER_UM',
        },
        pageRules: {
          mode: 'ALL_PAGES',
          urlContains: '',
          htmlSelector: '',
          pageKey: null,
        },
        criadoPorId: admin.id,
        atualizadoPorId: admin.id,
      },
      select: {
        id: true,
        nome: true,
      },
    });

    popupMap.set(definition.nome, popup);
  }

  const now = Date.now();

  for (const definition of contactDefinitions) {
    const popup = popupMap.get(definition.popupName);

    if (!popup) {
      throw new Error(`Pop-up de seed não encontrado: ${definition.popupName}`);
    }

    await client.websitePopupContato.create({
      data: {
        popupId: popup.id,
        popupNome: popup.nome,
        usuarioId: null,
        contactKey: buildContactKey(definition),
        nome: definition.nome,
        email: definition.email.toLowerCase(),
        telefone: definition.telefone,
        whatsapp: definition.whatsapp,
        tag: CRM_POPUP_TAG,
        payload: {
          ...definition.payload,
          nome: definition.nome,
          email: definition.email,
          telefone: definition.telefone,
          whatsapp: definition.whatsapp,
        },
        origemPath: definition.origemPath,
        userAgent: 'seed-script',
        ipHash: `seed-${definition.email}`,
        criadoEm: new Date(now - definition.createdAtOffsetMinutes * 60_000),
      },
    });
  }

  const groupedContacts = await client.websitePopupContato.findMany({
    where: {
      tag: CRM_POPUP_TAG,
      removidoEm: null,
    },
    orderBy: {
      criadoEm: 'asc',
    },
    select: {
      id: true,
      contactKey: true,
      nome: true,
      email: true,
      telefone: true,
      whatsapp: true,
      tag: true,
      origemPath: true,
      popupId: true,
      popupNome: true,
      criadoEm: true,
    },
  });

  const groups = new Map<string, typeof groupedContacts>();
  groupedContacts.forEach((contact) => {
    const key = contact.contactKey ?? `isolated:${contact.id}`;
    const current = groups.get(key) ?? [];
    current.push(contact);
    groups.set(key, current);
  });

  for (const [contactKey, records] of groups.entries()) {
    const first = records[0];
    const last = records[records.length - 1];

    const lead = await client.websitePopupLead.create({
      data: {
        contactKey,
        nome: last.nome,
        email: last.email,
        telefone: last.telefone,
        whatsapp: last.whatsapp,
        empresa: last.email === 'lead-popup-seed@example.com' ? 'Advance Seed Company' : null,
        dataNascimento:
          last.email === 'lead-popup-seed@example.com' ? new Date('1994-03-18') : null,
        endereco: null,
        cidade: 'Maceió',
        estado: 'AL',
        tag: CRM_POPUP_TAG,
        status: WebsitePopupLeadStatus.NOVO,
        ownerUsuarioId: admin.id,
        origemPrincipal: last.origemPath,
        ultimoPopupId: last.popupId,
        ultimoPopupNome: last.popupNome,
        primeiraCapturaEm: first.criadoEm,
        ultimaCapturaEm: last.criadoEm,
        removidoEm: null,
      },
    });

    await client.websitePopupLeadNote.create({
      data: {
        leadId: lead.id,
        autorUsuarioId: admin.id,
        conteudo: `Lead de seed gerado para validar CRM e histórico (${records.length} inscrição(ões)).`,
      },
    });

    await client.websitePopupLeadInterest.createMany({
      data: [
        {
          leadId: lead.id,
          label: 'popup-seed',
          source: WebsitePopupLeadInterestSource.MANUAL,
        },
        {
          leadId: lead.id,
          label: last.popupNome ?? 'popup',
          source: WebsitePopupLeadInterestSource.AUTO,
        },
      ],
      skipDuplicates: true,
    });

    await client.websitePopupLeadOpportunity.create({
      data: {
        leadId: lead.id,
        titulo:
          last.email === 'lead-popup-seed@example.com'
            ? 'Oportunidade de qualificação via roleta'
            : 'Oportunidade de newsletter ativa',
        status: WebsitePopupLeadOpportunityStatus.ABERTA,
        valorEsperado: 1500,
        closeDate: new Date(now + 14 * 24 * 60 * 60 * 1000),
        descricao: 'Registro inicial para validar o fluxo de oportunidades do CRM.',
        ownerUsuarioId: admin.id,
      },
    });
  }

  console.log(
    `✅ Seed CRM finalizado: ${popupDefinitions.length} pop-up(s), ${contactDefinitions.length} captura(s) e ${groups.size} lead(s).`,
  );

  if (!prisma) {
    await client.$disconnect();
  }
}
