---
description: Create and configure Astro landing page templates with full tracking integration
---

# Astro Template Generator Skill

## Overview
This skill helps you create, configure, and deploy Astro landing page templates with complete tracking integration including Voluum, Google Ads, and first-party pixel tracking.

## When to Use This Skill
Use this skill when you need to:
- Create new Astro landing page templates from scratch
- Configure existing templates with tracking integration
- Deploy templates to Cloudflare Pages with automated tracking injection
- Validate template tracking compliance
- Generate deploy configurations for new domains

## Prerequisites
- Node.js 20+ installed
- Git repository with proper structure
- Access to Cloudflare Pages API
- Voluum tracking domain configured
- Google Ads conversion ID (optional)

## Step-by-Step Process

### 1. Template Creation
```bash
# Create new template directory
mkdir templates/{template-name}
cd templates/{template-name}

# Initialize Astro project
npm create astro@latest . -- --template --no-git --typescript strict
npm install

# Create basic structure
mkdir -p src/components src/pages src/layouts public
```

### 2. Template Configuration
Create `template.json`:
```json
{
  "templateId": "bolt-loan-01",
  "name": "Payday Loan Template",
  "description": "High-converting payday loan landing page",
  "type": "astro",
  "version": "1.0.0",
  "environment": {
    "variables": [
      "PUBLIC_VOLUUMDOMAIN",
      "PUBLIC_VOLUUM_CLICK_URL", 
      "PUBLIC_CONVERSIONID",
      "PUBLIC_FORMSTARTLABEL",
      "PUBLIC_FORMSUBMITLABEL",
      "PUBLIC_AID"
    ]
  },
  "tracking": {
    "voluum": true,
    "googleAds": true,
    "firstPartyPixel": true,
    "leadsgate": true
  }
}
```

### 3. Core Components Setup

#### Layout.astro
```astro
---
const voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
const voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '/apply';
const conversionId = import.meta.env.PUBLIC_CONVERSIONID || '';
const formStartLabel = import.meta.env.PUBLIC_FORMSTARTLABEL || 'form_start';
const formSubmitLabel = import.meta.env.PUBLIC_FORMSUBMITLABEL || 'form_submit';
---

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  
  <!-- Voluum dtpCallback -->
  {voluumDomain && (
    <script>
      window.dtpCallback = function(clickId) {
        try {
          sessionStorage.setItem('vlcid', clickId);
          console.log('[Voluum] Click ID stored:', clickId);
        } catch(e) {}
      };
    </script>
  )}
  
  <!-- Google Ads gtag -->
  {conversionId && (
    <script async src="https://www.googletagmanager.com/gtag/js?id={conversionId}"></script>
  )}
  {conversionId && (
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '{conversionId}');
    </script>
  )}
</head>

<body>
  <slot />
  
  <!-- First-Party Pixel -->
  <script>
    function fpPixel(eventName, extra) {
      try {
        var endpoint = 'https://t.' + window.location.hostname + '/e';
        var payload = Object.assign({
          e: eventName, 
          d: window.location.hostname, 
          ts: Math.floor(Date.now()/1000)
        }, extra || {});
        navigator.sendBeacon(endpoint, JSON.stringify(payload));
      } catch(_) {}
    }
    
    // Capture click IDs
    {voluumDomain && (
      <script>
        var urlParams = new URLSearchParams(window.location.search);
        var clickId = urlParams.get('vlcid') || urlParams.get('clickid') || '';
        if (clickId) sessionStorage.setItem('vlcid', clickId);
      </script>
    )}
  </script>
</body>
</html>
```

#### Hero.astro
```astro
---
const voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '/apply';
const ctaHref = voluumClickUrl;
---

<section class="hero">
  <div class="hero-content">
    <h1>Get Your Loan Today</h1>
    <p>Fast approval, competitive rates</p>
    <a href="{ctaHref}" class="cta-button">Apply Now</a>
  </div>
</section>

<style>
  .hero { padding: 4rem 2rem; text-align: center; }
  .cta-button { 
    background: #007acc; 
    color: white; 
    padding: 1rem 2rem; 
    text-decoration: none; 
    border-radius: 8px; 
  }
</style>
```

