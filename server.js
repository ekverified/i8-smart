const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: 'https://ekverified.github.io' })); // Restrict to GitHub Pages
app.use(express.json()); // Parse JSON bodies
app.use(express.static(path.join(__dirname))); // Serve static files from root

// GET endpoint to fetch data.json
app.get('/api/data', async (req, res) => {
    try {
        const dataFile = path.join(__dirname, 'data.json');
        console.log('GET /api/data - Attempting to read file at:', dataFile);
        let fileContent;
        try {
            fileContent = await fs.readFile(dataFile, 'utf8');
            console.log('GET /api/data - File read successfully');
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('GET /api/data - Creating new data.json');
                fileContent = JSON.stringify({ monthly_reports: {}, member_contributions: [] }, null, 2);
                await fs.writeFile(dataFile, fileContent);
            } else {
                console.error('GET /api/data - Error reading data.json:', error.message);
                throw error;
            }
        }
        res.json(JSON.parse(fileContent));
    } catch (error) {
        console.error('GET /api/data - Failed:', error.message);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// POST endpoint to update data.json (main endpoint)
app.post('/api/update-data', async (req, res) => {
    try {
        console.log('POST /api/update-data - Received:', JSON.stringify(req.body, null, 2));
        const { action, month, data } = req.body;
        const dataFile = path.join(__dirname, 'data.json');
        let jsonData = { monthly_reports: {}, member_contributions: [] };

        // Read existing data or initialize new
        try {
            const fileContent = await fs.readFile(dataFile, 'utf8');
            jsonData = JSON.parse(fileContent);
            console.log('POST /api/update-data - Existing data read:', JSON.stringify(jsonData, null, 2));
        } catch (error) {
            console.log('POST /api/update-data - Creating new data.json');
            await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
        }

        // Validate request
        if (!action) {
            console.error('POST /api/update-data - Error: Action is required');
            return res.status(400).json({ error: 'Action is required' });
        }

        if (action === 'updateBalanceSheet') {
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                console.error('POST /api/update-data - Error: Invalid month format');
                return res.status(400).json({ error: 'Valid month (YYYY-MM) is required' });
            }
            if (!data || typeof data !== 'object') {
                console.error('POST /api/update-data - Error: Invalid data object');
                return res.status(400).json({ error: 'Valid data object is required' });
            }
            // Validate required fields
            const requiredFields = [
                'opening_kcb_balance',
                'total_member_contributions_kcb',
                'total_loan_repayments_kcb',
                'total_loan_disbursements_kcb',
                'bank_charges_kcb',
                'opening_lofty_balance',
                'total_loan_repayments_lofty',
                'total_loan_disbursements_lofty',
                'bank_charges_lofty'
            ];
            for (const field of requiredFields) {
                if (!(field in data) || typeof data[field] !== 'number' || data[field] < 0) {
                    console.error(`POST /api/update-data - Error: Invalid ${field}`);
                    return res.status(400).json({ error: `Valid ${field} is required` });
                }
            }
            jsonData.monthly_reports[month] = data;
            console.log(`POST /api/update-data - Updated monthly_reports for ${month}`);
        } else if (action === 'addMemberContribution') {
            if (!data || typeof data !== 'object') {
                console.error('POST /api/update-data - Error: Invalid data object');
                return res.status(400).json({ error: 'Valid data object is required' });
            }
            if (!data.member_name || typeof data.member_name !== 'string') {
                console.error('POST /api/update-data - Error: Invalid member_name');
                return res.status(400).json({ error: 'Valid member_name is required' });
            }
            if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
                console.error('POST /api/update-data - Error: Invalid amount');
                return res.status(400).json({ error: 'Valid positive amount is required' });
            }
            if (!data.contributions || !data.contributions[month]) {
                console.error(`POST /api/update-data - Error: Contribution for ${month} is required`);
                return res.status(400).json({ error: `Contribution for ${month} is required` });
            }
            // Update existing member or add new
            const memberIndex = jsonData.member_contributions.findIndex(m => m.member_name === data.member_name);
            if (memberIndex >= 0) {
                jsonData.member_contributions[memberIndex].contributions = {
                    ...jsonData.member_contributions[memberIndex].contributions,
                    [month]: data.contributions[month]
                };
                jsonData.member_contributions[memberIndex].amount = Object.values(jsonData.member_contributions[memberIndex].contributions).reduce((sum, val) => sum + val, 0);
                jsonData.member_contributions[memberIndex].last_contribution_date = data.last_contribution_date;
                jsonData.member_contributions[memberIndex].shares = data.shares;
                console.log(`POST /api/update-data - Updated contribution for ${data.member_name}`);
            } else {
                jsonData.member_contributions.push({
                    member_name: data.member_name,
                    amount: data.amount,
                    last_contribution_date: data.last_contribution_date,
                    shares: data.shares,
                    contributions: { [month]: data.contributions[month] }
                });
                console.log(`POST /api/update-data - Added new contribution for ${data.member_name}`);
            }
        } else {
            console.error('POST /api/update-data - Error: Invalid action');
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Write updated data
        await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
        console.log('POST /api/update-data - Data written successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('POST /api/update-data - Failed:', error.message);
        res.status(500).json({ error: 'Failed to update data' });
    }
});

// Fallback endpoints for compatibility with frontend
app.post('/api/update-balance-sheet', async (req, res) => {
    console.log('POST /api/update-balance-sheet - Redirecting to /api/update-data');
    req.body.action = 'updateBalanceSheet';
    return app._router.handle(req, res); // Forward to /api/update-data
});

app.post('/api/add-contribution', async (req, res) => {
    console.log('POST /api/add-contribution - Redirecting to /api/update-data');
    req.body.action = 'addMemberContribution';
    return app._router.handle(req, res); // Forward to /api/update-data
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
