# Signal Room

Signal Room is a serverless TypeScript bot that combines a self-custodial-style Polygon zkEVM wallet experience with an AI-powered content workflow. WhatsApp and Telegram are the user interfaces; Supabase stores users, encrypted wallet keys, settings, payment state, and content candidates.

## Features

### Wallet users

Users on either active messaging platform can:

- Create a Polygon zkEVM wallet protected by a PIN.
- Receive a wallet address for ETH and configured ERC-20 token deposits.
- Check ETH and token balances.
- Send tokens to a wallet address or a registered WhatsApp phone number.
- Have gas sponsored by the configured sponsor wallet when eligible.
- Link a LinkedIn account directly with a LinkedIn URN or with a verification code.
- Receive a PolygonScan address link after a successful transfer.

Wallet private keys are encrypted with `MASTER_ENCRYPTION_KEY` and the user's PIN before being stored.

### WhatsApp and Telegram

The owner can choose which messaging platform is active:

```text
ACTIVE_MESSAGING_PLATFORM=whatsapp
ACTIVE_MESSAGING_PLATFORM=telegram
ACTIVE_MESSAGING_PLATFORM=both
```

If the setting is omitted, both platforms remain active for backward compatibility. The setting can be managed from the admin dashboard or through the settings table/environment.

WhatsApp webhook:

```text
/api/whatsapp
```

Telegram webhook:

```text
/api/telegram
```

Telegram users are stored with an identity such as `telegram:<chat-id>`. They are separate accounts from WhatsApp users unless an explicit account-linking flow is added.

#### Telegram wallet commands

Telegram users can use the inline buttons or these commands:

| Command | Action |
| --- | --- |
| `/start` | Start onboarding or open the wallet menu |
| `/register` | Start wallet registration |
| `/wallet` | Open the wallet; prompts unregistered users to create one |
| `/deposit` | Show the wallet address for ETH and token deposits |
| `/balance` | Request the PIN and show ETH and token balances |
| `/send` | Start a token transfer to a wallet address or registered WhatsApp number |
| `/linkedin` | Start LinkedIn account linking |
| `/cancel` | Cancel the current transfer or wallet action |
| `/help` | Show the command list |

During wallet creation, send the requested PIN as a normal message. During a balance check or transfer, send the PIN when prompted. During `/send`, send the recipient first, then the amount, then the PIN. For `/linkedin`, choose whether to provide a LinkedIn URN or receive a verification code.

To show these commands in Telegram, open `@BotFather`, choose `/setcommands`, select the bot, and paste:

```text
start - Start onboarding or open the wallet
register - Create a wallet
wallet - Open the wallet menu
deposit - Show the deposit address
balance - Check ETH and token balances
send - Send tokens
linkedin - Link a LinkedIn account
cancel - Cancel the current action
help - Show available commands
```

### Viral Radar

The owner can send an Instagram post, Reel, or TV URL through WhatsApp or Telegram. Signal Room then:

1. Extracts available Instagram metadata.
2. Stores the candidate in Supabase.
3. Uses OpenAI or Anthropic to score its viral potential.
4. Evaluates hook strength, LinkedIn transferability, brand relevance, repeatability, topic heat, comment potential, and visible popularity.
5. Generates an original LinkedIn draft when the score is at least 70.
6. Lets the owner approve or skip the draft.

The draft is stored in the `linkedin_drafts` table for later publishing or review.

### LinkedIn rewards

The protected endpoint `/api/linkedin/reward` can inspect comments on a LinkedIn post and reward eligible commenters with tokens. It supports:

- A configurable reward amount.
- A configurable maximum number of commenters.
- A per-post total reward cap.
- Rewarding only the first unique comment from each author.
- Linking a commenter using a stored LinkedIn URN or a `CRYPTO-1234` verification code.

## Architecture

```text
WhatsApp Cloud API ─┐
                    ├─ Vercel serverless handlers ─ Supabase
Telegram Bot API ───┘             │                 ├─ users
                                  │                 ├─ payment_requests
                                  │                 ├─ settings
                                  │                 ├─ viral_candidates
                                  │                 └─ linkedin_drafts
                                  │
                                  ├─ Polygon zkEVM / ERC-20 token contract
                                  ├─ OpenAI or Anthropic
                                  └─ LinkedIn API
```

Important entry points:

