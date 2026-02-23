# Technical Audit and Root Cause Analysis
**System**: Dashboard Template Platform (Astro + Vite)
**Date**: February 2026

---

## Part 1 – Theme Bug Diagnosis
### Problem Statement
When switching to Light Mode, some components remain dark. This indicates a failure in dynamic CSS variable application or hardcoded styling overrides.

### Root Cause Analysis & Hydration Conflicts
1. **Hardcoded Utility Classes**: Components using specific color values (e.g., `bg-slate-900`) instead of semantic CSS variables (`bg-card` or `bg-background`).
2. **Missing CSS Variable Mappings**: The `.dark` class in `globals.css` might redefine variables that the light mode `:root` block is missing, or vice versa, causing a fallback to browser defaults.
3. **Hydration Mismatch (SSR vs Client)**: 
   - Astro renders HTML on the server. If the server assumes "light mode" but local storage is "dark", the HTML is sent with light mode classes.
   - When React/Preact hydrates on the client, the `ThemeToggle` component reads `localStorage` and flips the class. This causes a Flash of Unstyled Content (FOUC) and can break component state if colors are calculated in JS before hydration completes.
4. **CSS Specificity**: Global styles or scoped Astro styles (`<style scoped>`) might have higher specificity than the Tailwind generic classes applied by the theme toggle.

### Debugging Checklist
- [ ] Inspect the DOM to ensure `class="dark"` is correctly added/removed from the `<html>` or `<body>` element.
- [ ] Check affected components for hardcoded colors (e.g., `text-white`, `bg-gray-800`).
- [ ] Verify `globals.css` ensures all variables defined in `.dark` exist in `:root` with proper HSL syntax.
- [ ] Test SSR rendering by clearing local storage and loading the page (observe FOUC).
- [ ] Check for dynamic imports rendering before the theme script executes.

### Step-by-Step Fix Strategy
1. **Enforce Semantic Variables**: Replace hardcoded classes (e.g., `bg-slate-900`) with semantic counterparts (e.g., `bg-[hsl(var(--card))]` or `bg-card` if configured in Tailwind).
2. **Align globals.css**: Guarantee complete parity between `:root` and `.dark` variable definitions.
3. **Prevent Hydration Mismatch (FOUC)**: Add an inline blocking script inside `<head>` in your Astro layout to evaluate local storage and push the `.dark` class *before* the body renders:
   ```html
   <script is:inline>
     const theme = localStorage.getItem('theme');
     if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
       document.documentElement.classList.add('dark');
     } else {
       document.documentElement.classList.remove('dark');
     }
   </script>
   ```

---

## Part 2 – Template Generator Wizard Validation
### QA Validation Objective
Ensure the wizard securely and accurately clones, generates, and persists Astro template files without data corruption or unauthorized access.

### QA Test Scenarios

| Test ID | Objective | Steps | Expected Result | Status |
|---|---|---|---|---|
| **WIZ-01** | **Template Creation (From Scratch)** | 1. Open Wizard -> "Start from Scratch"<br>2. Fill required metadata.<br>3. Click "Generate". | Template generated. State updates with valid HTML/JS/CSS code in `generatedCode`. | [ ] |
| **WIZ-02** | **Data Persistence (Clone Mode)** | 1. Select "Clone Existing".<br>2. Pick a template.<br>3. Validate generated payload. | Configuration is exactly persisted and matches the source layout/schema. | [ ] |
| **WIZ-03** | **Rendering Integrity** | 1. Generate template.<br>2. Mount generated code into the preview iframe or component. | UI renders correctly with no broken CSS or missing JS logic. | [ ] |
| **WIZ-04** | **Error Handling (Network Failure)** | 1. Disconnect network during generation.<br>2. Wait for timeout. | UI displays graceful error message. Rollback incomplete DB writes. | [ ] |
| **WIZ-05** | **Permission Control** | 1. Login as Read-Only user.<br>2. Attempt to trigger Wizard API. | Save strictly blocked. Server returns `403 Forbidden`. | [ ] |

