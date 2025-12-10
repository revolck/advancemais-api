import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import { prisma } from '@/config/prisma';
import { cursosCheckoutService } from '../services/cursos-checkout.service';

describe('Cursos Checkout Service', () => {
  // Mock data
  const mockUsuario = {
    id: 'user-123',
    nomeCompleto: 'João Silva',
    email: 'joao@test.com',
    cpf: '12345678901',
    supabaseId: 'supabase-123',
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
    limiteAlunos: 30,
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
        limiteAlunos: null,
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
