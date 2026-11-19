import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class SmtpMailer implements Mailer {
  readonly #transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.#transport = nodemailer.createTransport(smtpUrl);
  }

  async send(message: MailMessage): Promise<void> {
    await this.#transport.sendMail({ from: this.from, ...message });
  }
}

/** Keeps messages in memory; used by tests. */
export class MemoryMailer implements Mailer {
  readonly messages: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }
}
