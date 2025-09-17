import { extractInitPoint } from '@/modules/mercadopago/assinaturas/services/assinaturas.service';

describe('extractInitPoint', () => {
  it('prioritizes production init_point from body over sandbox url', () => {
    const result = {
      body: {
        init_point: 'https://prod.example.com',
        sandbox_init_point: 'https://sandbox.example.com',
      },
    } as any;

    expect(extractInitPoint(result)).toBe('https://prod.example.com');
  });

  it('falls back to camelCase initPoint before sandbox urls', () => {
    const result = {
      body: {
        initPoint: 'https://prod-camel.example.com',
        sandbox_init_point: 'https://sandbox.example.com',
      },
    } as any;

    expect(extractInitPoint(result)).toBe('https://prod-camel.example.com');
  });

  it('returns sandbox init point when production urls are missing', () => {
    const result = {
      body: {
        sandbox_init_point: 'https://sandbox.example.com',
      },
    } as any;

    expect(extractInitPoint(result)).toBe('https://sandbox.example.com');
  });
});
