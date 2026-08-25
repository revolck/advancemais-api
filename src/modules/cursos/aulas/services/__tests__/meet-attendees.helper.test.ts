jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/modules/configuracoes-gerais', () => ({
  runtimeConfigService: {
    getGoogleMeetInstitutionalEmails: jest.fn(),
  },
}));

import { prisma } from '@/config/prisma';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';
import {
  buildAttendeeGroups,
  resolveInstrutorAttendeeIds,
  resolveOrganizadorId,
} from '../meet-attendees.helper';

const mockedFindMany = prisma.usuarios.findMany as jest.Mock;
const mockedInstitutionalEmails =
  runtimeConfigService.getGoogleMeetInstitutionalEmails as jest.Mock;

describe('meet-attendees.helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveOrganizadorId', () => {
    it('prioriza o instrutor do item sobre o da turma', () => {
      const organizadorId = resolveOrganizadorId('item-instrutor', {
        instrutorId: 'turma-instrutor',
        CursosTurmasInstrutores: [{ instrutorId: 'co-instrutor' }],
      });
      expect(organizadorId).toBe('item-instrutor');
    });

    it('cai para o instrutor principal da turma quando o item não tem instrutor', () => {
      const organizadorId = resolveOrganizadorId(null, {
        instrutorId: 'turma-instrutor',
        CursosTurmasInstrutores: [],
      });
      expect(organizadorId).toBe('turma-instrutor');
    });

    it('cai para um co-instrutor da turma quando não há instrutor principal', () => {
      const organizadorId = resolveOrganizadorId(undefined, {
        instrutorId: null,
        CursosTurmasInstrutores: [{ instrutorId: 'co-instrutor' }],
      });
      expect(organizadorId).toBe('co-instrutor');
    });

    it('retorna null quando não há nenhum instrutor resolvível', () => {
      const organizadorId = resolveOrganizadorId(null, {
        instrutorId: null,
        CursosTurmasInstrutores: [],
      });
      expect(organizadorId).toBeNull();
    });
  });

  describe('resolveInstrutorAttendeeIds', () => {
    it('combina item + turma + co-instrutores sem duplicatas', () => {
      const ids = resolveInstrutorAttendeeIds('item-instrutor', {
        instrutorId: 'item-instrutor',
        CursosTurmasInstrutores: [
          { instrutorId: 'co-instrutor' },
          { instrutorId: 'item-instrutor' },
        ],
      });
      expect(ids.sort()).toEqual(['co-instrutor', 'item-instrutor'].sort());
    });
  });

  describe('buildAttendeeGroups', () => {
    it('separa convidados normais de adicionais silenciosos, sem duplicar e-mails já convidados', async () => {
      mockedFindMany
        .mockResolvedValueOnce([{ email: 'instrutor@example.com' }]) // busca de instrutores
        .mockResolvedValueOnce([
          { email: 'admin@example.com' },
          { email: 'instrutor@example.com' }, // já é convidado como instrutor — não deve duplicar
        ]); // busca de ADMIN/MODERADOR/PEDAGOGICO
      mockedInstitutionalEmails.mockResolvedValue([
        'aulas@advancerh.page',
        'admin@example.com', // também já está nos gestores — não deve duplicar
      ]);

      const { convidados, adicionaisSilenciosos } = await buildAttendeeGroups({
        alunoEmails: ['aluno@example.com'],
        instrutorIds: ['instrutor-id'],
      });

      expect(convidados.sort()).toEqual(['aluno@example.com', 'instrutor@example.com'].sort());
      expect(adicionaisSilenciosos.sort()).toEqual(
        ['admin@example.com', 'aulas@advancerh.page'].sort(),
      );
    });

    it('não consulta instrutores quando a lista de ids está vazia', async () => {
      mockedFindMany.mockResolvedValueOnce([]);
      mockedInstitutionalEmails.mockResolvedValue([]);

      await buildAttendeeGroups({ alunoEmails: [], instrutorIds: [] });

      expect(mockedFindMany).toHaveBeenCalledTimes(1);
    });
  });
});
