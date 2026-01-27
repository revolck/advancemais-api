import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import crypto from 'crypto';
import type {
  CreateMaterialInput,
  UpdateMaterialInput,
  ReordenarMateriaisInput,
} from '../validators/materiais.schema';
import { montarCamposAlteradosMaterial } from './historico-materiais.helper';

// Re-exportar tipos para uso na função helper
type CreateMaterialInputType = CreateMaterialInput;
type UpdateMaterialInputType = UpdateMaterialInput;

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
        // Campos adicionais se disponíveis
        tamanhoEmBytes: input.tipo === 'ARQUIVO' ? input.arquivoTamanho : null,
      },
    });

    // 5. Preparar dados do material para histórico (incluir dados do input que não estão no banco)
    const materialCompleto = {
      ...material,
      arquivoNome: input.tipo === 'ARQUIVO' ? input.arquivoNome : undefined,
      arquivoMimeType: input.tipo === 'ARQUIVO' ? input.arquivoMimeType : undefined,
      arquivoTamanho: input.tipo === 'ARQUIVO' ? input.arquivoTamanho : undefined,
      linkUrl: input.tipo === 'LINK' ? input.linkUrl : undefined,
      conteudoHtml: input.tipo === 'TEXTO' ? input.conteudoHtml : undefined,
    };

    // 6. Registrar no histórico da aula com informações detalhadas
    const camposAlterados = montarCamposAlteradosMaterial(
      'MATERIAL_ADICIONADO',
      null,
      materialCompleto,
      input,
    );

    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId,
        acao: 'EDITADA', // Manter enum existente, ação específica em camposAlterados
        camposAlterados,
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
    const materialAntigo = await prisma.cursosTurmasAulasMateriais.findFirst({
      where: { id: materialId, aulaId },
    });

    if (!materialAntigo) throw new Error('Material não encontrado');

    const materialAtualizado = await prisma.cursosTurmasAulasMateriais.update({
      where: { id: materialId },
      data: input,
    });

    // Preparar dados para histórico
    const materialAntigoCompleto = {
      ...materialAntigo,
      arquivoNome: null, // Não temos no banco, mas pode vir do input se for atualização de arquivo
      arquivoMimeType: null,
      arquivoTamanho: materialAntigo.tamanhoEmBytes || null,
      linkUrl: materialAntigo.url || null,
    };

    const materialNovoCompleto = {
      ...materialAtualizado,
      arquivoNome: (input as any)?.arquivoNome || null,
      arquivoMimeType: (input as any)?.arquivoMimeType || null,
      arquivoTamanho: materialAtualizado.tamanhoEmBytes || null,
      linkUrl: materialAtualizado.url || null,
    };

    // Registrar histórico com informações detalhadas
    const camposAlterados = montarCamposAlteradosMaterial(
      'MATERIAL_ATUALIZADO',
      materialAntigoCompleto,
      materialNovoCompleto,
      input,
    );

    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId,
        acao: 'EDITADA',
        camposAlterados,
      },
    });

    return materialAtualizado;
  },

  /**
   * Deletar material
   */
  async delete(aulaId: string, materialId: string, usuarioId: string) {
    const material = await prisma.cursosTurmasAulasMateriais.findFirst({
      where: { id: materialId, aulaId },
    });

    if (!material) throw new Error('Material não encontrado');

    // Preparar dados do material antes de deletar
    const materialCompleto: any = {
      ...material,
      arquivoNome: null as string | null, // Não temos no banco, mas tentar extrair da URL se possível
      arquivoMimeType: null as string | null,
      arquivoTamanho: material.tamanhoEmBytes || null,
      linkUrl: material.url || null,
    };

    // Tentar extrair nome do arquivo da URL se for arquivo
    if (material.url && material.tipo === 'APOSTILA') {
      try {
        const url = new URL(material.url);
        const pathname = url.pathname;
        const filename = pathname.split('/').pop() || pathname;
        if (filename && filename.includes('.')) {
          materialCompleto.arquivoNome = decodeURIComponent(filename);
        }
      } catch {
        // Ignorar erro de URL
      }
    }

    await prisma.cursosTurmasAulasMateriais.delete({
      where: { id: materialId },
    });

    // Registrar histórico com informações detalhadas
    const camposAlterados = montarCamposAlteradosMaterial(
      'MATERIAL_REMOVIDO',
      materialCompleto,
      null,
    );

    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId,
        acao: 'EDITADA',
        camposAlterados,
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
    // Buscar materiais antes de atualizar para ter informações completas
    const materiaisAntigos = await prisma.cursosTurmasAulasMateriais.findMany({
      where: {
        aulaId,
        id: { in: input.ordens.map((o) => o.id) },
      },
      orderBy: { ordem: 'asc' },
    });

    // Criar mapa de ordens antigas
    const ordensAntigas = new Map(materiaisAntigos.map((m) => [m.id, m.ordem]));
    const materiaisMap = new Map(materiaisAntigos.map((m) => [m.id, m]));

    // Atualizar ordem de cada material
    for (const item of input.ordens) {
      await prisma.cursosTurmasAulasMateriais.updateMany({
        where: { id: item.id, aulaId },
        data: { ordem: item.ordem },
      });
    }

    // Preparar informações de reordenação para histórico
    const materiaisReordenados = input.ordens
      .filter((item) => {
        const ordemAntiga = ordensAntigas.get(item.id);
        return ordemAntiga !== undefined && ordemAntiga !== item.ordem;
      })
      .map((item) => {
        const material = materiaisMap.get(item.id);
        return {
          materialId: item.id,
          materialTitulo: material?.titulo || 'Material',
          ordem: { de: ordensAntigas.get(item.id) || null, para: item.ordem },
        };
      });

    // Registrar histórico apenas se houver mudanças
    if (materiaisReordenados.length > 0) {
      const camposAlterados: Record<string, any> = {
        acao: 'MATERIAIS_REORDENADOS',
        materiais: materiaisReordenados,
      };

      await prisma.cursosAulasHistorico.create({
        data: {
          aulaId,
          usuarioId,
          acao: 'EDITADA',
          camposAlterados,
        },
      });
    }

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
      downloadUrl: material.url || '',
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
