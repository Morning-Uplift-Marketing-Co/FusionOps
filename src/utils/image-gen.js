/**
 * AI-style Image Generation for LP Factory
 * Generates favicon (SVG) and OG image (Canvas) from brand config
 */

import { COLORS } from "../constants";

/**
 * Generate SVG favicon from brand config
 * Returns data URL string
 */
export function generateFavicon(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const initial = (site.brand || "L")[0].toUpperCase();
  const p = `hsl(${c.p[0]},${c.p[1]}%,${c.p[2]}%)`;
  const a = `hsl(${c.a[0]},${c.a[1]}%,${c.a[2]}%)`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p}"/>
      <stop offset="100%" stop-color="${a}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="32" y="44" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="36" font-weight="800" fill="#fff">${initial}</text>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Generate OG image (1200x630) using Canvas
 * Returns Promise<dataURL string> (PNG base64)
 */
export async function generateOgImage(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const brand = site.brand || "LoanBridge";
  const tagline = site.sub || site.tagline || "Fast, Simple, Trusted.";
  const loanLabel = site.loanType === "installment" ? "Installment Loans" : site.loanType === "personal" ? "Personal Loans" : "Loans";

  const W = 1200, H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background gradient
  const p = `hsl(${c.p[0]},${c.p[1]}%,${c.p[2]}%)`;
  const a = `hsl(${c.a[0]},${c.a[1]}%,${c.a[2]}%)`;
  const bg = `hsl(${c.bg[0]},${c.bg[1]}%,${c.bg[2]}%)`;
  const fg = `hsl(${c.fg[0]},${c.fg[1]}%,${c.fg[2]}%)`;

  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `hsl(${c.p[0]},${Math.min(c.p[1] + 10, 100)}%,${Math.max(c.p[2] - 30, 5)}%)`);
  grad.addColorStop(1, `hsl(${c.a[0]},${Math.min(c.a[1] + 10, 100)}%,${Math.max(c.a[2] - 25, 8)}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Decorative circles
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(W - 150, 100, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(100, H - 80, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Logo icon (rounded rect with initial)
  const iconX = 80, iconY = 180, iconS = 72;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundRect(ctx, iconX, iconY, iconS, iconS, 16);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brand[0].toUpperCase(), iconX + iconS / 2, iconY + iconS / 2 + 2);

  // Brand name next to icon
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
  ctx.fillText(brand, iconX + iconS + 20, iconY + iconS / 2);

  // Main headline
  ctx.fillStyle = "#fff";
  ctx.font = "800 56px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  const headline = `Fast ${loanLabel}`;
  ctx.fillText(headline, 80, 300);

  // Amount badge
  if (site.amountMax) {
    const amountText = `Up to $${Number(site.amountMax).toLocaleString()}`;
    ctx.font = "700 48px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = p;
    // Accent background pill
    const amtW = ctx.measureText(amountText).width + 40;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, 76, 370, amtW, 60, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 36px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(amountText, 96, 400);
  }

  // Tagline
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "400 24px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(tagline, 80, 460);

  // Bottom bar
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(0, H - 60, W, 60);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 16px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(site.domain || "example.com", 80, H - 30);

  // Trust badges on right
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("🔒 256-bit SSL  •  Won't affect credit score", W - 80, H - 30);

  return canvas.toDataURL("image/png", 0.92);
}

// Helper: rounded rectangle
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
