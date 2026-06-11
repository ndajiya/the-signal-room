# Signal Room 📡

**Signal Room** is a powerful WhatsApp-powered Viral Radar, Content Engine, and Secure Custodial Wallet. It allows owners to identify viral content, transform it into high-impact LinkedIn posts, and reward their community automatically.

## Permission

This project is based on or inspired by cryptosapp-wallet by Nicolas Montone.

Original repository:
https://github.com/NicolasMontone/cryptosapp-wallet

The original author gave permission to use the project publicly here:
[link to X post](https://x.com/montonenico/status/2064040534281203862)

Modifications and new code in this repository are licensed under the Apache License 2.0.

---

## 🚀 Key Features

### 📡 Viral Radar (Owner Only)
- **Instagram-to-LinkedIn Pipeline**: Share an Instagram Post, Reel, or Carousel to the bot.
- **AI Scoring Framework**: Automatically scores content based on Hook Strength, Transferability, Format Repeatability, and Brand Relevance.
- **LinkedIn Ghostwriter**: Generates polished, strategic LinkedIn drafts tailored to your brand identity.
- **Interactive Review**: Approve, Rewrite, or Skip drafts directly from WhatsApp buttons.

### 💰 Secure Crypto Wallet (Polygon zkEVM)
- **Custodial Wallet**: Instant wallet creation tied to WhatsApp phone numbers.
- **Gasless Transactions**: Integrated **ERC-4337-style Sponsorship** logic. The owner pays for user gas via a Sponsor Wallet.
- **Multi-Asset Support**: Supports ETH (Gas) and USDT on Polygon zkEVM.
- **Interactive Menu**: Check balance, deposit funds, and "Give me my Fakn money!" (Transfer) via simple buttons.

### 🔗 LinkedIn Reward Engine
- **Automatic Payouts**: Reward the first 10-25 commenters on your LinkedIn posts with crypto.
- **Identity Linking**: Users can link their LinkedIn profiles via a unique verification code (`CRYPTO-XXXX`) or manual URN entry.

---

## 🛡️ Security Architecture

- **Encryption at Rest**: Private keys are encrypted using **AES-256-GCM** with a server-side `MASTER_ENCRYPTION_KEY` and a user-defined PIN.
- **PIN-Protected 2FA**: A 6-digit PIN is required for Wallet Registration, Balance Checks, and Transfers.
- **Owner-Only Mode**: Viral Radar features are strictly restricted to the `OWNER_WHATSAPP_NUMBER`.
- **Secure Configuration**: An Admin Dashboard allows managing secrets without exposing them in `.env` files.

---

## ⚙️ How to use it

As simple as scanning a QR code. We will take care of the rest!
Once the QR is scanned, you will be redirected to Whatsapp with our chatbot, where you will be able to create your own wallet.

### Run it in local

You should have installed `vercel-cli`

- Setup your project in vercel adding the env variables of the `.env.example`
- run

```bash
npm run start
```

### Deploy from GitHub to Vercel

When importing this repository into Vercel, use these project settings:

- `Framework Preset`: `Other`
- `Root Directory`: `.`
- `Install Command`: `npm install`
- `Build Command`: leave empty
- `Output Directory`: leave empty
- `Development Command`: leave empty

Recommended in the Vercel project settings after import:

- `Node.js Version`: `22.x`
- `Production Branch`: your main branch, usually `main`

Add these **Bootstrap Environment Variables** in Vercel to get your dashboard running:

- `ADMIN_SECRET`: Your dashboard password.
- `SUPABASE_URL`: From your Supabase project.
- `SUPABASE_ANON_KEY`: From your Supabase project.

Once the dashboard is live, you can configure the rest of the application settings through the UI.

### Critical Application Settings
Every user who deploys this bot (the "Operator") must provide their own keys for the following services:

- **Blockchain**: `QUICK_NODE_URL`, `SPONSOR_PRIVATE_KEY`, `MASTER_ENCRYPTION_KEY`
- **WhatsApp**: `META_WA_ACCESS_TOKEN`, `META_WA_SENDER_PHONE_NUMBER_ID`, `META_WA_WABA_ID`, `OWNER_WHATSAPP_NUMBER`
- **AI (Interchangeable)**:
  - `AI_PROVIDER`: "openai" or "anthropic" (Claude).
  - `OPENAI_API_KEY`: Required if provider is "openai".
  - `ANTHROPIC_API_KEY`: Required if provider is "anthropic".

Optional environment variables:

- `LINKEDIN_ACCESS_TOKEN`
- `ANTHROPIC_MODEL`
- `OPENAI_MODEL`
- `TOKEN_CONTRACT_ADDRESS`
- `TOKEN_SYMBOL`
- `TOKEN_DECIMALS`
- `TOKEN_NAME`
- `COMMENT_REWARD_AMOUNT`
- `MAX_COMMENTERS_TO_REWARD`
- `MAX_TOTAL_REWARD_PER_POST`
- `REWARD_ONLY_FIRST_UNIQUE_COMMENT`

### Endpoints

- `/api/whatsapp`: Main webhook for WhatsApp API notifications.
- `/api/admin/dashboard`: Secure web dashboard for configuration.
- `/api/admin/settings`: API for dynamic settings management.
- `/api/linkedin/reward`: Endpoint to trigger LinkedIn comment rewards.

---

## 🛠️ Setup Instructions

### 1. Database Setup (Supabase)
Run the [setup_viral_radar.sql](file:///c%3A/Users/ndaji/Documents/cryptosapp-wallet-main/scripts/setup_viral_radar.sql) script in your Supabase SQL Editor to create the required tables (`users`, `settings`, `viral_candidates`, `linkedin_drafts`, `payment_requests`).

### 2. WhatsApp and Meta accounts

1. Go to [facebook's business dashboard](https://business.facebook.com/), log in and create a new business account.
2. Go to [Accounts / Whatsapp accounts](https://business.facebook.com/settings/whatsapp-business-accounts/) and click `Add`. Enter a phone number without a personal account.
3. Register a developer account at `developers.facebook.com`.
4. Create a "Business" app and select your business account.
5. Set up the "Whatsapp" product and click "Start using the API".
6. Copy the "Phone number ID" and "WhatsApp Business Account ID" to your environment variables.
7. Generate an **Admin System User** token with `business_management`, `whatsapp_business_messaging`, and `whatsapp_business_management` permissions.
8. Configure the Webhook callback URL to `https://{YOUR_URL}/api/whatsapp` and set your verify token.

### 3. Admin Dashboard Configuration
Once deployed, visit `/api/admin/dashboard` to set up your brand identity and critical keys:
- `OWNER_WHATSAPP_NUMBER`
- `AI_PROVIDER`: "openai" or "anthropic" (Claude).
- `OPENAI_API_KEY` (if using OpenAI) or `ANTHROPIC_API_KEY` (if using Claude)
- `SPONSOR_PRIVATE_KEY`
- `LINKEDIN_ACCESS_TOKEN`
- `BRAND_NAME` & `BRAND_TARGET_AUDIENCE`

### 4. Vercel Routing Behavior

This repository is configured so the root Vercel URL does not show a blank 404 page.

- Visiting `/` redirects to `/api/admin/dashboard`
- Visiting `/admin` redirects to `/api/admin/dashboard`
- Visiting `/dashboard` redirects to `/api/admin/dashboard`

That means users can open the deployment URL directly and land on the configuration dashboard instead of Vercel's default 404 screen.

---
*Built for founders who want to scale their presence and reward their tribe.*
