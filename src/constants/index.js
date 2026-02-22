export const APP_VERSION = "2.1.1";

export const LOAN_TYPES = [
    { id: "personal", label: "Personal Loans", icon: "💳" },
    { id: "installment", label: "Installment Loans", icon: "📋" },
    { id: "pet", label: "Pet Care Financing", icon: "🐾" },
    { id: "medical", label: "Medical Financing", icon: "🏥" },
    { id: "auto", label: "Auto Loans", icon: "🚗" },
    { id: "custom", label: "Custom / Other", icon: "⚡" },
];

export const COLORS = [
    { id: "ocean", name: "Ocean Trust", p: [217, 91, 35], s: [158, 64, 42], a: [15, 92, 62], bg: [210, 40, 98], fg: [222, 47, 11] },
    { id: "forest", name: "Forest Green", p: [152, 68, 28], s: [45, 93, 47], a: [350, 80, 55], bg: [140, 20, 97], fg: [150, 40, 10] },
    { id: "midnight", name: "Midnight Indigo", p: [235, 70, 42], s: [170, 60, 45], a: [25, 95, 58], bg: [230, 25, 97], fg: [235, 50, 12] },
    { id: "ruby", name: "Ruby Finance", p: [350, 75, 38], s: [200, 70, 45], a: [40, 90, 55], bg: [350, 15, 97], fg: [350, 40, 12] },
    { id: "slate", name: "Slate Modern", p: [215, 25, 35], s: [160, 50, 42], a: [15, 85, 55], bg: [210, 15, 97], fg: [215, 30, 12] },
    { id: "coral", name: "Coral Warm", p: [12, 76, 42], s: [185, 60, 40], a: [265, 65, 55], bg: [20, 30, 97], fg: [15, 40, 12] },
    { id: "teal", name: "Teal Pro", p: [180, 65, 30], s: [280, 55, 55], a: [35, 90, 55], bg: [175, 20, 97], fg: [180, 40, 10] },
    { id: "plum", name: "Plum Finance", p: [270, 55, 40], s: [150, 55, 42], a: [20, 88, 58], bg: [270, 15, 97], fg: [270, 40, 12] },
];

export const FONTS = [
    { id: "dm-sans", name: "DM Sans", import: "DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700", family: '"DM Sans"' },
    { id: "plus-jakarta", name: "Plus Jakarta Sans", import: "Plus+Jakarta+Sans:wght@400;600;700", family: '"Plus Jakarta Sans"' },
    { id: "outfit", name: "Outfit", import: "Outfit:wght@400;500;600;700", family: '"Outfit"' },
    { id: "manrope", name: "Manrope", import: "Manrope:wght@400;500;600;700;800", family: '"Manrope"' },
    { id: "sora", name: "Sora", import: "Sora:wght@400;500;600;700", family: '"Sora"' },
    { id: "figtree", name: "Figtree", import: "Figtree:wght@400;500;600;700", family: '"Figtree"' },
    { id: "inter", name: "Inter", import: "Inter:wght@400;500;600;700", family: '"Inter"' },
    { id: "space-grotesk", name: "Space Grotesk", import: "Space+Grotesk:wght@400;500;600;700", family: '"Space Grotesk"' },
];

export const LAYOUTS = [
    { id: "hero-left", label: "Hero Left + Form Right", desc: "Classic split" },
    { id: "hero-center", label: "Hero Center + Form Below", desc: "Centered modern" },
    { id: "hero-full", label: "Full Width Hero", desc: "Impact first" },
];

export const RADIUS = [
    { id: "sharp", label: "Sharp", v: "0rem" },
    { id: "subtle", label: "Subtle", v: "0.375rem" },
    { id: "rounded", label: "Rounded", v: "0.75rem" },
    { id: "pill", label: "Pill", v: "1.5rem" },
];

