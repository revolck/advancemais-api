import express from "express";
import request from "supertest";
import { SobreController } from "../controllers/sobre.controller";
import { sobreService } from "../services/sobre.service";

jest.mock("../services/sobre.service", () => ({
  sobreService: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

describe("SobreController", () => {
  const app = express();
  app.use(express.json());
  app.post("/sobre", SobreController.create);
  app.put("/sobre/:id", SobreController.update);

  it("should return imagemUrl on create", async () => {
    const payload = {
      titulo: "Title",
      descricao: "Desc",
      imagemUrl: "https://cdn.example.com/img.png",
    };
    (sobreService.create as jest.Mock).mockResolvedValue({
      id: "1",
      ...payload,
      imagemTitulo: "img",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

    const res = await request(app).post("/sobre").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.imagemUrl).toBe(payload.imagemUrl);
    expect(sobreService.create).toHaveBeenCalledWith({
      imagemUrl: payload.imagemUrl,
      imagemTitulo: "img",
      titulo: payload.titulo,
      descricao: payload.descricao,
    });
  });

  it("should update imagemUrl when provided", async () => {
    const payload = {
      titulo: "Title",
      descricao: "Desc",
      imagemUrl: "https://cdn.example.com/new.png",
    };
    (sobreService.update as jest.Mock).mockResolvedValue({
      id: "1",
      ...payload,
      imagemTitulo: "new",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

    const res = await request(app).put("/sobre/1").send(payload);
    expect(res.status).toBe(200);
    expect(res.body.imagemUrl).toBe(payload.imagemUrl);
    expect(sobreService.update).toHaveBeenCalledWith("1", {
      titulo: payload.titulo,
      descricao: payload.descricao,
      imagemUrl: payload.imagemUrl,
      imagemTitulo: "new",
    });
  });
});
