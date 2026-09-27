import nodemailer from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';
import { mailConfigured, type Env } from '../env.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; cid: string; contentType: string }[];
}

export interface Mailer {
  readonly enabled: boolean;
  send(message: MailMessage): Promise<void>;
}

/**
 * SMTP mail (e.g. Gmail with an app password: smtp.gmail.com:465). Sent from the server, so no mail
 * credentials or templates live in the browser bundle anymore.
 */
export function createMailer(env: Env, log: FastifyBaseLogger): Mailer {
  if (!mailConfigured(env)) {
    log.warn('SMTP is not configured -- order emails are logged, not sent.');
    return {
      enabled: false,
      async send(message) {
        log.info({ to: message.to, subject: message.subject }, 'Email skipped (SMTP not configured)');
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return {
    enabled: true,
    async send(message) {
      await transport.sendMail({ from: env.MAIL_FROM, ...message });
    },
  };
}
