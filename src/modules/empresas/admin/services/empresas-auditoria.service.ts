import { prisma } from '@/config/prisma';
import { EmpresasAuditoriaAcao } from '@prisma/client';

export interface EmpresaAuditoriaInput {
  empresaId: string;
  alteradoPor: string;
  acao: EmpresasAuditoriaAcao;
  campo?: string;
  valorAnterior?: string;
  valorNovo?: string;
  descricao: string;
  metadata?: Record<string, any>;
}

export interface EmpresaAuditoriaItem {
  id: string;
  acao: EmpresasAuditoriaAcao;
  campo?: string | null;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  descricao: string;
  metadata?: Record<string, any> | null;
  criadoEm: Date;
  alteradoPor: {
    id: string;
    nomeCompleto: string;
    role: string;
  };
}

class EmpresasAuditoriaService {
  async registrarAlteracao(input: EmpresaAuditoriaInput) {
    return await prisma.empresasAuditoria.create({
      data: {
        empresaId: input.empresaId,
        alteradoPor: input.alteradoPor,
        acao: input.acao,
        campo: input.campo,
        valorAnterior: input.valorAnterior,
        valorNovo: input.valorNovo,
        descricao: input.descricao,
        metadata: input.metadata,
      },
    });
  }

  async obterHistoricoAlteracoes(
    empresaId: string,
    limit: number = 20,
  ): Promise<EmpresaAuditoriaItem[]> {
    const auditoria = await prisma.empresasAuditoria.findMany({
      where: { empresaId },
      orderBy: { criadoEm: 'desc' },
      take: limit,
    });

    // Buscar informações dos usuários separadamente
    const alteradoPorIds = [...new Set(auditoria.map((item) => item.alteradoPor))];
    const usuarios = await prisma.usuarios.findMany({
      where: { id: { in: alteradoPorIds } },
      select: {
        id: true,
        nomeCompleto: true,
        role: true,
      },
    });

    const usuariosMap = new Map(usuarios.map((user) => [user.id, user]));

    return auditoria.map((item) => ({
      id: item.id,
      acao: item.acao,
      campo: item.campo,
      valorAnterior: item.valorAnterior,
      valorNovo: item.valorNovo,
      descricao: item.descricao,
      metadata: item.metadata as Record<string, any> | null,
      criadoEm: item.criadoEm,
      alteradoPor: usuariosMap.get(item.alteradoPor) || {
        id: item.alteradoPor,
        nomeCompleto: 'Usuário não encontrado',
        role: 'UNKNOWN',
      },
    }));
  }

  async registrarCriacaoEmpresa(empresaId: string, alteradoPor: string, dadosEmpresa: any) {
    return await this.registrarAlteracao({
      empresaId,
      alteradoPor,
      acao: EmpresasAuditoriaAcao.EMPRESA_CRIADA,
      descricao: `Empresa criada: ${dadosEmpresa.nome}`,
      metadata: {
        dadosIniciais: {
          nome: dadosEmpresa.nome,
          email: dadosEmpresa.email,
          cnpj: dadosEmpresa.cnpj,
        },
      },
    });
  }

  async registrarAtualizacaoEmpresa(
    empresaId: string,
    alteradoPor: string,
    campo: string,
    valorAnterior: any,
    valorNovo: any,
    descricao: string,
  ) {
    return await this.registrarAlteracao({
      empresaId,
      alteradoPor,
      acao: EmpresasAuditoriaAcao.EMPRESA_ATUALIZADA,
      campo,
      valorAnterior: String(valorAnterior || ''),
      valorNovo: String(valorNovo || ''),
      descricao,
    });
  }

  async registrarAlteracaoPlano(
    empresaId: string,
    alteradoPor: string,
    acao: EmpresasAuditoriaAcao,
    planoNome: string,
    detalhes?: string,
  ) {
    return await this.registrarAlteracao({
      empresaId,
      alteradoPor,
      acao,
      descricao: `${acao.replace('_', ' ').toLowerCase()}: ${planoNome}${detalhes ? ` - ${detalhes}` : ''}`,
      metadata: {
        planoNome,
        detalhes,
      },
    });
  }

  async registrarBloqueio(
    empresaId: string,
    alteradoPor: string,
    acao: 'aplicado' | 'revogado',
    motivo: string,
    observacoes?: string,
  ) {
    return await this.registrarAlteracao({
      empresaId,
      alteradoPor,
      acao:
        acao === 'aplicado'
          ? EmpresasAuditoriaAcao.BLOQUEIO_APLICADO
          : EmpresasAuditoriaAcao.BLOQUEIO_REVOGADO,
      descricao: `Bloqueio ${acao}: ${motivo}${observacoes ? ` - ${observacoes}` : ''}`,
      metadata: {
        motivo,
        observacoes,
      },
    });
  }

  formatarDescricaoAlteracao(item: EmpresaAuditoriaItem): string {
    const dataFormatada = item.criadoEm.toLocaleDateString('pt-BR');
    const horaFormatada = item.criadoEm.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const nomeUsuario = item.alteradoPor.nomeCompleto;

    if (item.campo && item.valorAnterior && item.valorNovo) {
      return `${nomeUsuario} alterou ${item.campo} de "${item.valorAnterior}" para "${item.valorNovo}" em ${dataFormatada} às ${horaFormatada}`;
    }

    return `${nomeUsuario} ${item.descricao} em ${dataFormatada} às ${horaFormatada}`;
  }
}

export const empresasAuditoriaService = new EmpresasAuditoriaService();