---

## Part 3 – Delete Template Feature Design
### Deletion Architecture
**Approach: Soft Delete with Dependency Guards**  
In a production platform where landing pages (`Sites`) rely on `Templates`, a *Hard Delete* poses severe crash risks. We must implement a **Soft Delete** (`deleted_at` timestamp).

### Architecture Components
1. **Dependency Checks**: Before deletion, querying the `Sites` table. If `SELECT COUNT(*) FROM sites WHERE template_id = ?` > `0`, block deletion and display dependent sites.
2. **Soft Delete Database Structure**: Update the Templates table to include `is_deleted` or `deleted_at`.
3. **Role-based Access**: Only `Admin` or `Owner` roles can execute deletes.

### Implementation Flow (Astro + Vite)
1. **UX Confirmation Flow**:
   - User clicks `Delete`.
   - Open Modal: *"Are you sure? This template will be archived and unavailable for new sites."*
   - Requires user to type the template name to confirm.
2. **API Endpoint (`DELETE /api/templates/:id`)**:
   - Verify JWT and Admin role.
   - Run dependency check query.
   - `UPDATE templates SET deleted_at = NOW() WHERE id = ?`.
3. **Frontend State Updates**: Remove the item locally using functional state updates (`setTemplates(prev => prev.filter(...))`) to prevent reloading.

---

## Part 4 – Change Log System Setup
### Versioning Structure
Use **Semantic Versioning (SemVer) 2.0.0** (`MAJOR.MINOR.PATCH`).
- **MAJOR**: Incompatible API resets or massive UI changes.
- **MINOR**: New backward-compatible functionality (e.g., Template Wizard).
- **PATCH**: Backward-compatible bug fixes (e.g., Theme bug).

### Design Format
Create `CHANGELOG.md` in the repository root. Display it parsing markdown to HTML in the "API Docs / Changelog" view.

### Sample Entry
```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [2.1.2] - 2026-02-23
### Added
- **Template System**: Implemented a safe "Delete Template" feature utilizing soft-deletes and architecture dependency checks. 
- **Wizard**: Added robust QA validation limits and generation rendering checks.

### Fixed
- **Theme**: Fixed hydration mismatch and scoped UI conflicts causing components to incorrectly persist dark mode while the System was in light mode.
```

---

## Part 5 – Template Storage Architecture
### Storage Location Matrix
1. **Template Metadata (Name, Categories, Configs)**: 
   - **Recommended**: Relational DB / Serverless DB (e.g., Cloudflare D1 or Neon PostgreSQL). Queryable and enforces relationships.
2. **Template Code & Static Assets (Astro Files, Zips)**:
   - **Recommended**: Object Storage (AWS S3, Cloudflare R2). Avoid storing raw heavy files in the DB.
   - *Why not filesystem?* Serverless (Cloudflare Workers / Vercel) utilizes ephemeral filesystems. File writes will vanish. 

### Folder Structure (During Astro Build/Authoring)
```text
src/
└── templates/
    ├── base/                 # Foundational layouts
    ├── finance/              # Industry specific blocks
    │   ├── LoanHero.astro
    │   └── config.json       # Template schema
    └── registry.json         # Index of available cloneable templates
```

### Data Flow for Template Generator
1. **Create**: User configures via Wizard (React State).
2. **Compile**: Worker API merges configuration with base Astro files.
3. **Persist**: 
   - Worker writes raw files into a ZIP in Object Storage (R2).
   - Worker writes DB Row containing URL to R2 Zip, mapping it to the `User ID`.
4. **Render**: When deploying a Landing Page, the deployer pulls the R2 Zip, injects final production keys, and triggers a Cloudflare Pages / Netlify deployment.

### Security Considerations
- **Sanitization**: Never render user `.customJs` directly in the Editor dashboard to avoid Stored XSS. Always escape until final production deployment.
- **Path Traversal Guards**: When resolving templates like `api/templates?path=finance/index`, sanitize the path to prevent `../` attacks hitting internal env files.
