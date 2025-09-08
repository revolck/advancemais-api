import { planoEmpresaService } from "../services/plano-empresa.service";
import { prisma } from "../../../config/prisma";

jest.mock("../../../config/prisma", () => ({
  prisma: {
    mercadoPagoPlan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    empresaPlano: {
      findUnique: jest.fn(),
    },
    vaga: {
      count: jest.fn(),
    },
  },
}));

const prismaMock = prisma as jest.Mocked<typeof prisma>;

describe("planoEmpresaService.canPublishVaga", () => {
  beforeEach(() => {
    prismaMock.empresaPlano.findUnique.mockReset();
    prismaMock.vaga.count.mockReset();
  });

  test("retorna false quando a empresa não possui plano", async () => {
    prismaMock.empresaPlano.findUnique.mockResolvedValue(null as any);
    const result = await planoEmpresaService.canPublishVaga("1");
    expect(result).toBe(false);
  });

  test("retorna true para plano com vagas ilimitadas", async () => {
    prismaMock.empresaPlano.findUnique.mockResolvedValue({
      plano: { limiteVagasAtivas: null, limiteVagasDestaque: null },
    } as any);
    const result = await planoEmpresaService.canPublishVaga("1");
    expect(result).toBe(true);
  });

  test("retorna true quando contador está abaixo do limite", async () => {
    prismaMock.empresaPlano.findUnique.mockResolvedValue({
      plano: { limiteVagasAtivas: 3, limiteVagasDestaque: 1 },
    } as any);
    prismaMock.vaga.count.mockResolvedValue(2 as any);
    const result = await planoEmpresaService.canPublishVaga("1");
    expect(result).toBe(true);
  });

  test("retorna false quando contador atinge o limite", async () => {
    prismaMock.empresaPlano.findUnique.mockResolvedValue({
      plano: { limiteVagasAtivas: 3, limiteVagasDestaque: 1 },
    } as any);
    prismaMock.vaga.count.mockResolvedValue(3 as any);
    const result = await planoEmpresaService.canPublishVaga("1");
    expect(result).toBe(false);
  });
});

