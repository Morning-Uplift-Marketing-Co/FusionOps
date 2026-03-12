Build a production-ready pet care financing landing page called "BearLoanNow" using Astro with Tailwind CSS. The site is a loan-matching platform (NOT a direct lender) for pet owners seeking installment loans of $200–$10,000 for veterinary expenses.

---

## TECH STACK
- Astro (latest) as the framework
- Tailwind CSS for styling
- lucide-react for icons (via @astrojs/react integration)
- React islands (client:load / client:visible) ONLY for interactive components
- Inter font from Google Fonts
- zod for ZIP code validation only

---

## COLOR PALETTE & DESIGN
Primary: teal (teal-700 = #0f766e, teal-800 = #115e59, teal-900 = #134e4a)
Accent: amber-500 (#f59e0b)
Background sections alternate: white → slate-50 → white → gray-50 → amber-50 → teal-900 → slate-50 → white → gray-950 (footer)
Font: Inter (weights 300/400/500/600/700/800/900)
Rounded corners: xl/2xl/3xl throughout. Shadows: shadow-sm, shadow-md, shadow-xl.
8px spacing system. Hover transitions on all interactive elements.

---

## PAGE STRUCTURE (top to bottom)

### 1. TOP BAR (static Astro component)
- Dark teal-900 background, teal-100 text
- Left: phone icon + "+1-800-232-7562" (tel link) | "Mon–Fri, 9:00 AM – 6:00 PM ET"
- Right: "Soft inquiry only • Fast decisions • 4.9/5 stars"
- Hidden on mobile (hidden md:block)

### 2. HEADER (React island, client:load — needs scroll detection)
- Sticky top-0, z-50
- On scroll >60px: bg-white/95 backdrop-blur shadow-md; default: bg-white/98
- Logo: teal-700 rounded-xl box with PawPrint icon (lucide) + "Bear[teal]Loan[/teal]Now" bold text
- Nav links (smooth scroll): "How It Works" → #how-it-works, "Features" → #features, "Reviews" → #reviews, "FAQ" → #faq
- Right: phone link + amber "Apply Now" CTA button (scrolls to #apply)
- Mobile: hamburger menu (Menu/X icon) with slide-down panel containing nav + CTA

### 3. HERO SECTION (React island, client:load)
Background: CSS linear-gradient(135deg, #0f4c4c 0%, #0d6e6e 40%, #0e7f74 70%, #1a6a5a 100%) + subtle white cross-hatch SVG pattern overlay at 10% opacity + teal glow top-right + amber glow bottom-left
- Animated badge: pulsing amber dot + "Installment Loan Solutions — 0% APR Available"
- H1: "Your Pet Deserves the Best Care. We Make It Affordable." (amber-400 on "Best Care.")
- Subheading: "Flexible installment loans from $200 to $10,000 for veterinary and pet care expenses. All credit types considered. Data-driven lending decisions with funds as soon as the next business day — secured with 256-bit SSL encryption."
- ZIP code input form: left-aligned input with MapPin icon + "Check My Rate" amber button. On valid 5-digit ZIP submit → open ApplyModal. Show zod validation error in red-300 below. Below form: "Soft inquiry only · Data-driven lending decision"
- 4 trust badge cards (bg-white/10 border border-white/15 rounded-xl, amber icons):
  1. Star icon | "4.9/5 Stars" | "2,400+ Reviews"
  2. Shield icon | "All Credit Types Considered" | "Soft inquiry only"
  3. Zap icon | "Fast Lending Decision" | "Response in moments"
  4. DollarSign icon | "$200 – $10,000" | "Flexible loan amounts"
- Decorative wave SVG at bottom (fills into slate-50)
- Right side: Pexels vet image (https://images.pexels.com/photos/1350591/pexels-photo-1350591.jpeg?auto=compress&cs=tinysrgb&w=1200) at 10% opacity with left-fade mask, hidden on mobile
- Fade-up animation on all elements with staggered delays

### 4. STATS BAR (React island, client:visible — animated counter)
bg-teal-900, py-14
4 stats in a grid (lg:divide-x lg:divide-teal-700):
- 4.9/5 | Customer Rating
- 2,400+ | Customers Served
- $10k | Maximum Loan Amount
- 256-bit SSL | Data Encryption
Animated count-up using requestAnimationFrame when scrolled into view (IntersectionObserver). Eased cubic-out over 1800ms. Large white extrabold numbers, teal-300 labels uppercase tracking-wider.

### 5. HOW IT WORKS (static Astro)
bg-slate-50, id="how-it-works"
Section label: "Simple Process" (teal-700 uppercase)
H2: "How It Works"
Subtext: "Getting financing for your pet's care is quick, easy, and stress-free."
3-column card layout with horizontal connector line (hidden on mobile):
  Step 01 | ClipboardList icon | "Apply Online" | "Fill out our simple, 3-minute application. No paperwork, no fax, no branch visit required." | amber badge: "Takes about 3 minutes"
  Step 02 | CheckCircle icon | "Receive Your Lending Decision" | "We use a soft credit inquiry with zero impact on your credit score. All credit types considered — most applicants receive a lending decision in moments." | amber badge: "Decision in moments"
  Step 03 | Banknote icon | "Access Your Funds" | "Once approved, funds are deposited directly to your account as soon as the next business day." | amber badge: "Funds next business day"
Each card: bg-white rounded-2xl shadow-sm border hover:shadow-lg hover:-translate-y-1. Icon in teal-50 bg rounded-2xl with numbered circle overlay.

### 6. FEATURES (React island, client:visible — interactive loan calculator)
bg-white, id="features"
Section label: "Why BearLoanNow", H2: "Built for Pet Owners"
Left 2/3: 2-column grid of 8 feature cards (flex gap-4 with icon box + title/description):
  1. DollarSign | "Installment Loans $200 – $10,000"
  2. ShieldCheck | "All Credit Types Considered"
  3. Zap | "Fast Lending Decision"
  4. TrendingUp | "0% APR Available"
  5. Clock | "Funds as Soon as Next Business Day"
  6. Calendar | "Flexible Repayment Terms"
  7. CreditCard | "Multiple Payment Methods"
  8. Lock | "256-Bit SSL Encryption"
Right 1/3: Loan Calculator card (bg-gradient teal-700→teal-900 rounded-2xl text-white):
  - Range slider: Loan Amount $200–$10,000 (step $100), default $3,000
  - Range slider: Repayment Period 2–72 months, default 12
  - Live calculation: monthly = (P * r) / (1 - (1+r)^-n) where r = 9.99% / 12
  - Display: "Estimated Monthly Payment" in amber-400 large font
  - Summary rows: Loan Amount, APR (9.99% example), Total Repaid
  - Note: "This is an estimate only. Actual rates vary by credit profile."

### 7. APR COMPARISON TABLE (static Astro)
bg-gray-50
Section label: "Rate Comparison", H2: "See How We Compare"
Subtitle: "Based on a representative example of a $5,000 loan over 60 months."
Responsive table (overflow-x-auto) with dark gray-900 header:
Columns: Lender | APR Range | Monthly Payment ($5,000/60mo) | Total Repayable | No Hard Pull | Pet-Specific | Same-Day Fund
4 rows:
  BearLoanNow (highlight: teal-50 bg + teal-600 left border + "Best Value" amber badge): 9.99%–35.99% | repr. 9.99% | ✓ | ✓ | ✓
  Traditional Bank Installment Loan: 10.99%–24.99% | repr. 18% | ✗ | ✗ | ✗
  Credit Card (Avg.): 20.49%–29.99% | repr. 24.99% | ✗ | ✗ | ✓
  Vet Payment Plan: 0%–26.99% | repr. 26.99% | ✗ | ✓ | ✗
Calculate monthly payments using: (P * r) / (1 - (1+r)^-n). CheckCircle2 (teal-600) / XCircle (red-400) icons for boolean columns.
Below table: full representative example disclaimer with loan details grid tiles and legal copy.

### 8. ELIGIBLE EXPENSES (static Astro)
bg-amber-50, id="expenses"
Section label: "What's Covered" (amber-700), H2: "Eligible Pet Care Expenses"
4-column grid of 8 cards (bg-white border border-amber-100 rounded-2xl):
  Activity | Emergency Care
  Stethoscope | Routine & Preventive Care
  Scissors | Surgical Procedures
  Bone | Dental Procedures
  Pill | Medications
  UserCog | Specialist Visits
  FlaskConical | Diagnostics & Labs
  Syringe | Rehabilitation
Icon boxes: amber-100 bg rounded-2xl. Hover: amber-200 + shadow-md + -translate-y-1.
CTA banner at bottom: bg-gradient teal-700→teal-800, amber CTA button "Check My Eligibility — Free" (scrolls to #apply)

### 9. TESTIMONIALS (React island, client:visible — auto-playing carousel)
bg-slate-50, id="reviews"
Section label: "Customer Stories", H2: "Trusted by Pet Owners Everywhere"
Star rating: 5 amber stars + "4.9" + "from 2,400+ verified reviews"
Auto-playing carousel (4s interval, pauses on hover) — 3 cards desktop / 2 tablet / 1 mobile:
6 reviews (Sarah M./Dog, James R./Cat, Maria T./Rabbit, David K./Dog, Lisa B./Dog, Tom W./Cat)
Each card: bg-white rounded-2xl p-7 shadow-sm border. Quote icon top. Teal avatar circles with initials. Stars bottom-right.
Prev/next arrows. Dot pagination (active dot wider, teal-600).

### 10. FAQ (React island, client:visible — accordion)
bg-white, id="faq"
2-column layout: left sticky panel (1/3) + right accordion (2/3)
Left: "Got Questions?" label, H2: "Frequently Asked Questions", teal-50 contact box with phone CTA
Right accordion — 7 questions covering APR range, credit score impact, loan amounts, decision speed, eligible expenses, repayment terms, and support contact.
Each item: rounded-xl border. Open: shadow-md border-teal-200 + teal text + ChevronDown rotates 180°. Max-height 0→384px transition.

### 11. APPLY FORM SECTION (React island, client:load)
bg-teal-900, id="apply", subtle cross-hatch SVG pattern overlay
2-column: left info panel + right white form card (bg-white rounded-3xl shadow-2xl)
Form fields:
  - Loan amount range slider ($200–$10,000, default $3,000) — live dollar display
  - First Name + Last Name (2-col grid)
  - Email address
  - Phone + State select (2-col grid, full US states list)
  - Submit button: "Check My Rate — No Hard Credit Pull" (amber-500, full width)
  - Consent text with Terms / Privacy links

On submit: perform client-side zod validation only. On valid submission, show a success confirmation screen (green checkmark, "Application Received!" heading, thank you message). NO database or API calls — this is a static demo form. On invalid fields, show inline red error messages.

### 12. APPLY MODAL (React island)
Triggered by ZIP form in Hero. Overlays entire page (fixed inset-0 z-[100]).
- Dark backdrop (bg-black/60 backdrop-blur-sm), click-outside and Escape key to close
- Modal: max-w-5xl, rounded-2xl shadow-2xl, animate-fade-up on open
- Header bar: teal-800 bg, "Great news — financing is available in your area", ZIP code in amber-400 mono font, "No hard credit check · Decision in seconds"
- Body: same ApplyForm component in modal mode (form only, no left info panel)
- Close X button (white circle, top-right corner)

### 13. FOOTER (static Astro)
bg-gray-950 text-gray-400
4-column grid: Brand | For Pet Parents | Support | Legal
Brand: PawPrint logo, tagline, Facebook/Twitter/LinkedIn social icon buttons (gray-800 → teal-700 hover)
For Pet Parents: smooth-scroll nav links
Support: email + hours
Legal: About Us, Privacy Policy, Terms of Service, Disclosures

Full legal disclaimer block (bg-gray-900 rounded-xl p-5):
  "BearLoanNow is a loan-matching platform and marketing service, NOT a direct lender, broker, or agent. We connect consumers with a network of independent third-party lenders. We do not make credit decisions or issue loans."
  Full representative example: $3,000 over 24 months at 9.99% APR = ~$138.32/month, total $3,319.68.
  Soft vs hard inquiry disclosure. State availability caveat. Not all applicants qualify.
  Not a bank. Not responsible for third-party lender actions.

Bottom bar: copyright + Privacy Policy / Terms of Service / Licensing Disclosures / Do Not Sell My Info

---

## NO DATABASE
Do NOT use any database, Bolt Database, API calls, or server-side data persistence. The apply form is purely client-side: validate with zod, show success UI on valid submit. No data is stored or transmitted anywhere.

---

## SEO / HEAD
Title: "BearLoanNow — Pet Care Financing & Installment Loans"
Meta description: "BearLoanNow offers flexible pet care financing from $200 to $10,000. Get affordable installment loans for vet bills, surgeries, dental care, and emergency pet expenses."
OG tags: og:title, og:description, og:image (https://bearloannow.com/image.png), og:type=website
Twitter card: summary_large_image
Canonical: https://bearloannow.com/
theme-color: #0f766e
Robots: index, follow

---

## ANIMATIONS
- All sections: elements start opacity-0 translate-y-4, animate to opacity-100 translate-y-0 on IntersectionObserver
- Staggered delays: 0/100/200/300/400ms per element, duration 700ms ease-out
- Hover cards: hover:-translate-y-1 transition-all duration-300
- Buttons: active:scale-95
- Stats: animated count-up (requestAnimationFrame, cubic-out easing, 1800ms)
- Testimonials: CSS transform translateX carousel
- FAQ: max-height 0→384px transition-all duration-300
- Header pulsing amber dot: animate-ping

---

## FILE STRUCTURE
src/
  components/
    Header.tsx (React)
    Hero.tsx (React)
    StatsBar.tsx (React)
    HowItWorks.astro
    Features.tsx (React)
    APRComparison.astro
    EligibleExpenses.astro
    Testimonials.tsx (React)
    FAQ.tsx (React)
    ApplyForm.tsx (React)
    ApplyModal.tsx (React)
    Footer.astro
  layouts/
    Layout.astro
  pages/
    index.astro
    e.ts (first-party pixel endpoint)
    robots.txt.ts (robots.txt route)

public/
  _headers (Cloudflare security headers)
  favicon.svg
  other assets

Use client:load for Header, Hero, ApplyForm.
Use client:visible for StatsBar, Features, Testimonials, FAQ.

---

## REPO-SPECIFIC REQUIREMENTS

### Layout.astro Requirements
In src/layouts/Layout.astro, you MUST include:

#### Environment Variable Reading
```astro
const colorId = import.meta.env.PUBLIC_COLORID || 'teal';
const fontId = import.meta.env.PUBLIC_FONTID || 'inter';
const radiusId = import.meta.env.PUBLIC_RADIUS || 'rounded-xl';
const layout = import.meta.env.PUBLIC_LAYOUT || 'hero-center';
const voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
const voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '';
```

#### First-Party Pixel Block (fpPixel)
Must include in `<head>`:
```html
<script data-cfasync="false" is:inline>
(function(){
  var p = new URLSearchParams(window.location.search);
  var cid = p.get('vlcid') || p.get('clickid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  if (cid) {
    window.__fpClickId = cid;
    try { sessionStorage.setItem('voluum_cpid', cid); } catch(_){}
  }
  window.__fpPixel = function(eventName, extra) {
    try {
      var endpoint = 'https://t.' + window.location.hostname + '/e';
      var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Math.floor(Date.now()/1000) }, extra || {});
      navigator.sendBeacon(endpoint, JSON.stringify(payload));
    } catch(_) {}
  };
  window.__fpPixel('pv', cid ? { click_id: cid } : {});
})();
</script>
```

#### Voluum dtpCallback Block
Must include in `<head>` if `voluumDomain` is present:
```html
{voluumDomain && (
  <script data-cfasync="false" is:inline define:vars={{ voluumDomain }}>
  (function(){
    var p = new URLSearchParams(window.location.search);
    var cpid = p.get('cpid') || p.get('cid') || p.get('click_id') || p.get('vlcid') || '';
    if (cpid) { try { sessionStorage.setItem('voluum_cpid', cpid); } catch(_){} }
    var s = document.createElement('script');
    s.async = true; s.setAttribute('data-cfasync','false');
    s.src = 'https://' + voluumDomain + '/dtpCallback.js';
    document.head.appendChild(s);
  })();
  </script>
)}
```

#### Color/Theme System
Support dynamic color scheme via `PUBLIC_COLORID` env var. Include color mapping for:
- teal (default)
- ocean
- forest
- sunset
- etc.

### index.astro Requirements
In src/pages/index.astro, you MUST include:

#### CTA Href Declaration
```astro
const voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '';
const ctaHref = voluumClickUrl || '#apply';
```

#### CTA Wiring
All CTA buttons/links must use:
```html
<a href={ctaHref}>Apply Now</a>
<a href={ctaHref}>Check My Rate</a>
<a href={ctaHref}>Check My Eligibility — Free</a>
```

### src/pages/e.ts Requirements
Create first-party pixel endpoint:
```typescript
export async function GET() {
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  return new Response(gif, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
```

### src/pages/robots.txt.ts Requirements
```typescript
export async function GET() {
  const robotsTxt = `User-agent: *\nAllow: /`;
  return new Response(robotsTxt, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

### public/_headers Requirements
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### package.json Requirements
Include:
```json
{
  "name": "bearloannow-template",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "astro lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "astro": "^5.18.0",
    "@astrojs/tailwind": "^6.0.2",
    "@astrojs/react": "^4.0.1",
    "tailwindcss": "^3.4.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.395.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.5.3"
  }
}
```

### astro.config.mjs Requirements
```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [tailwind(), react()],
  output: 'static',
});
```

### .env.example Requirements
```
# Color Scheme
PUBLIC_COLORID=teal
PUBLIC_FONTID=inter
PUBLIC_RADIUS=rounded-xl
PUBLIC_LAYOUT=hero-center

# Tracking Configuration
PUBLIC_VOLUUMDOMAIN=
PUBLIC_VOLUUM_CLICK_URL=
```

---

## TEMPLATE METADATA
- **Template ID/Slug**: bearloannow-pet-financing-v1
- **Display Name**: BearLoanNow Pet Financing V1
- **Description**: Production-ready pet care financing landing page with loan calculator, testimonials, and application form
- **Category**: loan
- **Badge**: New

---

## VALIDATION COMPLIANCE CHECKLIST

Before finalizing, verify:
- ✅ `src/layouts/Layout.astro` reads `PUBLIC_VOLUUMDOMAIN` env var
- ✅ `src/layouts/Layout.astro` pixel uses `t.{domain}/e` endpoint
- ✅ `src/layouts/Layout.astro` includes Voluum dtpCallback injection
- ✅ `src/pages/index.astro` declares `ctaHref`
- ✅ `src/pages/index.astro` CTA links are wired to `ctaHref`
- ✅ `src/pages/e.ts` exists and returns 200 with 1x1 GIF
- ✅ `src/pages/robots.txt.ts` exists and returns valid robots.txt
- ✅ `public/_headers` exists with security headers
- ✅ `package.json` exists with all dependencies
- ✅ `astro.config.mjs` exists with proper integrations
- ✅ All referenced files exist
- ✅ All imports are valid
- ✅ No TODOs left
- ✅ Template is immediately usable

---

## PERFORMANCE REQUIREMENTS
Target: PageSpeed Insights 95+ on mobile and desktop.
- Astro-first, static-first implementation
- Minimal client-side JavaScript (only React islands where needed)
- No unnecessary hydration
- No heavy UI libraries
- Keep above-the-fold lightweight
- Use semantic HTML and CSS-first solutions
- Optimize images
- Avoid render-blocking assets
- Use efficient font loading strategy (Inter from Google Fonts)

---

## COMPLETENESS REQUIREMENTS
- No TODO comments
- No missing files
- No broken imports
- No placeholder sections without implementation
- All interactive components fully functional
- Form validation complete (zod)
- Animations implemented
- Responsive design complete
- Accessibility considerations included

Return only the final complete template output that passes all validation checks.
