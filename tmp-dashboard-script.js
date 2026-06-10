
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
                
                // Define all expected settings with categories
                const expectedSettings = {
                    'Database': ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
                    'Blockchain': ['QUICK_NODE_URL', 'SPONSOR_PRIVATE_KEY', 'MASTER_ENCRYPTION_KEY'],
                    'LinkedIn': ['LINKEDIN_ACCESS_TOKEN'],
                    'WhatsApp': ['META_WA_ACCESS_TOKEN', 'META_WA_SENDER_PHONE_NUMBER_ID', 'META_WA_WABA_ID', 'OWNER_WHATSAPP_NUMBER'],
                    'AI': ['OPENAI_API_KEY'],
                    'Brand': ['BRAND_NAME', 'BRAND_TARGET_AUDIENCE', 'BRAND_VALUE_PROPOSITION', 'LINKEDIN_DRAFT_PROMPT'],
                    'Admin': ['ADMIN_SECRET']
                };
                
                // Create sections for each category
                for (const [category, keys] of Object.entries(expectedSettings)) {
                    const categoryDiv = document.createElement('div');
                    categoryDiv.className = 'mb-6';
                    categoryDiv.innerHTML = `
                        <h3 class="text-lg font-semibold text-gray-700 mb-2">${category} Settings</h3>
                        <div class="space-y-2">
                    `;
                    
                    for (const key of keys) {
                        const value = settings[key] || '';
                        const displayValue = value === '********' ? '[Hidden]' : (value || '[Not Set]');
                        const isHidden = value === '********' || key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET') || key.includes('PRIVATE');
                        
                        const div = document.createElement('div');
                        div.className = 'flex justify-between items-center p-3 bg-gray-50 rounded border';
                        div.innerHTML = `
                            <div>
                                <span class="font-mono text-sm font-bold text-blue-600">${key}</span>
                                <p class="text-xs text-gray-500 truncate max-w-xs">${displayValue}</p>
                            </div>
                            <button onclick="editSetting('${key}', '${isHidden ? '' : value}')" class="text-blue-500 text-sm hover:underline">${value ? 'Edit' : 'Add'}</button>
                        `;
                        
                        categoryDiv.querySelector('div').appendChild(div);
                    }
                    
                    categoryDiv.innerHTML += '</div>';
                    list.appendChild(categoryDiv);
                }
                
                // Update brand setup fields
                if (settings['BRAND_NAME']) document.getElementById('setup-brand-name').value = settings['BRAND_NAME'];
                if (settings['BRAND_TARGET_AUDIENCE']) document.getElementById('setup-target-audience').value = settings['BRAND_TARGET_AUDIENCE'];
                
                document.getElementById('settings-section').classList.remove('hidden');
                document.getElementById('login-section').classList.add('hidden');
                
                // Test Supabase connection
                await testSupabaseConnection();
            } catch (e) {
                alert('Login failed: ' + e.message);
            }
        }
        
        async function testSupabaseConnection() {
            const statusText = document.getElementById('supabase-status-text');
            const statusDiv = document.getElementById('supabase-status');
            
            try {
                const res = await fetch('/api/admin/settings', {
                    headers: { 'Authorization': 'Bearer ' + currentSecret }
                });
                
                if (res.ok) {
                    const settings = await res.json();
                    const supabaseUrl = settings['SUPABASE_URL'] || process.env.SUPABASE_URL || '';
                    const supabaseKey = settings['SUPABASE_ANON_KEY'] || process.env.SUPABASE_ANON_KEY || '';
                    
                    if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder') || !supabaseUrl || !supabaseKey) {
                        statusText.textContent = '?? Not configured. Please set up Supabase database above.';
                        statusDiv.className = 'mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200';
                    } else {
                        statusText.textContent = '? Connected to Supabase database. Settings will be saved persistently.';
                        statusDiv.className = 'mb-8 p-4 bg-green-50 rounded-lg border border-green-200';
                    }
                } else {
                    statusText.textContent = '? Failed to connect to database. Check your Supabase credentials.';
                    statusDiv.className = 'mb-8 p-4 bg-red-50 rounded-lg border border-red-200';
                }
            } catch (e) {
                statusText.textContent = '? Connection error: ' + e.message;
                statusDiv.className = 'mb-8 p-4 bg-red-50 rounded-lg border border-red-200';
            }
        }

        function editSetting(key, value) {
            document.getElementById('new-key').value = key;
            document.getElementById('new-value').value = value;
            document.getElementById('new-value').focus();
        }

        async function saveSetting() {
            const key = document.getElementById('new-key').value;
            const value = document.getElementById('new-value').value;
            
            if (!key || !value) return alert('Key and value required');

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
                    alert('Saved!');
                    loadSettings();
                    document.getElementById('new-key').value = '';
                    document.getElementById('new-value').value = '';
                } else {
                    throw new Error('Failed to save');
                }
            } catch (e) {
                alert(e.message);
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
                alert('Brand identity updated! ??');
                loadSettings();
            } catch (e) {
                alert('Error saving brand identity: ' + e.message);
            }
        }

        async function saveSupabaseSetup() {
            const url = document.getElementById('setup-supabase-url').value;
            const key = document.getElementById('setup-supabase-key').value;
            
            if (!url || !key) {
                alert('Both Supabase URL and Anon Key are required');
                return;
            }
            
            if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
                alert('Please enter a valid Supabase URL (should start with https:// and contain .supabase.co)');
                return;
            }
            
            if (!key.startsWith('eyJ')) {
                alert('Please enter a valid Supabase Anon Key (should start with eyJ)');
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
                    alert('Supabase configuration saved successfully! ?\n\nYour settings will now be stored in the database.');
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
        });
    
