import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Behavioral guarantees the production-hardening pass cares about:
 *   1) EMAIL_TRANSPORT=smtp with missing config DOES NOT fake delivery.
 *   2) EMAIL_TRANSPORT=log under NODE_ENV=production DOES NOT fake delivery
 *      and emits an error log so an alert pipeline can pick it up.
 *
 * We intentionally do NOT exercise nodemailer here — these tests verify the
 * EmailService contract that downstream callers (phone OTP, password setup)
 * rely on to decide whether to refuse or record `unavailable`.
 */
describe('EmailService — production hardening behavior', () => {
  const originalEnv = { ...process.env };

  function restoreEnv() {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }

  beforeEach(() => {
    // Each test fully controls EMAIL_TRANSPORT + NODE_ENV. Reset before so a
    // leftover `EMAIL_TRANSPORT=smtp` from earlier suites cannot bleed in.
    delete process.env.EMAIL_TRANSPORT;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.EMAIL_FROM_ADDRESS;
    delete process.env.EMAIL_FROM_NAME;
    delete process.env.SMTP_SECURE;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('EMAIL_TRANSPORT=smtp + missing SMTP config', () => {
    it('falls back to stub transport (isStubTransport=true) without throwing on boot', () => {
      process.env.EMAIL_TRANSPORT = 'smtp';
      // No SMTP_HOST / SMTP_USER / SMTP_PASSWORD / EMAIL_FROM_ADDRESS set.
      const service = new EmailService();
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      service.onModuleInit();

      expect(service.resolveTransport()).toBe('smtp');
      expect(service.isStubTransport()).toBe(true);
      // One error log was emitted for the missing-config event so operators
      // know the prod misconfig is observable.
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('send() returns delivered:false / stub:true and DOES NOT call any real transporter', async () => {
      process.env.EMAIL_TRANSPORT = 'smtp';
      const service = new EmailService();
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      service.onModuleInit();

      const result = await service.send({
        to: 'tenant@example.com',
        subject: 'subj',
        text: 'body',
      });

      expect(result.delivered).toBe(false);
      expect(result.stub).toBe(true);
      // We INTENDED smtp but degraded — transport in the result is the
      // honest 'log' so downstream callers do not assume an SMTP path
      // succeeded.
      expect(result.transport).toBe('log');
    });
  });

  describe('EMAIL_TRANSPORT=log under NODE_ENV=production', () => {
    it('send() does NOT report delivery success and emits an error log', async () => {
      process.env.EMAIL_TRANSPORT = 'log';
      process.env.NODE_ENV = 'production';
      const service = new EmailService();
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      // onModuleInit short-circuits when transport !== 'smtp'; explicitly
      // call it so the test mirrors a real Nest bootstrap.
      service.onModuleInit();

      const result = await service.send({
        to: 'tenant@example.com',
        subject: 'subj',
        text: 'body',
      });

      expect(result.delivered).toBe(false);
      expect(result.stub).toBe(true);
      expect(result.transport).toBe('log');

      // The production-mode log path emits an error so an alert pipeline
      // can fire. The non-prod path uses a plain log line — verify the
      // production-specific event was at the error level here.
      const errorCalls = errorSpy.mock.calls.flat().join('|');
      expect(errorCalls).toContain('email_transport_log_in_production');

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('describeTransport()', () => {
    it('reports requested=smtp + effective=log when config is missing', () => {
      process.env.EMAIL_TRANSPORT = 'smtp';
      const service = new EmailService();
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      service.onModuleInit();

      const desc = service.describeTransport();
      expect(desc.requested).toBe('smtp');
      expect(desc.effective).toBe('log');
      expect(desc.initError).toMatch(/missing_env:/);
    });
  });
});
