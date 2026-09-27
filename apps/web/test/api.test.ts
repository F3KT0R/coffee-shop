import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../src/lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('surfaces the server error code, message and field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Proverite unete podatke.',
              fields: { 'customer.email': 'Loš email' },
            },
          },
          { status: 400 },
        ),
      ),
    );
    const error = await api.config().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      fields: { 'customer.email': 'Loš email' },
    });
    expect((error as ApiError).transient).toBe(false);
  });

  it('treats a non-JSON gateway error (API waking up) as transient', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })),
    );
    const error = (await api.config().catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('UNAVAILABLE');
    expect(error.transient).toBe(true);
  });

  it('turns a network failure into a friendly, retryable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const error = (await api.config().catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.transient).toBe(true);
  });

  it('sends the idempotency key with new orders', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ number: '260927-0001', accessToken: 't' }, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await api.createOrder({} as never, 'key-123456');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-123456');
  });
});
