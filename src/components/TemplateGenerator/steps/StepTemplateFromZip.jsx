import { useRef, useState } from "react";
import JSZip from "jszip";
import { THEME as T } from "../../../constants";
import { Field } from "../../ui/field";
import { InputField as Inp } from "../../ui/input-field";
import { Button } from "../../ui/button";
import { TEMPLATE_AI_EDITABLE_FILES } from "../generateTemplateCode";

const ALLOWED_EXTS = [".astro", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".json", ".css", ".html", ".md", ".env", ".toml"];
const SKIP_DIRS = ["node_modules", ".git", "dist", ".astro"];

function isAllowedPath(path) {
    const ext = "." + String(path).split(".").pop().toLowerCase();
    return ALLOWED_EXTS.includes(ext);
}

function normalizePath(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function stripCommonRoot(files) {
    const keys = Object.keys(files);
    if (keys.length === 0) return files;
    const first = keys[0].split("/");
    if (first.length < 2) return files;

    const root = first[0];
    const allShare = keys.every(k => k.startsWith(`${root}/`));
    if (!allShare) return files;

    const out = {};
    for (const [k, v] of Object.entries(files)) {
        const next = k.slice(root.length + 1);
        if (next) out[next] = v;
    }
    return out;
}

function hasAstroIndex(files) {
    return Object.keys(files).some(p => p.endsWith("index.astro"));
}

function findHtmlIndex(files) {
    const keys = Object.keys(files);
    if (keys.includes("index.html")) return "index.html";
    return keys.find(p => p.endsWith("/index.html")) || null;
}

function ensureEntrypoint(files) {
    const out = { ...files };
    if (hasAstroIndex(out)) return out;

    const htmlIndexPath = findHtmlIndex(out);
    if (!htmlIndexPath) return out;

    out["src/pages/index.astro"] = out[htmlIndexPath];
    return out;
}

async function readZipFile(file) {
    const zip = await JSZip.loadAsync(file);
    const files = {};

    for (const [rawPath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        const path = normalizePath(rawPath);
        const parts = path.split("/");
        if (parts.some(p => SKIP_DIRS.includes(p))) continue;
        if (!isAllowedPath(path)) continue;
        files[path] = await zipEntry.async("string");
    }

    return ensureEntrypoint(stripCommonRoot(files));
}

async function readFileList(fileList) {
    const files = {};
    for (const f of fileList) {
        const rawPath = f.webkitRelativePath || f.name;
        const path = normalizePath(rawPath);
        const parts = path.split("/");
        if (parts.some(p => SKIP_DIRS.includes(p))) continue;
        if (!isAllowedPath(path)) continue;
        files[path] = await f.text();
    }
    return ensureEntrypoint(stripCommonRoot(files));
}

export function StepTemplateFromZip({ c, u, onGenerate }) {
    const [dragging, setDragging] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [parsedFiles, setParsedFiles] = useState(null);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const [idManuallyEdited, setIdManuallyEdited] = useState(false);

    const handleNameChange = (val) => {
        u("templateName", val);
        if (!idManuallyEdited && val) {
            const slug = val.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
            u("newFolderId", slug);
        }
    };

    const handleIdChange = (val) => {
        setIdManuallyEdited(true);
        u("newFolderId", val.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    };

    const finishImport = (files, importType, label) => {
        const fileCount = Object.keys(files).length;
        const isAstroProject = hasAstroIndex(files) || Object.keys(files).some((p) => String(p).endsWith(".astro"));
        const sourceCode = `// Imported from ${label}\n// Files: ${fileCount}\n// Entry: ${hasAstroIndex(files) ? "index.astro" : "index.html (wrapped)"}\n// Date: ${new Date().toISOString()}`;
        setParsedFiles(files);
        onGenerate({
            sourceCode,
            files,
            importType,
            defaults: {
                __rawFiles: !isAstroProject,
                __importType: importType,
                __aiTemplateOnly: true,
                __aiEditableFiles: TEMPLATE_AI_EDITABLE_FILES,
            },
        });
    };

    const handleFiles = async (items, sourceLabel = "files") => {
        if (!items || items.length === 0) return;
        setParsing(true);
        setParseError(null);
        setParsedFiles(null);

        try {
            let files = {};
            const first = items[0];
            const isSingleZip = items.length === 1 && /\.zip$/i.test(first.name || "");

            if (isSingleZip) {
                files = await readZipFile(first);
            } else {
                files = await readFileList(items);
            }

            if (!hasAstroIndex(files) && !findHtmlIndex(files)) {
                const found = Object.keys(files).slice(0, 8).join(", ");
                throw new Error(`Missing entry file (index.astro or index.html). Found: ${found || "none"}`);
            }

            const importType = isSingleZip ? "zip" : "files";
            finishImport(files, importType, isSingleZip ? first.name : sourceLabel);
        } catch (err) {
            setParseError(`Import failed: ${err.message}`);
        } finally {
            setParsing(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        handleFiles(files, "drag-drop");
    };

    const handleFileInputChange = (e) => {
        const files = Array.from(e.target.files || []);
        handleFiles(files, "file-picker");
    };

    const handleFolderInputChange = (e) => {
        const files = Array.from(e.target.files || []);
        handleFiles(files, "folder-picker");
    };

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Import Template Files</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    ZIP, HTML, Astro, or full project files
                </p>
            </div>

            <Field label="Display Name" req>
                <Inp value={c.templateName} onChange={handleNameChange} placeholder="My Custom LP" />
            </Field>

            <Field label="New Template ID" req help="Unique identifier, hyphens only (e.g. pro-lp-v1)">
                <Inp value={c.newFolderId} onChange={handleIdChange} placeholder="my-custom-lp" />
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

            <Field label="Template Source Files" req>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".zip,.astro,.html,.js,.jsx,.ts,.tsx,.mjs,.cjs,.json,.css,.md,.toml,.env"
                        style={{ display: "none" }}
                        onChange={handleFileInputChange}
                    />
                    <input
                        ref={folderInputRef}
                        type="file"
                        multiple
                        directory=""
                        webkitdirectory=""
                        style={{ display: "none" }}
                        onChange={handleFolderInputChange}
                    />
                    <Button type="button" size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                        📁 Select Files / ZIP
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => folderInputRef.current?.click()}>
                        🗂️ Select Folder
                    </Button>
                </div>

                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: `2px dashed ${dragging ? T.primary : (parsedFiles ? "#22c55e" : T.border)}`,
                        borderRadius: 12,
                        padding: "30px 20px",
                        textAlign: "center",
                        cursor: "pointer",
                        background: dragging ? T.primaryGlow : (parsedFiles ? "#22c55e10" : T.input),
                        transition: "all 0.2s",
                    }}
                >
                    {parsing ? (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                            <div style={{ fontSize: 13, color: T.muted }}>Importing files...</div>
                        </>
                    ) : parsedFiles ? (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                                {Object.keys(parsedFiles).length} files loaded
                            </div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Click to replace</div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                                Drop ZIP/files here or click to browse
                            </div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                                Requires <code style={{ background: T.card, padding: "1px 4px", borderRadius: 3 }}>index.astro</code> or <code style={{ background: T.card, padding: "1px 4px", borderRadius: 3 }}>index.html</code>
                            </div>
                        </>
                    )}
                </div>
                {parseError && (
                    <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8, padding: "8px 12px", background: "#ef444410", borderRadius: 6 }}>
                        ⚠️ {parseError}
                    </div>
                )}
            </Field>

            {parsedFiles && (
                <div style={{ padding: 16, background: "#1e1e1e", borderRadius: 10, maxHeight: 180, overflowY: "auto" }}>
                    <div style={{ fontSize: 12, color: "#22c55e", marginBottom: 8 }}>
                        📁 Files detected ({Object.keys(parsedFiles).length})
                    </div>
                    {Object.keys(parsedFiles).sort().map((f) => (
                        <div key={f} style={{ fontSize: 11, color: "#d4d4d4", padding: "2px 0", fontFamily: "monospace" }}>
                            📄 {f}
                        </div>
                    ))}
                </div>
            )}

            <div
                style={{
                    marginTop: 16,
                    padding: 14,
                    background: T.primary + "12",
                    borderRadius: 10,
                    border: "1px solid " + T.primary + "30",
                    fontSize: 12,
                    color: T.muted,
                }}
            >
                <div style={{ fontWeight: 700, color: T.primary, marginBottom: 6 }}>📋 Supported Import</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Single file: <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>index.html</code> or <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>index.astro</code></li>
                    <li>Project folder/files: Astro + static assets</li>
                    <li>ZIP package with the same file types</li>
                    <li><code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>node_modules/</code>, <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>dist/</code>, <code style={{ background: T.input, padding: "1px 4px", borderRadius: 3 }}>.git/</code> are excluded</li>
                </ul>
            </div>
        </>
    );
}
