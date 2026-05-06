// ============================================================
// AI generation handler for FusionOps API Worker
// ============================================================
// Routes (all POST, require Gemini or Anthropic key):
//   /api/ai/generate-copy         hero copy (h1, title2, cta, sub, badge, tagline, mechanism)
//   /api/ai/generate-meta         meta title + description
//   /api/ai/generate-description  short template description
//   /api/ai/generate-reviews      3 customer review objects
//
// Key resolution priority: request body → env secret → D1 settings.
// Provider order: Gemini-first, Anthropic-fallback (see lib/ai.js).
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../lib/http.js';
import { callAI, extractJson } from '../lib/ai.js';

/** Resolve AI keys from request body, env, then D1 settings. */
async function resolveAiKeys(db, body, env) {
  const d1GeminiRow = await db.prepare("SELECT value FROM settings WHERE key = 'geminiKey'").first().catch(() => null);
  const d1AnthropicRow = await db.prepare("SELECT value FROM settings WHERE key = 'anthropicKey'").first().catch(() => null);
  const geminiKey = body.geminiKey || env.GEMINI_API_KEY || (d1GeminiRow?.value || '');
  const anthropicKey = body.anthropicKey || env.ANTHROPIC_API_KEY || (d1AnthropicRow?.value || '');
  return { geminiKey, anthropicKey };
}

