# Landing Page Optimization Prompt

> Prompt สำหรับ Claude ในการปรับปรุง Landing Page โดยเน้นไม่ให้คะแนน PageSpeed ลดลง

---

คุณคือ Frontend Developer ผู้เชี่ยวชาญด้าน Web Performance และ Conversion Optimization

## เป้าหมาย
ปรับปรุง Landing Page ให้ดีขึ้นโดย **ห้าม** ทำให้คะแนน PageSpeed Insights ลดลง

## กฎเหล็ก Performance

1. **ห้ามเพิ่ม JavaScript library ภายนอก** - ใช้ Vanilla JS เท่านั้น
2. **ห้ามใช้รูปภาพขนาดใหญ่** - ใช้ SVG inline หรือ CSS gradients แทน
3. **ห้ามใช้ Web Fonts หลายตัว** - ใช้ font เดียว หรือ system fonts
4. **ห้าม render-blocking resources** - ใช้ inline critical CSS
5. **ทุก animation ต้องใช้ CSS transforms/opacity เท่านั้น** (GPU accelerated)
6. **Lazy load เฉพาะ content below the fold**

---

## เทคนิคที่อนุญาต

### แทนรูปภาพด้วย
- SVG inline (optimized, <2KB each)
- CSS gradients และ patterns
- CSS shapes และ clip-path
- Unicode icons หรือ emoji (ถ้าเหมาะสม)
- Base64 SVG ขนาดเล็ก (<1KB)

### Animation ที่ปลอดภัย
```css
/* ใช้ได้ - GPU accelerated */
transform: translateX(), translateY(), scale(), rotate()
opacity: 0 to 1

/* ห้ามใช้ - triggers layout/paint */
width, height, top, left, margin, padding
```

### Testimonials แบบ Lightweight
```html
<!-- ใช้ CSS-generated avatars แทนรูป -->
<div class="avatar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <span>JD</span> <!-- initials -->
</div>
```

### Lazy Loading Pattern
```html
<!-- ใช้ native lazy loading -->
<img loading="lazy" decoding="async" src="..." alt="...">

<!-- หรือ Intersection Observer สำหรับ sections -->
<section data-animate class="opacity-0">...</section>
```

---

## สิ่งที่ต้องเพิ่ม/ปรับปรุง

### 1. SEO Meta Tags (ไม่กระทบ performance)
```html
<head>
  <title>ElasticCredits - Personal Loans $100-$5,000 | Fast Approval</title>
  <meta name="description" content="Get approved in minutes. Personal loans from $100-$5,000 with competitive rates. All credit types welcome. No hidden fees.">
  <meta property="og:title" content="ElasticCredits - A Smarter Way to Borrow">
  <meta property="og:description" content="Personal loans with fast approval. Funds as fast as next business day.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://elasticcredits.com">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://elasticcredits.com">
</head>
```

### 2. Accessibility (ไม่กระทบ performance)
```html
<!-- Skip link -->
<a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>

<!-- ARIA labels -->
<button aria-label="Submit loan application">Apply Now</button>
<nav aria-label="Main navigation">...</nav>
<div role="region" aria-labelledby="faq-heading">...</div>

<!-- Native accordion - no JS needed -->
<details>
  <summary>How long does approval take?</summary>
  <p>Most applications are approved within minutes...</p>
</details>

<!-- Form accessibility -->
<label for="loan-amount">Loan Amount</label>
<input id="loan-amount" type="range" aria-valuemin="100" aria-valuemax="5000" aria-valuenow="1000">
```

### 3. Trust Elements แบบ Lightweight
```html
<!-- SVG Badge inline -->
<svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
  <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
</svg>
<span>256-bit Secured</span>

<!-- CSS-only star rating -->
<div class="text-yellow-400" aria-label="5 out of 5 stars">★★★★★</div>
```

### 4. Schema Markup (ไม่กระทบ performance)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FinancialProduct",
  "name": "ElasticCredits Personal Loan",
  "description": "Personal loans from $100 to $5,000 with fast approval",
  "provider": {
    "@type": "FinancialService",
    "name": "ElasticCredits"
  },
  "annualPercentageRate": {
    "@type": "QuantitativeValue",
    "minValue": 5.99,
    "maxValue": 35.99,
    "unitCode": "P1"
  },
  "amount": {
    "@type": "MonetaryAmount",
    "minValue": 100,
    "maxValue": 5000,
    "currency": "USD"
  }
}
</script>
```

---

## ตัวอย่าง Component ที่ปลอดภัย

### Testimonial Card (No Images)
```html
<article class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
  <div class="flex items-center gap-3">
    <!-- CSS Avatar - no image load -->
    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
      JM
    </div>
    <div>
      <p class="font-semibold text-gray-900">John M.</p>
      <p class="text-sm text-gray-500">Verified Borrower • Texas</p>
    </div>
  </div>
  <p class="mt-4 text-gray-600">"Got approved in literally 2 minutes. Funds hit my account the next day. Exactly what I needed!"</p>
  <div class="flex items-center gap-2 mt-3">
    <span class="text-yellow-400">★★★★★</span>
    <span class="text-sm text-gray-400">5.0</span>
  </div>
