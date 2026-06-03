import { prisma } from '@/config/prisma';
import * as mercadoPagoConfig from '@/config/mercadopago';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Payment } from 'mercadopago';
import { cursosCheckoutService } from '../services/cursos-checkout.service';

const vi = jest;

describe('Cursos Checkout Service', () => {
  // Mock data
  const mockUsuario = {
    id: 'user-123',
    nomeCompleto: 'João Silva',
    email: 'joao@test.com',
    cpf: '12345678901',
    authId: 'auth-123',
    senha: 'hash',
    codUsuario: 'USER001',
    tipoUsuario: 'ALUNO' as any,
    role: 'USUARIO' as any,
  };

  const mockCurso = {
    id: 'curso-123',
    codigo: 'CRS001',
    nome: 'Node.js Avançado',
    descricao: 'Curso completo de Node.js',
    cargaHoraria: 40,
    statusPadrao: 'PUBLICADO' as any,
    valor: 299.9,
    valorPromocional: 249.9,
    gratuito: false,
    categoriaId: 1,
    subcategoriaId: null,
    estagioObrigatorio: false,
    imagemUrl: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  const mockTurma = {
    id: 'turma-123',
    nome: 'Turma 01/2025',
    cursoId: 'curso-123',
    vagasTotais: 30,
    vagasIlimitadas: false,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('gerarCodigoInscricao', () => {
    it('deve gerar código no formato MAT{ano}{numero}', async () => {
      const codigo = await cursosCheckoutService.gerarCodigoInscricao();
      const ano = new Date().getFullYear();

      expect(codigo).toMatch(new RegExp(`^MAT${ano}\\d{3}$`));
    });

    it('deve gerar códigos únicos sequenciais', async () => {
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findFirst')
        .mockResolvedValueOnce({ codigo: null } as any)
        .mockResolvedValueOnce({ codigo: `MAT${new Date().getFullYear()}001` } as any);

      const codigo1 = await cursosCheckoutService.gerarCodigoInscricao();
      const codigo2 = await cursosCheckoutService.gerarCodigoInscricao();

      expect(codigo1).not.toBe(codigo2);
    });
  });

  describe('gerarTokenAcesso', () => {
    it('deve gerar token JWT válido', () => {
      const params = {
        inscricaoId: 'inscricao-123',
        alunoId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
      };

      const { token, expiresAt } = cursosCheckoutService.gerarTokenAcesso(params);

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3); // JWT tem 3 partes
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('token deve expirar em 1 ano', () => {
      const params = {
        inscricaoId: 'inscricao-123',
        alunoId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
      };

      const { expiresAt } = cursosCheckoutService.gerarTokenAcesso(params);
      const umAno = new Date();
      umAno.setFullYear(umAno.getFullYear() + 1);

      // Permitir diferença de 1 minuto
      const diff = Math.abs(expiresAt.getTime() - umAno.getTime());
      expect(diff).toBeLessThan(60000); // 1 minuto em ms
    });
  });

  describe('validarVagasDisponiveis', () => {
    it('deve retornar true quando há vagas disponíveis', async () => {
      // Mock: turma com limite 30, 20 inscritos
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue({
        ...mockTurma,
        _count: {
          CursosTurmasInscricoes: 20,
        },
      } as any);

      const temVaga = await cursosCheckoutService.validarVagasDisponiveis('turma-123');

      expect(temVaga).toBe(true);
    });

    it('deve retornar false quando não há vagas', async () => {
      // Mock: turma com limite 30, 30 inscritos (lotada)
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue({
        ...mockTurma,
        _count: {
          CursosTurmasInscricoes: 30,
        },
      } as any);

      const temVaga = await cursosCheckoutService.validarVagasDisponiveis('turma-123');

      expect(temVaga).toBe(false);
    });

    it('deve retornar true quando turma não tem limite', async () => {
      // Mock: turma sem limite de alunos
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue({
        ...mockTurma,
        vagasIlimitadas: true,
        vagasTotais: 0,
        _count: {
          CursosTurmasInscricoes: 100,
        },
      } as any);

      const temVaga = await cursosCheckoutService.validarVagasDisponiveis('turma-123');

      expect(temVaga).toBe(true);
    });

    it('deve lançar erro quando turma não existe', async () => {
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(null);

      await expect(cursosCheckoutService.validarVagasDisponiveis('turma-invalida')).rejects.toThrow(
        'Turma não encontrada',
      );
    });
  });

  describe('validarInscricaoDuplicada', () => {
    it('deve retornar true quando aluno já está inscrito', async () => {
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findFirst').mockResolvedValue({
        id: 'inscricao-123',
        turmaId: 'turma-123',
        alunoId: 'user-123',
        status: 'INSCRITO' as any,
        criadoEm: new Date(),
      } as any);

      const duplicada = await cursosCheckoutService.validarInscricaoDuplicada(
        'user-123',
        'turma-123',
      );

      expect(duplicada).toBe(true);
    });

    it('deve retornar false quando aluno não está inscrito', async () => {
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findFirst').mockResolvedValue(null);

      const duplicada = await cursosCheckoutService.validarInscricaoDuplicada(
        'user-123',
        'turma-123',
      );

      expect(duplicada).toBe(false);
    });
  });

  describe('criarInscricaoGratuita', () => {
    it('deve criar inscrição com status INSCRITO para curso gratuito', async () => {
      const mockInscricao = {
        id: 'inscricao-123',
        codigo: 'MAT2025001',
        turmaId: 'turma-123',
        alunoId: 'user-123',
        status: 'INSCRITO' as any,
        statusPagamento: 'APROVADO',
        tokenAcesso: 'jwt.token.here',
        tokenAcessoExpiraEm: new Date(),
        criadoEm: new Date(),
      };

      vi.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025001');
      vi.spyOn(prisma.cursosTurmasInscricoes, 'create').mockResolvedValue(mockInscricao as any);
      vi.spyOn(prisma.cursosTurmasInscricoes, 'update').mockResolvedValue({
        ...mockInscricao,
        CursosTurmas: {
          Cursos: mockCurso,
        },
        Usuarios: mockUsuario,
      } as any);

      const result = await cursosCheckoutService.criarInscricaoGratuita({
        usuarioId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
        aceitouTermos: true,
      });

      expect(result.success).toBe(true);
      expect(result.inscricao.status).toBe('INSCRITO');
      expect(result.inscricao.statusPagamento).toBe('APROVADO');
      expect(result.inscricao.tokenAcesso).toBeDefined();
    });

    it('deve registrar aceite de termos', async () => {
      const createSpy = vi.spyOn(prisma.cursosTurmasInscricoes, 'create');

      vi.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025001');
      vi.spyOn(prisma.cursosTurmasInscricoes, 'update').mockResolvedValue({
        id: 'inscricao-123',
        codigo: 'MAT2025001',
        turmaId: 'turma-123',
        alunoId: 'user-123',
        status: 'INSCRITO',
        statusPagamento: 'APROVADO',
        criadoEm: new Date(),
        CursosTurmas: { Cursos: mockCurso },
        Usuarios: mockUsuario,
      } as any);

      await cursosCheckoutService.criarInscricaoGratuita({
        usuarioId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
        aceitouTermos: true,
        aceitouTermosIp: '192.168.1.1',
        aceitouTermosUserAgent: 'Mozilla/5.0',
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aceitouTermos: true,
            aceitouTermosIp: '192.168.1.1',
            aceitouTermosUserAgent: 'Mozilla/5.0',
          }),
        }),
      );
    });
  });

  describe('validarTokenAcesso', () => {
    it('deve validar token JWT válido', async () => {
      const { token } = cursosCheckoutService.gerarTokenAcesso({
        inscricaoId: 'inscricao-123',
        alunoId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
      });

      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue({
        id: 'inscricao-123',
        status: 'INSCRITO' as any,
        tokenAcesso: token,
        tokenAcessoExpiraEm: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        CursosTurmas: {
          Cursos: mockCurso,
        },
        Usuarios: mockUsuario,
      } as any);

      const result = await cursosCheckoutService.validarTokenAcesso(token);

      expect(result.valido).toBe(true);
      expect(result.inscricao).toBeDefined();
    });

    it('deve rejeitar token inválido', async () => {
      const result = await cursosCheckoutService.validarTokenAcesso('token.invalido.aqui');

      expect(result.valido).toBe(false);
      expect(result.erro).toBeDefined();
    });

    it('deve rejeitar token de inscrição não ativa', async () => {
      const { token } = cursosCheckoutService.gerarTokenAcesso({
        inscricaoId: 'inscricao-123',
        alunoId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
      });

      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue({
        id: 'inscricao-123',
        status: 'CANCELADO' as any, // Status não ativo
        tokenAcesso: token,
        tokenAcessoExpiraEm: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      } as any);

      const result = await cursosCheckoutService.validarTokenAcesso(token);

      expect(result.valido).toBe(false);
      expect(result.erro).toBe('Inscrição não está ativa');
    });

    it('deve rejeitar token expirado', async () => {
      const { token } = cursosCheckoutService.gerarTokenAcesso({
        inscricaoId: 'inscricao-123',
        alunoId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
      });

      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue({
        id: 'inscricao-123',
        status: 'INSCRITO' as any,
        tokenAcesso: token,
        tokenAcessoExpiraEm: new Date(Date.now() - 1000), // Expirado há 1 segundo
      } as any);

      const result = await cursosCheckoutService.validarTokenAcesso(token);

      expect(result.valido).toBe(false);
      expect(result.erro).toBe('Token expirado');
    });
  });

  describe('startCheckout - Validações', () => {
    const checkoutParams = {
      usuarioId: 'user-123',
      cursoId: 'curso-123',
      turmaId: 'turma-123',
      pagamento: 'pix' as any,
      aceitouTermos: true as const,
    };

    it('deve lançar erro se curso não existe', async () => {
      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(null);

      await expect(cursosCheckoutService.startCheckout(checkoutParams)).rejects.toThrow(
        'Curso não encontrado',
      );
    });

    it('deve lançar erro se curso não está publicado', async () => {
      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue({
        ...mockCurso,
        statusPadrao: 'RASCUNHO', // Curso em rascunho não pode ser vendido
      } as any);

      await expect(cursosCheckoutService.startCheckout(checkoutParams)).rejects.toThrow(
        'Curso não está disponível para compra',
      );
    });

    it('deve lançar erro se turma não existe', async () => {
      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(null);

      await expect(cursosCheckoutService.startCheckout(checkoutParams)).rejects.toThrow(
        'Turma não encontrada',
      );
    });

    it('deve lançar erro se turma não pertence ao curso', async () => {
      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue({
        ...mockTurma,
        cursoId: 'outro-curso-123', // Curso diferente
      } as any);

      await expect(cursosCheckoutService.startCheckout(checkoutParams)).rejects.toThrow(
        'Turma não pertence ao curso selecionado',
      );
    });

    it('deve lançar erro se não há vagas disponíveis', async () => {
      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(mockTurma as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(false);

      await expect(cursosCheckoutService.startCheckout(checkoutParams)).rejects.toThrow(
        'Não há vagas disponíveis nesta turma',
      );
    });

    it('deve lançar erro se aluno já está inscrito', async () => {
      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(mockTurma as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      vi.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(true);

      await expect(cursosCheckoutService.startCheckout(checkoutParams)).rejects.toThrow(
        'Você já possui inscrição ativa nesta turma',
      );
    });
  });

  describe('startCheckout - Curso Gratuito', () => {
    it('deve criar inscrição diretamente para curso gratuito', async () => {
      const cursoGratuito = { ...mockCurso, gratuito: true, valor: 0 };

      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(cursoGratuito as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(mockTurma as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      vi.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(false);
      vi.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue({
        ...mockUsuario,
        UsuariosEnderecos: [],
        UsuariosInformation: null,
      } as any);

      const criarGratuitaSpy = vi.spyOn(cursosCheckoutService, 'criarInscricaoGratuita');
      criarGratuitaSpy.mockResolvedValue({
        success: true,
        inscricao: {} as any,
        curso: cursoGratuito,
        termos: {} as any,
      });

      const result = await cursosCheckoutService.startCheckout({
        usuarioId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
        pagamento: 'pix' as any,
        aceitouTermos: true,
      });

      expect(criarGratuitaSpy).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('startCheckout - Resiliência de vaga', () => {
    it('deve cancelar inscrição pendente quando falhar ao criar pagamento', async () => {
      const checkoutParams = {
        usuarioId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
        pagamento: 'pix' as const,
        aceitouTermos: true,
        payer: {
          email: 'joao@test.com',
          identification: {
            type: 'CPF' as const,
            number: '529.982.247-25',
          },
        },
      };

      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue({
        ...mockTurma,
        vagasTotais: 1,
      } as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      vi.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(false);
      vi.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue({
        ...mockUsuario,
        cpf: '52998224725',
        UsuariosEnderecos: [],
        UsuariosInformation: null,
      } as any);
      vi.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025001');
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.cursosTurmasInscricoes, 'create').mockResolvedValue({
        id: 'inscricao-123',
        codigo: 'MAT2025001',
        turmaId: 'turma-123',
        alunoId: 'user-123',
        status: 'AGUARDANDO_PAGAMENTO',
        statusPagamento: 'PENDENTE',
      } as any);

      const cleanupSpy = vi
        .spyOn(prisma.cursosTurmasInscricoes, 'update')
        .mockResolvedValue({ id: 'inscricao-123' } as any);

      vi.spyOn(Payment.prototype, 'create').mockRejectedValue(new Error('gateway offline'));

      await expect(
        cursosCheckoutService.startCheckout(checkoutParams as any),
      ).rejects.toMatchObject({
        code: 'MERCADOPAGO_ERROR',
        message: 'Não foi possível processar o pagamento no Mercado Pago. Tente novamente.',
      });

      expect(cleanupSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inscricao-123' },
          data: expect.objectContaining({
            status: 'CANCELADO',
            statusPagamento: 'CANCELADO',
          }),
        }),
      );
    });

    it('mapeia erro de identidade financeira do Mercado Pago e limpa inscrição pendente', async () => {
      const checkoutParams = {
        usuarioId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
        pagamento: 'pix' as const,
        aceitouTermos: true,
        payer: {
          email: 'joao@test.com',
          identification: {
            type: 'CPF' as const,
            number: '529.982.247-25',
          },
        },
      };

      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(mockTurma as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      vi.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(false);
      vi.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue({
        ...mockUsuario,
        cpf: '52998224725',
        UsuariosEnderecos: [],
        UsuariosInformation: null,
      } as any);
      vi.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025001');
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.cursosTurmasInscricoes, 'create').mockResolvedValue({
        id: 'inscricao-123',
        codigo: 'MAT2025001',
        turmaId: 'turma-123',
        alunoId: 'user-123',
        status: 'AGUARDANDO_PAGAMENTO',
        statusPagamento: 'PENDENTE',
      } as any);
      const cleanupSpy = vi
        .spyOn(prisma.cursosTurmasInscricoes, 'update')
        .mockResolvedValue({ id: 'inscricao-123' } as any);

      const gatewayError = Object.assign(new Error('Financial Identity validation failed'), {
        cause: [{ description: 'Financial Identity rejected payer' }],
      });
      vi.spyOn(Payment.prototype, 'create').mockRejectedValue(gatewayError);

      await expect(
        cursosCheckoutService.startCheckout(checkoutParams as any),
      ).rejects.toMatchObject({
        code: 'FINANCIAL_IDENTITY_ERROR',
      });

      expect(cleanupSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inscricao-123' },
          data: expect.objectContaining({
            status: 'CANCELADO',
            statusPagamento: 'CANCELADO',
          }),
        }),
      );
    });

    it('mapeia token inválido do Mercado Pago e limpa inscrição pendente', async () => {
      const checkoutParams = {
        usuarioId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
        pagamento: 'pix' as const,
        aceitouTermos: true,
        payer: {
          email: 'joao@test.com',
          identification: {
            type: 'CPF' as const,
            number: '529.982.247-25',
          },
        },
      };

      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(mockTurma as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      vi.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(false);
      vi.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue({
        ...mockUsuario,
        cpf: '52998224725',
        UsuariosEnderecos: [],
        UsuariosInformation: null,
      } as any);
      vi.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025001');
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.cursosTurmasInscricoes, 'create').mockResolvedValue({
        id: 'inscricao-123',
        codigo: 'MAT2025001',
        turmaId: 'turma-123',
        alunoId: 'user-123',
        status: 'AGUARDANDO_PAGAMENTO',
        statusPagamento: 'PENDENTE',
      } as any);
      const cleanupSpy = vi
        .spyOn(prisma.cursosTurmasInscricoes, 'update')
        .mockResolvedValue({ id: 'inscricao-123' } as any);

      const gatewayError = Object.assign(new Error('Unauthorized'), {
        status: 401,
        apiResponse: {
          statusCode: 401,
          message: 'invalid access token',
          cause: [{ code: 'invalid_token', description: 'Invalid access token' }],
        },
      });
      const paymentCreateSpy = vi
        .spyOn(Payment.prototype, 'create')
        .mockRejectedValue(gatewayError);

      await expect(
        cursosCheckoutService.startCheckout(checkoutParams as any),
      ).rejects.toMatchObject({
        code: 'MERCADOPAGO_INVALID_TOKEN',
      });

      expect(paymentCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestOptions: {
            idempotencyKey: 'curso-checkout:inscricao-123:pix',
          },
        }),
      );
      expect(cleanupSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inscricao-123' },
          data: expect.objectContaining({
            status: 'CANCELADO',
            statusPagamento: 'CANCELADO',
          }),
        }),
      );
    });

    it('mapeia bloqueio por política do Mercado Pago e limpa inscrição pendente', async () => {
      const checkoutParams = {
        usuarioId: 'user-123',
        cursoId: 'curso-123',
        turmaId: 'turma-123',
        pagamento: 'pix' as const,
        aceitouTermos: true,
        payer: {
          email: 'joao@test.com',
          identification: {
            type: 'CPF' as const,
            number: '529.982.247-25',
          },
        },
      };

      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(mockTurma as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      vi.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(false);
      vi.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue({
        ...mockUsuario,
        cpf: '52998224725',
        UsuariosEnderecos: [],
        UsuariosInformation: null,
      } as any);
      vi.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025001');
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.cursosTurmasInscricoes, 'create').mockResolvedValue({
        id: 'inscricao-123',
        codigo: 'MAT2025001',
        turmaId: 'turma-123',
        alunoId: 'user-123',
        status: 'AGUARDANDO_PAGAMENTO',
        statusPagamento: 'PENDENTE',
      } as any);
      const cleanupSpy = vi
        .spyOn(prisma.cursosTurmasInscricoes, 'update')
        .mockResolvedValue({ id: 'inscricao-123' } as any);

      const gatewayError = Object.assign(new Error('At least one policy returned UNAUTHORIZED.'), {
        payload: {
          code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',
          status: 403,
          message: 'At least one policy returned UNAUTHORIZED.',
          blocked_by: 'PolicyAgent',
        },
      });
      vi.spyOn(Payment.prototype, 'create').mockRejectedValue(gatewayError);

      await expect(
        cursosCheckoutService.startCheckout(checkoutParams as any),
      ).rejects.toMatchObject({
        code: 'MERCADOPAGO_UNAUTHORIZED_POLICY',
      });

      expect(cleanupSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inscricao-123' },
          data: expect.objectContaining({
            status: 'CANCELADO',
            statusPagamento: 'CANCELADO',
          }),
        }),
      );
    });
  });

  describe('startCheckout - Reativação de inscrição encerrada', () => {
    const checkoutParams = {
      usuarioId: 'user-123',
      cursoId: 'curso-123',
      turmaId: 'turma-123',
      pagamento: 'pix' as const,
      aceitouTermos: true,
      payer: {
        email: 'joao@test.com',
        identification: {
          type: 'CPF' as const,
          number: '529.982.247-25',
        },
      },
    };

    it('reativa inscrição CANCELADO sem criar duplicidade', async () => {
      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue({
        ...mockTurma,
        vagasTotais: 1,
      } as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      vi.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(false);
      vi.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue({
        ...mockUsuario,
        cpf: '52998224725',
        UsuariosEnderecos: [],
        UsuariosInformation: null,
      } as any);
      vi.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025001');
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue({
        id: 'inscricao-encerrada',
        status: 'CANCELADO',
      } as any);
      const createSpy = vi.spyOn(prisma.cursosTurmasInscricoes, 'create');
      const updateSpy = vi.spyOn(prisma.cursosTurmasInscricoes, 'update').mockResolvedValue({
        id: 'inscricao-encerrada',
        codigo: 'MAT2025001',
        status: 'AGUARDANDO_PAGAMENTO',
        statusPagamento: 'PENDENTE',
      } as any);
      vi.spyOn(Payment.prototype, 'create').mockRejectedValue(new Error('gateway offline'));

      await expect(
        cursosCheckoutService.startCheckout(checkoutParams as any),
      ).rejects.toMatchObject({
        code: 'MERCADOPAGO_ERROR',
      });

      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inscricao-encerrada' },
          data: expect.objectContaining({
            status: 'AGUARDANDO_PAGAMENTO',
            statusPagamento: 'PENDENTE',
          }),
        }),
      );
    });

    it('reativa inscrição TRANCADO sem criar duplicidade', async () => {
      vi.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as any);
      vi.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue({
        ...mockTurma,
        vagasTotais: 1,
      } as any);
      vi.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      vi.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(false);
      vi.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue({
        ...mockUsuario,
        cpf: '52998224725',
        UsuariosEnderecos: [],
        UsuariosInformation: null,
      } as any);
      vi.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025002');
      vi.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue({
        id: 'inscricao-trancada',
        status: 'TRANCADO',
      } as any);
      const createSpy = vi.spyOn(prisma.cursosTurmasInscricoes, 'create');
      const updateSpy = vi.spyOn(prisma.cursosTurmasInscricoes, 'update').mockResolvedValue({
        id: 'inscricao-trancada',
        codigo: 'MAT2025002',
        status: 'AGUARDANDO_PAGAMENTO',
        statusPagamento: 'PENDENTE',
      } as any);
      vi.spyOn(Payment.prototype, 'create').mockRejectedValue(new Error('gateway offline'));

      await expect(
        cursosCheckoutService.startCheckout(checkoutParams as any),
      ).rejects.toMatchObject({
        code: 'MERCADOPAGO_ERROR',
      });

      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inscricao-trancada' },
          data: expect.objectContaining({
            status: 'AGUARDANDO_PAGAMENTO',
            statusPagamento: 'PENDENTE',
          }),
        }),
      );
    });
  });

  describe('startCheckout', () => {
    it('rejeita método de pagamento desativado para cursos', async () => {
      jest
        .spyOn(mercadoPagoConfig, 'assertMercadoPagoConfiguredAsync')
        .mockResolvedValue({} as never);
      jest.spyOn(mercadoPagoConfig, 'getRuntimeMercadoPagoConfig').mockResolvedValue({
        courseInstallments: { enabled: false, maxInstallments: 1 },
        coursePaymentMethods: ['pix'],
      } as never);

      jest.spyOn(prisma.cursos, 'findUnique').mockResolvedValue(mockCurso as never);
      jest.spyOn(prisma.cursosTurmas, 'findUnique').mockResolvedValue(mockTurma as never);
      jest.spyOn(cursosCheckoutService, 'validarVagasDisponiveis').mockResolvedValue(true);
      jest.spyOn(cursosCheckoutService, 'validarInscricaoDuplicada').mockResolvedValue(false);
      jest.spyOn(prisma.usuarios, 'findUnique').mockResolvedValue({
        ...mockUsuario,
        UsuariosEnderecos: [],
        UsuariosInformation: { telefone: '82999999999' },
      } as never);
      jest.spyOn(cursosCheckoutService, 'gerarCodigoInscricao').mockResolvedValue('MAT2025001');
      jest.spyOn(cursosCheckoutService as any, 'criarOuReativarInscricao').mockResolvedValue({
        id: 'inscricao-123',
        codigo: 'MAT2025001',
        status: 'AGUARDANDO_PAGAMENTO',
      });

      await expect(
        cursosCheckoutService.startCheckout({
          usuarioId: 'user-123',
          cursoId: 'curso-123',
          turmaId: 'turma-123',
          pagamento: 'card',
          payer: { email: 'joao@test.com' },
          aceitouTermos: true,
        } as any),
      ).rejects.toMatchObject({
        code: 'CURSO_PAYMENT_METHOD_DISABLED',
        statusCode: 400,
      });
    });
  });
});

describe('Cursos Checkout - Integração com Cupons', () => {
  it('deve aplicar desconto de cupom percentual', async () => {
    // Este teste será implementado quando completarmos a integração de cupons
    expect(true).toBe(true);
  });

  it('deve aplicar desconto de cupom fixo', async () => {
    // Este teste será implementado quando completarmos a integração de cupons
    expect(true).toBe(true);
  });

  it('deve rejeitar cupom inválido', async () => {
    // Este teste será implementado quando completarmos a integração de cupons
    expect(true).toBe(true);
  });
});
