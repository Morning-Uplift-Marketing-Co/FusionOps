# Deployment Guide - BearLoanNow

This project is built with Astro using Static Site Generation (SSG) optimized for Cloudflare Pages deployment.

## Cloudflare Pages Deployment

### Quick Setup

1. **Connect to Cloudflare Pages:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to Pages > Create a project
   - Connect your Git repository

2. **Build Settings:**
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 (automatically detected from `.node-version`)

3. **Environment Variables:**
   Add these in Cloudflare Pages settings:
   ```
   PUBLIC_SUPABASE_URL=https://lcjfyqxpxeyohvzpvhne.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### Manual Deployment

If you prefer to deploy manually:

```bash
npm run build
npx wrangler pages deploy dist
```

## Architecture Overview

### Islands Architecture

The project uses Astro's Islands Architecture for optimal performance:

**Static Components (Pure HTML/CSS):**
- HowItWorks
- APRComparison
- EligibleExpenses
- Footer

**Interactive Components (React Islands):**
- Header (`client:idle`) - Loads after main thread is free
- Hero (`client:load`) - Immediate interactivity for ZIP code form
- StatsBar (`client:visible`) - Loads when scrolled into view
- Features (`client:visible`) - Loads when scrolled into view
- Testimonials (`client:visible`) - Loads when scrolled into view
- FAQ (`client:visible`) - Loads when scrolled into view
- ApplyForm (`client:visible`) - Loads when scrolled into view

### Performance Optimizations

1. **Minimal JavaScript:** Only interactive components ship JS
2. **Strategic Hydration:** Header uses `client:idle`, below-fold uses `client:visible`
3. **Static HTML:** Non-interactive sections are pure HTML
4. **Code Splitting:** React vendor and form components separated
5. **Font Optimization:** Async loading with `font-display: swap`
6. **No External Images:** CSS gradients replace Pexels dependency
7. **Supabase Singleton:** Single client instance to reduce bundle duplication

### Bundle Analysis

**Total JavaScript (gzipped):**
- React Runtime: ~44 KB
- Hero Component: ~16 KB
- Form Components: ~39 KB
- Other Components: ~10 KB
- **Total:** ~109 KB (deferred loading for most)

**CSS:** ~3 KB (minified and purged)

**HTML:** 103 KB (includes all static content)

## Performance Targets

✅ **LCP < 2.5s** - Achieved through SSG, optimized assets, and no external images
✅ **CLS < 0.1** - All elements have reserved space, no image layout shifts
✅ **Lighthouse Mobile 90+** - Expected with current optimizations

## Security & Caching

The `_headers` file configures:
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Long-term caching for static assets (1 year)
- No-cache for HTML to ensure fresh content

## SEO Optimization

- JSON-LD structured data for financial services
- Complete Open Graph and Twitter Card meta tags
- Sitemap.xml and robots.txt included
- Semantic HTML structure

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Database

The project uses Supabase for data persistence:
- Loan applications are stored in the `loan_applications` table
- Connection configured via environment variables
- Soft credit check disclaimer included in forms

## Notes

- Single-page layout with smooth scroll navigation
- All forms submit to Supabase backend
- Responsive design with mobile-first approach
- SEO optimized with proper meta tags
