import { useState, useRef } from "react";
import { THEME as T } from "../../../constants";
import { Field } from "../../ui/field";
import { InputField as Inp } from "../../ui/input-field";
import { Button } from "../../ui/button";
import JSZip from 'jszip';
import { validateAstroStandard } from "../../../utils/template-standard";

export function StepTemplateFromZip({ c, u, onGenerate }) {
    const [dragging, setDragging] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [parsedFiles, setParsedFiles] = useState(null);
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
        setParsedFiles(null);

        try {
            const zip = await JSZip.loadAsync(file);
            const files = {};

            // Extract all text files from the zip
            const ALLOWED_EXTS = ['.astro', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.env', '.toml'];
            const SKIP_DIRS = ['node_modules', '.git', 'dist', '.astro'];

            for (const [path, zipEntry] of Object.entries(zip.files)) {
                if (zipEntry.dir) continue;

                // Skip unwanted directories
                // Normalize path — determine if we should strip a root folder
                const parts = path.split('/');
                if (parts.some(p => SKIP_DIRS.includes(p))) continue;

                let normalizedPath = path;

                // Simple heuristic: if the first part is clearly a folder and there's a second part,
                // and it's NOT a standard directory like src/ or public/ at the root, 
                // we'll check if we should strip it later or just handle it here.
                // Better approach: collect all files first, then find common prefix.

                const ext = '.' + path.split('.').pop();
                if (!ALLOWED_EXTS.includes(ext)) continue;

                const content = await zipEntry.async('string');
                files[path] = content;
            }

            // --- SMART PATH NORMALIZATION ---
            // If all files share a common root directory, strip it.
            const filePaths = Object.keys(files);
            if (filePaths.length > 0) {
                const firstPathParts = filePaths[0].split('/');
                if (firstPathParts.length > 1) {
                    const rootCandidate = firstPathParts[0];
                    const allShareRoot = filePaths.every(p => p.startsWith(rootCandidate + '/'));

                    if (allShareRoot) {
                        const newFiles = {};
                        for (const [p, content] of Object.entries(files)) {
                            const newPath = p.substring(rootCandidate.length + 1);
                            if (newPath) newFiles[newPath] = content;
                        }
                        // Replace original files with normalized ones
                        Object.keys(files).forEach(key => delete files[key]);
                        Object.assign(files, newFiles);
                    }
                }
            }
            // ---------------------------------

            const standardCheck = validateAstroStandard(files);
            if (!standardCheck.ok) {
                setParseError(`Astro Standard Mode failed:\n- ${standardCheck.errors.join('\n- ')}`);
                setParsing(false);
                return;
            }

            setParsedFiles(files);
            const sourceCode = `// Uploaded from ZIP: ${file.name}\n// Files: ${Object.keys(files).length}\n// Normalized: ${Object.keys(files).some(k => !k.includes('/')) ? 'Yes' : 'No'}\n// Date: ${new Date().toISOString()}`;
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
            <Field label="Display Name" req>
                <Inp
                    value={c.templateName}
                    onChange={handleNameChange}
                    placeholder="My Custom LP"
                />
            </Field>

            <Field label="New Template ID" req help="Unique identifier, hyphens only (e.g. pro-lp-v1)">
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
                                Astro Standard Mode: index + apply + layout + tracking
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
                    <li>Must contain <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>src/pages/index.astro</code> or <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>index.html</code></li>
                    <li>Must contain <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>src/pages/apply.astro</code> or <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>apply.html</code></li>
                    <li>Must contain <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>src/layouts/Layout.astro</code></li>
                    <li>Must include tracking config/script (e.g. <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>__trackingConfig</code>, <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>src/lib/tracking.ts</code>)</li>
                    <li><code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>node_modules/</code> and <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>dist/</code> are automatically excluded</li>
                </ul>
            </div>
        </>
    );
}
