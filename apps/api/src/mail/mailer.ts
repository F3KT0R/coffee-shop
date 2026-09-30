import nodemailer from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';
import { mailConfigured, mailRelayConfigured, type Env } from '../env.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface Mailer {
  readonly enabled: boolean;
  send(message: MailMessage): Promise<void>;
}

const RELAY_TIMEOUT_MS = 30_000;

/**
 * Sends through the Gmail relay (a Google Apps Script web app, see apps/api/mail-relay/Code.gs): one
 * HTTPS POST per message. Apps Script runs the script on the POST itself, then redirects to a one-off
 * URL holding its output -- the relay's JSON verdict. That URL only answers GET, and a 307 redirect
 * would make fetch repeat the POST there (a 404), so the redirect is followed by hand, always as a GET.
 */
function createRelayMailer(env: Env, fetchImpl: typeof fetch): Mailer {
  const url = env.MAIL_RELAY_URL!;
  const secret = env.MAIL_RELAY_SECRET!;
  return {
    enabled: true,
    async send(message) {
      const signal = AbortSignal.timeout(RELAY_TIMEOUT_MS);
      let response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, name: env.MAIL_FROM_NAME, ...message }),
        redirect: 'manual',
        signal,
      });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        response = await fetchImpl(new URL(location, url), { method: 'GET', redirect: 'follow', signal });
      }
      const body = await response.text();
      let verdict: { ok?: boolean; error?: string };
      try {
        verdict = JSON.parse(body) as typeof verdict;
      } catch {
        // Typically Google's HTML sign-in page: the web app isn't deployed with access "Anyone".
        throw new Error(
          `Mail relay answered HTTP ${response.status} without JSON -- check the URL and access`,
        );
      }
      if (!response.ok || verdict.ok !== true) {
        throw new Error(`Mail relay refused: ${verdict.error ?? `HTTP ${response.status}`}`);
      }
    },
  };
}

/**
 * Order emails. The Gmail relay wins when configured; plain SMTP (smtp.gmail.com:465 with an app
 * password) needs a paid Render instance, since free instances block outbound SMTP ports.
 */
export function createMailer(env: Env, log: FastifyBaseLogger, fetchImpl: typeof fetch = fetch): Mailer {
  if (!mailConfigured(env)) {
    log.warn('Email is not configured -- order emails are logged, not sent.');
    return {
      enabled: false,
      async send(message) {
        log.info({ to: message.to, subject: message.subject }, 'Email skipped (not configured)');
      },
    };
  }
  if (mailRelayConfigured(env)) return createRelayMailer(env, fetchImpl);

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