#### Calculator.astro
```astro
---
const voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '/apply';
const ctaHref = voluumClickUrl;
---

<section class="calculator">
  <div class="calc-content">
    <h2>Loan Calculator</h2>
    <div class="calc-form">
      <!-- Calculator form elements -->
      <a href="{ctaHref}" class="calc-cta">Apply for This Loan</a>
    </div>
  </div>
</section>

<script>
  // Fire form_start event on interaction
  function fireFormStart() {
    if (!window.firedFormStart) {
      window.firedFormStart = true;
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', { 
          send_to: '{import.meta.env.PUBLIC_CONVERSIONID}/{import.meta.env.PUBLIC_FORMSTARTLABEL}' 
        });
      }
      if (typeof fpPixel === 'function') {
        fpPixel('form_start', { amount: 10000 });
      }
    }
  }
  
  // Add event listeners to calculator interactions
  document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('input, button');
    inputs.forEach(input => {
      input.addEventListener('click', fireFormStart);
      input.addEventListener('change', fireFormStart);
    });
  });
</script>
```

#### apply.astro
```astro
---
const aid = import.meta.env.PUBLIC_AID || '14881';
---

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Apply</title>
  <link rel="dns-prefetch" href="//apikeep.com" />
</head>
<body>
<script data-cfasync="false">
window.dataLayer = window.dataLayer || [];

function fpPixel(eventName, extra) {
  try {
    var endpoint = 'https://t.' + window.location.hostname + '/e';
    var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Math.floor(Date.now()/1000) }, extra || {});
    navigator.sendBeacon(endpoint, JSON.stringify(payload));
  } catch(_) {}
}

function getVoluumClickId() {
  var urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('vlcid') || urlParams.get('clickid') || urlParams.get('cid') || '';
}

var _lg_form_init_ = {
  aid: "{aid}",
  template: "fresh",
  ref: window.location.hostname,
  click_id: getVoluumClickId(),
  
  hooks: {
    onFormLoad: function() {
      var cid = getVoluumClickId();
      fpPixel('lg_form_load', { click_id: cid });
    },
    
    onSubmit: function() {
      var cid = getVoluumClickId();
      fpPixel('lg_submit', { click_id: cid });
    },
    
    onSuccess: function(data) {
      var cid = getVoluumClickId();
      var leadId = data && (data.leadId || data.lead_id);
      fpPixel('lg_success', { click_id: cid, lead_id: leadId, status: 'approved' });
    }
  }
};

// Enhanced form load detection
(function() {
  var formLoadFired = false;
  var obs = new MutationObserver(function(muts) {
    var form = document.querySelector('#_lg_form_ iframe, #_lg_form_ form');
    if (form && !formLoadFired) {
      formLoadFired = true;
      obs.disconnect();
      fpPixel('lg_form_ready', { click_id: getVoluumClickId() });
    }
  });
  
  var container = document.getElementById('_lg_form_');
  if (container) {
    obs.observe(container, { childList: true, subtree: true });
    
    setTimeout(function() {
      if (!formLoadFired) { 
        formLoadFired = true; 
        obs.disconnect(); 
        fpPixel('lg_form_load', { click_id: getVoluumClickId(), source: 'timeout' });
      }
    }, 15000);
  }
})();

var script = document.createElement('script');
script.setAttribute('data-cfasync', 'false');
script.type = 'text/javascript';
script.async = true;
script.src = 'https://apikeep.com/form/applicationInit.js';
document.body.appendChild(script);
</script>

<div id="_lg_form_"></div>
</body>
</html>
```

#### e.ts (Pixel Endpoint)
```typescript
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);
    console.log('[pixel]', payload);
  } catch (_) {}
  return new Response(null, { status: 204 });
};

export const GET: APIRoute = () => {
  return new Response(null, { status: 204 });
};
```

#### robots.txt.ts
```typescript
---
const domain = import.meta.env.PUBLIC_DOMAIN || 'example.com';
---

User-agent: *
Allow: /

Sitemap: https://{domain}/sitemap.xml

# Disallow apply page
User-agent: *
Disallow: /apply/
```

### 4. Security Headers
Create `public/_headers`:
```
# Security headers
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

# Cache control for HTML
/*.html
  Cache-Control: public, max-age=0, must-revalidate

# Cache control for static assets
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Cache control for pixel endpoint
/e
  Cache-Control: no-cache, no-store, must-revalidate
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type
```

