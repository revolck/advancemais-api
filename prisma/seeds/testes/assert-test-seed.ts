export function assertTestSeedEnvironment(seedName: string) {
  const ambiente = process.env.SEED_AMBIENTE || process.env.NODE_ENV;

  if (!['test', 'teste'].includes(ambiente || '')) {
    throw new Error(
      `${seedName} usa dados de teste e so pode rodar com NODE_ENV=test ou SEED_AMBIENTE=teste.`,
    );
  }
}
