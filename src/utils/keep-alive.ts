import { serverConfig } from "../config/env";

/**
 * Inicia um ping periódico para manter a instância ativa.
 */
export function startKeepAlive(): void {
  const url =
    process.env.KEEP_ALIVE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${serverConfig.port}/health`;

  const interval = parseInt(process.env.KEEP_ALIVE_INTERVAL || "600000", 10); // 10min

  if (!url || interval <= 0) {
    console.warn("⚠️ Keep-alive desativado: URL ou intervalo inválido");
    return;
  }

  setInterval(async () => {
    try {
      await fetch(url);
      console.log(`✅ Keep-alive ping para ${url}`);
    } catch (error) {
      console.error(`❌ Erro no keep-alive para ${url}:`, error);
    }
  }, interval);
}
