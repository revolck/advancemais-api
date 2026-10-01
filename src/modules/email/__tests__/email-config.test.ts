import { resolveEmailEnvironment } from '../config/email-config';

describe('resolveEmailEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('infers production when Render signals exist even without NODE_ENV', () => {
    delete process.env.NODE_ENV;
    process.env.RENDER = 'true';
    process.env.FRONTEND_URL = 'https://advancemais.com';

    expect(resolveEmailEnvironment()).toBe('production');
  });
});
