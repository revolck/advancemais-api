import express from 'express';
import request from 'supertest';
import { EmailVerificationController } from '../controllers/email-verification-controller';

describe('Email verification flow', () => {
  it('returns success JSON on valid token', async () => {
    process.env.FRONTEND_URL = 'http://app.advancemais.com';
    process.env.AUTH_FRONTEND_URL = 'http://auth.advancemais.com';
    const controller = new EmailVerificationController();
    // @ts-ignore accessing private property for test
    controller['emailService'] = {
      verifyEmailToken: jest.fn().mockResolvedValue({ valid: true, userId: '1' }),
    } as any;

    const app = express();
    app.get('/verificar-email', controller.verifyEmail);

    const res = await request(app).get('/verificar-email?token=test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.redirectUrl).toBe('http://app.advancemais.com');
    expect(res.body.userId).toBe('1');
  });

  it('returns 400 for invalid token', async () => {
    const controller = new EmailVerificationController();
    // @ts-ignore
    controller['emailService'] = {
      verifyEmailToken: jest.fn().mockResolvedValue({ valid: false, error: 'Token inválido' }),
    } as any;

    const app = express();
    app.get('/verificar-email', controller.verifyEmail);

    const res = await request(app).get('/verificar-email?token=bad');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});
