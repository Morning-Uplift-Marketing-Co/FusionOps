export const prerender = false;

export async function POST({ request }) {
  let data;

  try {
    data = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  if (!data.e || !data.cid) {
    return new Response('invalid', { status: 400 });
  }

  // TODO: forward to worker / DB
  console.log('[TRACK]', data);

  return new Response('ok');
}
