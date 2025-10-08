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
    tipo?: string,
    inicio?: Date,
    fim?: Date | null,
  ) {
    // Mapear tipo de bloqueio
    const tipoTexto: Record<string, string> = {
      TEMPORARIO: 'Temporário',
      PERMANENTE: 'Permanente',
      RESTRICAO_DE_RECURSO: 'Restrição de Recurso',
    };

    // Calcular duração em dias se for temporário
    let duracaoDias: number | null = null;
    if (tipo === 'TEMPORARIO' && inicio && fim) {
      const diffTime = Math.abs(fim.getTime() - inicio.getTime());
      duracaoDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Construir descrição consolidada
    let descricao = '';

    if (acao === 'aplicado') {
      const tipoFormatado = tipo ? tipoTexto[tipo] || tipo : 'Não especificado';
      descricao = `Bloqueio aplicado: ${tipoFormatado} - Motivo: ${motivo}`;

      if (duracaoDias !== null) {
        descricao += ` - Duração: ${duracaoDias} dias`;
      }

      if (observacoes) {
        descricao += ` - Observação: ${observacoes}`;
      }
    } else {
      descricao = `Bloqueio revogado - Motivo original: ${motivo}`;

      if (observacoes) {
        descricao += ` - Observação: ${observacoes}`;
      }
    }

    return await this.registrarAlteracao({
      empresaId,
      alteradoPor,
      acao:
        acao === 'aplicado'
          ? EmpresasAuditoriaAcao.BLOQUEIO_APLICADO
          : EmpresasAuditoriaAcao.BLOQUEIO_REVOGADO,
      descricao,
      metadata: {
        motivo,
        observacoes,
        tipo,
        inicio: inicio?.toISOString(),
        fim: fim?.toISOString() || null,
        duracaoDias,
      },
    });
  }

  async registrarAlteracaoEndereco(
    empresaId: string,
    alteradoPor: string,
    dadosAnteriores: any,
    dadosNovos: any,
  ) {
    const alteracoesEndereco = [];

    // Verificar cada campo de endereço
    const camposEndereco = ['logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep'];

    for (const campo of camposEndereco) {
      const valorAnterior = dadosAnteriores?.[campo] || '';
      const valorNovo = dadosNovos?.[campo] || '';

      if (valorAnterior !== valorNovo) {
        alteracoesEndereco.push({
          campo,
          valorAnterior,
          valorNovo,
        });

        await this.registrarAtualizacaoEmpresa(
          empresaId,
          alteradoPor,
          campo,
          valorAnterior,
          valorNovo,
          `${campo.charAt(0).toUpperCase() + campo.slice(1)} alterado de "${valorAnterior || 'vazio'}" para "${valorNovo || 'vazio'}"`,
        );
      }
    }

    // Se houve múltiplas alterações de endereço, registrar uma entrada consolidada
    if (alteracoesEndereco.length > 1) {
      const descricaoConsolidada = `Endereço atualizado: ${alteracoesEndereco
        .map(
          (alt) => `${alt.campo} (${alt.valorAnterior || 'vazio'} → ${alt.valorNovo || 'vazio'})`,
        )
        .join(', ')}`;

      return await this.registrarAlteracao({
        empresaId,
        alteradoPor,
        acao: EmpresasAuditoriaAcao.EMPRESA_ATUALIZADA,
        campo: 'endereco_completo',
        valorAnterior: JSON.stringify(dadosAnteriores),
        valorNovo: JSON.stringify(dadosNovos),
        descricao: descricaoConsolidada,
        metadata: {
          tipo: 'endereco_completo',
          alteracoes: alteracoesEndereco,
        },
      });
    }

    return alteracoesEndereco.length > 0;
  }

  async registrarAlteracaoTelefone(
    empresaId: string,
    alteradoPor: string,
    telefoneAnterior: string | null,
    telefoneNovo: string | null,
  ) {
    if (telefoneAnterior !== telefoneNovo) {
      return await this.registrarAtualizacaoEmpresa(
        empresaId,
        alteradoPor,
        'telefone',
        telefoneAnterior || '',
        telefoneNovo || '',
        `Telefone alterado de "${telefoneAnterior || 'vazio'}" para "${telefoneNovo || 'vazio'}"`,
      );
    }
    return false;
  }

  async registrarAlteracaoRedesSociais(
    empresaId: string,
    alteradoPor: string,
    redesAnteriores: any,
    redesNovas: any,
  ) {
    const alteracoesRedes = [];
    const camposRedes = ['instagram', 'linkedin', 'facebook', 'youtube', 'twitter', 'tiktok'];

    for (const campo of camposRedes) {
      const valorAnterior = redesAnteriores?.[campo] || '';
      const valorNovo = redesNovas?.[campo] || '';

      if (valorAnterior !== valorNovo) {
        alteracoesRedes.push({
          campo,
          valorAnterior,
          valorNovo,
        });

        await this.registrarAtualizacaoEmpresa(
          empresaId,
          alteradoPor,
          `social_${campo}`,
          valorAnterior,
          valorNovo,
          `Rede social ${campo.charAt(0).toUpperCase() + campo.slice(1)} alterada de "${valorAnterior || 'vazio'}" para "${valorNovo || 'vazio'}"`,
        );
      }
    }

    // Se houve múltiplas alterações de redes sociais, registrar uma entrada consolidada
    if (alteracoesRedes.length > 1) {
      const descricaoConsolidada = `Redes sociais atualizadas: ${alteracoesRedes
        .map(
          (alt) => `${alt.campo} (${alt.valorAnterior || 'vazio'} → ${alt.valorNovo || 'vazio'})`,
        )
        .join(', ')}`;

      return await this.registrarAlteracao({
        empresaId,
        alteradoPor,
        acao: EmpresasAuditoriaAcao.EMPRESA_ATUALIZADA,
        campo: 'redes_sociais',
        valorAnterior: JSON.stringify(redesAnteriores),
        valorNovo: JSON.stringify(redesNovas),
        descricao: descricaoConsolidada,
        metadata: {
          tipo: 'redes_sociais',
          alteracoes: alteracoesRedes,
        },
      });
    }

    return alteracoesRedes.length > 0;
  }

  async registrarAlteracaoDescricao(
    empresaId: string,
    alteradoPor: string,
    descricaoAnterior: string | null,
    descricaoNova: string | null,
  ) {
    if (descricaoAnterior !== descricaoNova) {
      return await this.registrarAtualizacaoEmpresa(
        empresaId,
        alteradoPor,
        'descricao',
        descricaoAnterior || '',
        descricaoNova || '',
        `Descrição da empresa alterada de "${descricaoAnterior || 'vazia'}" para "${descricaoNova || 'vazia'}"`,
      );
    }
    return false;
  }

  async registrarAlteracaoPlanoDetalhada(
    empresaId: string,
    alteradoPor: string,
    acao: EmpresasAuditoriaAcao,
    planoAnterior: any,
    planoNovo: any,
    detalhes?: string,
  ) {
    // Mapear modo para texto legível
    const modoTexto: Record<string, string> = {
      CLIENTE: 'Cliente',
      PARCEIRO: 'Parceiro',
      TESTE: 'Avaliação',
    };

    // Mapear método de pagamento
    const metodoPagamentoTexto: Record<string, string> = {
      CARTAO: 'Cartão',
      PIX: 'PIX',
      BOLETO: 'Boleto',
    };

    // Mapear status de pagamento
    const statusPagamentoTexto: Record<string, string> = {
      APROVADO: 'Aprovado',
      PENDENTE: 'Pendente',
      CANCELADO: 'Cancelado',
      EXPIRADO: 'Expirado',
      REJEITADO: 'Rejeitado',
    };

    const metadata: any = {
      planoAnterior: planoAnterior
        ? {
            id: planoAnterior.id,
            nome: planoAnterior.plano?.nome || planoAnterior.nome,
            modo: planoAnterior.modo,
            status: planoAnterior.status,
            modeloPagamento: planoAnterior.modeloPagamento,
            metodoPagamento: planoAnterior.metodoPagamento,
            statusPagamento: planoAnterior.statusPagamento,
            diasTeste: planoAnterior.duracaoEmDias,
          }
        : null,
      planoNovo: planoNovo
        ? {
            id: planoNovo.id,
            nome: planoNovo.plano?.nome || planoNovo.nome,
            modo: planoNovo.modo,
            status: planoNovo.status,
            modeloPagamento: planoNovo.modeloPagamento,
            metodoPagamento: planoNovo.metodoPagamento,
            statusPagamento: planoNovo.statusPagamento,
            diasTeste: planoNovo.duracaoEmDias,
          }
        : null,
    };

    let descricao = '';

    if (acao === EmpresasAuditoriaAcao.PLANO_ASSIGNADO) {
      const nomePlano = planoNovo?.plano?.nome || planoNovo?.nome || 'Plano não identificado';
      const modo = modoTexto[planoNovo?.modo] || planoNovo?.modo || 'modo não definido';

      descricao = `Plano atribuído: ${nomePlano} - Vínculo: ${modo}`;

      // Adicionar método de pagamento se disponível
      if (planoNovo?.metodoPagamento) {
        const metodo = metodoPagamentoTexto[planoNovo.metodoPagamento] || planoNovo.metodoPagamento;
        descricao += ` - Método: ${metodo}`;
      }

      // Adicionar status de pagamento se disponível
      if (planoNovo?.statusPagamento) {
        const status = statusPagamentoTexto[planoNovo.statusPagamento] || planoNovo.statusPagamento;
        descricao += ` - Status: ${status}`;
      }

      // Adicionar dias de teste se for avaliação
      if (planoNovo?.modo === 'TESTE' && planoNovo?.duracaoEmDias) {
        descricao += ` - Período de teste: ${planoNovo.duracaoEmDias} dias`;
      }

    } else if (acao === EmpresasAuditoriaAcao.PLANO_ATUALIZADO) {
      const nomeAnterior = planoAnterior?.plano?.nome || planoAnterior?.nome || 'Plano anterior';
      const nomeNovo = planoNovo?.plano?.nome || planoNovo?.nome || 'Plano novo';
      const modoAnterior = modoTexto[planoAnterior?.modo] || planoAnterior?.modo || 'não definido';
      const modoNovo = modoTexto[planoNovo?.modo] || planoNovo?.modo || 'não definido';

      descricao = `Plano alterado de "${nomeAnterior}" (${modoAnterior}) para "${nomeNovo}" (${modoNovo})`;

      // Adicionar método de pagamento se mudou
      if (planoNovo?.metodoPagamento && planoAnterior?.metodoPagamento !== planoNovo?.metodoPagamento) {
        const metodoNovo = metodoPagamentoTexto[planoNovo.metodoPagamento] || planoNovo.metodoPagamento;
        descricao += ` - Método: ${metodoNovo}`;
      }

      // Adicionar status de pagamento se mudou
      if (planoNovo?.statusPagamento && planoAnterior?.statusPagamento !== planoNovo?.statusPagamento) {
        const statusNovo = statusPagamentoTexto[planoNovo.statusPagamento] || planoNovo.statusPagamento;
        descricao += ` - Status: ${statusNovo}`;
      }

      // Adicionar dias de teste se for avaliação
      if (planoNovo?.modo === 'TESTE' && planoNovo?.duracaoEmDias) {
        descricao += ` - Período de teste: ${planoNovo.duracaoEmDias} dias`;
      }

    } else if (acao === EmpresasAuditoriaAcao.PLANO_CANCELADO) {
      const nomePlano = planoAnterior?.plano?.nome || planoAnterior?.nome || 'Plano não identificado';
      const modo = modoTexto[planoAnterior?.modo] || planoAnterior?.modo || 'não definido';
      descricao = `Plano cancelado: ${nomePlano} (${modo})`;

    } else if (acao === EmpresasAuditoriaAcao.PLANO_EXPIRADO) {
      const nomePlano = planoAnterior?.plano?.nome || planoAnterior?.nome || 'Plano não identificado';
      const modo = modoTexto[planoAnterior?.modo] || planoAnterior?.modo || 'não definido';
      descricao = `Plano expirado: ${nomePlano} (${modo})`;
    }

    if (detalhes) {
      descricao += ` - ${detalhes}`;
    }

    return await this.registrarAlteracao({
      empresaId,
      alteradoPor,
      acao,
      descricao,
      metadata,
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
