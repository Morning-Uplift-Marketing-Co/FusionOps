export const GET = () => new Response(null, {
  status: 204,
  headers: { 'Access-Control-Allow-Origin': '*' }
});
