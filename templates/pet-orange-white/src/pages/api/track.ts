import type { APIRoute } from "astro";
import { trackEventSchema } from "../../lib/validation";

export const POST: APIRoute = async ({ request }) => {
  const backendBaseUrl = import.meta.env.BACKEND_BASE_URL;
  if (!backendBaseUrl) {
    return Response.json({ error: "Server misconfigured: BACKEND_BASE_URL is missing." }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = trackEventSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed.", details: parsed.error.flatten() }, { status: 400 });
  }

  const normalized = {
    ...parsed.data,
    timestamp: parsed.data.timestamp ?? new Date().toISOString(),
  };

  const upstream = await fetch(new URL("/track", backendBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(normalized),
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const bodyText = await upstream.text();
  return new Response(bodyText, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
};
