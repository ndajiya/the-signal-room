import express from 'express';
import bodyParser from 'body-parser';
import { VercelRequest, VercelResponse } from '@vercel/node';

// Import handlers manually for now
import dashboardHandler from './api/admin/dashboard';
import settingsHandler from './api/admin/settings';
import supabaseSetupHandler from './api/admin/supabase-setup';
import rewardHandler from './api/linkedin/reward';
import whatsappHandler from './api/whatsapp/message';

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Bridge function to convert Express req/res to Vercel types
const bridge = (handler: any) => async (req: express.Request, res: express.Response) => {
    // Add Vercel-specific methods if needed (query is already there in express)
    const vRes = res as unknown as VercelResponse;
    const vReq = req as unknown as VercelRequest;
    
    try {
        await handler(vReq, vRes);
    } catch (e) {
        console.error('Handler error:', e);
        res.status(500).send((e as Error).message);
    }
};

// Routes
app.get('/api/admin/dashboard', bridge(dashboardHandler));
app.get('/api/admin/settings', bridge(settingsHandler));
app.post('/api/admin/settings', bridge(settingsHandler));
app.post('/api/admin/supabase-setup', bridge(supabaseSetupHandler));
app.post('/api/linkedin/reward', bridge(rewardHandler));
app.post('/api/whatsapp/message', bridge(whatsappHandler));
app.get('/api/whatsapp', bridge(whatsappHandler)); // Challenge verification

app.listen(port, () => {
    console.log(`Signal Room Dev Server running at http://localhost:${port}`);
    console.log(`Access Admin Dashboard: http://localhost:${port}/api/admin/dashboard`);
});
