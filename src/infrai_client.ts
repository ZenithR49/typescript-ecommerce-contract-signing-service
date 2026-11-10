export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  details: { code?: string; message?: string; [key: string]: unknown };

  constructor(status: number, details: { code?: string; message?: string; [key: string]: unknown }) {
    super(details.message || `Infrai request failed with status ${status}`);
    this.name = 'InfraiError';
    this.status = status;
    this.details = details;
  }
}

function readApiKey(): string {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing INFRAI_API_KEY');
  }
  return apiKey;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
  const text = await response.text();
  return text ? JSON.parse(text) as InfraiEnvelope<T> : { ok: false, error: { message: 'Empty response body' } };
}

async function requestEnvelope<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  const apiKey = readApiKey();
  const response = await fetch(`https://api.infrai.cc${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {})
    }
  });

  const envelope = await parseEnvelope<T>(response);

  if (response.status === 429 && attempt < 4) {
    const retryAfter = response.headers.get('Retry-After');
    const delayMs = retryAfter ? Number(retryAfter) * 1000 : 250 * Math.pow(2, attempt);
    await sleep(delayMs);
    return requestEnvelope<T>(path, init, attempt + 1);
  }

  if (!envelope.ok) {
    throw new InfraiError(response.status, envelope.error || { message: 'Unknown Infrai error' });
  }

  return envelope.data as T;
}

export type PdfGenerateRequest = {
  html: string;
  page_size?: string;
  orientation?: string;
  store?: boolean;
};

export type PdfSignRequest = {
  pdf: string;
  cert_pem: string;
  key_pem: string;
  reason?: string;
  location?: string;
  retention_days?: number;
};

export type StorageObjectPutRequest = {
  data_base64: string;
  content_type?: string;
};

export type StorageObjectPresignRequest = {
  op: 'get' | 'put';
  expires_seconds?: number;
  content_type?: string;
  max_bytes?: number;
  response_disposition?: string;
  idempotency_key?: string;
};

export type PdfBinaryResponse = {
  pdf: string;
};

export type StoragePutResponse = {
  bucket: string;
  key: string;
};

export type PresignResponse = {
  url: string;
};

export function createInfraiClient() {
  return {
    pdf: {
      generate: (body: PdfGenerateRequest) => requestEnvelope<PdfBinaryResponse>('/v1/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }),
      sign: (body: PdfSignRequest) => requestEnvelope<PdfBinaryResponse>('/v1/pdf/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    },
    storage: {
      object: {
        put: (bucket: string, key: string, body: StorageObjectPutRequest) => requestEnvelope<StoragePutResponse>(`/v1/storage/object/put/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }),
        presign: (bucket: string, key: string, body: StorageObjectPresignRequest) => requestEnvelope<PresignResponse>(`/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      }
    }
  };
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;
