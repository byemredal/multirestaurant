import { Injectable, Logger } from '@nestjs/common';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailTransport = 'log' | 'smtp' | 'sendgrid' | 'mailgun' | 'ses';

export type EmailSendResult = {
  delivered: boolean;
  transport: EmailTransport;
  stub: boolean;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  resolveTransport(): EmailTransport {
    const transport = (process.env.EMAIL_TRANSPORT ?? 'log').toLowerCase();
    if (transport === 'smtp' || transport === 'sendgrid' || transport === 'mailgun' || transport === 'ses') {
      return transport;
    }
    return 'log';
  }

  isStubTransport(): boolean {
    return this.resolveTransport() === 'log';
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const transport = this.resolveTransport();

    if (transport !== 'log') {
      this.logger.warn(
        JSON.stringify({
          event: 'email_transport_not_implemented',
          requested: transport,
          fallback: 'log',
          to: message.to,
          subject: message.subject,
        }),
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'email_queued',
        transport: 'log',
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    );

    return { delivered: false, transport: 'log', stub: true };
  }
}
