import {
  buildCodigoCertificadoMigracao,
  buildCodigoCursoMigracao,
  buildCodigoInscricaoMigracao,
  buildCodigoTurmaMigracao,
  buildMigrationPreflight,
  buildQuarantinePlan,
  consolidateMigrationRecords,
  parseLegacyDateToUtcNoon,
} from '../seed-migracao-legado';

const baseRecord = (overrides: Record<string, unknown> = {}) => ({
  linhaOrigem: 10,
  linhaBloco: 5,
  cursoNome: 'AGENTE DE PORTARIA COM PRATICA PROFISSIONAL SUPERVISIONADA',
  cpf: '07133279444',
  cpfOriginal: '07133279444',
  nomeAluno: 'ADIJANERSON TALES LOPES FERREIRA',
  nomeAlunoCabecalho: 'ADIJANERSON TALES LOPES FERREIRA',
  cidade: 'MACEIO',
  estado: 'AL',
  celular: '82996148322',
  whatsapp: '(82) 9 9614-8322',
  whatsappCabecalho: '(82) 9 9614-8322',
  cadastro: '2023-01-20',
  cadastroCabecalho: '20/01/2023',
  dataInicio: '2026-04-25',
  dataFim: '2026-05-23',
  valorCurso: 370,
  valorPresencial: 0,
  cargaHoraria: 20,
  horario: 'N',
  ...overrides,
});

describe('seed migracao legado preflight', () => {
  it('bloqueia registro sem CPF', () => {
    const preflight = buildMigrationPreflight([baseRecord({ cpf: '', cpfOriginal: '' }) as any]);

    expect(preflight.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPF_AUSENTE_OU_INVALIDO',
          linhasOrigem: [10],
        }),
      ]),
    );
  });

  it('bloqueia registro sem periodo da turma', () => {
    const preflight = buildMigrationPreflight([baseRecord({ dataInicio: '', dataFim: '' }) as any]);

    expect(preflight.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PERIODO_AUSENTE_OU_INVALIDO',
          linhasOrigem: [10],
        }),
      ]),
    );
  });

  it('bloqueia mesmo CPF com nomes divergentes', () => {
    const preflight = buildMigrationPreflight([
      baseRecord({ linhaOrigem: 10, cursoNome: 'CURSO A' }) as any,
      baseRecord({
        linhaOrigem: 20,
        cursoNome: 'CURSO B',
        nomeAluno: 'OUTRA PESSOA',
        nomeAlunoCabecalho: 'OUTRA PESSOA',
      }) as any,
    ]);

    expect(preflight.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPF_COM_NOMES_DIVERGENTES',
          cpf: '07133279444',
          linhasOrigem: [10, 20],
        }),
      ]),
    );
  });

  it('consolida duplicatas exatas por CPF curso e periodo', () => {
    const consolidated = consolidateMigrationRecords([
      baseRecord({ linhaOrigem: 10 }) as any,
      baseRecord({ linhaOrigem: 11 }) as any,
    ]);

    expect(consolidated).toHaveLength(1);
    expect(consolidated[0].linhasOrigem).toEqual([10, 11]);
  });

  it('gera codigos deterministicos para entidades migradas', () => {
    const record = baseRecord() as any;
    const turmaCodigo = buildCodigoTurmaMigracao(record);
    const inscricaoCodigo = buildCodigoInscricaoMigracao(record.cpf, turmaCodigo);

    expect(buildCodigoCursoMigracao(record.cursoNome)).toBe(
      buildCodigoCursoMigracao(record.cursoNome),
    );
    expect(turmaCodigo).toBe(buildCodigoTurmaMigracao(record));
    expect(inscricaoCodigo).toBe(buildCodigoInscricaoMigracao(record.cpf, turmaCodigo));
    expect(buildCodigoCertificadoMigracao(inscricaoCodigo)).toBe(
      buildCodigoCertificadoMigracao(inscricaoCodigo),
    );
    expect(turmaCodigo).toMatch(/^MIGT[A-F0-9]{8}$/);
    expect(inscricaoCodigo).toMatch(/^MIGI[A-F0-9]{12}$/);
  });

  it('preserva datas legadas em UTC ao meio-dia', () => {
    const date = parseLegacyDateToUtcNoon('2023-01-20');

    expect(date?.toISOString()).toBe('2023-01-20T12:00:00.000Z');
  });

  it('separa registros importaveis dos registros em quarentena', () => {
    const preflight = buildMigrationPreflight([
      baseRecord({ linhaOrigem: 10, cpf: '', cpfOriginal: '' }) as any,
      baseRecord({ linhaOrigem: 20, cpf: '04886279406', cpfOriginal: '04886279406' }) as any,
    ]);
    const quarantine = buildQuarantinePlan(preflight);

    expect(quarantine.registrosQuarentenados.map((record) => record.linhaOrigem)).toEqual([10]);
    expect(quarantine.registrosImportaveis.map((record) => record.linhaOrigem)).toEqual([20]);
  });
});
