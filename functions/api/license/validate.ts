const POLAR_VALIDATE_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/validate';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-VaultFlow-License-Proxy': '1',
    },
  });
}

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ detail: 'Invalid JSON body.' }, 400);
  }

  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ detail: 'Invalid request payload.' }, 400);
  }

  const record = payload as Record<string, unknown>;
  const key = typeof record.key === 'string' ? record.key.trim() : '';
  const organizationId =
    typeof record.organization_id === 'string' ? record.organization_id.trim() : '';
  const activationId =
    typeof record.activation_id === 'string' && record.activation_id.trim()
      ? record.activation_id.trim()
      : undefined;

  if (!key || !organizationId) {
    return jsonResponse({ detail: 'Missing key or organization_id.' }, 400);
  }

  const upstreamBody: Record<string, string> = {
    key,
    organization_id: organizationId,
    ...(activationId ? { activation_id: activationId } : {}),
  };

  try {
    const upstream = await fetch(POLAR_VALIDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(upstreamBody),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'no-store',
        'X-VaultFlow-License-Proxy': '1',
      },
    });
  } catch {
    return jsonResponse({ detail: 'Unable to reach license server.' }, 502);
  }
}