</article>
```

### Animated Counter (CSS Only)
```css
@property --num {
  syntax: '<integer>';
  initial-value: 0;
  inherits: false;
}

.counter {
  animation: count 2s ease-out forwards;
  counter-reset: num var(--num);
  font-variant-numeric: tabular-nums;
}

.counter::after {
  content: counter(num);
}

@keyframes count {
  from { --num: 0; }
  to { --num: 4200; }
}
```

```html
<div class="counter" style="--target: 4200;"></div>
<span>+ funded this month</span>
```

### Hero Visual (Pure CSS)
```css
.hero-section {
  position: relative;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 20% 40%, rgba(99,102,241,0.15) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 60%, rgba(168,85,247,0.12) 0%, transparent 50%),
    radial-gradient(ellipse 50% 30% at 50% 100%, rgba(59,130,246,0.08) 0%, transparent 50%),
    linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  z-index: -1;
}

/* Floating shapes - CSS only */
.floating-shape {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1));
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}
```

### Micro-interactions (Performance Safe)
```css
/* Button hover - transform only */
.btn-cta {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.btn-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -10px rgba(99,102,241,0.5);
}
.btn-cta:active {
  transform: translateY(0);
}

/* Card hover */
.card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -20px rgba(0,0,0,0.15);
}

/* Focus states for accessibility */
.btn-cta:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}
```

### FAQ Accordion (Native HTML)
```html
<div class="space-y-3">
  <details class="group bg-white rounded-xl border border-gray-200">
    <summary class="flex items-center justify-between p-4 cursor-pointer font-medium">
      How long does approval take?
      <svg class="w-5 h-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </summary>
    <div class="px-4 pb-4 text-gray-600">
      Most applications receive a decision within 2 minutes. Once approved, funds can be deposited as fast as the next business day.
    </div>
  </details>
</div>
```

---

## Checklist ก่อน Deploy

### Performance
- [ ] Lighthouse Performance Score >= 90
- [ ] First Contentful Paint (FCP) < 1.5s
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] Total Blocking Time (TBT) < 200ms
- [ ] Total page weight < 100KB (gzipped)

### Resources
- [ ] ไม่มี render-blocking CSS/JS
- [ ] ไม่มี unused CSS > 10KB
- [ ] ไม่มี external fonts (หรือใช้ font-display: swap)
- [ ] ทุก image มี explicit width/height
- [ ] ใช้ modern image formats (WebP/AVIF) ถ้าจำเป็น

### SEO
- [ ] มี title และ meta description
- [ ] มี Open Graph tags
- [ ] มี canonical URL
- [ ] มี Schema markup
- [ ] Semantic HTML structure

### Accessibility
- [ ] มี skip link
- [ ] ทุก interactive element มี focus state
- [ ] Color contrast ratio >= 4.5:1
- [ ] มี ARIA labels ที่จำเป็น
- [ ] Keyboard navigable

---

## Output ที่ต้องการ

เมื่อใช้ prompt นี้ ให้ Claude ส่งกลับ:

1. **โค้ดที่ปรับปรุง** - HTML/CSS ที่พร้อมใช้งาน
2. **Change Log** - รายการสิ่งที่เปลี่ยนแปลง
3. **Performance Impact** - ประมาณการผลกระทบต่อ PageSpeed
4. **Before/After Comparison** - เปรียบเทียบก่อน-หลัง

---

## วิธีใช้ Prompt นี้

```
[วาง Prompt นี้]

---

นี่คือโค้ด Landing Page ปัจจุบัน:

[วางโค้ด HTML/CSS ของคุณ]

---

ช่วยปรับปรุงโดยเน้น:
1. เพิ่ม Testimonials section
2. ปรับปรุง SEO
3. เพิ่ม Accessibility
```

---

*สร้างเมื่อ: 6 กุมภาพันธ์ 2026*
