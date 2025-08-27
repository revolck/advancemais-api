import express from "express";
import request from "supertest";
import { consultoriaService } from "../services/consultoria.service";

jest.mock("../../superbase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: jest.fn(),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  },
}));

jest.mock("../services/consultoria.service", () => ({
  consultoriaService: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

import { ConsultoriaController } from "../controllers/consultoria.controller";

describe("ConsultoriaController", () => {
  const app = express();
  app.use(express.json());
  app.post("/consultoria", ConsultoriaController.create);
  app.put("/consultoria/:id", ConsultoriaController.update);

  it("should return trimmed imagemUrl on create", async () => {
    const payload = {
      titulo: "Title",
      descricao: "Desc",
      imagemUrl: " https://cdn.example.com/img.png ",
      buttonUrl: "https://example.com",
      buttonLabel: "Saiba mais",
    };
    const trimmed = payload.imagemUrl.trim();
    (consultoriaService.create as jest.Mock).mockResolvedValue({
      id: "1",
      ...payload,
      imagemUrl: trimmed,
      imagemTitulo: "img",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

    const res = await request(app).post("/consultoria").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.imagemUrl).toBe(trimmed);
    expect(consultoriaService.create).toHaveBeenCalledWith({
      imagemUrl: trimmed,
      imagemTitulo: "img",
      titulo: payload.titulo,
      descricao: payload.descricao,
      buttonUrl: payload.buttonUrl,
      buttonLabel: payload.buttonLabel,
    });
  });

  it("should update imagemUrl when provided", async () => {
    const payload = {
      titulo: "Title",
      descricao: "Desc",
      imagemUrl: " https://cdn.example.com/new.png ",
      buttonUrl: "https://example.com",
      buttonLabel: "Saiba mais",
    };
    const trimmed = payload.imagemUrl.trim();
    (consultoriaService.update as jest.Mock).mockResolvedValue({
      id: "1",
      ...payload,
      imagemUrl: trimmed,
      imagemTitulo: "new",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

    const res = await request(app).put("/consultoria/1").send(payload);
    expect(res.status).toBe(200);
    expect(res.body.imagemUrl).toBe(trimmed);
    expect(consultoriaService.update).toHaveBeenCalledWith("1", {
      titulo: payload.titulo,
      descricao: payload.descricao,
      buttonUrl: payload.buttonUrl,
      buttonLabel: payload.buttonLabel,
      imagemUrl: trimmed,
      imagemTitulo: "new",
    });
  });
});
