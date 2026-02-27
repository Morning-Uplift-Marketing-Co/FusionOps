import { useState, useMemo } from "react";
import { THEME as T } from "../../../constants";
import { Field } from "../../ui/field";
import { InputField as Inp } from "../../ui/input-field";
import { Button } from "../../ui/button";

// Use the template registry so the wizard auto-discovers all registered templates
import "#lp-template-generator/templates";
import { getTemplates, getTemplate } from "#lp-template-generator/core/template-registry.js";

export function StepTemplateFromDir({ c, u, onGenerate, isGenerating }) {
    const [preview, setPreview] = useState(null);
    const TEMPLATES = useMemo(() => getTemplates(), []);

    const SAMPLE_SITE = {
        brand: "SampleBrand",
        domain: "example.com",
        colorId: "blue",
        fontId: "dm-sans",
        h1: "Sample Headline",
        sub: "Sample subheadline",
        cta: "Get Started",
        aid: "14881",
        network: "LeadsGate",
        redirectUrl: "#",
    };

    const handlePreview = (templateId) => {
        const tmpl = getTemplate(templateId);
        if (tmpl) {
            const files = tmpl.generate(SAMPLE_SITE);
            setPreview({ templateId, files, name: tmpl.name });
        }
    };

    const handleGenerateFrom = (templateId) => {
        const tmpl = getTemplate(templateId);
        if (tmpl && onGenerate) {
            // Generate actual files with SAMPLE_SITE so preview HTML is valid
            const files = tmpl.generate(SAMPLE_SITE);

            const sourceCode = `// Source: cloned from templates/${templateId}/index.js\n// New template ID: ${c.newFolderId || 'my-template'}\n// Generated: ${new Date().toISOString()}`;

            onGenerate({ sourceCode, files });
        }
    };

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Generate from Template</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Clone and modify existing template
                </p>
            </div>

            {/* New Template Info */}
            <Field label="New Template Folder Name" req help="e.g. my-custom-lp">
                <Inp
                    value={c.newFolderId}
                    onChange={(v) => u("newFolderId", v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="my-custom-lp"
                />
            </Field>

            <Field label="Display Name" req help="e.g. My Custom LP">
                <Inp
                    value={c.templateName}
                    onChange={(v) => u("templateName", v)}
                    placeholder="My Custom LP"
                />
            </Field>

            <Field label="Description">
                <textarea
                    value={c.templateDescription}
                    onChange={(e) => u("templateDescription", e.target.value)}
                    placeholder="Brief description of your template..."
                    style={{
                        width: "100%",
                        minHeight: 60,
                        padding: "12px 14px",
                        background: T.input,
                        border: "1px solid " + T.border,
                        borderRadius: 8,
                        color: T.text,
                        fontSize: 14,
                    }}
                />
            </Field>

            {/* Source Template Selection */}
            <Field label="Clone from Template" req>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {TEMPLATES.map((tmpl) => {
                        const isSelected = c.sourceTemplate === tmpl.id;
                        return (
                            <button
                                key={tmpl.id}
                                onClick={() => u("sourceTemplate", tmpl.id)}
                                style={{
                                    padding: 14,
                                    borderRadius: 10,
                                    background: isSelected ? T.primaryGlow : T.input,
                                    border: "2px solid " + (isSelected ? T.primary : T.border),
                                    cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? "#fff" : T.text }}>
                                        {tmpl.name}
                                    </span>
                                    {tmpl.badge && (
                                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, background: isSelected ? "rgba(255,255,255,0.2)" : T.border, color: isSelected ? "#fff" : T.muted }}>
                                            {tmpl.badge}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 11, color: isSelected ? "rgba(255,255,255,0.7)" : T.muted, marginTop: 2 }}>
                                    {tmpl.description || `ID: ${tmpl.id}`}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Field>

            {/* Preview Selected Template */}
            {c.sourceTemplate && (
                <div style={{
                    marginTop: 16,
                    padding: 16,
                    background: T.input,
                    borderRadius: 10,
                }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 12 }}>
                        Preview: {TEMPLATES.find(t => t.id === c.sourceTemplate)?.name}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <Button
                            onClick={() => handlePreview(c.sourceTemplate)}
                            variant="ghost"
                            size="sm"
                        >
                            👁️ Preview Files
                        </Button>
                        <Button
                            onClick={() => handleGenerateFrom(c.sourceTemplate)}
                            disabled={isGenerating || !c.newFolderId}
                            size="sm"
                        >
                            {isGenerating ? "Generating..." : "🚀 Generate from This"}
                        </Button>
                    </div>
                </div>
            )}

            {/* File Preview */}
            {preview && (
                <div style={{
                    marginTop: 16,
                    padding: 16,
                    background: "#1e1e1e",
                    borderRadius: 10,
                    maxHeight: 200,
                    overflowY: "auto",
                }}>
                    <div style={{ fontSize: 12, color: "#22c55e", marginBottom: 8 }}>
                        📁 Files in {preview.name} ({Object.keys(preview.files).length} files):
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {Object.keys(preview.files).sort().map((file) => (
                            <div key={file} style={{
                                fontSize: 11,
                                color: "#d4d4d4",
                                padding: "4px 8px",
                                fontFamily: "monospace",
                                borderRadius: 4,
                                background: file.includes("/") ? "transparent" : "#2a2a2a",
                            }}>
                                {file.includes("/") ? "  " : ""}📄 {file}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div style={{
                marginTop: 20,
                padding: 16,
                background: T.primary + "15",
                borderRadius: 10,
                border: "1px solid " + T.primary + "40",
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, marginBottom: 8 }}>
                    📋 How to use
                </div>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: T.muted }}>
                    <li>Enter a unique folder name for your new template</li>
                    <li>Select a template to clone from</li>
                    <li>Click "Generate from This" to preview the files</li>
                    <li>Click "Save Template" to save to the database</li>
                    <li>Your template will appear instantly in LP Wizard</li>
                </ol>
            </div>
        </>
    );
}

// Helper: Get source code of a template
function generateSourceCode(templateId, tmpl) {
    // Read the actual source file from the template generator
    // This gives users the complete code to copy and modify
    return `/**
 * NEW TEMPLATE: Based on ${templateId}
 * Created: ${new Date().toISOString()}
 *
 * INSTRUCTIONS:
 * 1. Create folder: packages/lp-template-generator/src/templates/YOUR-TEMPLATE-ID/
 * 2. Create index.js with this code
 * 3. Register in packages/lp-template-generator/src/templates/index.js
 * 4. Add to template-registry.js
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || "YourBrand";
  const domain = site.domain || "example.com";

  // TODO: Customize these based on your template needs
  const h1 = site.h1 || "Your Headline";
  const sub = site.sub || "Your subheadline";
  const cta = site.cta || "Get Started";

  const files = {};

  // ─── package.json ────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview"
    },
    dependencies: {
      astro: "^5.2.0"
    }
  }, null, 2);

  // ─── astro.config.mjs ─────────────────────────────
  files["astro.config.mjs"] = \`import { defineConfig } from "astro/config";
export default defineConfig({
  output: "static",
  site: "https://\${domain}"
});\`;

  // ─── src/pages/index.astro ─────────────────────────
  files["src/pages/index.astro"] = \`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>\${brand}</title>
  <style is:global>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: \${f.system}, system-ui, -apple-system, sans-serif;
      background: \${c.bg};
      color: \${c.text};
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    /* TODO: Add your custom styles here */
  </style>
</head>
<body>
  <section style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
    <div class="container" style="text-align: center;">
      <h1 style="font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; margin-bottom: 1rem;">
        \${h1}
      </h1>
      <p style="font-size: 1.25rem; color: \${c.muted}; margin-bottom: 2rem;">
        \${sub}
      </p>
      <button style="padding: 1rem 2.5rem; background: \${c.primary}; color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: 700; cursor: pointer;">
        \${cta}
      </button>
    </div>
  </section>
</body>
</html>\`;

  // TODO: Add more files as needed (public/assets, components, etc.)

  return files;
}

// Export metadata for the registry
export const metadata = {
  id: "YOUR-TEMPLATE-ID",
  name: "Your Template Name",
  description: "Brief description of what this template does",
  category: "general",
  features: ["hero-form"] // Add features: hero-form, calculator, faq, testimonials, etc.
};
`;
}
