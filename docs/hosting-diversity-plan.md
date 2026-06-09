# Hosting Diversification Plan: ASN Spread for 37 Astro Sites

To mitigate Google footprint footprinting across your 37 static landing sites, you must diversify the IP addresses and ASNs serving the content. Because your GitHub Actions already handle the Astro/Vite `npm run build`, you only need simple static deployment targets.

**CRITICAL DNS RULE:** For any non-Cloudflare provider, you **must** use "DNS Only" (grey-cloud) in Cloudflare. If you leave the orange proxy on, Google will still see Cloudflare's ASN (AS13335) regardless of the underlying host.

## 1. Provider Comparison (at ~12 sites/each)

### (a) Multiple Cloudflare Accounts
*   **Monthly Cost:** $0 (CF Pages free tier supports 500 deploys/mo).
*   **Deploy Effort:** **Zero.** Your `deploy-lp.yml` already supports checking `cfApiToken` and `cfAccountId` directly from `deploy-configs/*.json`.
*   **ASN Diversity:** **None.** (All still resolve to AS13335). It only isolates account-level footprints, not IP footprints.
*   **DNS Implications:** Proxied (Orange cloud).
*   **Gotchas:** Doesn't solve IP-level footprinting.

### (b) Netlify
*   **Monthly Cost:** $19/mo (Pro tier). *Don't use Free tier for 12 commercial loan sites; Netlify enforces commercial use policies.*
*   **Deploy Effort:** Low. Swap `wrangler` for `netlify-cli` to upload the `dist/` folder.
*   **ASN Diversity:** High. Resolves to AS396982 (Netlify) or underlying AWS/GCP nodes.
*   **DNS Implications:** Set CNAME to `[site-name].netlify.app` (Grey-clouded in CF).
*   **Gotchas:** Site IDs must be pre-created or generated via Netlify API during deploy. 

### (c) Vercel
*   **Monthly Cost:** $20/mo (Pro tier). *Free/Hobby tier strictly forbids commercial use and will be banned automatically.*
*   **Deploy Effort:** Low. Run `vercel pull` then `vercel build` and `vercel deploy --prebuilt`.
*   **ASN Diversity:** High. Resolves to AS16509 (AWS / Vercel Edge).
*   **DNS Implications:** CNAME to `cname.vercel-dns.com` or A record to `76.76.21.21` (Grey-clouded).
*   **Gotchas:** Vercel routes strictly. If `dist/apply.html` is missing, Astro output might mismatch Vercel's expected routing without proper config.

### (d) GitHub Pages
*   **Monthly Cost:** $0.
*   **Deploy Effort:** **Not Recommended.** 
*   **ASN Diversity:** Fastly (AS54113).
*   **DNS Implications:** CNAME to `[org].github.io`.
*   **Gotchas:** GitHub Pages limits you to **one custom domain per repository**. To host 12 sites, you would need to break your monorepo into 12 separate repositories, destroying your current `deploy-configs/` workflow.

### (e) Bunny.net
*   **Monthly Cost:** ~$1.00 to $2.00/mo (Pay-as-you-go based on storage/bandwidth).
*   **Deploy Effort:** Medium. Uses standard REST API or FTP action to push the `dist/` folder to a Bunny Storage Zone.
*   **ASN Diversity:** High. Resolves to AS30083 (Bunny CDN).
*   **DNS Implications:** CNAME to `[zone-name].b-cdn.net` (Grey-clouded).
*   **Gotchas:** It's a CDN, not a PaaS. You must create the Storage Zone and Pull Zone via API first. No automatic PR preview links.

---

## 2. Allocation Table (37 Brands)

To maximize spread while keeping architecture manageable, eliminate GitHub Pages and split across 4 distinct ASNs.

| Provider | Sites | ASN Footprint | Target Brands (Examples) |
| :--- | :--- | :--- | :--- |
| **Vercel (Pro)** | 10 | AS16509 (AWS) | `bearlendlng.com`, `gotogetherloans.com`, `joracreditz.com` |
| **Netlify (Pro)** | 10 | AS396982 (Netlify) | `cashloansback.com`, `possiblefinence.com`, `pawpayfund.com` |
| **Bunny.net** | 9 | AS30083 (Bunny) | `pawvetfund.com`, `scratchforpetusa.com`, `petfundcare.com` |
| **Cloudflare** *(Legacy)* | 8 | AS13335 (Cloudflare) | `explorercredlt.com`, `fundsfineday.com`, `scratchcareday.com` |

---

## 3. GitHub Actions Modifications (`deploy-lp.yml`)

Update your JSON configs to include a new key: `"provider": "vercel" | "netlify" | "bunny" | "cloudflare"`.

### A. New Repository Secrets Required
*   `VERCEL_TOKEN`, `VERCEL_ORG_ID`
*   `NETLIFY_AUTH_TOKEN`
*   `BUNNY_API_KEY`, `BUNNY_STORAGE_PASSWORD`

### B. Workflow Step Changes (`deploy-lp.yml`)

1. **Parse the Provider:**
   Update the "Parse config" step to extract the target:
   `PROVIDER=$(node -e "const c=require('./$CONFIG_FILE');console.log(c.provider||'cloudflare')")`

2. **Conditional Deploy Steps:**
   Wrap your current Cloudflare `wrangler` steps with an `if` condition, and add parallel blocks for the others.

   **For Cloudflare (Existing):**
   ```yaml
   - name: Deploy to Cloudflare Pages
     if: steps.config_parse.outputs.provider == 'cloudflare'
     # ... existing wrangler deploy ...
   ```

   **For Vercel:**
   ```yaml
   - name: Deploy to Vercel
     if: steps.config_parse.outputs.provider == 'vercel'
     working-directory: ${{ steps.template.outputs.dir }}
     env:
       VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
       VERCEL_PROJECT_ID: ${{ steps.config_parse.outputs.vercel_project_id }}
     run: |
       npm install -g vercel
       vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
       vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
   ```

   **For Netlify:**
   ```yaml
   - name: Deploy to Netlify
     if: steps.config_parse.outputs.provider == 'netlify'
     working-directory: ${{ steps.template.outputs.dir }}
     env:
       NETLIFY_SITE_ID: ${{ steps.config_parse.outputs.netlify_site_id }}
     run: |
       npm install -g netlify-cli
       netlify deploy --dir=dist --prod --auth=${{ secrets.NETLIFY_AUTH_TOKEN }}
   ```

   **For Bunny.net:**
   ```yaml
   - name: Deploy to Bunny.net
     if: steps.config_parse.outputs.provider == 'bunny'
     working-directory: ${{ steps.template.outputs.dir }}/dist
     run: |
       # Delete old files, upload new files via Bunny Storage API
       curl -X PUT -T index.html -H "AccessKey: ${{ secrets.BUNNY_STORAGE_PASSWORD }}" \
       "https://storage.bunnycdn.com/${{ steps.config_parse.outputs.bunny_zone }}/"
       # (Use an FTP Action or recursive curl script for the full directory)
   ```

3. **Conditional DNS & Cache Logic:**
   Update the "Upsert Cloudflare DNS CNAME" step. If the provider is `cloudflare`, `proxied: true` is correct. For Vercel/Netlify/Bunny, you must force `proxied: false` (Grey cloud) in the API call payload (`{"proxied":false}`) and target their specific CNAME endpoints. If `proxied` is true, your ASN diversification fails entirely.
