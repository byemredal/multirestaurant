import { Injectable, Logger } from '@nestjs/common';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async send(message: EmailMessage) {
    const transport = process.env.EMAIL_TRANSPORT ?? 'log';

    if (transport !== 'log') {
      this.logger.warn(
        `EMAIL_TRANSPORT=${transport} is not implemented yet. Falling back to log transport.`,
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'email_queued',
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    );

    return { delivered: false, transport: 'log' as const };
  }
}
