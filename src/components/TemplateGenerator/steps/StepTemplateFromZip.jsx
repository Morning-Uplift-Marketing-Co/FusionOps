import { useState, useRef } from "react";
import { THEME as T } from "../../../constants";
import { Field } from "../../ui/field";
import { InputField as Inp } from "../../ui/input-field";
import { Button } from "../../ui/button";

export function StepTemplateFromZip({ c, u, onGenerate }) {
    const [dragging, setDragging] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [parsedFiles, setParsedFiles] = useState(null);
    const fileInputRef = useRef(null);

    const handleFile = async (file) => {
        if (!file || !file.name.endsWith('.zip')) {
            setParseError('Please upload a .zip file');
            return;
        }
        setParsing(true);
        setParseError(null);
        setParsedFiles(null);

        try {
            const { default: JSZip } = await import('jszip');
            const zip = await JSZip.loadAsync(file);
            const files = {};

            // Extract all text files from the zip
            const ALLOWED_EXTS = ['.astro', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.env', '.toml'];
            const SKIP_DIRS = ['node_modules', '.git', 'dist', '.astro'];

            for (const [path, zipEntry] of Object.entries(zip.files)) {
                if (zipEntry.dir) continue;

                // Skip unwanted directories
                const parts = path.split('/');
                if (parts.some(p => SKIP_DIRS.includes(p))) continue;

                // Normalize path — strip leading folder name if zip has a root folder
                const normalizedPath = parts.length > 1 && !path.includes('src/') && !path.includes('public/')
                    ? parts.slice(1).join('/')
                    : path;

                if (!normalizedPath) continue;

                const ext = '.' + normalizedPath.split('.').pop();
                if (!ALLOWED_EXTS.includes(ext)) continue;

                const content = await zipEntry.async('string');
                files[normalizedPath] = content;
            }

            if (!files['src/pages/index.astro'] && !Object.keys(files).some(f => f.endsWith('index.astro'))) {
                setParseError('ZIP must contain src/pages/index.astro');
                setParsing(false);
                return;
            }

            setParsedFiles(files);
            const sourceCode = `// Uploaded from ZIP: ${file.name}\n// Files: ${Object.keys(files).length}\n// Generated: ${new Date().toISOString()}`;
            onGenerate({ sourceCode, files });
        } catch (err) {
            setParseError(`Failed to parse ZIP: ${err.message}. Make sure jszip is installed.`);
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

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Upload from ZIP</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Upload an existing Astro project as a .zip file
                </p>
            </div>

            {/* Template Info */}
            <Field label="New Template ID" req help="e.g. my-custom-lp (lowercase, hyphens only)">
                <Inp
                    value={c.newFolderId}
                    onChange={(v) => u("newFolderId", v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="my-custom-lp"
                />
            </Field>

            <Field label="Display Name" req>
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
                        resize: "vertical",
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
                        borderRadius: 12,
                        padding: "32px 20px",
                        textAlign: "center",
                        cursor: "pointer",
                        background: dragging ? T.primaryGlow : (parsedFiles ? '#22c55e10' : T.input),
                        transition: "all 0.2s",
                    }}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        style={{ display: "none" }}
                        onChange={handleInputChange}
                    />
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
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                                Click to replace
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                                Drop .zip file here or click to browse
                            </div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                                Must contain <code style={{ background: T.card, padding: "1px 4px", borderRadius: 3 }}>src/pages/index.astro</code>
                            </div>
                        </>
                    )}
                </div>
                {parseError && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8, padding: "8px 12px", background: '#ef444410', borderRadius: 6 }}>
                        ⚠️ {parseError}
                    </div>
                )}
            </Field>

            {/* File Preview */}
            {parsedFiles && (
                <div style={{
                    padding: 16,
                    background: "#1e1e1e",
                    borderRadius: 10,
                    maxHeight: 180,
                    overflowY: "auto",
                }}>
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

            {/* Requirements */}
            <div style={{
                marginTop: 16,
                padding: 14,
                background: T.primary + "12",
                borderRadius: 10,
                border: "1px solid " + T.primary + "30",
                fontSize: 12,
                color: T.muted,
            }}>
                <div style={{ fontWeight: 700, color: T.primary, marginBottom: 6 }}>📋 ZIP Requirements</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Must contain <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>src/pages/index.astro</code></li>
                    <li>Optionally: <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>astro.config.mjs</code>, <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>src/layouts/</code>, <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>src/components/</code></li>
                    <li><code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>node_modules/</code> and <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>dist/</code> are automatically excluded</li>
                </ul>
            </div>
        </>
    );
}
