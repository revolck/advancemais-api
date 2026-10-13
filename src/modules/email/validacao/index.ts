export * from './tipos';
export {
  detectarErroDeDigitacao,
  limparCacheDominios,
  verificarLocalmente,
} from './verificacao-local';
export { criarValidadorExterno, PROVEDORES_VALIDACAO, type ProvedorValidacao } from './provedores';
export {
  carregarValidacoes,
  ehBloqueioDefinitivo,
  liberadoParaEnvio,
  normalizarEmail,
  precisaValidar,
  registrarSinaisBrevo,
  validarEmails,
  MAX_TENTATIVAS_TEMPORARIO,
  VALIDADE_VALIDO_DIAS,
  type RegistroValidacao,
  type ResumoValidacao,
  type SinalBrevo,
} from './email-validacao.service';
