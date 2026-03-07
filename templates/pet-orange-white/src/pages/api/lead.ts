import type { APIRoute } from "astro";
import { leadsgateCallbackSchema } from "../../lib/validation";

export const POST: APIRoute = async ({ request, url }) => {
  const backendBaseUrl = import.meta.env.BACKEND_BASE_URL;
  const callbackToken = import.meta.env.CALLBACK_TOKEN;
  const defaultAccountId = import.meta.env.DEFAULT_ACCOUNT_ID;
  const accountId = url.searchParams.get("account_id") ?? defaultAccountId ?? "";

  if (!backendBaseUrl) {
    return Response.json({ error: "Server misconfigured: BACKEND_BASE_URL is missing." }, { status: 500 });
  }

  if (!callbackToken) {
    return Response.json({ error: "Server misconfigured: CALLBACK_TOKEN is missing." }, { status: 500 });
  }

  if (!accountId) {
    return Response.json(
      { error: "Missing account_id. Pass ?account_id=... or configure DEFAULT_ACCOUNT_ID." },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = leadsgateCallbackSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed.", details: parsed.error.flatten() }, { status: 400 });
  }

  const endpoint = new URL(`/callback/${encodeURIComponent(accountId)}/leadsgate`, backendBaseUrl);
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-callback-token": callbackToken,
    },
    body: JSON.stringify(parsed.data),
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const bodyText = await upstream.text();
  return new Response(bodyText, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
};
