# Azure AD App Registration — Phase 2 Setup

This guide is for **Phase 2**: when `prealert@fedex.com` is provisioned and
we switch from SMTP/IMAP to Microsoft Graph API for sending and receiving
email.

**Prerequisites:**
- A Microsoft 365 tenant with Exchange Online
- A Global Administrator or Privileged Role Administrator to grant admin consent
- The `prealert@fedex.com` shared mailbox created in Exchange

---

## 1. Create the App Registration

1. Go to [Entra ID](https://entra.microsoft.com) → **App registrations** →
   **New registration**.
2. Name: `Cargo PAF Mail Engine`
3. **Supported account types**: "Accounts in this organizational directory only"
4. **Redirect URI**: leave blank (this is app-only auth, no user login)
5. Click **Register**.

---

## 2. Copy Credentials

From the app's **Overview** page:

| Variable | Value |
|----------|-------|
| `AZURE_AD_TENANT_ID` | Directory (tenant) ID |
| `AZURE_AD_CLIENT_ID` | Application (client) ID |

Go to **Certificates & secrets** → **New client secret**:

| Variable | Value |
|----------|-------|
| `AZURE_AD_CLIENT_SECRET` | The secret value (copy immediately) |

---

## 3. Grant API Permissions

1. Go to **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Application permissions**.
2. Add these permissions:

   | Permission | Use |
   |------------|-----|
   | `Mail.Send` | Send pre-alert emails from the shared mailbox |
   | `Mail.Read` | Read customer replies from the shared mailbox |
   | `Mail.ReadBasic.All` | Basic mailbox access |

3. Click **Grant admin consent** (requires a Global Admin).
4. Verify the status shows **"Granted for <tenant>"** for each permission.

---

## 4. Restrict to the Shared Mailbox (recommended)

Prevent a leaked client secret from sending as any mailbox:

```powershell
# Exchange Online PowerShell
Connect-ExchangeOnline

New-ApplicationAccessPolicy `
  -AppId "<AZURE_AD_CLIENT_ID>" `
  -PolicyScopeGroupId "prealert@fedex.com" `
  -AccessRight RestrictAccess `
  -Description "Cargo PAF - prealert@fedex.com only"
```

---

## 5. Enable IMAP for the Shared Mailbox (if needed)

If using IMAP polling instead of Graph subscriptions:

```powershell
Set-CASMailbox -Identity "prealert@fedex.com" -ImapEnabled $true
```

---

## 6. Configure Environment

```env
MAIL_DRIVER=graph
AZURE_AD_TENANT_ID=...
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
```

---

## 7. Verify

```bash
# Test sending via Graph
QUEUE_DRIVER=inline npm run dev
# Create a small batch, send to yourself, confirm it arrives from prealert@fedex.com
```
