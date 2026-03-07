# Flexible Funding Solutions Astro Landing Template

Production-ready Astro + Tailwind landing page template optimized for flexible funding lead generation funnels.

## Stack

- Astro 5
- Tailwind CSS
- Zod schema validation
- Minimal client JavaScript for ZIP validation + redirect

## Run

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## Funnel Behavior

### `/`

- Above-the-fold hero is static HTML for fast first paint.
- ZIP input validates as exactly 5 digits.
- CTA button text: `Check Eligibility →`.
- On submit, redirects to `/apply?zip=XXXXX` while preserving all existing query params (`cid`, `click_id`, `gclid`, `fbclid`, `utm_*`, and any others).

### `/apply`

- Includes LeadsGate contract exactly:
  - `<div id="_lg_form_"></div>`
  - global-scope `var _lg_form_init_ = {...}`
  - SDK script: `https://apikeep.com/form/applicationInit.js`
  - DNS prefetch: `//apikeep.com`

## API Endpoint Mapping

Primary backend contract (upstream backend):

- `POST /track`
- `POST /callback/{account_id}/leadsgate` with header `X-Callback-Token`

Optional Astro wrappers included:

- `POST /api/track` forwards to upstream `POST /track`
- `POST /api/lead?account_id=<id>` forwards to upstream `POST /callback/{account_id}/leadsgate`
  - If `account_id` query param is missing, wrapper falls back to `DEFAULT_ACCOUNT_ID`.

## Environment Variables

Copy `.env.example` to `.env` and configure values.

- Client-safe values must be `PUBLIC_*`.
- Secrets stay server-side only:
  - `BACKEND_BASE_URL`
  - `CALLBACK_TOKEN`

## Validation

Shared Zod schemas are in `src/lib/validation.ts`:

- ZIP schema (`^\d{5}$`)
- Track event payload schema
- LeadsGate callback payload schema (`soldLead | rejectLead | newLead`)

## Compliance Placeholders

Footer includes placeholder legal pages:

- `/loan-disclosure`
- `/privacy-policy`
- `/terms-of-use`
