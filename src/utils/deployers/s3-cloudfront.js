/**
 * S3 + CloudFront Deploy (P5)
 * Uses AWS S3 PutObject via REST API with SigV4 signing done client-side.
 * Routes through Worker proxy to avoid CORS issues.
 */

const PROXY_PASS = "https://lp-factory-api.songsawat-w.workers.dev/api/proxy/pass";

async function proxyFetch(url, opts = {}) {
  // Route through Worker proxy to bypass CORS
  const proxyUrl = `${PROXY_PASS}?url=${encodeURIComponent(url)}`;
  return fetch(proxyUrl, opts);
}

async function hmacSha256(key, msg) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? new TextEncoder().encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg)));
}

async function sha256Hex(data) {
  const buf = await crypto.subtle.digest("SHA-256", typeof data === "string" ? new TextEncoder().encode(data) : data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(date) {
  return toAmzDate(date).slice(0, 8);
}

async function signV4(method, url, headers, body, accessKey, secretKey, region, service) {
  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);

  headers["x-amz-date"] = amzDate;
  headers["x-amz-content-sha256"] = await sha256Hex(body || "");
  headers["host"] = parsedUrl.host;

  // Canonical request
  const sortedHeaders = Object.keys(headers).sort();
  const signedHeaders = sortedHeaders.map(h => h.toLowerCase()).join(";");
  const canonicalHeaders = sortedHeaders.map(h => `${h.toLowerCase()}:${headers[h].trim()}\n`).join("");
  const canonicalUri = parsedUrl.pathname;
  const canonicalQueryString = parsedUrl.search ? parsedUrl.search.slice(1) : "";

  const canonicalRequest = [
    method, canonicalUri, canonicalQueryString,
    canonicalHeaders, signedHeaders,
    headers["x-amz-content-sha256"],
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // Signing key
  const kDate = await hmacSha256("AWS4" + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");

  const signature = Array.from(await hmacSha256(kSigning, stringToSign))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  headers["Authorization"] =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
}

export async function deploy(html, site, settings) {
  const { awsAccessKey, awsSecretKey, awsRegion, s3Bucket, cloudfrontDistId } = settings;
  if (!awsAccessKey || !awsSecretKey || !s3Bucket) {
    return { success: false, error: "Missing AWS credentials or S3 bucket. Configure in Settings." };
  }

  const region = awsRegion || "us-east-1";
  const encoder = new TextEncoder();
  const body = encoder.encode(html);
  const objectKey = "index.html";

  try {
    // 1. PutObject to S3
    const s3Url = `https://${s3Bucket}.s3.${region}.amazonaws.com/${objectKey}`;
    const putHeaders = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "x-amz-acl": "public-read",
    };

    const signedHeaders = await signV4("PUT", s3Url, { ...putHeaders }, body, awsAccessKey, awsSecretKey, region, "s3");
    // Remove host header since fetch sets it automatically
    const fetchHeaders = { ...signedHeaders };
    delete fetchHeaders["host"];

    const s3Res = await proxyFetch(s3Url, {
      method: "PUT",
      headers: fetchHeaders,
      body,
    });

    if (!s3Res.ok) {
      const errText = await s3Res.text();
      return { success: false, error: `S3 upload failed (${s3Res.status}): ${errText.slice(0, 200)}` };
    }

    // 2. Invalidate CloudFront (optional)
    let cfInvalidationId = null;
    if (cloudfrontDistId) {
      try {
        const callerRef = `lp-${Date.now()}`;
        const invalidationBody = `<?xml version="1.0" encoding="UTF-8"?>
<InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
  <CallerReference>${callerRef}</CallerReference>
  <Paths><Quantity>1</Quantity><Items><Path>/index.html</Path></Items></Paths>
</InvalidationBatch>`;

        const cfUrl = `https://cloudfront.amazonaws.com/2020-05-31/distribution/${cloudfrontDistId}/invalidation`;
        const cfHeaders = { "Content-Type": "application/xml" };
        const signedCfHeaders = await signV4(
          "POST", cfUrl, { ...cfHeaders },
          new TextEncoder().encode(invalidationBody),
          awsAccessKey, awsSecretKey, "us-east-1", "cloudfront"
        );
        delete signedCfHeaders["host"];

        const cfRes = await proxyFetch(cfUrl, {
          method: "POST",
          headers: signedCfHeaders,
          body: invalidationBody,
        });
        if (cfRes.ok) {
          const cfText = await cfRes.text();
          const match = cfText.match(/<Id>([^<]+)<\/Id>/);
          cfInvalidationId = match?.[1];
        }
      } catch (e) {
        // CloudFront invalidation is optional; don't fail the deploy
        console.warn("[S3Deploy] CloudFront invalidation failed (non-critical):", e?.message || e);
      }
    }

    const url = cloudfrontDistId
      ? `https://${cloudfrontDistId}.cloudfront.net/`
      : `https://${s3Bucket}.s3.${region}.amazonaws.com/${objectKey}`;

    return {
      success: true,
      url,
      deployId: `s3-${Date.now()}`,
      target: "s3-cloudfront",
      meta: { cfInvalidationId },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
