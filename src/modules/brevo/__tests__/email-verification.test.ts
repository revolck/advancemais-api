import express from 'express';
import request from 'supertest';
import { EmailVerificationController } from '../controllers/email-verification-controller';

describe('Email verification flow', () => {
  it('redirects to frontend on valid token', async () => {
    process.env.FRONTEND_URL = 'http://app.advancemais.com';
    const controller = new EmailVerificationController();
    // @ts-ignore accessing private property for test
    controller['emailService'] = {
      verifyEmailToken: jest.fn().mockResolvedValue({ valid: true, userId: '1' })
    } as any;

    const app = express();
    app.get('/verificar-email', controller.verifyEmail);

    const res = await request(app).get('/verificar-email?token=test');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://app.advancemais.com');
  });

  it('returns 400 for invalid token', async () => {
    const controller = new EmailVerificationController();
    // @ts-ignore
    controller['emailService'] = {
      verifyEmailToken: jest.fn().mockResolvedValue({ valid: false, error: 'Token inválido' })
    } as any;

    const app = express();
    app.get('/verificar-email', controller.verifyEmail);

    const res = await request(app).get('/verificar-email?token=bad');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});
