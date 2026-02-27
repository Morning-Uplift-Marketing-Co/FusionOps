/**
 * Shared Base CSS
 * ===============
 * CSS reset + design token variables.
 * Every template page includes this at the top of <style>.
 * This eliminates CSS inconsistency across templates.
 */

export function baseCSS(tokens) {
  return `
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    :root{
      --primary:${tokens.primary};
      --primary-dark:${tokens.primaryDark};
      --primary-light:${tokens.primaryLight};
      --primary-glow:${tokens.primaryGlow};
      --secondary:${tokens.secondary};
      --accent:${tokens.accent};
      --accent-light:${tokens.accentLight};
      --accent-glow:${tokens.accentGlow};
      --accent-dark:${tokens.accentDark};
      --success:#22c55e;
      --bg:#faf9f7;
      --bg-warm:#f5f0eb;
      --fg:#1a1a2e;
      --fg-sub:#4a4a5a;
      --muted:#8a8a9a;
      --border:#e8e5e0;
      --card:#fff;
      --radius:16px;
      --radius-sm:10px;
      --font:${tokens.fontFamily};
    }
    html{scroll-behavior:smooth}
    body{font-family:var(--font);line-height:1.6;color:var(--fg);background:var(--bg);-webkit-font-smoothing:antialiased;overflow-x:hidden}
    a{color:inherit;text-decoration:none}
    img{max-width:100%;display:block}
    .container{max-width:1120px;margin:0 auto;padding:0 16px}
    @media(min-width:769px){.container{padding:0 24px}}
  `.trim();
}

/**
 * Font preconnect + import tags for <head>
 */
export function fontTags(tokens) {
  return [
    `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
    `<link href="https://fonts.googleapis.com/css2?family=${tokens.fontImport}&display=swap" rel="stylesheet" />`,
  ].join('\n  ');
}