function buildCopyPrompt({ brand, loanType, amountMin, amountMax, lang }) {
  // ─── Niche detection (keyword match on loanType) ────────────────
  const detectNiche = (lt) => {
    const t = String(lt || '').toLowerCase();
    if (/\b(pet|vet|dog|cat|animal)\b/.test(t)) return 'pet';
    if (/\b(auto|car|vehicle|truck)\b/.test(t)) return 'auto';
    if (/\b(payday|cash advance|paycheck)\b/.test(t)) return 'payday';
    if (/\b(medical|dental|health|surgery)\b/.test(t)) return 'medical';
    return 'default';
  };

  // Niche-aware safe vocabulary (replaces banned "Personal Loans" phrase)
  const SAFE_TERMS = {
    pet:     'Pet Funding · Care Financing · Payment Plans',
    auto:    'Auto Cash · Vehicle Financing · Same-Day Funds',
    payday:  'Quick Cash · Short-Term Funds · Paycheck Advance',
    medical: 'Care Financing · Medical Payment Plans',
    default: 'Fast Cash · Quick Funding · Personal Finance',
  };

  // Niche-aware pain-hook examples (fuels H1 Pattern e — Halbert Emotional Hook)
  const PAIN_HOOKS = {
    pet:     'Unexpected vet bill? Pet emergency? Surgery this week?',
    auto:    'Car broke down? Need wheels to keep your job?',
    payday:  'Short till payday? Rent due before Friday?',
    medical: 'Medical bill surprise? Copay gap? Dental emergency?',
    default: 'Unexpected expense? Need cash by tomorrow?',
  };

  const niche = detectNiche(loanType);
  const safeTerms = SAFE_TERMS[niche];
  const painHook = PAIN_HOOKS[niche];
  const painLead = painHook.split('?')[0];
  const nicheCashLabel = niche === 'pet' ? 'Pet Cash' : niche === 'auto' ? 'Auto Cash' : niche === 'medical' ? 'Care Cash' : 'Cash';

  // ─── Randomization seeds (force variety across generations) ─────
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const PATTERNS = ['a', 'b', 'c', 'd', 'e'];
  const TONES = ['urgent', 'reassuring', 'bold', 'friendly', 'confident', 'direct', 'empathetic'];
  const ANGLES = ['speed', 'trust', 'ease', 'relief', 'surprise', 'control', 'dignity', 'security'];
  const CTA_VERBS = ['See', 'Get', 'Check', 'View', 'Claim', 'Unlock', 'Reveal', 'Show'];
  const NUMBER_STYLES = ['exact-amount', 'time-duration', 'count-of-customers', 'percentage', 'years-in-business'];
  const seed = {
    pattern: pick(PATTERNS),
    tone: pick(TONES),
    angle: pick(ANGLES),
    ctaVerb: pick(CTA_VERBS),
    numberStyle: pick(NUMBER_STYLES),
  };

  return `You are a senior direct-response copywriter trained in the schools of
Eugene Schwartz (Unique Mechanism), Gary Halbert (Emotional Hook), David Ogilvy (Authority),
and Robert Cialdini (Influence). Write MOBILE above-the-fold copy for a ${loanType} landing
page that must convert PPC traffic and PASS Google Ads Financial Services policy review.

The user's eyes scan H1 → Title 2 → CTA Button → Sub-headline in <2 seconds on a phone.
Every word must earn its place. Write for a tired, skeptical buyer on their phone at 10pm.

CONTEXT:
Brand: ${brand}
Loan type: ${loanType}
Niche detected: ${niche}
Amount range: $${amountMin}–$${amountMax}
Language: ${lang}

═══ THIS GENERATION'S CREATIVE SEED (use these, do not override) ═══
• H1 Pattern to use: (${seed.pattern})
• Emotional tone: ${seed.tone}
• Psychological angle: ${seed.angle}
• CTA opening verb: "${seed.ctaVerb}" (use this verb, not others)
• Number style for H1: ${seed.numberStyle}

═══ ANTI-VERBATIM RULE ═══
The examples below show PATTERN STRUCTURE only — DO NOT copy any example phrase word-for-word.
Specifically BANNED verbatim phrases (create your own variations):
  "60-Second Cash", "Soft-Pull Only", "No FICO Drop", "Funded Tomorrow",
  "12,000+ Funded This Month", "BBB A+ · Since 2012", "No Obligation to Accept",
  "500K+ Customers Served", "2-minute form. Soft credit check."
Write fresh copy that follows the framework but uses DIFFERENT words, numbers, and phrasing.

═══ HARD RULES (violating = fail) ═══
1. NEVER use the literal phrase "Personal Loans".
2. NO jargon: APR, FICO, origination, underwriting, amortization, unsecured.
3. NO weasel words: "best", "leading", "premium", "top-rated", "world-class".
4. NO generic verbs in CTA: avoid "Learn More", "Click Here", "Submit", "Apply Now".
5. Mobile-safe: H1 must fit 2 lines on 375px viewport (≤48 chars total).
6. Respect Language: ${lang} (translate all output to target language, but keep the
   concept-level bans from rules 7 & 8 — do not translate banned phrases back in).
7. Google Ads Financial Services Compliance — BANNED phrases (any form, any language):
   - "guaranteed approval" / "guaranteed rate" / "100% approved"
   - "instant approval" / "instant money" / "free money"
   - "no credit check" — use "soft credit check" instead
   - Do NOT make absolute time guarantees ("always", "every time")
   - Do NOT claim specific approval odds ("9 out of 10 approved")
8. Niche-aware vocabulary — use ONLY these safe terms for the product (niche: ${niche}):
   ${safeTerms}

═══ FIELD-SPECIFIC FRAMEWORKS ═══

H1 (hero headline, 4–7 words, ≤48 chars):
  Pick ONE of these 5 proven patterns (rotate across generations):
  a) Amount + Speed (direct):       "Get $${amountMax} Cash in 24 Hours"
  b) Problem + Solution (grounded): "Unexpected Bill? Get Cash Fast."
  c) Benefit + Specificity:         "$${amountMin}–$${amountMax} Funded Tomorrow"
  d) Unique Mechanism (Schwartz):   "$${amountMax} ${nicheCashLabel} via Soft-Pull Only"
     (name the specific method/angle — what's DIFFERENT from competitors)
  e) Emotional Hook (Halbert):      "${painLead}? 60-Second Cash."
     (name the exact fear from the niche + offer exact relief)
  Rule: must contain a NUMBER (amount OR time) and a CONCRETE benefit.

Title 2 (supporting subheadline, 3–6 words, ≤40 chars):
  Purpose = kill the #1 objection using Cialdini trust triggers:
    • Social Proof:    "12,000+ Funded This Month"
    • Authority:       "BBB A+ · Since 2012"
    • Risk Reversal:   "Soft Credit Check Only"
    • Commitment:      "No Obligation to Accept"
  Rule: must NOT repeat any word from H1. No CTA verbs.

CTA (button text, 2–4 words, ≤24 chars):
  Use first-person benefit framing (proven +90% CTR vs "Apply Now"):
  Good: "See My Rate", "Check My Offer", "Get My Cash", "View My Options"
  Bad: "Apply Now", "Submit", "Click Here", "Learn More"
  Rule: must start with an action verb + possessive pronoun (my/your).

Sub-headline (reassurance line, 8–14 words, ≤90 chars):
  Formula: [Speed/Simplicity] + [Risk Removal] + [Outcome]
  Example: "2-minute form. Soft credit check. Funds by next business day."
  Rule: must contain at least 2 of: speed, no-credit-impact, simple-form, funding-time.

Trust Badge (tiny chip shown near hero, 3–5 words, ≤28 chars):
  Factual, specific, verifiable-sounding:
  Good: "Soft Pull · No FICO Drop", "500K+ Customers Served"
  Bad: "Trusted Lender", "Award Winning"

Tagline (brand promise, 3–5 words, ≤28 chars):
  ${brand}'s one-line identity — e.g. "Fast. Simple. Trusted."

Mechanism (Schwartz unique angle, 2–4 words):
  The ONE thing that makes this offer different. Examples:
  "Soft-Pull Only", "60-Second Form", "Same-Day Funding", "No Paystubs Needed"

═══ OUTPUT ═══
CRITICAL: Respond with ONE valid JSON object. Start your response with { and end with }.
Do NOT wrap in markdown code fences. Do NOT add any prose before or after the JSON.
Do NOT use angle brackets like <headline> — replace them with your actual copy.

Required JSON shape (fill every field with real copy, not placeholders):
{"h1":"","title2":"","cta":"","sub":"","badge":"","tagline":"","mechanism":""}`;
}