| Path | Purpose |
| --- | --- |
| `api/whatsapp/index.ts` | WhatsApp verification and webhook forwarding |
| `api/whatsapp/message.ts` | WhatsApp wallet and owner conversation flow |
| `api/telegram/index.ts` | Telegram wallet and owner conversation flow |
| `api/admin/dashboard.ts` | Browser-based configuration dashboard |
| `api/admin/settings.ts` | Authenticated settings API |
| `api/linkedin/reward.ts` | Authenticated LinkedIn commenter rewards |
| `lib/crypto/transaction.ts` | Wallet transfers and payment state |
| `lib/viral-radar/` | Instagram metadata, AI scoring, and draft generation |

## Prerequisites

- Node.js 18 or newer.
- A Vercel project or another serverless TypeScript host.
- A Supabase project.
- A Polygon zkEVM RPC endpoint.
- A sponsor wallet and private key for sponsored gas/rewards.
- A WhatsApp Cloud API application, a Telegram bot, or both.
- An OpenAI or Anthropic API key for Viral Radar.
- LinkedIn API access if comment rewards are enabled.

## Local setup

1. Install dependencies from the project package manifest. The required runtime packages are:

   ```text
   @anthropic-ai/sdk
   @supabase/supabase-js
   @vercel/node
   axios
   ethers
   openai
   whatsappcloudapi_wrapper
   ```

