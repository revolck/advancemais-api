/**
 * Helper compartilhado para montar camposAlterados do histórico de materiais
 * Usado tanto no serviço de materiais quanto no serviço de aulas
 */

/**
 * Helper para montar camposAlterados do histórico de materiais
 */
export function montarCamposAlteradosMaterial(
  acao: 'MATERIAL_ADICIONADO' | 'MATERIAL_REMOVIDO' | 'MATERIAL_ATUALIZADO',
  materialAntigo: any | null,
  materialNovo: any | null,
  inputNovo?: any,
): Record<string, any> {
  const campos: Record<string, any> = {
    acao,
  };

  // Material ID
  if (materialNovo?.id) {
    campos.materialId = { de: materialAntigo?.id || null, para: materialNovo.id };
  } else if (materialAntigo?.id) {
    campos.materialId = { de: materialAntigo.id, para: null };
  }

  // Tipo do material
  const tipoAntigo = materialAntigo?.tipo || null;
  const tipoNovo = materialNovo?.tipo || inputNovo?.tipo || null;
  if (tipoAntigo || tipoNovo) {
    campos.materialTipo = { de: tipoAntigo, para: tipoNovo };
  }

  // Título do material
  const tituloAntigo = materialAntigo?.titulo || null;
  const tituloNovo = materialNovo?.titulo || inputNovo?.titulo || null;
  if (tituloAntigo || tituloNovo) {
    campos.materialTitulo = { de: tituloAntigo, para: tituloNovo };
  }

  // Campos específicos por tipo
  if (
    tipoNovo === 'ARQUIVO' ||
    tipoAntigo === 'ARQUIVO' ||
    tipoNovo === 'APOSTILA' ||
    tipoAntigo === 'APOSTILA'
  ) {
    // Nome do arquivo
    const arquivoNomeAntigo = materialAntigo?.arquivoNome || null;
    const arquivoNomeNovo = materialNovo?.arquivoNome || inputNovo?.arquivoNome || null;
    if (arquivoNomeAntigo || arquivoNomeNovo) {
      campos.arquivoNome = { de: arquivoNomeAntigo, para: arquivoNomeNovo };
    }

    // MIME Type
    const mimeTypeAntigo = materialAntigo?.arquivoMimeType || null;
    const mimeTypeNovo = materialNovo?.arquivoMimeType || inputNovo?.arquivoMimeType || null;
    if (mimeTypeAntigo || mimeTypeNovo) {
      campos.arquivoMimeType = { de: mimeTypeAntigo, para: mimeTypeNovo };
    }

    // Tamanho do arquivo
    const tamanhoAntigo = materialAntigo?.tamanhoEmBytes || materialAntigo?.arquivoTamanho || null;
    const tamanhoNovo =
      materialNovo?.tamanhoEmBytes ||
      materialNovo?.arquivoTamanho ||
      inputNovo?.arquivoTamanho ||
      null;
    if (tamanhoAntigo || tamanhoNovo) {
      campos.arquivoTamanho = { de: tamanhoAntigo, para: tamanhoNovo };
    }
  }

  if (
    tipoNovo === 'LINK' ||
    tipoAntigo === 'LINK' ||
    tipoNovo === 'ARTIGO' ||
    tipoAntigo === 'ARTIGO'
  ) {
    // URL do link
    const urlAntiga = materialAntigo?.url || materialAntigo?.linkUrl || null;
    const urlNova = materialNovo?.url || materialNovo?.linkUrl || inputNovo?.linkUrl || null;
    if (urlAntiga || urlNova) {
      campos.linkUrl = { de: urlAntiga, para: urlNova };
    }
  }

  if (tipoNovo === 'TEXTO' || tipoAntigo === 'TEXTO') {
    // Conteúdo do texto (resumo)
    const conteudoAntigo = materialAntigo?.conteudoHtml || null;
    const conteudoNovo = materialNovo?.conteudoHtml || inputNovo?.conteudoHtml || null;
    if (conteudoAntigo || conteudoNovo) {
      // Criar resumo (primeiros 80 caracteres, removendo HTML)
      const resumoAntigo = conteudoAntigo
        ? conteudoAntigo.replace(/<[^>]*>/g, '').substring(0, 80)
        : null;
      const resumoNovo = conteudoNovo
        ? conteudoNovo.replace(/<[^>]*>/g, '').substring(0, 80)
        : null;
      if (resumoAntigo || resumoNovo) {
        campos.conteudoResumo = { de: resumoAntigo, para: resumoNovo };
      }
    }
  }

  // Remover campos vazios (de e para ambos null)
  Object.keys(campos).forEach((key) => {
    if (key === 'acao') return; // Manter ação sempre
    const valor = campos[key];
    if (valor && typeof valor === 'object' && 'de' in valor && 'para' in valor) {
      if (valor.de === null && valor.para === null) {
        delete campos[key];
      }
    }
  });

  return campos;
}
