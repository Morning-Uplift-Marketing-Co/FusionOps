import { useState, useRef } from "react";
import { THEME as T } from "../../../constants";
import { Field } from "../../ui/field";
import { InputField as Inp } from "../../ui/input-field";
import JSZip from 'jszip';
import { validateAstroStandard, detectTemplateFormat } from "../../../utils/template-standard";

export function StepTemplateFromZip({ c, u, onGenerate }) {
    const [dragging, setDragging] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [parseWarnings, setParseWarnings] = useState([]);
    const [parsedFiles, setParsedFiles] = useState(null);
    const [detectedFormat, setDetectedFormat] = useState(null);
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

    const handleFile = async (file) => {
        if (!file || !file.name.endsWith('.zip')) {
            setParseError('Please upload a .zip file');
            return;
        }
        setParsing(true);
        setParseError(null);
        setParseWarnings([]);
        setParsedFiles(null);
        setDetectedFormat(null);

        try {
            const zip = await JSZip.loadAsync(file);
            const files = {};

            const ALLOWED_EXTS = ['.astro', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.env', '.toml', '.svg', '.txt'];
            const SKIP_DIRS = ['node_modules', '.git', 'dist', '.astro', '.wrangler'];

            for (const [rawPath, zipEntry] of Object.entries(zip.files)) {
                if (zipEntry.dir) continue;
                // Normalize: forward-slash only, strip leading slash
                const path = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
                const parts = path.split('/');
                if (parts.some(p => SKIP_DIRS.includes(p))) continue;
                const ext = '.' + path.split('.').pop().toLowerCase();
                if (!ALLOWED_EXTS.includes(ext)) continue;
                const content = await zipEntry.async('string');
                files[path] = content;
            }

            // Strip common root prefix — derive from ALL paths, not just the first
            const filePaths = Object.keys(files);
            if (filePaths.length > 0) {
                // Sort so nested paths come first — flat files like package.json would otherwise
                // be picked as rootCandidate (their split('/')[0] is just the filename with no subdir)
                const sortedPaths = [...filePaths].sort((a, b) => b.split('/').length - a.split('/').length);
                // Find the top-level directory that every path shares (if any)
                const rootCandidate = sortedPaths[0].split('/')[0];
                const allShareRoot = rootCandidate &&
                    filePaths.every(p => p === rootCandidate || p.startsWith(rootCandidate + '/'));
                // Only strip if the root is a directory (at least one path has a slash after it)
                const rootIsDir = filePaths.some(p => p.startsWith(rootCandidate + '/'));
                if (allShareRoot && rootIsDir) {
                    const newFiles = {};
                    for (const [p, content] of Object.entries(files)) {
                        const newPath = p.startsWith(rootCandidate + '/') ? p.substring(rootCandidate.length + 1) : p;
                        if (newPath) newFiles[newPath] = content;
                    }
                    Object.keys(files).forEach(k => delete files[k]);
                    Object.assign(files, newFiles);
                }
            }

            // Detect format first
            const format = detectTemplateFormat(files);

            // Validate
            const check = validateAstroStandard(files);

            if (!check.ok) {
                setParseError(check.errors.join('\n'));
                setParsing(false);
                return;
            }

            // Warnings are OK — show them but allow import
            setParseWarnings(check.warnings || []);
            setDetectedFormat(format);
            setParsedFiles(files);

            // Store format in template metadata
            u("templateFormat", format);

            const sourceCode = `// Uploaded from ZIP: ${file.name}\n// Format: ${format}\n// Files: ${Object.keys(files).length}\n// Date: ${new Date().toISOString()}`;
            onGenerate({ sourceCode, files, format });
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

    const formatLabel = detectedFormat === 'astro' ? '⚡ Astro Project' :
                        detectedFormat === 'html'  ? '🌐 HTML (Bolt/Lovable)' : null;

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Upload from ZIP</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Supports Astro projects and HTML exports from Bolt / Lovable
                </p>
            </div>

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
                            <div style={{ fontSize: 13, color: T.muted }}>Parsing ZIP...</div>
                        </>
                    ) : parsedFiles ? (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                                {Object.keys(parsedFiles).length} files loaded
                            </div>
                            {formatLabel && (
                                <div style={{ fontSize: 11, marginTop: 4, padding: "2px 10px", background: '#22c55e20', borderRadius: 6, display: 'inline-block', color: '#22c55e', fontWeight: 600 }}>
                                    {formatLabel}
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
                                Astro projects · Bolt / Lovable HTML exports
                            </div>
                        </>
                    )}
                </div>

                {parseError && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8, padding: "8px 12px", background: '#ef444410', borderRadius: 6, whiteSpace: 'pre-line' }}>
                        ⚠️ {parseError}
                    </div>
                )}

                {parseWarnings.length > 0 && (
                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 8, padding: "8px 12px", background: '#f59e0b10', borderRadius: 6 }}>
                        {parseWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                )}
            </Field>

            {/* File list */}
            {parsedFiles && (
                <div style={{ padding: 16, background: "#1e1e1e", borderRadius: 10, maxHeight: 180, overflowY: "auto" }}>
                    <div style={{ fontSize: 12, color: "#22c55e", marginBottom: 8 }}>
                        📁 Files detected ({Object.keys(parsedFiles).length}):
                    </div>
                    {Object.keys(parsedFiles).sort().map((f) => (
                        <div key={f} style={{ fontSize: 11, color: "#d4d4d4", padding: "2px 0", fontFamily: "monospace" }}>
                            📄 {f}
                        </div>
                    ))}
                </div>
            )}

            {/* Requirements info */}
            <div style={{
                marginTop: 16, padding: 14, background: T.primary + "12",
                borderRadius: 10, border: "1px solid " + T.primary + "30",
                fontSize: 12, color: T.muted,
            }}>
                <div style={{ fontWeight: 700, color: T.primary, marginBottom: 6 }}>📋 ZIP Requirements</div>
                <div style={{ marginBottom: 4, fontWeight: 600, color: T.text }}>Astro Project:</div>
                <ul style={{ margin: "0 0 8px 0", paddingLeft: 18 }}>
                    <li><code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>src/pages/index.astro</code> — required</li>
                    <li>apply.astro, Layout.astro, tracking — optional</li>
                </ul>
                <div style={{ marginBottom: 4, fontWeight: 600, color: T.text }}>Bolt / Lovable HTML:</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>index.html</code> — required</li>
                    <li>CSS, JS, assets — all supported</li>
                </ul>
            </div>
        </>
    );
}
