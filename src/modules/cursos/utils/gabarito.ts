export const GABARITO_RELEASE_DELAY_MS = 60_000;
export const AVALIACAO_TIMEZONE_OFFSET_MINUTES = -3 * 60;

export const combinarDataHoraAvaliacao = (
  data?: Date | null,
  hora?: string | null,
): Date | null => {
  if (!data || !hora) return null;

  const [horas, minutos] = hora.split(':').map(Number);
  if (
    !Number.isInteger(horas) ||
    !Number.isInteger(minutos) ||
    horas < 0 ||
    horas > 23 ||
    minutos < 0 ||
    minutos > 59
  ) {
    return null;
  }

  const dataParte = data.toISOString().slice(0, 10);
  const [ano, mes, dia] = dataParte.split('-').map(Number);
  return new Date(
    Date.UTC(ano, mes - 1, dia, 0, horas * 60 + minutos - AVALIACAO_TIMEZONE_OFFSET_MINUTES, 0, 0),
  );
};

export const obterLiberacaoGabarito = (
  dataFim?: Date | null,
  horaTermino?: string | null,
  agora = new Date(),
) => {
  const encerramento = combinarDataHoraAvaliacao(dataFim, horaTermino);
  const disponivelEm = encerramento
    ? new Date(encerramento.getTime() + GABARITO_RELEASE_DELAY_MS)
    : null;

  return {
    encerramento,
    disponivelEm,
    disponivel: Boolean(disponivelEm && agora >= disponivelEm),
  };
};
