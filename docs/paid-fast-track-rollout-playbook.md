# Paid Fast-Track Rollout Playbook

## Scope

This rollout covers:

- Paid component normalization (`Tailwind UI` source profile)
- Tracking Pack baseline (`gtag` + first-party pixel + verification endpoint)
- Publish quality gate (UI + API block)
- Golden templates:
  - `installment-golden`
  - `pet-care-golden`
  - `leadgen-golden`

## Rollout Sequence

1. **Template intake**
   - Normalize template token usage (`--color-primary`, `--color-secondary`, `--color-accent`)
   - Validate mobile viewport + CTA + first-party pixel marker
2. **Pre-publish gate**
   - Open Template Manager
   - Ensure `Quality Gate: Pass`
   - If fail, block publish and resolve blocking messages
3. **Deploy + verify**
   - Deploy to Cloudflare Workers
   - Use post-deploy verification (`/api/automation/tracking/verify`)
   - Confirm:
     - worker health endpoint is reachable
     - `https://t.{domain}/e` responds to verification event
4. **Wizard availability**
   - Confirm template is visible/selectable in Wizard categories
   - Confirm default template save accepts template ID
5. **Smoke checks**
   - Open landing page on mobile width
   - Submit form flow and confirm event markers fire (`form_start`, `form_submit`)

## Team Checklist

- [ ] Template source mapped to normalization contract
- [ ] No Astro expression leaks on live HTML
- [ ] First-party pixel endpoint present in output HTML
- [ ] Loan templates include Payment Calculator + APR Compare block
- [ ] Loan copy has no banned policy-risk claims (e.g., guaranteed approval)
- [ ] Quality gate passes before publish
- [ ] Deploy verification returns success
- [ ] Wizard can select template in target category

## Acceptance Criteria

- Every new template is blocked from publish when quality gate has blocking issues
- Worker output does not leak Astro placeholders (`{title}`, conditional blocks)
- Core conversion events are present and verifiable
- Golden templates are available in runtime registry and Wizard
- Team can repeat the process using this playbook + deploy checklist

## Operational Notes

- Verification can fail during DNS propagation; re-run after propagation delay.
- Keep cross-origin headers aligned if new custom headers are introduced.
- Do not publish templates that only pass warnings by chance; warnings should be reviewed during QA.

