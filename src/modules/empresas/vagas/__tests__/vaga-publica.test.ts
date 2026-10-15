jest.mock('@/config/prisma', () => ({
  prisma: {
    empresasVagas: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('@/modules/empresas/vagas/services/status-sync.service', () => ({
  syncExpiredPublishedVagas: jest.fn(),
}));

import { prisma } from '@/config/prisma';
import { vagasService } from '../services/vagas.service';
import { VagasController } from '../controllers/vagas.controller';

const db = prisma as any;

const empresaBruta = {
  id: 'empresa-1',
  nomeCompleto: 'Empresa Real LTDA',
  cnpj: '12345678000199',
  codUsuario: 'EMP-001',
  role: 'EMPRESA',
  tipoUsuario: 'PESSOA_JURIDICA',
  UsuariosInformation: {
    telefone: '82999990000',
    genero: null,
    dataNasc: null,
    inscricao: null,
    avatarUrl: 'https://cdn/logo.png',
    descricao: 'Sobre a empresa',
    aceitarTermos: true,
  },
  UsuariosRedesSociais: null,
  UsuariosEnderecos: [
    {
      id: 'e1',
      logradouro: 'Rua X',
      numero: '1',
      bairro: 'B',
      cidade: 'Maceió',
      estado: 'AL',
      cep: '57000000',
    },
  ],
};

const vaga = (modoAnonimo: boolean) => ({
  id: 'abcde-1234',
  usuarioId: 'empresa-1',
  status: 'PUBLICADO',
  titulo: 'Assistente Fiscal',
  modoAnonimo,
  destaque: false,
  EmpresasVagasDestaque: null,
  CandidatosAreasInteresse: null,
  CandidatosSubareasInteresse: null,
  motivoRejeicao: null,
  observacoesAprovacao: null,
  moderadaEm: null,
  Usuarios: empresaBruta,
});

beforeEach(() => jest.clearAllMocks());

describe('vaga pública (site e candidatos)', () => {
  it('confidencial: não identifica a empresa de jeito nenhum', async () => {
    db.empresasVagas.findFirst.mockResolvedValue(vaga(true));
    const publica: any = await vagasService.get('abcde-1234');
    const texto = JSON.stringify(publica);
    expect(texto).not.toContain('Empresa Real');
    expect(texto).not.toContain('12345678000199');
    expect(texto).not.toContain('82999990000');
    expect(texto).not.toContain('EMP-001');
    expect(texto).not.toContain('Rua X');
    expect(texto).not.toContain('empresa-1');
    expect(publica.empresa).toMatchObject({ id: null, modoAnonimo: true });
    expect(publica.empresa.nome).toMatch(/^Oportunidade Confidencial/);
    expect(publica).not.toHaveProperty('Usuarios');
  });

  it('identificada: mostra a vitrine, mas não o cadastro bruto nem o telefone', async () => {
    db.empresasVagas.findFirst.mockResolvedValue(vaga(false));
    const publica: any = await vagasService.get('abcde-1234');
    expect(publica.empresa).toMatchObject({
      nome: 'Empresa Real LTDA',
      avatarUrl: 'https://cdn/logo.png',
      modoAnonimo: false,
      informacoes: null,
    });
    expect(publica).not.toHaveProperty('Usuarios');
    expect(JSON.stringify(publica)).not.toContain('82999990000');
  });

  it('listagem pública também sai sem o cadastro bruto', async () => {
    db.empresasVagas.findMany.mockResolvedValue([vaga(true), vaga(false)]);
    const lista: any[] = await vagasService.list({});
    for (const item of lista) {
      expect(item).not.toHaveProperty('Usuarios');
      expect(JSON.stringify(item)).not.toContain('82999990000');
    }
  });
});

describe('painel (equipe, empresa dona, recrutador)', () => {
  it('continua com os dados completos da empresa, mesmo em vaga confidencial', async () => {
    db.empresasVagas.findFirst.mockResolvedValue(vaga(true));
    const interna: any = await vagasService.getForInternalViewer({ id: 'abcde-1234' });
    expect(interna.empresa.nome).toBe('Empresa Real LTDA');
    expect(interna.empresa.informacoes.telefone).toBe('82999990000');
    expect(interna.Usuarios).toBeDefined();
    expect(interna.usuarioId).toBe('empresa-1');
  });

  it('listagem da equipe vem completa', async () => {
    db.empresasVagas.findMany.mockResolvedValue([vaga(true)]);
    const [item]: any[] = await vagasService.list({ interno: true });
    expect(item.empresa.nome).toBe('Empresa Real LTDA');
  });
});

describe('cache da listagem', () => {
  const res = () =>
    ({
      set: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    }) as any;

  it('público: confere com o servidor a cada uso (vaga despublicada some na hora)', async () => {
    db.empresasVagas.findMany.mockResolvedValue([]);
    const r = res();
    await VagasController.list({ query: {}, headers: {} } as any, r);
    expect(r.set).toHaveBeenLastCalledWith('Cache-Control', 'public, no-cache');
  });

  it('com login: privado, nunca em cache compartilhado', async () => {
    db.empresasVagas.findMany.mockResolvedValue([]);
    const r = res();
    await VagasController.list(
      { query: {}, headers: {}, user: { id: 'admin-1', role: 'ADMIN' } } as any,
      r,
    );
    expect(r.set).toHaveBeenLastCalledWith('Cache-Control', 'private, no-cache');
  });
});
