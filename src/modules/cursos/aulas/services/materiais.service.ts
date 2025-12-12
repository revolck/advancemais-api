import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import crypto from 'crypto';
import type {
  CreateMaterialInput,
  UpdateMaterialInput,
  ReordenarMateriaisInput,
} from '../validators/materiais.schema';

const materiaisLogger = logger.child({ module: 'MateriaisService' });

// Mapear tipo do frontend para enum do banco
function mapTipoMaterial(tipo: string): any {
  const map: Record<string, string> = {
    ARQUIVO: 'APOSTILA', // Usar tipo existente do enum
    LINK: 'ARTIGO', // Usar tipo existente do enum
    TEXTO: 'ARTIGO', // Usar tipo existente do enum
  };
  return map[tipo] || tipo;
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/gif',
  'audio/mpeg',
  'video/mp4',
];

export const materiaisService = {
  /**
   * Criar material (via URL do blob storage)
   */
  async create(aulaId: string, input: CreateMaterialInput, usuarioId: string) {
    // 1. Verificar limite de 3 materiais por aula
    const count = await prisma.cursosTurmasAulasMateriais.count({
      where: { aulaId },
    });

    if (count >= 3) {
      throw new Error('Limite de 3 materiais por aula atingido');
    }

    // 2. Validações específicas por tipo
    if (input.tipo === 'ARQUIVO') {
      // Validar MIME type
      if (!ALLOWED_MIME_TYPES.includes(input.arquivoMimeType)) {
        throw new Error(`Tipo de arquivo não permitido: ${input.arquivoMimeType}`);
      }

      // Validar se é URL válida
      try {
        new URL(input.arquivoUrl);
      } catch {
        throw new Error('URL de arquivo inválida');
      }

      // Validar tamanho
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (input.arquivoTamanho > MAX_SIZE) {
        throw new Error('Arquivo excede o limite de 5MB');
      }
    }

    // 3. Calcular próxima ordem
    const ultimoMaterial = await prisma.cursosTurmasAulasMateriais.findFirst({
      where: { aulaId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });

    const ordem = (ultimoMaterial?.ordem || 0) + 1;

    // 4. Criar material (usando tabela existente com campos disponíveis)
    const material = await prisma.cursosTurmasAulasMateriais.create({
      data: {
        aulaId,
        tipo: mapTipoMaterial(input.tipo),
        titulo: input.titulo,
        descricao: input.descricao || null,
        ordem,
        // Campo url (existe na tabela)
        url:
          input.tipo === 'ARQUIVO'
            ? input.arquivoUrl
            : input.tipo === 'LINK'
              ? input.linkUrl
              : null,
      },
    });

    // 5. Registrar no histórico da aula
    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId,
        acao: 'EDITADA',
        camposAlterados: {
          acao: 'MATERIAL_ADICIONADO',
          materialId: material.id,
          materialTitulo: material.titulo,
          materialTipo: material.tipo,
        },
      },
    });

    materiaisLogger.info('[MATERIAL_CRIADO]', {
      materialId: material.id,
      aulaId,
      tipo: material.tipo,
    });

    return material;
  },

  /**
   * Listar materiais de uma aula
   */
  async list(aulaId: string) {
    const materiais = await prisma.cursosTurmasAulasMateriais.findMany({
      where: { aulaId },
      orderBy: { ordem: 'asc' },
    });

    const total = materiais.length;
    const limite = 3;

    return {
      data: materiais.map((m: any) => ({
        id: m.id,
        tipo: m.tipo,
        titulo: m.titulo,
        descricao: m.descricao,
        obrigatorio: m.obrigatorio,
        ordem: m.ordem,
        // Campos condicionais
        ...(m.tipo === 'ARQUIVO' && {
          arquivoNome: m.arquivoNome,
          arquivoTamanho: m.arquivoTamanho,
          arquivoMimeType: m.arquivoMimeType,
          // NÃO retorna arquivoUrl direta (segurança)
          // NÃO retorna arquivoToken (só via endpoint específico)
        }),
        ...(m.tipo === 'LINK' && {
          linkUrl: m.linkUrl,
        }),
        ...(m.tipo === 'TEXTO' && {
          conteudoHtml: m.conteudoHtml,
        }),
        criadoPor: m.CriadoPor,
        criadoEm: m.criadoEm.toISOString(),
      })),
      total,
      limite,
      disponiveis: limite - total,
    };
  },

  /**
   * Atualizar material
   */
  async update(aulaId: string, materialId: string, input: UpdateMaterialInput, usuarioId: string) {
    const material = await prisma.cursosTurmasAulasMateriais.findFirst({
      where: { id: materialId, aulaId },
    });

    if (!material) throw new Error('Material não encontrado');

    const atualizado = await prisma.cursosTurmasAulasMateriais.update({
      where: { id: materialId },
      data: input,
    });

    // Registrar histórico
    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId,
        acao: 'EDITADA',
        camposAlterados: {
          acao: 'MATERIAL_ATUALIZADO',
          materialId,
          mudancas: input,
        },
      },
    });

    return atualizado;
  },

  /**
   * Deletar material
   */
  async delete(aulaId: string, materialId: string, usuarioId: string) {
    const material = await prisma.cursosTurmasAulasMateriais.findFirst({
      where: { id: materialId, aulaId },
    });

    if (!material) throw new Error('Material não encontrado');

    await prisma.cursosTurmasAulasMateriais.delete({
      where: { id: materialId },
    });

    // Registrar histórico
    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId,
        acao: 'EDITADA',
        camposAlterados: {
          acao: 'MATERIAL_REMOVIDO',
          materialId,
          materialTitulo: material.titulo,
        },
      },
    });

    // TODO: Se for arquivo, remover do blob storage
    // if (material.tipo === 'ARQUIVO' && material.arquivoUrl) {
    //   await deleteFromBlobStorage(material.arquivoUrl);
    // }

    return { success: true, message: 'Material removido com sucesso' };
  },

  /**
   * Reordenar materiais
   */
  async reordenar(aulaId: string, input: ReordenarMateriaisInput, usuarioId: string) {
    // Atualizar ordem de cada material
    for (const item of input.ordens) {
      await prisma.cursosTurmasAulasMateriais.updateMany({
        where: { id: item.id, aulaId },
        data: { ordem: item.ordem },
      });
    }

    // Registrar histórico
    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId,
        acao: 'EDITADA',
        camposAlterados: {
          acao: 'MATERIAIS_REORDENADOS',
          ordens: input.ordens,
        },
      },
    });

    return { success: true, message: 'Materiais reordenados com sucesso' };
  },

  /**
   * Gerar token de download para arquivo
   */
  async gerarTokenDownload(aulaId: string, materialId: string) {
    const material = await prisma.cursosTurmasAulasMateriais.findFirst({
      where: { id: materialId, aulaId },
    });

    if (!material) throw new Error('Material não encontrado');
    if (!material.url) throw new Error('Material não possui URL');

    // Retornar URL direta (arquivoToken não existe no schema)
    return {
      token: materialId,
      downloadUrl: material.url,
      expiresIn: 3600,
    };
  },

  /**
   * Download protegido de arquivo
   */
  async downloadArquivo(token: string, usuarioId: string, usuarioRole: string) {
    // 1. Buscar material pelo ID (token é o ID agora)
    const material = await prisma.cursosTurmasAulasMateriais.findFirst({
      where: { id: token },
      include: {
        CursosTurmasAulas: {
          include: {
            CursosTurmas: {
              include: {
                CursosTurmasInscricoes: {
                  where: { status: 'INSCRITO' },
                  select: { alunoId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!material) throw new Error('Material não encontrado');

    // 2. Verificar acesso
    const aula = material.CursosTurmasAulas;
    const turma = aula.CursosTurmas;

    // Admin/Moderador/Pedagógico sempre têm acesso
    if (['ADMIN', 'MODERADOR', 'PEDAGOGICO'].includes(usuarioRole)) {
      return material.url!;
    }

    // Instrutor da aula tem acesso
    if (usuarioRole === 'INSTRUTOR' && aula.instrutorId === usuarioId) {
      return material.url!;
    }

    // Aluno precisa estar inscrito na turma
    if (turma) {
      const inscrito = turma.CursosTurmasInscricoes.some((i: any) => i.alunoId === usuarioId);
      if (inscrito) {
        return material.url!;
      }
    }

    throw new Error('Você não tem acesso a este material');
  },
};
