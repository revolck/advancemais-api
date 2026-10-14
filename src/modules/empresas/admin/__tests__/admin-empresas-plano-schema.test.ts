import { EmpresasPlanoModo } from '@prisma/client';
import {
  adminEmpresasPlanoManualAssignSchema,
  adminEmpresasPlanoUpdateSchema,
} from '../validators/admin-empresas.schema';

const base = {
  planosEmpresariaisId: '1e3d091b-1ea0-48a6-a9ce-c131a3f232d6',
  modo: EmpresasPlanoModo.CLIENTE,
};

describe('datas opcionais do plano da empresa (admin)', () => {
  it.each([
    ['atribuição manual', adminEmpresasPlanoManualAssignSchema],
    ['edição', adminEmpresasPlanoUpdateSchema],
  ])('%s: null continua null (não vira 01/01/1970)', (_caso, schema) => {
    const r = schema.parse({ ...base, graceUntil: null, proximaCobranca: null });
    expect(r.graceUntil).toBeNull();
    expect(r.proximaCobranca).toBeNull();
  });

  it('data informada continua sendo convertida', () => {
    const r = adminEmpresasPlanoManualAssignSchema.parse({
      ...base,
      proximaCobranca: '2026-11-14T03:00:00.000Z',
    });
    expect(r.proximaCobranca).toEqual(new Date('2026-11-14T03:00:00.000Z'));
    expect(r.graceUntil).toBeUndefined();
  });
});