2. Create a Supabase project and add the tables described in [Database setup](#database-setup).

3. Configure the environment variables in [Configuration](#configuration).

4. Run the project with the Vercel development server:

   ```bash
   npx vercel dev
   ```

The project is designed around Vercel serverless routes rather than a standalone web server.

## Database setup

The application expects these Supabase tables.

### `users`

Required columns:

```text
id uuid primary key default gen_random_uuid()
phone_number text unique not null
name text
private_key text
address text
linkedin_urn text
verification_code text
created_at timestamptz default now()
```

### `payment_requests`

Required columns:

```text
id uuid primary key default gen_random_uuid()
from_user_id uuid references users(id)
to text
to_user_id uuid references users(id)
amount numeric
status text not null
created_at timestamptz default now()
```

### `settings`

Required columns:

```text
key text primary key
value text not null
updated_at timestamptz default now()
```

### `viral_candidates`

The Viral Radar workflow expects columns for the source URL, submitter, extracted metadata, scores, owner note, and status. At minimum, create:

```text
id uuid primary key default gen_random_uuid()
source_url text not null
submitted_by_whatsapp text
owner_note text
creator_username text
caption text
thumbnail_url text
content_type text
visible_likes numeric
visible_comments numeric
visible_views numeric
raw_metadata jsonb
viral_score numeric
hook_score numeric
linkedin_transfer_score numeric
brand_relevance_score numeric
format_repeatability_score numeric
topic_heat_score numeric
comment_potential_score numeric
visible_popularity_score numeric
status text
created_at timestamptz default now()
```

### `linkedin_drafts`

```text
id uuid primary key default gen_random_uuid()
candidate_id uuid references viral_candidates(id)
draft_title text
linkedin_post text
angle text
target_audience text
status text
created_at timestamptz default now()
```

## Configuration

Settings can be supplied as Vercel environment variables or stored in Supabase through the admin dashboard. When Supabase is configured, the dashboard persists settings in the `settings` table.

### Core and security

| Setting | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended for admin persistence | Server-only Supabase secret used for settings reads/writes when RLS blocks the publishable key; never expose it to clients |
| `ADMIN_SECRET` | Yes | Protects the admin dashboard and reward endpoint |
| `MASTER_ENCRYPTION_KEY` | Yes | Encrypts stored wallet private keys; use a long random secret |
| `ACTIVE_MESSAGING_PLATFORM` | No | `whatsapp`, `telegram`, or `both`; defaults to `both` |

### Blockchain

| Setting | Required | Purpose |
| --- | --- | --- |
| `QUICK_NODE_URL` | Yes | Polygon zkEVM JSON-RPC endpoint |
| `SPONSOR_PRIVATE_KEY` | Yes for sponsored actions | Pays sponsored gas and rewards |
| `TOKEN_CONTRACT_ADDRESS` | No | ERC-20 contract to use; code has a default address |
| `TOKEN_SYMBOL` | No | Display symbol; defaults to `USDT` |
| `TOKEN_NAME` | No | Display name |
| `TOKEN_DECIMALS` | No | Token precision; defaults to `18` |

### WhatsApp

| Setting | Required when WhatsApp is active | Purpose |
| --- | --- | --- |
| `META_WA_ACCESS_TOKEN` | Yes | WhatsApp Cloud API access token |
| `META_WA_SENDER_PHONE_NUMBER_ID` | Yes | WhatsApp sender phone number ID |
| `META_WA_WABA_ID` | Yes | WhatsApp Business Account ID |
| `META_WA_VERIFY_TOKEN` | Yes | Webhook verification token |
| `OWNER_WHATSAPP_NUMBER` | Yes for owner controls | Owner phone number in international format |
| `VERCEL_PROD_URL` | Yes | Public deployment URL used for webhook forwarding |

### Telegram

| Setting | Required when Telegram is active | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Yes | Token from `@BotFather` |
| `OWNER_TELEGRAM_CHAT_ID` | Yes for owner controls | Numeric Telegram chat ID for the owner |
| `OWNER_TELEGRAM_USERNAME` | Alternative for owner controls | Telegram username without `@`; less stable than a chat ID because usernames can change |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret header used to authenticate Telegram webhook requests |

### AI and brand

| Setting | Required | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | No | `openai` or `anthropic`; defaults to `openai` |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI credential |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o` |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic credential |
| `ANTHROPIC_MODEL` | No | Claude model name |
| `BRAND_NAME` | No | Brand used in generated content |
| `BRAND_TARGET_AUDIENCE` | No | Audience used by Viral Radar |
| `BRAND_VALUE_PROPOSITION` | No | Brand context used in drafts |
| `LINKEDIN_DRAFT_PROMPT` | No | Custom prompt replacing the default draft prompt |

### LinkedIn rewards

| Setting | Required | Purpose |
| --- | --- | --- |
| `LINKEDIN_ACCESS_TOKEN` | Yes for rewards | Reads LinkedIn post comments |
| `COMMENT_REWARD_AMOUNT` | No | Default token reward per commenter; defaults to `1` |
| `MAX_COMMENTERS_TO_REWARD` | No | Maximum commenters per post; defaults to `25` |
| `MAX_TOTAL_REWARD_PER_POST` | No | Total payout cap |
| `REWARD_ONLY_FIRST_UNIQUE_COMMENT` | No | Defaults to `true` |

## Admin dashboard

After deployment, open:

```text
https://<your-domain>/api/admin/dashboard
```

Enter `ADMIN_SECRET`. The dashboard can:

- Configure Supabase.
- Select WhatsApp, Telegram, or both.
- Configure blockchain and token settings.
- Configure AI and brand settings.
- Configure Telegram owner access.
- Configure LinkedIn reward limits.

For production, configure Supabase before relying on dashboard changes so settings persist across serverless invocations.

## Webhook setup

### WhatsApp

In Meta for Developers, configure the callback URL:

```text
https://<your-domain>/api/whatsapp
```

Use the same value as `META_WA_VERIFY_TOKEN`. Subscribe the WhatsApp application to message events.

### Telegram

Create a bot with `@BotFather`, then register the webhook:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-domain>/api/telegram
```

If `TELEGRAM_WEBHOOK_SECRET` is configured, register the webhook using Telegram's `secret_token` option so Telegram sends the matching `X-Telegram-Bot-Api-Secret-Token` header.

Open the bot and send `/start` to test wallet onboarding. The owner can send an Instagram URL to test Viral Radar.

Webhooks must use a publicly reachable HTTPS URL. For local development, use a secure tunnel or a deployed preview environment.

## LinkedIn reward endpoint

Send a POST request to:

```text
/api/linkedin/reward
```

Example body:

```json
{
  "postId": "urn:li:share:123456789",
  "rewardAmount": 1,
  "limit": 25,
  "secret": "your-admin-secret"
}
```

## Security notes

- Never commit API tokens, private keys, admin secrets, or encryption keys.
- Use a dedicated sponsor wallet with strict balances and spending limits.
- Back up `MASTER_ENCRYPTION_KEY` securely. Losing it can make stored wallet keys unrecoverable.
- The user PIN is required to decrypt a wallet private key for transfers and balance checks.
- Set `OWNER_WHATSAPP_NUMBER` and/or `OWNER_TELEGRAM_CHAT_ID` before enabling owner controls.
- Use `TELEGRAM_WEBHOOK_SECRET` in production.
- The reward endpoint requires `ADMIN_SECRET`.
- Review token contract, network, decimals, and RPC settings before funding the system.

## Development checks

Run TypeScript checks with the repository's TypeScript configuration when available. The main serverless handlers should be checked before deployment:

```bash
npx tsc --noEmit
```

Then deploy with:

```bash
npx vercel --prod
```
