/**
 * Create/update GitHub Actions repository secrets via REST API (libsodium sealed box).
 * @see https://docs.github.com/en/rest/actions/secrets
 */

const GITHUB_API = "https://api.github.com";

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** True if UI shows a placeholder instead of a real PAT (do not send to API). */
export function isLikelyMaskedGithubSecret(value) {
  const s = String(value || "").trim();
  return s.length > 0 && /^[•*\s]+$/.test(s);
}

/**
 * @param {object} p
 * @param {string} p.token       GitHub PAT: classic `repo` or fine-grained with Actions secrets write
 * @param {string} p.owner
 * @param {string} p.repo
 * @param {string} p.secretName  e.g. CLOUDFLARE_API_TOKEN
 * @param {string} p.secretValue plaintext
 */
export async function putGithubRepoSecret({ token, owner, repo, secretName, secretValue }) {
  const sodium = (await import("libsodium-wrappers")).default;
  await sodium.ready;

  const headers = githubHeaders(token);
  const pkUrl = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/secrets/public-key`;
  const pkRes = await fetch(pkUrl, { headers });
  if (!pkRes.ok) {
    const t = await pkRes.text();
    throw new Error(`GitHub public-key ${pkRes.status}: ${t.slice(0, 240)}`);
  }
  const { key_id, key: keyB64 } = await pkRes.json();

  const binKey = sodium.from_base64(keyB64, sodium.base64_variants.ORIGINAL);
  const msg = sodium.from_string(secretValue);
  const sealed = sodium.crypto_box_seal(msg, binKey);
  const encrypted_value = sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);

  const putUrl = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/secrets/${encodeURIComponent(secretName)}`;
  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted_value, key_id }),
  });
  if (!putRes.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await putRes.json());
    } catch {
      detail = await putRes.text();
    }
    throw new Error(`GitHub PUT ${secretName} → ${putRes.status}: ${detail.slice(0, 400)}`);
  }
}

/**
 * Writes CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for deploy-lp.yml / wrangler.
 */
export async function syncCloudflareRepoSecrets({ token, owner, repo, cfApiToken, cfAccountId }) {
  const tok = String(cfApiToken || "").trim();
  const aid = String(cfAccountId || "").trim();
  if (!tok) throw new Error("Missing Cloudflare API token");
  if (!aid || !/^[0-9a-f]{32}$/i.test(aid)) throw new Error("Cloudflare Account ID must be 32 hex characters");
  await putGithubRepoSecret({
    token,
    owner,
    repo,
    secretName: "CLOUDFLARE_API_TOKEN",
    secretValue: tok,
  });
  await putGithubRepoSecret({
    token,
    owner,
    repo,
    secretName: "CLOUDFLARE_ACCOUNT_ID",
    secretValue: aid,
  });
}
