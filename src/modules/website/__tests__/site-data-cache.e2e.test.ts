import express from 'express';
import request from 'supertest';

const createMock = jest.fn();
const listMock = jest.fn();
const invalidateMock = jest.fn();

jest.mock('../../usuarios/auth', () => ({
  supabaseAuthMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../services/sobre.service', () => ({
  sobreService: {
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn(),
    create: (...args: any[]) => createMock(...args),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('../services/site-data.service', () => ({
  websiteSiteDataService: {
    list: (...args: any[]) => listMock(...args),
    invalidate: (...args: any[]) => invalidateMock(...args),
    statusFilterableSections: new Set(['slider', 'banner', 'logoEnterprises']),
  },
  allWebsiteSiteDataSections: ['sobre'],
  isWebsiteSiteDataSection: (value: string) => value === 'sobre',
}));

import { websiteRoutes } from '../routes';

describe('Website site-data cache invalidation (E2E)', () => {
  let app: express.Express;
  let version = 0;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/website', websiteRoutes);

    version = 0;
    listMock.mockReset();
    invalidateMock.mockReset();
    createMock.mockReset();

    listMock.mockImplementation(async () => {
      version += 1;
      return {
        statusFilter: 'PUBLICADO',
        sections: ['sobre'],
        generatedAt: `2026-02-12T01:00:0${version}.000Z`,
        data: { sobre: [{ id: `sobre-${version}` }] },
      };
    });

    invalidateMock.mockResolvedValue(undefined);
    createMock.mockResolvedValue({
      id: 'sobre-new',
      imagemUrl: 'https://cdn.example.com/sobre.png',
      imagemTitulo: 'sobre',
      titulo: 'Novo',
      descricao: 'Descricao',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });
  });

  it('should invalidate GET cache after successful mutation', async () => {
    const first = await request(app).get(
      '/api/v1/website/site-data?sections=sobre&status=PUBLICADO',
    );
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(first.body.data.sobre[0].id).toBe('sobre-1');
    expect(listMock).toHaveBeenCalledTimes(1);

    const second = await request(app).get(
      '/api/v1/website/site-data?sections=sobre&status=PUBLICADO',
    );
    expect(second.status).toBe(200);
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body.data.sobre[0].id).toBe('sobre-1');
    expect(listMock).toHaveBeenCalledTimes(1);

    const mutate = await request(app).post('/api/v1/website/sobre').send({
      titulo: 'Novo',
      descricao: 'Descricao',
      imagemUrl: 'https://cdn.example.com/sobre.png',
    });

    expect(mutate.status).toBe(201);
    expect(invalidateMock).toHaveBeenCalledTimes(1);

    const third = await request(app).get(
      '/api/v1/website/site-data?sections=sobre&status=PUBLICADO',
    );
    expect(third.status).toBe(200);
    expect(third.headers['x-cache']).toBe('MISS');
    expect(third.body.data.sobre[0].id).toBe('sobre-2');
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
