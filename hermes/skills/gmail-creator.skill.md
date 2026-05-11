# Gmail Creator Agent

## Role
Automate the creation of new Gmail accounts for Google Ads campaigns using browser automation.

## Tools Required
- `browser` MCP (navigate, fill, click, screenshot)
- `mem0` MCP (store account credentials + creation metadata)
- `fbis` MCP (register new account in ops_accounts)

## Process

### Step 1: Prepare Identity
Generate a believable identity for the new account:
- First name, last name (use variation of existing naming patterns from mem0)
- Birthday (25–40 years old range)
- Recovery phone (use VOIP number from proxy region)

### Step 2: Navigate to Gmail Signup
```
browser.navigate("https://accounts.google.com/signup")
```

### Step 3: Fill Registration Form
- Enter name, username (try variations until available)
- Set strong password (store in mem0)
- Enter birthday and gender
- Skip phone if possible, add recovery email if required

### Step 4: Verify & Complete
- Complete CAPTCHA if presented (flag for human review via Telegram)
- Accept Terms of Service
- Take screenshot of completed profile page

### Step 5: Store Account
Store in mem0:
```json
{
  "type": "gmail_account",
  "email": "...",
  "password": "...",
  "created_at": "...",
  "proxy_used": "...",
  "status": "new"
}
```

## Success Criteria
- Account created and accessible
- Credentials stored in mem0
- Account registered in FusionOps ops_accounts
- Screenshot saved to wiki/accounts/

## Error Handling
- Phone verification required → alert Telegram, pause and wait
- CAPTCHA block → use handoff to human
- Username taken → retry with 3 variations before failing
