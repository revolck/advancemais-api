/**
 * Utilitários para configuração de cron jobs
 */

/**
 * Converter minutos em expressão cron
 * Exemplos:
 * - 1 -> a cada 1 minuto
 * - 15 -> a cada 15 minutos
 * - 60 -> a cada 1 hora
 * - 120 -> a cada 2 horas
 */
export function minutosParaCronExpression(minutos: number): string {
  if (minutos < 60) {
    // A cada N minutos: */N * * * *
    return `*/${minutos} * * * *`;
  } else if (minutos % 60 === 0) {
    // A cada N horas (múltiplo exato de 60): 0 */H * * *
    const horas = minutos / 60;
    return `0 */${horas} * * *`;
  } else {
    // Para valores que não são múltiplos exatos de 60, usar minutos
    // Exemplo: 90 minutos = 1h30min -> */90 * * * *
    return `*/${minutos} * * * *`;
  }
}

/**
 * Converter configuração de minutos (string ou número) para expressão cron
 * Aceita: número (15), string numérica ("15"), ou expressão cron completa
 *
 * @param value - Valor da variável de ambiente
 * @param defaultMinutos - Valor padrão em minutos se não fornecido
 * @returns Expressão cron válida
 *
 * @example
 * parseScheduleConfig("15", 60) // Retorna expressão para a cada 15 minutos
 * parseScheduleConfig("120", 60) // Retorna expressão para a cada 2 horas
 * parseScheduleConfig("0 2 * * *", 60) // Retorna "0 2 * * *" (expressão completa)
 */
export function parseScheduleConfig(value: string | undefined, defaultMinutos: number): string {
  if (!value) {
    return minutosParaCronExpression(defaultMinutos);
  }

  // Se for um número simples, converter para cron
  const minutos = parseInt(value, 10);
  if (!isNaN(minutos) && minutos > 0) {
    return minutosParaCronExpression(minutos);
  }

  // Caso contrário, usar como expressão cron completa
  return value;
}