### 5. Package.json Scripts
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "validate-tracking": "node ../../scripts/validate-template-tracking.mjs .",
    "inject-tracking": "node ../../scripts/inject-tracking.mjs ."
  }
}
```

### 6. Deploy Configuration
Create deploy config in `deploy-configs/{domain}.json`:
```json
{
  "domain": "example.com",
  "templateId": "bolt-loan-01",
  "cfPagesProject": "lp-example-com",
  "cfApiToken": "your-cloudflare-api-token",
  "environment": {
    "PUBLIC_VOLUUMDOMAIN": "vls.example.com",
    "PUBLIC_VOLUUM_CLICK_URL": "https://vls.example.com/click/12345",
    "PUBLIC_CONVERSIONID": "AW-123456789",
    "PUBLIC_FORMSTARTLABEL": "form_start",
    "PUBLIC_FORMSUBMITLABEL": "form_submit",
    "PUBLIC_AID": "14881",
    "PUBLIC_DOMAIN": "example.com"
  }
}
```

## Validation Checklist

### Pre-Deploy Validation
- [ ] All environment variables defined
- [ ] Voluum tracking scripts present
- [ ] Google Ads gtag configured
- [ ] First-party pixel endpoint created
- [ ] LeadsGate form properly initialized
- [ ] Security headers configured
- [ ] Robots.txt configured
- [ ] Template builds successfully
- [ ] Tracking validation passes

### Tracking Verification
- [ ] Click ID capture working
- [ ] Form load events firing
- [ ] Step change events tracking
- [ ] Submit events firing
- [ ] Success/lead events working
- [ ] Google Ads conversions tracking
- [ ] First-party pixel receiving data

## Deployment Process

### 1. Local Testing
```bash
# Test template locally
npm run dev
# Visit http://localhost:4321
# Check Network tab for tracking requests
# Verify LeadsGate form loads
```

### 2. Deploy to Cloudflare Pages
```bash
# Push deploy config to trigger GitHub Actions
git add deploy-configs/{domain}.json
git commit -m "deploy: {domain} via GitHub Actions"
git push origin main
```

### 3. Post-Deploy Verification
- [ ] Site loads correctly
- [ ] Tracking scripts present in source
- [ ] Network requests working
- [ ] LeadsGate form functional
- [ ] Console errors none
- [ ] Mobile responsive

## Troubleshooting

### Common Issues
1. **Tracking not firing**: Check environment variables and script loading
2. **LeadsGate form not loading**: Verify AID and script source
3. **Click ID not captured**: Check URL parameters and dtpCallback
4. **Build failures**: Validate Astro syntax and imports
5. **Deploy failures**: Check Cloudflare API token and project settings

### Debug Tools
- Browser DevTools Network tab
- Console logging for tracking events
- Astro build logs
- GitHub Actions workflow logs
- Cloudflare Pages build logs

## Best Practices

### Template Structure
- Keep components modular and reusable
- Use environment variables for all dynamic content
- Implement proper error handling
- Follow Astro best practices
- Maintain consistent styling approach

### Tracking Implementation
- Always include fallback mechanisms
- Use safe storage methods (sessionStorage with fallback)
- Implement proper error handling
- Test all tracking events
- Validate data formats

### Security & Performance
- Implement security headers
- Optimize asset loading
- Use proper caching strategies
- Validate all inputs
- Follow SEO best practices

## Examples

### Complete Template Example
See `templates/goldrush-v2` for a fully implemented example with:
- Complete tracking integration
- Responsive design
- Lead generation form
- Calculator component
- Security headers
- Deploy configuration

### Minimal Template Example
```astro
---
// Minimal layout with tracking
const voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
---
<!DOCTYPE html>
<html>
<head>
  {voluumDomain && (
    <script>
      window.dtpCallback = function(cid) { 
        sessionStorage.setItem('vlcid', cid); 
      };
    </script>
  )}
</head>
<body>
  <slot />
</body>
</html>
```

## Integration with Existing Systems

### Template Manager Integration
Templates created with this skill are automatically compatible with:
- Template Manager UI
- GitHub Actions deployment
- Tracking validation system
- Quality gate checks

### API Integration
Templates can integrate with external APIs:
- Lead validation services
- Rate calculation APIs
- CRM systems
- Analytics platforms

## Maintenance

### Regular Updates
- Update tracking scripts
- Refresh security headers
- Test compatibility
- Update dependencies
- Validate tracking compliance

### Monitoring
- Monitor tracking performance
- Check error rates
- Validate conversion tracking
- Review security headers
- Test form functionality

---

This skill provides a complete framework for creating professional Astro landing page templates with enterprise-grade tracking integration. Use it as a reference guide and adapt according to specific requirements.