async function handleGenerateCopy({ request, env, db }) {
  try {
    const body = await request.json();
    const { geminiKey, anthropicKey } = await resolveAiKeys(db, body, env);
    if (!geminiKey && !anthropicKey) {
      return json({ error: 'No AI API key configured. Add Gemini API Key in Settings.' }, 400);
    }
    const { brand = '', loanType = 'personal loan', amountMin = 100, amountMax = 5000, lang = 'English' } = body;
    const prompt = buildCopyPrompt({ brand, loanType, amountMin, amountMax, lang });
    const enrichedBody = { ...body, geminiKey, anthropicKey };
    const text = await callAI(env, enrichedBody, prompt, 2048);
    const jsonStr = extractJson(text);
    if (!jsonStr) return json({ error: 'AI returned unexpected format', raw: text.slice(0, 500) }, 500);
    return json(JSON.parse(jsonStr));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleGenerateMeta({ request, env, db }) {
  try {
    const body = await request.json();
    const { geminiKey, anthropicKey } = await resolveAiKeys(db, body, env);
    if (!geminiKey && !anthropicKey) {
      return json({ error: 'No AI API key configured. Add Gemini API Key in Settings.' }, 400);
    }
    const { brand = '', domain = '', loanType = 'personal loan', amountMin = 100, amountMax = 5000, h1 = '', cta = '', lang = 'English' } = body;
    const prompt = `You are an PPC Google Ads copywriter for loan landing pages.
Generate meta title and description. Respond ONLY with valid JSON.
IMPORTANT: Never use the exact phrase "Personal Loans" in your output. Use alternatives like "personal finance", "quick funding", or "fast cash" instead.

Brand: ${brand}
Domain: ${domain}
Loan type: ${loanType}
Amount range: $${amountMin} – $${amountMax}
Hero H1: ${h1}
CTA: ${cta}
Language: ${lang}

Return this exact JSON shape:
{
  "metaTitle": "PPC title (50-60 chars, include brand and amount)",
  "metaDesc": "Meta description (140-160 chars, include CTA and amount)"
}`;
    const enrichedBody = { ...body, geminiKey, anthropicKey };
    const text = await callAI(env, enrichedBody, prompt, 1024);
    const jsonStr = extractJson(text);
    if (!jsonStr) return json({ error: 'AI returned unexpected format', raw: text.slice(0, 500) }, 500);
    return json(JSON.parse(jsonStr));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleGenerateDescription({ request, env, db }) {
  try {
    const body = await request.json();
    const { geminiKey, anthropicKey } = await resolveAiKeys(db, body, env);
    if (!geminiKey && !anthropicKey) {
      return json({ error: 'No AI API key configured. Add Gemini API Key in Settings.' }, 400);
    }
    const { templateName = '', format = 'astro', files = [] } = body;
    const fileList = Array.isArray(files) ? files.slice(0, 20).join(', ') : '';
    const prompt = `You are a UI component library documenter. Write a single short description (1–2 sentences, max 120 chars) for a landing page template.\n\nTemplate name: "${templateName}"\nFormat: ${format}\nKey files: ${fileList}\n\nRespond ONLY with a plain string — no JSON, no quotes, no markdown.`;
    const enrichedBody = { ...body, geminiKey, anthropicKey };
    const text = await callAI(env, enrichedBody, prompt, 150);
    const desc = text.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0].trim();
    return json({ description: desc });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleGenerateReviews({ request, env, db }) {
  try {
    const body = await request.json();
    const { geminiKey, anthropicKey } = await resolveAiKeys(db, body, env);
    if (!geminiKey && !anthropicKey) {
      return json({ error: 'No AI API key configured. Add Gemini API Key in Settings.' }, 400);
    }
    const { brand = '', loanType = 'personal finance', amountMax = 5000 } = body;
    const prompt = `You are a UX copywriter. Generate 3 short, realistic customer reviews for a ${loanType} landing page. Each review must match the loan category context. Different names, states, situations. Respond ONLY with valid JSON array.\n\nBrand: ${brand}, Amount up to: $${amountMax}\n\n[\n  {"name":"First L.","location":"City, ST","rating":5,"text":"1-2 sentence review"},\n  {...},\n  {...}\n]`;
    const enrichedBody = { ...body, geminiKey, anthropicKey };
    const text = await callAI(env, enrichedBody, prompt, 1024);
    const jsonStr = extractJson(text);
    if (!jsonStr) return json({ error: 'AI returned unexpected format', raw: text.slice(0, 300) }, 500);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (pe) {
      return json({ error: 'Invalid JSON from AI', detail: pe.message, raw: jsonStr.slice(0, 400) }, 500);
    }
    if (!Array.isArray(parsed) && Array.isArray(parsed?.reviews)) {
      parsed = parsed.reviews;
    }
    if (!Array.isArray(parsed)) {
      return json({ error: 'AI must return a JSON array of reviews', raw: jsonStr.slice(0, 300) }, 500);
    }
    return json(parsed);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

/**
 * Route entry. Returns Response if path matches `/api/ai/(copy|meta|description|reviews)`; null otherwise.
 */
export async function handleAiGenerationRoute({ request, env, db, path, method }) {
  if (method !== 'POST') return null;
  if (path === '/api/ai/generate-copy') return handleGenerateCopy({ request, env, db });
  if (path === '/api/ai/generate-meta') return handleGenerateMeta({ request, env, db });
  if (path === '/api/ai/generate-description') return handleGenerateDescription({ request, env, db });
  if (path === '/api/ai/generate-reviews') return handleGenerateReviews({ request, env, db });
  return null;
}
