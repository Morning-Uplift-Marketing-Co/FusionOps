import { useState, useRef } from "react";
import { THEME as T } from "../../../constants";
import { Field } from "../../ui/field";
import { InputField as Inp } from "../../ui/input-field";
import JSZip from 'jszip';
import { analyzeTemplate } from "../../../utils/template-analyzer";
import { normalizeTemplateFiles } from "../../../utils/template-standard";
import { parameterizeTemplate } from "../../../utils/generators/template-parameterizer";

const MAX_ZIP_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_EXTRACTED_SIZE = 30 * 1024 * 1024; // 30 MB uncompressed

const ALLOWED_EXTS = [
    '.astro', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
    '.json', '.css', '.html', '.md', '.env', '.toml', '.svg', '.txt',
];
const SKIP_DIRS = ['node_modules', '.git', '.astro', '.wrangler', '.next', '.vercel', '__pycache__'];

export function StepTemplateFromZip({ c, u, onGenerate }) {
    const [dragging, setDragging] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [parseWarnings, setParseWarnings] = useState([]);
    const [parsedFiles, setParsedFiles] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const fileInputRef = useRef(null);

    const [idManuallyEdited, setIdManuallyEdited] = useState(false);

    const handleNameChange = (val) => {
        u("templateName", val);
        if (!idManuallyEdited && val) {
            const slug = val.toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            u("newFolderId", slug);
        }
    };

    const handleIdChange = (val) => {
        setIdManuallyEdited(true);
        u("newFolderId", val.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    };

    /**
     * Strip wrapper directories until we find a known entry point.
     * Handles: project-name/src/pages/index.astro -> src/pages/index.astro
     */
    const stripRootWrappers = (inputFiles) => {
        let current = normalizeTemplateFiles(inputFiles);
        for (let depth = 0; depth < 3; depth++) {
            const paths = Object.keys(current);
            if (paths.length === 0) return current;

            const topDirs = [...new Set(paths.map(p => p.split('/')[0]).filter(Boolean))];
            if (topDirs.length !== 1) return current;

            const root = topDirs[0];
            const hasNested = paths.some(p => p.startsWith(root + '/'));
            if (!hasNested) return current;

            const stripped = {};
            for (const [p, content] of Object.entries(current)) {
                const trimmed = p.startsWith(root + '/') ? p.slice(root.length + 1) : p;
                if (trimmed) stripped[trimmed] = content;
            }

            if (Object.keys(stripped).length === 0) return current;
            current = stripped;

            // Check if we've found a valid entry point after stripping
            const hasEntry = Object.keys(current).some(k =>
                k === 'src/pages/index.astro' || k === 'index.astro' ||
                k === 'index.html' || k === 'src/App.tsx' || k === 'src/App.jsx'
            );
            if (hasEntry) return current;
        }
        return current;
    };

    const handleFile = async (file) => {
        if (!file || !file.name.endsWith('.zip')) {
            setParseError('Please upload a .zip file');
            return;
        }
        if (file.size > MAX_ZIP_SIZE) {
            setParseError(`ZIP file is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_ZIP_SIZE / 1024 / 1024} MB.`);
            return;
        }

        setParsing(true);
        setParseError(null);
        setParseWarnings([]);
        setParsedFiles(null);
        setAnalysis(null);

        try {
            const zip = await JSZip.loadAsync(file);
            const files = {};
            let extractedSize = 0;

            for (const [rawPath, zipEntry] of Object.entries(zip.files)) {
                if (zipEntry.dir) continue;

                const path = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
                const parts = path.split('/');
                if (parts.some(p => SKIP_DIRS.includes(p))) continue;

                const ext = '.' + path.split('.').pop().toLowerCase();
                if (!ALLOWED_EXTS.includes(ext)) continue;

                const content = await zipEntry.async('string');
                extractedSize += content.length;
                if (extractedSize > MAX_EXTRACTED_SIZE) {
                    setParseError(`Extracted content exceeds ${MAX_EXTRACTED_SIZE / 1024 / 1024} MB limit. Remove unnecessary files from the ZIP.`);
                    setParsing(false);
                    return;
                }

                files[path] = content;
            }

            if (Object.keys(files).length === 0) {
                setParseError('ZIP contains no supported files. Expected .astro, .html, .tsx, .jsx, .css, .js, or .json files.');
                setParsing(false);
                return;
            }

            // Strip wrapper directories
            const normalizedFiles = stripRootWrappers(files);

            // Run full analysis
            const result = analyzeTemplate(normalizedFiles);

            if (result.errors.length > 0) {
                setParseError(result.errors.join('\n'));
                setParsing(false);
                return;
            }

            // ─── Auto-parameterize: convert hard-coded text to ${variable} syntax ───
            // This allows substituteSiteVariables() to inject site-specific content
            // when generating previews and deploying.
            const { files: paramFiles, constants, rulesCount } = parameterizeTemplate(normalizedFiles);
            if (rulesCount > 0 && constants.brand) {
                console.log('[ZIP Upload] Parameterized:',
                    `brand=${constants.brand}, domain=${constants.domain},`,
                    `${rulesCount} rules,`,
                    Object.keys(paramFiles).filter(p => paramFiles[p] !== normalizedFiles[p]).length,
                    'files modified'
                );
            }

            setParseWarnings(result.warnings);
            setAnalysis(result);
            setParsedFiles(paramFiles);

            // Store analysis metadata in wizard state
            u("templateFormat", result.framework.id);

            console.log('[ZIP Upload] Analysis:', result.framework.label,
                `(${(result.framework.confidence * 100).toFixed(0)}%)`,
                'Entry:', result.entry.path,
                'Deps:', result.dependencies.map(d => d.label).join(', ') || 'none'
            );

            const sourceCode = [
                `// Uploaded from ZIP: ${file.name}`,
                `// Framework: ${result.framework.label} (${(result.framework.confidence * 100).toFixed(0)}% confidence)`,
                `// Entry: ${result.entry.path || 'none'}`,
                `// Dependencies: ${result.dependencies.map(d => d.label).join(', ') || 'none'}`,
                `// Files: ${Object.keys(normalizedFiles).length}`,
                `// Date: ${new Date().toISOString()}`,
            ].join('\n');

            onGenerate({
                sourceCode,
                files: paramFiles,
                format: result.framework.id,
                analysis: result,
                parameterized: rulesCount > 0,
                detectedConstants: constants,
            });
        } catch (err) {
            setParseError(`Failed to parse ZIP: ${err.message}`);
        } finally {
            setParsing(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleInputChange = (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    };

    // Framework badge
    const frameworkBadge = analysis ? {
        'astro':       { label: 'Astro',         color: '#FF5D01' },
        'vite-react':  { label: 'Vite + React',  color: '#61DAFB' },
        'next':        { label: 'Next.js',        color: '#000000' },
        'html-static': { label: 'Static HTML',   color: '#E34F26' },
    }[analysis.framework.id] || null : null;

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Smart Import</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Supports Astro, Bolt.new, Lovable, v0, and static HTML projects
                </p>
            </div>

            {/* Template Info */}
            <Field label="Display Name" req>
                <Inp value={c.templateName} onChange={handleNameChange} placeholder="My Custom LP" />
            </Field>

            <Field label="Template ID" req help="Unique identifier, hyphens only (e.g. pro-lp-v1)">
                <Inp
                    value={c.newFolderId}
                    onChange={handleIdChange}
                    placeholder="my-custom-lp"
                />
            </Field>

            <Field label="Description">
                <textarea
                    value={c.templateDescription}
                    onChange={(e) => u("templateDescription", e.target.value)}
                    placeholder="Brief description of your template..."
                    style={{
                        width: "100%", minHeight: 60, padding: "12px 14px",
                        background: T.input, border: "1px solid " + T.border,
                        borderRadius: 8, color: T.text, fontSize: 14, resize: "vertical",
                    }}
                />
            </Field>

            {/* Drop Zone */}
            <Field label="ZIP File" req>
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: `2px dashed ${dragging ? T.primary : (parsedFiles ? '#22c55e' : T.border)}`,
                        borderRadius: 12, padding: "32px 20px", textAlign: "center",
                        cursor: "pointer",
                        background: dragging ? T.primaryGlow : (parsedFiles ? '#22c55e10' : T.input),
                        transition: "all 0.2s",
                    }}
                >
                    <input ref={fileInputRef} type="file" accept=".zip" style={{ display: "none" }} onChange={handleInputChange} />
                    {parsing ? (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                            <div style={{ fontSize: 13, color: T.muted }}>Analyzing template...</div>
                        </>
                    ) : parsedFiles ? (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                                {Object.keys(parsedFiles).length} files loaded
                            </div>
                            {frameworkBadge && (
                                <div style={{
                                    display: 'inline-block', marginTop: 6, padding: "3px 12px",
                                    borderRadius: 8, fontSize: 11, fontWeight: 700,
                                    background: frameworkBadge.color + '18',
                                    color: frameworkBadge.color,
                                    border: `1px solid ${frameworkBadge.color}30`,
                                }}>
                                    {frameworkBadge.label}
                                    {analysis && (
                                        <span style={{ opacity: 0.7, marginLeft: 4 }}>
                                            {(analysis.framework.confidence * 100).toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            )}
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Click to replace</div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                                Drop .zip file here or click to browse
                            </div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                                Astro projects, Bolt.new exports, Lovable HTML, any static site
                            </div>
                        </>
                    )}
                </div>

                {parseError && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8, padding: "8px 12px", background: '#ef444410', borderRadius: 6, whiteSpace: 'pre-line' }}>
                        {parseError}
                    </div>
                )}

                {parseWarnings.length > 0 && (
                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 8, padding: "8px 12px", background: '#f59e0b10', borderRadius: 6 }}>
                        {parseWarnings.map((w, i) => <div key={i}>* {w}</div>)}
                    </div>
                )}
            </Field>

            {/* Analysis Results */}
            {analysis && (
                <div style={{
                    padding: 16,
                    background: "#1a1d2e",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.06)",
                }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 12 }}>
                        Analysis Results
                    </div>

                    {/* Framework */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: T.muted, width: 80 }}>Framework:</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                            {analysis.framework.label}
                        </span>
                        {analysis.framework.buildRequired && (
                            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: '#f59e0b20', color: '#f59e0b', fontWeight: 600 }}>
                                BUILD REQUIRED
                            </span>
                        )}
                    </div>

                    {/* Entry Point */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: T.muted, width: 80 }}>Entry:</span>
                        <code style={{ fontSize: 11, color: '#22c55e', background: '#22c55e10', padding: "2px 6px", borderRadius: 4 }}>
                            {analysis.entry.path || 'none found'}
                        </code>
                        {analysis.entry.renderable && (
                            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: '#22c55e20', color: '#22c55e', fontWeight: 600 }}>
                                PREVIEWABLE
                            </span>
                        )}
                    </div>

                    {/* Dependencies */}
                    {analysis.dependencies.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 11, color: T.muted, width: 80, flexShrink: 0 }}>Deps:</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {analysis.dependencies.map(dep => (
                                    <span key={dep.id} style={{
                                        fontSize: 10, padding: "2px 8px", borderRadius: 6,
                                        background: dep.critical ? '#3b82f620' : 'rgba(255,255,255,0.05)',
                                        color: dep.critical ? '#60a5fa' : T.muted,
                                        fontWeight: 600,
                                        border: `1px solid ${dep.critical ? '#3b82f630' : 'rgba(255,255,255,0.08)'}`,
                                    }}>
                                        {dep.label}
                                        {dep.cdnUrl && <span style={{ marginLeft: 3, opacity: 0.5 }}>CDN</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CSS Variables */}
                    {analysis.cssVars.hasShadcnVars && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: T.muted, width: 80 }}>Theming:</span>
                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: '#8b5cf620', color: '#a78bfa', fontWeight: 600, border: '1px solid #8b5cf630' }}>
                                shadcn/ui CSS Variables
                            </span>
                            <span style={{ fontSize: 10, color: T.muted }}>
                                {Object.keys(analysis.cssVars.variables).length} vars detected
                            </span>
                        </div>
                    )}

                    {/* Evidence */}
                    {analysis.framework.evidence.length > 0 && (
                        <details style={{ marginTop: 10 }}>
                            <summary style={{ fontSize: 10, color: T.muted, cursor: 'pointer' }}>
                                Detection evidence ({analysis.framework.evidence.length} signals)
                            </summary>
                            <div style={{ marginTop: 4, paddingLeft: 8 }}>
                                {analysis.framework.evidence.map((e, i) => (
                                    <div key={i} style={{ fontSize: 10, color: T.muted, padding: "1px 0", fontFamily: "monospace" }}>
                                        + {e}
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            )}

            {/* File Preview (shown only if analysis hasn't loaded yet) */}
            {parsedFiles && !analysis && (
                <div style={{ padding: 16, background: "#1e1e1e", borderRadius: 10, maxHeight: 180, overflowY: "auto" }}>
                    <div style={{ fontSize: 12, color: "#22c55e", marginBottom: 8 }}>
                        Files detected ({Object.keys(parsedFiles).length}):
                    </div>
                    {Object.keys(parsedFiles).sort().map((f) => (
                        <div key={f} style={{ fontSize: 11, color: "#d4d4d4", padding: "2px 0", fontFamily: "monospace" }}>
                            {f}
                        </div>
                    ))}
                </div>
            )}

            {/* Supported formats info */}
            <div style={{
                marginTop: 16, padding: 14, background: T.primary + "12",
                borderRadius: 10, border: "1px solid " + T.primary + "30",
                fontSize: 12, color: T.muted,
            }}>
                <div style={{ fontWeight: 700, color: T.primary, marginBottom: 6 }}>Supported Formats</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                        <div style={{ fontWeight: 600, color: T.text, marginBottom: 2 }}>Astro Projects</div>
                        <div style={{ fontSize: 11 }}>src/pages/index.astro</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: T.text, marginBottom: 2 }}>Bolt.new / Static HTML</div>
                        <div style={{ fontSize: 11 }}>index.html + CSS/JS</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: T.text, marginBottom: 2 }}>Lovable / Vite+React</div>
                        <div style={{ fontSize: 11 }}>Requires build step</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: T.text, marginBottom: 2 }}>Auto-detected</div>
                        <div style={{ fontSize: 11 }}>Tailwind, Lucide, shadcn/ui</div>
                    </div>
                </div>
            </div>
        </>
    );
}