export const TRUST_BADGE_STYLES = [
    { id: "compact", label: "Compact Bar", desc: "Simple stats row" },
    { id: "cards", label: "Credibility Cards", desc: "Detailed trust badges" },
    { id: "both", label: "Both", desc: "Bar + cards" },
];

export const TRUST_BADGE_ICON_TONES = [
    { id: "primary", label: "Primary" },
    { id: "accent", label: "Accent" },
    { id: "secondary", label: "Secondary" },
];

export const NETWORKS_AFF = ["LeadsGate", "ZeroParallel", "LeadStack", "ClickDealer", "Everflow", "Custom"];
export const REGISTRARS = ["Namecheap", "GoDaddy", "Cloudflare", "Porkbun", "Internet.bs", "Other"];

export const COPY_SETS = [
    { id: "smart", brand: "ElasticCredits", h1: "A Smarter Way", h1span: "to Borrow", sub: "Get approved in minutes. Funds as fast as next business day.", cta: "Check My Rate", badge: "4,200+ funded this month" },
    { id: "fast", brand: "QuickFund", h1: "Fast Cash", h1span: "When You Need It", sub: "Simple application. Quick decisions. Direct deposit.", cta: "Get Started Now", badge: "3,800+ approved this week" },
    { id: "simple", brand: "ClearPath Loans", h1: "Simple Loans,", h1span: "Clear Terms", sub: "No hidden fees. No surprises. Straightforward loans.", cta: "See Your Rate", badge: "5,000+ happy borrowers" },
    { id: "trust", brand: "LoanBridge", h1: "Trusted by", h1span: "Thousands", sub: "Join thousands who found better rates with our lender network.", cta: "Find My Rate", badge: "12,000+ loans funded" },
    { id: "easy", brand: "EasyLend", h1: "Borrowing", h1span: "Made Easy", sub: "2-minute application. All credit types welcome.", cta: "Apply Now Free", badge: "2,900+ served nationwide" },
    { id: "flex", brand: "FlexCredit", h1: "Flexible Loans", h1span: "on Your Terms", sub: "Choose your amount. Pick your timeline. Get funded fast.", cta: "Check Eligibility", badge: "6,100+ customers served" },
];

/**
 * @deprecated Use getAllTemplates() from src/utils/template-registry.js instead.
 * This constant is kept for backward compatibility and will be removed in a future version.
 */
export const SITE_TEMPLATES = [
    {
        id: "classic",
        name: "Classic LP",
        badge: "Stable",
        description: "Current production LP flow (HTML + Astro generator)",
    },
    {
        id: "astrodeck-loan",
        name: "AstroDeck Loan",
        badge: "New",
        description: "New AstroDeck-style loan template architecture",
    },
    {
        id: "pdl-loansv1",
        name: "PDL Loans V1",
        badge: "Popular",
        description: "Payday/PDL loan template with hero form, trust badges, calculator, FAQ - Zero-JS architecture",
    },
    {
        id: "lander-core",
        name: "PDL Loans V2",
        badge: "Advanced",
        description: "High-conversion bear-style template with interactive form and premium trust signals",
    },
];

// Default configuration for new landing page wizard
export const WIZARD_DEFAULTS = {
    brand: "", domain: "", tagline: "", email: "",
    templateId: "classic",
    loanType: "personal", amountMin: 100, amountMax: 5000, aprMin: 5.99, aprMax: 35.99,
    colorId: "ocean", fontId: "dm-sans", layout: "hero-left", radius: "rounded",
    trustBadgeStyle: "both",
    trustBadgeIconTone: "primary",
    h1: "", badge: "", cta: "", sub: "",
    conversionId: "", formStartLabel: "", formSubmitLabel: "",
    aid: "14881", network: "LeadsGate", redirectUrl: "",
    voluumId: "", voluumDomain: "",
    lang: "English",
};

