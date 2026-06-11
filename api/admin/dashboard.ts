import type { VercelApiHandler, VercelResponse, VercelRequest } from '@vercel/node'

const handler: VercelApiHandler = async (_req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'text/html')
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Signal Room Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen p-8">
    <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 class="text-2xl font-bold mb-6 text-gray-800">Signal Room Configuration</h1>
        
        <div id="login-section" class="mb-8">
            <label class="block text-sm font-medium text-gray-700 mb-2">Admin Secret</label>
            <p class="text-xs text-gray-500 mb-2">Default secret is "admin" if not set in environment.</p>
            <div class="flex gap-2">
                <input type="password" id="admin-secret" class="flex-1 border rounded px-3 py-2" placeholder="Enter ADMIN_SECRET">
                <button onclick="loadSettings()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Login</button>
            </div>
        </div>

        <div id="settings-section" class="hidden">
            <div id="supabase-warning" class="hidden mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
                <p class="font-bold">⚠️ Supabase Not Connected</p>
                <p class="text-sm mb-2">Settings are currently being saved in <strong>temporary memory only</strong>. They will be lost if the server restarts or the page is refreshed.</p>
                <p class="text-xs">Ensure you have run the updated <code class="bg-red-200 px-1 rounded">scripts/setup_viral_radar.sql</code> in your Supabase SQL Editor to enable the correct permissions (RLS policies).</p>
            </div>

            <div id="required-summary" class="mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h2 class="text-lg font-bold text-yellow-800 mb-2">📋 Required Settings Summary</h2>
                <p class="text-sm text-yellow-600 mb-2">The following settings are required for the application to function:</p>
                <div id="missing-required-list" class="text-sm text-gray-700">
                    <!-- Will be populated by JavaScript -->
                </div>
                <p class="text-xs text-yellow-600 mt-2">Fill in all required settings marked with <span class="inline-block bg-red-100 text-red-700 px-1 py-0.5 rounded text-xs">Required</span> before using the application.</p>
            </div>
            
            <div class="mb-8 p-4 bg-green-50 rounded-lg border border-green-200">
                <h2 class="text-lg font-bold text-green-800 mb-2">Setup Supabase Database 🗄️</h2>
                <p class="text-sm text-green-600 mb-4">Configure your database connection to save settings permanently.</p>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-green-700">Supabase URL</label>
                        <input type="text" id="setup-supabase-url" class="w-full border rounded px-2 py-1 text-sm" placeholder="https://your-project.supabase.co">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-green-700">Supabase Publishable Key</label>
                        <input type="password" id="setup-supabase-key" class="w-full border rounded px-2 py-1 text-sm" placeholder="sb_publishable_... or eyJ...">
                    </div>
                </div>
                <button onclick="saveSupabaseSetup()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Save Supabase Configuration</button>
            </div>

            <div class="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h2 class="text-lg font-bold text-blue-800 mb-2">Setup Your Brand 🚀</h2>
                <p class="text-sm text-blue-600 mb-4">Customize how Signal Room generates content for you.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold uppercase text-blue-700">Brand Name</label>
                        <input type="text" id="setup-brand-name" class="w-full border rounded px-2 py-1 text-sm" placeholder="e.g. Signal Room">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-blue-700">Target Audience</label>
                        <input type="text" id="setup-target-audience" class="w-full border rounded px-2 py-1 text-sm" placeholder="e.g. Pre-seed founders">
                    </div>
                </div>
                <button onclick="saveBrandSetup()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Update Brand Identity</button>
            </div>

            <div id="supabase-status" class="mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 class="text-lg font-semibold text-yellow-800 mb-2">Database Status</h3>
                <p class="text-sm text-yellow-600" id="supabase-status-text">Checking connection...</p>
            </div>
            
            <div id="settings-list" class="space-y-4">
                <!-- Settings will be loaded here -->
            </div>
            
            <hr class="my-8">
            
            <h2 class="text-xl font-semibold mb-4">Add/Update Setting</h2>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Key</label>
                    <input type="text" id="new-key" class="w-full border rounded px-3 py-2" placeholder="e.g. SUPABASE_URL">
                    <p class="text-xs text-gray-500 mt-1">Configure Supabase first: SUPABASE_URL, SUPABASE_ANON_KEY (use your publishable key)</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Value</label>
                    <textarea id="new-value" class="w-full border rounded px-3 py-2" rows="3" placeholder="Enter your Supabase URL (https://your-project.supabase.co) or publishable key (sb_publishable_... or eyJ...)"></textarea>
                </div>
                <div id="selected-setting-help" class="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    Choose a setting to see where to get it and what it is used for.
                </div>
                <button onclick="saveSetting()" class="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save Setting</button>
            </div>
        </div>
    </div>

    <script>
        let currentSecret = '';

        async function loadSettings() {
            currentSecret = document.getElementById('admin-secret').value;
            try {
                const res = await fetch('/api/admin/settings', {
                    headers: { 'Authorization': 'Bearer ' + currentSecret }
                });
                if (!res.ok) throw new Error('Unauthorized or error');
                
                const settings = await res.json();
                const list = document.getElementById('settings-list');
                list.innerHTML = '';
                
                // Define all expected settings with categories and help text
                const expectedSettings = {
                    'Database': [
                        {
                            key: 'SUPABASE_URL',
                            required: true,
                            description: 'Your Supabase project URL',
                            format: 'Full HTTPS URL, for example: https://your-project.supabase.co',
                            whereToGet: 'Supabase Dashboard -> Project Overview or Project Settings -> API -> Project URL.',
                            usedFor: 'Connects the app to your Supabase database so settings and app data can be stored.'
                        },
                        {
                            key: 'SUPABASE_ANON_KEY',
                            required: true,
                            description: 'Supabase publishable key (starts with sb_publishable_ or eyJ)',
                            format: 'Publishable key string, usually starts with sb_publishable_ or older eyJ',
                            whereToGet: 'Supabase Dashboard -> Project Settings -> API -> Publishable key / anon key.',
                            usedFor: 'Authenticates frontend-safe requests from this app to Supabase.'
                        }
                    ],
                    'Blockchain': [
                        {
                            key: 'QUICK_NODE_URL',
                            required: true,
                            description: 'Polygon zkEVM RPC endpoint',
                            format: 'Full HTTPS RPC URL',
                            whereToGet: 'QuickNode dashboard or another Polygon zkEVM RPC provider endpoint.',
                            usedFor: 'Lets the bot read balances and send blockchain transactions on Polygon zkEVM.'
                        },
                        {
                            key: 'SPONSOR_PRIVATE_KEY',
                            required: true,
                            description: 'Private key for funding transactions',
                            format: '0x followed by 64 hex characters',
                            whereToGet: 'Export the private key from the wallet you want to use as the sponsor wallet.',
                            usedFor: 'Signs and pays for user withdrawal or reward transactions.'
                        },
                        {
                            key: 'MASTER_ENCRYPTION_KEY',
                            required: true,
                            description: '32-byte key for encrypting user data',
                            format: 'Long random secret, minimum 32 characters (e.g. 64 hex characters)',
                            whereToGet: 'Generate a long random secret using the "Generate" button below or a secure secret generator.',
                            usedFor: 'Encrypts sensitive stored data such as private keys and secrets at rest.'
                        }
                    ],
                    'Bot Blockchain Issuance': [
                        {
                            key: 'TOKEN_CONTRACT_ADDRESS',
                            required: false,
                            description: 'ERC-20 token contract address to distribute',
                            format: '0x followed by 40 hex characters',
                            whereToGet: 'Use the deployed contract address for your token on Polygon zkEVM.',
                            usedFor: 'Determines which token the bot sends to users and commenters.'
                        },
                        {
                            key: 'TOKEN_SYMBOL',
                            required: false,
                            description: 'Display ticker for the payout token',
                            format: 'Short ticker text, for example: USDT or FAKN',
                            whereToGet: 'Use the symbol defined by your token project.',
                            usedFor: 'Labels balances and rewards with the token ticker.'
                        },
                        {
                            key: 'TOKEN_DECIMALS',
                            required: false,
                            description: 'Token decimal precision',
                            format: 'Whole number, for example: 18 or 6',
                            whereToGet: 'Read the token contract documentation or on-chain metadata.',
                            usedFor: 'Converts human-readable amounts into on-chain token units correctly.'
                        },
                        {
                            key: 'TOKEN_NAME',
                            required: false,
                            description: 'Human-readable token name',
                            format: 'Plain text token name',
                            whereToGet: 'Use the official token name from your project or contract metadata.',
                            usedFor: 'Displays the token name in admin-facing bot configuration.'
                        }
                    ],
                    'WhatsApp': [
                        {
                            key: 'META_WA_ACCESS_TOKEN',
                            required: true,
                            description: 'WhatsApp Cloud API access token',
                            format: 'Meta access token string',
                            whereToGet: 'Meta for Developers -> Your App -> WhatsApp -> API Setup (Temporary) OR App Settings -> Configuration (Permanent System User Token).',
                            usedFor: 'Authorizes the bot to send WhatsApp messages through the Meta Cloud API.'
                        },
                        {
                            key: 'META_WA_VERIFY_TOKEN',
                            required: true,
                            description: 'Webhook verification token',
                            format: 'Any random string you choose',
                            whereToGet: 'Create your own random string and paste it here, then use the SAME string in Meta Developer Portal.',
                            usedFor: 'Authenticates the webhook connection between Meta and your Vercel deployment.'
                        },
                        {
                            key: 'META_WA_SENDER_PHONE_NUMBER_ID',
                            required: true,
                            description: 'Sender phone number ID',
                            format: 'Numeric ID string from Meta',
                            whereToGet: 'Meta for Developers -> WhatsApp -> API Setup -> Look under "Step 1: Select phone numbers" for "Phone number ID".',
                            usedFor: 'Tells Meta which WhatsApp business number the bot should send messages from.'
                        },
                        {
                            key: 'META_WA_WABA_ID',
                            required: true,
                            description: 'WhatsApp Business Account ID',
                            format: 'Numeric ID string from Meta',
                            whereToGet: 'Meta for Developers -> WhatsApp -> API Setup -> Look under "Step 1: Select phone numbers" for "WhatsApp Business Account ID".',
                            usedFor: 'Identifies your WhatsApp Business Account when initializing the WhatsApp client.'
                        },
                        {
                            key: 'OWNER_WHATSAPP_NUMBER',
                            required: true,
                            description: 'Your WhatsApp number (e.g., +1234567890)',
                            format: 'E.164 format, for example: +1234567890',
                            whereToGet: 'Use the approved owner/admin phone number you control, in full international format.',
                            usedFor: 'Restricts owner-only flows such as approvals, alerts, and privileged bot actions.'
                        }
                    ],
                    'AI': [
                        {
                            key: 'AI_PROVIDER',
                            required: false,
                            description: 'AI model provider to use',
                            format: '"openai" or "anthropic"',
                            whereToGet: 'Choose either "openai" or "anthropic".',
                            usedFor: 'Determines which AI service is used for generating content.'
                        },
                        {
                            key: 'OPENAI_API_KEY',
                            required: false,
                            description: 'OpenAI API key for content generation',
                            format: 'OpenAI API key string',
                            whereToGet: 'OpenAI dashboard -> API keys.',
                            usedFor: 'Generates content when AI_PROVIDER is set to "openai".'
                        },
                        {
                            key: 'OPENAI_MODEL',
                            required: false,
                            description: 'OpenAI model to use',
                            format: 'e.g. gpt-4o, gpt-4-turbo, gpt-3.5-turbo',
                            whereToGet: 'OpenAI documentation for available models.',
                            usedFor: 'Specifies which OpenAI model to use for generation.'
                        },
                        {
                            key: 'ANTHROPIC_API_KEY',
                            required: false,
                            description: 'Anthropic API key for Claude',
                            format: 'Anthropic API key string starting with sk-ant-',
                            whereToGet: 'Anthropic Console -> API Keys.',
                            usedFor: 'Generates content when AI_PROVIDER is set to "anthropic".'
                        },
                        {
                            key: 'ANTHROPIC_MODEL',
                            required: false,
                            description: 'Anthropic Claude model to use',
                            format: 'e.g. claude-3-5-sonnet-20240620, claude-3-opus-20240229',
                            whereToGet: 'Anthropic documentation for available models.',
                            usedFor: 'Specifies which Claude model to use for generation.'
                        }
                    ],
                    'LinkedIn': [
                        {
                            key: 'LINKEDIN_ACCESS_TOKEN',
                            required: false,
                            description: 'LinkedIn API token for comment rewards',
                            format: 'OAuth access token string',
                            whereToGet: 'LinkedIn Developer app after completing OAuth for the connected account.',
                            usedFor: 'Reads LinkedIn data and supports comment-reward and posting workflows.'
                        },
                        {
                            key: 'COMMENT_REWARD_AMOUNT',
                            required: false,
                            description: 'Token amount to pay each rewarded commenter',
                            format: 'Positive number, for example: 1 or 2.5',
                            whereToGet: 'Choose this yourself based on your reward strategy.',
                            usedFor: 'Sets the default payout amount per rewarded LinkedIn commenter.'
                        },
                        {
                            key: 'MAX_COMMENTERS_TO_REWARD',
                            required: false,
                            description: 'Maximum number of commenters to reward per post',
                            format: 'Whole number, for example: 10 or 25',
                            whereToGet: 'Choose this yourself based on your campaign budget.',
                            usedFor: 'Caps how many LinkedIn commenters can receive rewards for a single post.'
                        },
                        {
                            key: 'MAX_TOTAL_REWARD_PER_POST',
                            required: false,
                            description: 'Maximum total token payout allowed for one post',
                            format: 'Positive number, for example: 25 or 100',
                            whereToGet: 'Choose this yourself based on your per-post budget.',
                            usedFor: 'Prevents total commenter rewards for one post from exceeding your budget.'
                        },
                        {
                            key: 'REWARD_ONLY_FIRST_UNIQUE_COMMENT',
                            required: false,
                            description: 'Reward only one comment per person on a post',
                            format: 'true or false',
                            whereToGet: 'Choose true to reward each person once, or false to allow repeat comments to count.',
                            usedFor: 'Controls whether duplicate comments from the same author are excluded from rewards.'
                        }
                    ],
                    'Brand': [
                        {
                            key: 'BRAND_NAME',
                            required: false,
                            description: 'Your brand name for content generation',
                            format: 'Plain text name',
                            whereToGet: 'Use your business, product, or campaign name.',
                            usedFor: 'Personalizes generated copy and dashboard defaults.'
                        },
                        {
                            key: 'BRAND_TARGET_AUDIENCE',
                            required: false,
                            description: 'Target audience description',
                            format: 'Plain text description',
                            whereToGet: 'Define the people you want the bot content to speak to.',
                            usedFor: 'Guides tone and targeting in generated LinkedIn drafts and messaging.'
                        },
                        {
                            key: 'BRAND_VALUE_PROPOSITION',
                            required: false,
                            description: 'Your value proposition',
                            format: 'Plain text sentence or short paragraph',
                            whereToGet: 'Write a short explanation of the main benefit your brand offers.',
                            usedFor: 'Helps the AI emphasize the right offer in generated content.'
                        },
                        {
                            key: 'LINKEDIN_DRAFT_PROMPT',
                            required: false,
                            description: 'Custom prompt for LinkedIn drafts',
                            format: 'Prompt text or instructions',
                            whereToGet: 'Write your own instruction prompt for how LinkedIn drafts should sound.',
                            usedFor: 'Overrides the default AI prompt for LinkedIn post generation.'
                        }
                    ],
                    'Admin': [
                        {
                            key: 'ADMIN_SECRET',
                            required: false,
                            description: 'Admin dashboard password (default: "admin")',
                            format: 'Password or passphrase text',
                            whereToGet: 'Create your own secret password or passphrase.',
                            usedFor: 'Protects access to the admin dashboard and settings endpoints.'
                        }
                    ]
                };

                const settingHelpByKey = Object.values(expectedSettings)
                    .flat()
                    .reduce((acc, setting) => {
                        acc[setting.key] = setting;
                        return acc;
                    }, {});
                
                // Create sections for each category
                for (const [category, settingDefs] of Object.entries(expectedSettings)) {
                    const categoryDiv = document.createElement('div');
                    categoryDiv.className = 'mb-6';
                    categoryDiv.innerHTML = \`
                        <h3 class="text-lg font-semibold text-gray-700 mb-2">\${category} Settings</h3>
                        <div class="space-y-2">
                    \`;
                    
                    for (const setting of settingDefs) {
                        const key = setting.key;
                        const value = settings[key] || '';
                        const displayValue = value === '********' ? '[Hidden]' : (value || '[Not Set]');
                        const isHidden = value === '********' || 
                                         key.includes('KEY') || 
                                         key.includes('TOKEN') || 
                                         key.includes('SECRET') || 
                                         key.includes('PRIVATE') || 
                                         key.includes('ID') || 
                                         key.includes('PASSWORD');
                        const isRequired = setting.required;
                        const description = setting.description;
                        
                        const div = document.createElement('div');
                        div.className = 'flex justify-between items-start p-3 bg-gray-50 rounded border';
                        div.innerHTML = \`
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-mono text-sm font-bold \${isRequired ? 'text-red-600' : 'text-blue-600'}">\${key}</span>
                                    \${isRequired ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>' : '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Optional</span>'}
                                    <span
                                        class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm cursor-help"
                                        aria-label="More info about \${key}"
                                        title="Hover for info about \${key}. Use Add or Edit to populate the help panel below."
                                    >i</span>
                                </div>
                                <p class="text-xs text-gray-500 mb-1">\${description}</p>
                                \${setting.format ? '<p class="text-xs text-gray-500 mb-1"><strong>Format:</strong> ' + setting.format + '</p>' : ''}
                                <p class="text-xs text-gray-600 truncate max-w-xs">\${displayValue}</p>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                                <button onclick="editSetting('\${key}', '\${isHidden ? '' : value}')" class="text-blue-500 text-sm hover:underline">\${value ? 'Edit' : 'Add'}</button>
                                \${key === 'MASTER_ENCRYPTION_KEY' ? '<button onclick="generateMasterKey()" class="text-green-600 text-xs hover:underline">Generate New Key</button>' : ''}
                            </div>
                        \`;
                        
                        categoryDiv.querySelector('div').appendChild(div);
                    }
                    
                    categoryDiv.innerHTML += '</div>';
                    list.appendChild(categoryDiv);
                }
                
                // Update brand setup fields
                if (settings['BRAND_NAME']) document.getElementById('setup-brand-name').value = settings['BRAND_NAME'];
                if (settings['BRAND_TARGET_AUDIENCE']) document.getElementById('setup-target-audience').value = settings['BRAND_TARGET_AUDIENCE'];

                window.settingHelpByKey = settingHelpByKey;
                
                document.getElementById('settings-section').classList.remove('hidden');
                document.getElementById('login-section').classList.add('hidden');
                
                // Update required settings summary
                updateRequiredSettingsSummary(settings);
                
                // Test Supabase connection
                await testSupabaseConnection();
            } catch (e) {
                alert('Login failed: ' + e.message);
            }
        }
        
        async function testSupabaseConnection() {
            const statusText = document.getElementById('supabase-status-text');
            const statusDiv = document.getElementById('supabase-status');
            const warningDiv = document.getElementById('supabase-warning');
            
            try {
                const res = await fetch('/api/admin/settings', {
                    headers: { 'Authorization': 'Bearer ' + currentSecret }
                });
                
                if (res.ok) {
                    const settings = await res.json();
                    const supabaseUrl = settings['SUPABASE_URL'] || '';
                    const supabaseKey = settings['SUPABASE_ANON_KEY'] || '';
                    
                    if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder') || !supabaseUrl || !supabaseKey) {
                        statusText.textContent = '⚠️ Not configured. Please set up Supabase database above.';
                        statusDiv.className = 'mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200';
                        warningDiv.classList.remove('hidden');
                    } else {
                        statusText.textContent = '✅ Connected to Supabase database. Settings will be saved persistently.';
                        statusDiv.className = 'mb-8 p-4 bg-green-50 rounded-lg border border-green-200';
                        warningDiv.classList.add('hidden');
                    }
                } else {
                    statusText.textContent = '❌ Failed to connect to database. Check your Supabase credentials.';
                    statusDiv.className = 'mb-8 p-4 bg-red-50 rounded-lg border border-red-200';
                    warningDiv.classList.remove('hidden');
                }
            } catch (e) {
                statusText.textContent = '❌ Connection error: ' + e.message;
                statusDiv.className = 'mb-8 p-4 bg-red-50 rounded-lg border border-red-200';
                warningDiv.classList.remove('hidden');
            }
        }
        
        function updateRequiredSettingsSummary(settings) {
            const requiredSettings = [
                {key: 'SUPABASE_URL', description: 'Supabase project URL'},
                {key: 'SUPABASE_ANON_KEY', description: 'Supabase publishable key'},
                {key: 'QUICK_NODE_URL', description: 'Polygon zkEVM RPC endpoint'},
                {key: 'SPONSOR_PRIVATE_KEY', description: 'Private key for funding'},
                {key: 'MASTER_ENCRYPTION_KEY', description: 'Encryption key for user data'},
                {key: 'META_WA_ACCESS_TOKEN', description: 'WhatsApp API access token'},
                {key: 'META_WA_SENDER_PHONE_NUMBER_ID', description: 'WhatsApp sender phone ID'},
                {key: 'META_WA_WABA_ID', description: 'WhatsApp Business Account ID'},
                {key: 'OWNER_WHATSAPP_NUMBER', description: 'Your WhatsApp number'},
                {key: 'OPENAI_API_KEY', description: 'OpenAI API key'}
            ];
            
            const missingSettings = [];
            const completedSettings = [];
            
            for (const setting of requiredSettings) {
                const value = settings[setting.key] || '';
                const isPlaceholder = value.includes('placeholder') || value === '' || value === '[Not Set]';
                
                if (isPlaceholder) {
                    missingSettings.push(setting);
                } else {
                    completedSettings.push(setting);
                }
            }
            
            const summaryDiv = document.getElementById('missing-required-list');
            let html = '';
            
            if (missingSettings.length === 0) {
                html = \`
                    <div class="mb-2">
                        <span class="inline-block bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✅ All Required Settings Configured</span>
                    </div>
                    <p class="text-green-600">All required settings have been configured. The application is ready to use!</p>
                \`;
            } else {
                html = \`
                    <div class="mb-2">
                        <span class="inline-block bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">⚠️ Missing \${missingSettings.length} Required Settings</span>
                    </div>
                    <div class="space-y-1 mb-2">
                        <p class="font-medium text-gray-800">Missing settings:</p>
                        <ul class="list-disc pl-5 text-gray-700">
                            \${missingSettings.map(s => \`<li><span class="font-mono text-sm">\${s.key}</span> - \${s.description}</li>\`).join('')}
                        </ul>
                    </div>
                \`;
                
                if (completedSettings.length > 0) {
                    html += \`
                        <div class="space-y-1 mt-3">
                            <p class="font-medium text-gray-800">Completed settings:</p>
                            <ul class="list-disc pl-5 text-gray-700">
                                \${completedSettings.map(s => \`<li><span class="font-mono text-sm">\${s.key}</span> - ✅ Configured</li>\`).join('')}
                            </ul>
                        </div>
                    \`;
                }
            }
            
            summaryDiv.innerHTML = html;
            
            // Update the summary section color based on status
            const summarySection = document.getElementById('required-summary');
            if (missingSettings.length === 0) {
                summarySection.className = 'mb-8 p-4 bg-green-50 rounded-lg border border-green-200';
            } else if (missingSettings.length <= 3) {
                summarySection.className = 'mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200';
            } else {
                summarySection.className = 'mb-8 p-4 bg-red-50 rounded-lg border border-red-200';
            }
        }

        function editSetting(key, value) {
            document.getElementById('new-key').value = key;
            document.getElementById('new-value').value = value;
            updateSelectedSettingHelp(key);
            document.getElementById('new-value').focus();
        }

        function generateMasterKey() {
            const bytes = new Uint8Array(32);
            window.crypto.getRandomValues(bytes);
            const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
            
            if (confirm('Generate a new random 32-byte Master Encryption Key? You will need to click "Save Setting" after this to apply it.')) {
                editSetting('MASTER_ENCRYPTION_KEY', hex);
                alert('New key generated and populated in the form below. Please click "Save Setting" to save it permanently.');
            }
        }

        function updateSelectedSettingHelp(key) {
            const helpBox = document.getElementById('selected-setting-help');
            const setting = (window.settingHelpByKey || {})[key];

            if (!setting) {
                helpBox.innerHTML = 'Choose a setting to see where to get it and what it is used for.';
                helpBox.className = 'rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900';
                return;
            }

            helpBox.innerHTML =
                '<div class="mb-1 flex items-center gap-2">' +
                    '<span class="font-mono font-semibold">' + setting.key + '</span>' +
                    (setting.required
                        ? '<span class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Required</span>'
                        : '<span class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Optional</span>') +
                '</div>' +
                '<p class="mb-1 text-sm"><strong>What it does:</strong> ' + setting.usedFor + '</p>' +
                (setting.format
                    ? '<p class="mb-1 text-sm"><strong>Format:</strong> ' + setting.format + '</p>'
                    : '') +
                '<p class="text-sm"><strong>Where to get it:</strong> ' + setting.whereToGet + '</p>';
            helpBox.className = 'rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900';
        }

        async function saveSetting() {
            const key = document.getElementById('new-key').value;
            const value = document.getElementById('new-value').value;
            
            if (!key || !value) {
                alert('Key and value are required');
                return;
            }

            // Validate specific required settings
            const validationErrors = [];
            
            if (key === 'SUPABASE_URL') {
                if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
                    validationErrors.push('SUPABASE_URL must start with https:// and contain .supabase.co');
                }
            }
            
            if (key === 'SUPABASE_ANON_KEY') {
                if (!value.startsWith('eyJ') && !value.startsWith('sb_publishable_')) {
                    validationErrors.push('SUPABASE_ANON_KEY must start with eyJ (JWT) or sb_publishable_ (modern key)');
                }
            }

            if (key === 'AI_PROVIDER') {
                const normalized = value.trim().toLowerCase();
                if (normalized !== 'openai' && normalized !== 'anthropic') {
                    validationErrors.push('AI_PROVIDER must be either "openai" or "anthropic"');
                }
            }

            if (key === 'ANTHROPIC_API_KEY') {
                if (!value.startsWith('sk-ant-')) {
                    validationErrors.push('ANTHROPIC_API_KEY must start with "sk-ant-"');
                }
            }
            
            if (key === 'QUICK_NODE_URL') {
                if (!value.startsWith('https://')) {
                    validationErrors.push('QUICK_NODE_URL must be a valid HTTPS URL');
                }
            }
            
            if (key === 'TOKEN_CONTRACT_ADDRESS') {
                if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
                    validationErrors.push('TOKEN_CONTRACT_ADDRESS must be a valid EVM contract address');
                }
            }
            
            if (key === 'TOKEN_DECIMALS') {
                const decimals = Number.parseInt(value, 10);
                if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
                    validationErrors.push('TOKEN_DECIMALS must be a whole number between 0 and 36');
                }
            }
            
            if (key === 'COMMENT_REWARD_AMOUNT' || key === 'MAX_TOTAL_REWARD_PER_POST') {
                const amount = Number.parseFloat(value);
                if (!Number.isFinite(amount) || amount <= 0) {
                    validationErrors.push(key + ' must be a positive number');
                }
            }
            
            if (key === 'MAX_COMMENTERS_TO_REWARD') {
                const count = Number.parseInt(value, 10);
                if (!Number.isInteger(count) || count <= 0) {
                    validationErrors.push('MAX_COMMENTERS_TO_REWARD must be a whole number greater than 0');
                }
            }
            
            if (key === 'REWARD_ONLY_FIRST_UNIQUE_COMMENT') {
                const normalized = value.trim().toLowerCase();
                if (normalized !== 'true' && normalized !== 'false') {
                    validationErrors.push('REWARD_ONLY_FIRST_UNIQUE_COMMENT must be true or false');
                }
            }
            
            if (key === 'SPONSOR_PRIVATE_KEY') {
                if (!value.startsWith('0x') || value.length !== 66) {
                    validationErrors.push('SPONSOR_PRIVATE_KEY must be a 64-character hex string starting with 0x');
                }
            }
            
            if (key === 'MASTER_ENCRYPTION_KEY') {
                if (value.length < 32) {
                    validationErrors.push('MASTER_ENCRYPTION_KEY must be at least 32 characters long');
                }
            }
            
            if (key === 'OWNER_WHATSAPP_NUMBER') {
                if (!value.startsWith('+')) {
                    validationErrors.push('OWNER_WHATSAPP_NUMBER must start with + (e.g., +1234567890)');
                }
            }
            
            if (validationErrors.length > 0) {
                alert('Validation errors:\\n\\n' + validationErrors.join('\\n'));
                return;
            }

            try {
                const res = await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + currentSecret,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ key, value })
                });
                
                if (res.ok) {
                    alert('✅ Setting saved successfully!');
                    loadSettings();
                    document.getElementById('new-key').value = '';
                    document.getElementById('new-value').value = '';
                } else {
                    const errorText = await res.text();
                    throw new Error(errorText || 'Failed to save setting');
                }
            } catch (e) {
                alert('❌ Error saving setting: ' + e.message);
            }
        }

        async function saveBrandSetup() {
            const name = document.getElementById('setup-brand-name').value;
            const audience = document.getElementById('setup-target-audience').value;
            
            try {
                await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + currentSecret,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ key: 'BRAND_NAME', value: name })
                });
                await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + currentSecret,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ key: 'BRAND_TARGET_AUDIENCE', value: audience })
                });
                alert('Brand identity updated! 🎯');
                loadSettings();
            } catch (e) {
                alert('Error saving brand identity: ' + e.message);
            }
        }

        async function saveSupabaseSetup() {
            const url = document.getElementById('setup-supabase-url').value;
            const key = document.getElementById('setup-supabase-key').value;
            
            if (!url || !key) {
                alert('Both Supabase URL and Publishable Key are required');
                return;
            }
            
            if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
                alert('Please enter a valid Supabase URL (should start with https:// and contain .supabase.co)');
                return;
            }
            
            if (!key.startsWith('eyJ') && !key.startsWith('sb_publishable_')) {
                alert('Please enter a valid Supabase Publishable Key (usually starts with sb_publishable_, older keys may start with eyJ)');
                return;
            }
            
            try {
                const res = await fetch('/api/admin/supabase-setup', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + currentSecret,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key })
                });
                
                if (res.ok) {
                    alert('Supabase configuration saved successfully! ✅\\n\\nYour settings will now be stored in the database. If they still vanish, ensure you have applied the RLS policies from scripts/setup_viral_radar.sql');
                    loadSettings();
                } else {
                    const error = await res.text();
                    throw new Error(error || 'Failed to save Supabase configuration');
                }
            } catch (e) {
                alert('Error saving Supabase configuration: ' + e.message);
            }
        }

        // Set default key to SUPABASE_URL when page loads
        document.addEventListener('DOMContentLoaded', function() {
            const keyInput = document.getElementById('new-key');
            if (keyInput && !keyInput.value) {
                keyInput.value = 'SUPABASE_URL';
                keyInput.focus();
            }
            updateSelectedSettingHelp(keyInput ? keyInput.value : '');
            if (keyInput) {
                keyInput.addEventListener('input', function(event) {
                    updateSelectedSettingHelp(event.target.value.trim());
                });
            }
        });
    </script>
</body>
</html>
  `

  // #region debug-point A:dashboard-html-shape
  ;(() => {
    const fs = require('fs')
    const envPath = '.dbg/dashboard-js-error.env'
    let debugServerUrl = 'http://127.0.0.1:7777/event'
    let sessionId = 'dashboard-js-error'

    try {
      const envContent = fs.readFileSync(envPath, 'utf8')
      debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || debugServerUrl
      sessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || sessionId
    } catch {}

    fetch(debugServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'api/admin/dashboard.ts',
        msg: '[DEBUG] dashboard html emitted',
        data: {
          hasEscapedBackticks: html.includes('\\`'),
          hasEscapedInterpolations: html.includes('\\${'),
          hasClientTemplateLiteral: html.includes('categoryDiv.innerHTML = \\`'),
          hasClientLoadSettings: html.includes('async function loadSettings()'),
          htmlLength: html.length
        },
        ts: Date.now()
      })
    }).catch(() => {})
  })()
  // #endregion

  res.status(200).send(html)
}

export default handler
