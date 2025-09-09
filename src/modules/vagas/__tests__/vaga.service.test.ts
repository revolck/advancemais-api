import { vagaService } from "../services/vaga.service";
import { prisma } from "../../../config/prisma";
import { planoEmpresaService } from "../../plano-empresa";
import { VagaStatus, TipoContrato, RegimeTrabalho } from "../enums";

jest.mock("../../../config/prisma", () => ({
  prisma: {
    vaga: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    empresa: { findUnique: jest.fn() },
    candidaturaVaga: { create: jest.fn() },
  },
}));

jest.mock("../../plano-empresa", () => ({
  planoEmpresaService: { canPublishVaga: jest.fn() },
}));

const prismaMock = prisma as any;
const planoMock = planoEmpresaService as any;

describe("vagaService.create", () => {
  beforeEach(() => {
    prismaMock.vaga.create.mockReset();
    prismaMock.empresa.findUnique.mockReset();
    planoMock.canPublishVaga.mockReset();
  });

  test("usa localização da empresa quando não fornecida", async () => {
    prismaMock.empresa.findUnique.mockResolvedValue({
      id: "emp1",
      nome: "Empresa X",
      logoUrl: null,
      cidade: "São Paulo",
      estado: "SP",
    });
    planoMock.canPublishVaga.mockResolvedValue(true);
    prismaMock.vaga.create.mockResolvedValue({ id: "1" });

    await vagaService.create({
      empresaId: "emp1",
      nome: "Dev",
      tipoContrato: TipoContrato.CLT,
      regimeTrabalho: RegimeTrabalho.REMOTO,
      status: VagaStatus.EM_ANALISE,
    });

    expect(prismaMock.vaga.create.mock.calls[0][0].data.localizacao).toBe(
      "São Paulo/SP"
    );
    expect(planoMock.canPublishVaga).toHaveBeenCalled();
  });

  test("lança erro se empresa não encontrada", async () => {
    prismaMock.empresa.findUnique.mockResolvedValue(null);

    await expect(
      vagaService.create({
        empresaId: "emp1",
        nome: "Dev",
        tipoContrato: TipoContrato.CLT,
        regimeTrabalho: RegimeTrabalho.REMOTO,
      })
    ).rejects.toThrow("Empresa não encontrada");
  });
});