export const DNS_RECORD_TYPES = [
    { id: "A", label: "A", description: "IPv4 address", placeholder: "192.0.2.1" },
    { id: "AAAA", label: "AAAA", description: "IPv6 address", placeholder: "2001:db8::1" },
    { id: "CNAME", label: "CNAME", description: "Canonical name", placeholder: "example.com" },
    { id: "TXT", label: "TXT", description: "Text record", placeholder: "v=spf1 include:_spf.google.com ~all" },
    { id: "MX", label: "MX", description: "Mail exchange", placeholder: "mail.example.com" },
    { id: "NS", label: "NS", description: "Name server", placeholder: "ns1.example.com" },
    { id: "SRV", label: "SRV", description: "Service record", placeholder: "_service._proto.example.com" },
    { id: "CAA", label: "CAA", description: "Certification Authority Authorization", placeholder: "issue ca.example.com" },
];

export const DNS_TEMPLATES = [
    {
        id: "landing-page",
        name: "Landing Page",
        icon: "🌐",
        description: "Basic landing page with www",
        records: [
            { type: "A", name: "@", content: "192.0.2.1", ttl: 3600, proxied: true },
            { type: "CNAME", name: "www", content: "@", ttl: 3600, proxied: true },
        ],
    },
    {
        id: "email-google",
        name: "Google Workspace Email",
        icon: "📧",
        description: "MX + SPF records for Gmail",
        records: [
            { type: "MX", name: "@", content: "aspmx.l.google.com", priority: 1, ttl: 3600, proxied: false },
            { type: "MX", name: "@", content: "alt1.aspmx.l.google.com", priority: 5, ttl: 3600, proxied: false },
            { type: "MX", name: "@", content: "alt2.aspmx.l.google.com", priority: 5, ttl: 3600, proxied: false },
            { type: "MX", name: "@", content: "alt3.aspmx.l.google.com", priority: 10, ttl: 3600, proxied: false },
            { type: "MX", name: "@", content: "alt4.aspmx.l.google.com", priority: 10, ttl: 3600, proxied: false },
            { type: "TXT", name: "@", content: "v=spf1 include:_spf.google.com ~all", ttl: 3600, proxied: false },
        ],
    },
    {
        id: "wordpress",
        name: "WordPress",
        icon: "📝",
        description: "A record + www + PHP subdomain",
        records: [
            { type: "A", name: "@", content: "192.0.2.1", ttl: 3600, proxied: true },
            { type: "CNAME", name: "www", content: "@", ttl: 3600, proxied: true },
            { type: "CNAME", name: "wp-admin", content: "@", ttl: 3600, proxied: true },
        ],
    },
    {
        id: "saas",
        name: "SaaS Application",
        icon: "⚡",
        description: "App + API + www subdomains",
        records: [
            { type: "A", name: "@", content: "192.0.2.1", ttl: 3600, proxied: true },
            { type: "CNAME", name: "www", content: "@", ttl: 3600, proxied: true },
            { type: "CNAME", name: "app", content: "@", ttl: 3600, proxied: true },
            { type: "CNAME", name: "api", content: "@", ttl: 3600, proxied: true },
            { type: "CNAME", name: "dashboard", content: "@", ttl: 3600, proxied: true },
        ],
    },
    {
        id: "cdn-static",
        name: "CDN + Static Assets",
        icon: "📦",
        description: "Static assets via CDN",
        records: [
            { type: "A", name: "@", content: "192.0.2.1", ttl: 3600, proxied: true },
            { type: "CNAME", name: "www", content: "@", ttl: 3600, proxied: true },
            { type: "CNAME", name: "cdn", content: "cdn.example.com", ttl: 3600, proxied: true },
            { type: "CNAME", name: "static", content: "cdn.example.com", ttl: 3600, proxied: true },
            { type: "CNAME", name: "assets", content: "cdn.example.com", ttl: 3600, proxied: true },
        ],
    },
    {
        id: "dkim-email",
        name: "Email + DKIM + DMARC",
        icon: "🔒",
        description: "Complete email security setup",
        records: [
            { type: "MX", name: "@", content: "mail.example.com", priority: 10, ttl: 3600, proxied: false },
            { type: "TXT", name: "@", content: "v=spf1 mx -all", ttl: 3600, proxied: false },
            { type: "TXT", name: "_dmarc", content: "v=DMARC1; p=none; rua=mailto:dmarc@example.com", ttl: 3600, proxied: false },
            { type: "TXT", name: "selector1._domainkey", content: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD...", ttl: 3600, proxied: false },
        ],
    },
    {
        id: "cloudflare-pages",
        name: "Cloudflare Pages",
        icon: "☁️",
        description: "Deployed to CF Pages",
        records: [
            { type: "CNAME", name: "@", content: "your-project.pages.dev", ttl: 3600, proxied: true },
            { type: "CNAME", name: "www", content: "your-project.pages.dev", ttl: 3600, proxied: true },
        ],
    },
    {
        id: "netlify",
        name: "Netlify",
        icon: "▲",
        description: "Deployed to Netlify",
        records: [
            { type: "CNAME", name: "@", content: "example.netlify.com", ttl: 3600, proxied: true },
            { type: "CNAME", name: "www", content: "example.netlify.com", ttl: 3600, proxied: true },
        ],
    },
    {
        id: "vercel",
        name: "Vercel",
        icon: "▲",
        description: "Deployed to Vercel",
        records: [
            { type: "CNAME", name: "@", content: "cname.vercel-dns.com", ttl: 3600, proxied: true },
            { type: "CNAME", name: "www", content: "cname.vercel-dns.com", ttl: 3600, proxied: true },
        ],
    },
];

export const DEPLOY_TARGETS = [
    { id: "cf-pages", label: "Cloudflare Pages", icon: "☁️", description: "Fast global CDN with Workers integration" },
    { id: "netlify", label: "Netlify", icon: "▲", description: "JAMstack deployment with CI/CD" },
    { id: "vercel", label: "Vercel", icon: "▲", description: "Next.js optimized deployment" },
    { id: "cf-workers", label: "Cloudflare Workers", icon: "⚡", description: "Edge computing platform" },
    { id: "s3-cloudfront", label: "S3 + CloudFront", icon: "📦", description: "AWS static hosting" },
    { id: "vps-ssh", label: "VPS via SSH", icon: "🖥️", description: "Direct server deployment" },
    { id: "git-push", label: "Git Push Pipeline", icon: "🧬", description: "Push artifacts to GitHub; CI deploys to targets" },
];

export const DEPLOY_ENVIRONMENTS = [
    { id: "production", label: "Production", icon: "🚀", color: "#10b981", description: "Live production environment" },
    { id: "staging", label: "Staging", icon: "🧪", color: "#f59e0b", description: "Pre-production testing" },
    { id: "dev", label: "Development", icon: "🔧", color: "#6366f1", description: "Development environment" },
];

export const DNS_TTL_OPTIONS = [
    { id: "auto", label: "Auto", value: 1 },
    { id: "300", label: "5 minutes", value: 300 },
    { id: "1800", label: "30 minutes", value: 1800 },
    { id: "3600", label: "1 hour", value: 3600 },
    { id: "86400", label: "1 day", value: 86400 },
    { id: "604800", label: "1 week", value: 604800 },
];

export const THEME = {
    bg: "#0b0d14", card: "#12141e", card2: "#181b28", hover: "#1c2030",
    input: "#1a1d2e", border: "#232738", borderFocus: "#6366f1",
    text: "#e2e8f0", muted: "#8892a8", dim: "#5b6478",
    primary: "#6366f1", primaryH: "#818cf8", primaryGlow: "rgba(99,102,241,0.15)",
    accent: "#22d3ee", success: "#10b981", danger: "#ef4444", warning: "#f59e0b",
    grad: "linear-gradient(135deg,#6366f1,#a855f7)",
};
