import express from "express";
import request from "supertest";
import { headerPagesService } from "../services/header-pages.service";

jest.mock("../services/header-pages.service", () => ({
  headerPagesService: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

import { HeaderPageController } from "../controllers/header-pages.controller";

describe("HeaderPageController", () => {
  const app = express();
  app.use(express.json());
  app.post("/header", HeaderPageController.create);
  app.put("/header/:id", HeaderPageController.update);

  it("should trim urls on create", async () => {
    const payload = {
      subtitulo: "Sub",
      titulo: "Titulo",
      descricao: "Desc",
      imagemUrl: " https://cdn.example.com/img.jpg ",
      buttonLabel: "Saiba mais",
      buttonLink: " https://example.com ",
      page: "SOBRE",
    };
    const trimmedImg = payload.imagemUrl.trim();
    const trimmedLink = payload.buttonLink.trim();
    (headerPagesService.create as jest.Mock).mockResolvedValue({
      id: "1",
      ...payload,
      imagemUrl: trimmedImg,
      buttonLink: trimmedLink,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

    const res = await request(app).post("/header").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.imagemUrl).toBe(trimmedImg);
    expect(res.body.buttonLink).toBe(trimmedLink);
    expect(headerPagesService.create).toHaveBeenCalledWith({
      subtitulo: payload.subtitulo,
      titulo: payload.titulo,
      descricao: payload.descricao,
      imagemUrl: trimmedImg,
      buttonLabel: payload.buttonLabel,
      buttonLink: trimmedLink,
      page: payload.page,
    });
  });

  it("should trim urls on update", async () => {
    const payload = {
      imagemUrl: " https://cdn.example.com/new.jpg ",
      buttonLink: " https://example.com/new ",
    };
    const trimmedImg = payload.imagemUrl.trim();
    const trimmedLink = payload.buttonLink.trim();
    (headerPagesService.update as jest.Mock).mockResolvedValue({
      id: "1",
      subtitulo: "Sub",
      titulo: "Titulo",
      descricao: "Desc",
      imagemUrl: trimmedImg,
      buttonLabel: "Saiba mais",
      buttonLink: trimmedLink,
      page: "SOBRE",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

    const res = await request(app).put("/header/1").send(payload);
    expect(res.status).toBe(200);
    expect(res.body.imagemUrl).toBe(trimmedImg);
    expect(res.body.buttonLink).toBe(trimmedLink);
    expect(headerPagesService.update).toHaveBeenCalledWith("1", {
      imagemUrl: trimmedImg,
      buttonLink: trimmedLink,
    });
  });
});
