import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Env } from '../src/env.js';
import { createMailer } from '../src/mail/mailer.js';

const log = { warn() {}, info() {} } as unknown as FastifyBaseLogger;
const env = {
  MAIL_RELAY_URL: 'https://script.google.com/macros/s/abc/exec',
  MAIL_RELAY_SECRET: 's'.repeat(32),
  MAIL_FROM_NAME: 'Kafe za Vas',
} as Env;
const message = {
  to: 'ana@example.com',
  subject: 'Porudžbina',
  html: '<p>Hvala</p>',
  text: 'Hvala',
  replyTo: 'x@y.rs',
};

function relay(answer: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return answer;
  }) as unknown as typeof fetch;
  return { mailer: createMailer(env, log, fetchImpl), calls };
}

describe('Gmail relay mailer', () => {
  it('posts the finished email with the shared secret and sender name', async () => {
    const { mailer, calls } = relay(Response.json({ ok: true, remainingToday: 99 }));
    expect(mailer.enabled).toBe(true);
    await mailer.send(message);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(env.MAIL_RELAY_URL);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      secret: env.MAIL_RELAY_SECRET,
      name: 'Kafe za Vas',
      ...message,
    });
  });

  it('fails when the relay refuses (wrong secret, Gmail quota...)', async () => {
    const { mailer } = relay(Response.json({ ok: false, error: 'unauthorized' }));
    await expect(mailer.send(message)).rejects.toThrow(/unauthorized/);
  });

  it('explains a non-JSON answer (web app not shared with "Anyone")', async () => {
    const { mailer } = relay(new Response('<html>Sign in</html>', { status: 200 }));
    await expect(mailer.send(message)).rejects.toThrow(/without JSON/);
  });

  it('is disabled when nothing is configured', () => {
    expect(createMailer({ MAIL_FROM_NAME: 'Kafe za Vas' } as Env, log).enabled).toBe(false);
  });
});
