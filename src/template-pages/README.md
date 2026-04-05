# Astro Landing Page Templates

Created from `files/template.txt` - Two professional landing page templates for a loan/installment service.

## Files Created

- **`landing-page.astro`** - Full featured landing page with:
  - Fixed navigation with phone and CTA
  - Hero section with ZIP code capture form
  - Customer reviews carousel
  - Interactive payment calculator
  - Features grid
  - Process steps
  - FAQ accordion
  - Trust badges
  - Security bar
  - Full footer with contact info

- **`apply-page.astro`** - Application form page with:
  - Simple, clean layout
  - Trust pills
  - LeadsGate form integration
  - Google Analytics tracking
  - Disclosure text

## Usage

### 1. Basic Implementation

```astro
---
import LandingPage from "./landing-page.astro";
---

<LandingPage
  brand="MyLoanCo"
  h1="Get Fast Approval"
  sub="Flexible payment plans tailored to your needs"
  cta="Get Started Now"
  phone="1-800-555-0123"
  email="support@myloanco.com"
  primaryColor="#3b5bdb"
  accentColor="#00b894"
  amountMin="500"
  amountMax="10,000"
  amountMinRaw="500"
  amountMaxRaw="10000"
  aprMin="5.99"
  aprMax="35.99"
/>
```

### 2. Configuration Variables

#### Landing Page Props

| Variable | Type | Description |
|----------|------|-------------|
| `brand` | string | Company/brand name |
| `h1` | string | Main heading text |
| `sub` | string | Hero subtitle |
| `cta` | string | Call-to-action button text |
| `phone` | string | Contact phone number |
| `email` | string | Contact email |
| `primaryColor` | string | Primary brand color (hex) |
| `accentColor` | string | Accent color (hex) |
| `amountMin` | string | Minimum loan amount display |
| `amountMax` | string | Maximum loan amount display |
| `amountMinRaw` | string | Minimum for slider (raw number) |
| `amountMaxRaw` | string | Maximum for slider (raw number) |
| `aprMin` | string | Minimum APR percentage |
| `aprMax` | string | Maximum APR percentage |

#### Apply Page Props

| Variable | Type | Description |
|----------|------|-------------|
| `brand` | string | Company name |
| `amountMax` | string | Maximum loan amount |
| `phone` | string | Contact phone |
| `email` | string | Contact email |
| `leadsGateFormId` | string | LeadsGate form ID |
| `aprMin` | string | Minimum APR |
| `aprMax` | string | Maximum APR |

## Features

### Responsive Design

- Mobile-first approach
- Fully responsive at all breakpoints
- Touch-friendly form inputs

### JavaScript Interactivity

- ZIP code validation
- Payment calculator with real-time updates
- FAQ accordion toggle
- Modal dialogs
- All scripts use `is:inline` for client-side execution

### Color Customization

CSS variables are defined dynamically:

```css
--color-primary: var(--colorPrimary);
--color-accent: var(--colorAccent);
```

### Form Integration

- Integrated with LeadsGate API
- Google Analytics dataLayer tracking
- Click ID capture from URL params
- Session storage support

## Customization Guide

### Styles

All styles are in `<style>` blocks. Key sections:

- `/* ── NAV ── */` - Navigation bar
- `/* ── HERO ── */` - Hero section with ZIP form
- `/* ── CALC ── */` - Payment calculator
- `/* ── MODALS ── */` - Modal dialogs

### Interactive Elements

#### ZIP Code Handler

```javascript
function handleZip(e) {
  // Validates 5-digit US ZIP code
  // Redirects to /apply?zip=XXXXX
}
```

#### Calculator Functions

```javascript
updateCalc(val)      // Updates calculator display
selectTier(months)   // Switches payment plan tier
handleCalcApply()    // Redirects to /apply?amount=X
```

### Color Scheme

The templates support any brand colors:

```astro
primaryColor="#FF6B6B"    // Red brand
accentColor="#4ECDC4"     // Teal accent
```

## Integration Points

### LeadsGate Form

The apply page loads the LeadsGate script which populates `#_lg_form_` element:

```javascript
var _lg_form_init_ = {
  aid: "YOUR_FORM_ID",
  template: "fresh",
  ref: window.location.hostname,
  click_id: getVoluumClickId(),
  // ... event handlers
};
```

### Google Analytics

Both templates push events to `window.dataLayer`:

- `leadsgate_form_start`
- `leadsgate_form_progress`
- `lead_conversion_all`
- `lead_conversion_approved` (if sold)
- `lead_declined` (if rejected)
- `lead_pending` (if new)

### URL Parameters

Captured from search params:

- `?zip=XXXXX` - ZIP code from hero form
- `?amount=N` - Loan amount from calculator
- `?cid=ID` or `?click_id=ID` - Affiliate click tracking

## Performance

- Minimal dependencies
- Inline styles (no external CSS files)
- Vanilla JavaScript (no frameworks)
- No CSS-in-JS overhead
- SVG icons (no image files)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Supports older browsers with graceful degradation

## Accessibility

- Semantic HTML (nav, main, section, footer)
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus visible states
- Form input validation feedback

## Security Notes

⚠️ **Before Production:**

1. Replace `leadsGateFormId` with actual form ID
2. Validate ZIPcodes on server-side
3. Implement rate limiting on form endpoints
4. Add CSRF protection
5. Sanitize all user inputs
6. Use HTTPS only
7. Implement proper error handling

## File Organization

```
src/
├── template-pages/
│   ├── landing-page.astro    # Full featured landing
│   ├── apply-page.astro      # Application form
│   └── README.md             # This file
```

## Future Enhancements

- A/B testing variants
- Testimonial carousel
- Video hero section
- Multi-step form wizard
- Social proof integration
- Live chat widget
- Email list signup
- Holiday/seasonal themes

---

**Created:** April 2026
**Source:** `files/template.txt`
**Template Engine:** Astro v6.0.8+
