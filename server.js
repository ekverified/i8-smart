const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors({ origin: 'https://ekverified.github.io' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Data file path
const dataFile = path.join(__dirname, 'data.json');

// Initialize data.json
async function initializeDataFile() {
    try {
        await fs.access(dataFile);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Creating new data.json');
            await fs.writeFile(dataFile, JSON.stringify({ monthly_reports: {}, member_contributions: [] }, null, 2));
        } else {
            throw error;
        }
    }
}
initializeDataFile();

// GET /api/data
app.get('/api/data', async (req, res) => {
    try {
        console.log('GET /api/data - Attempting to read file at:', dataFile);
        const fileContent = await fs.readFile(dataFile, 'utf8');
        console.log('GET /api/data - File read successfully');
        res.json(JSON.parse(fileContent));
    } catch (error) {
        console.error('GET /api/data - Failed:', error.message);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Shared function for adding member contributions
async function addMemberContribution(data, month) {
    if (!data || typeof data !== 'object') throw new Error('Invalid data object');
    if (!data.member_name || typeof data.member_name !== 'string') throw new Error('Valid member_name is required');
    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) throw new Error('Valid positive amount is required');
    if (!data.contributions || !data.contributions[month]) throw new Error(`Contribution for ${month} is required`);

    let jsonData = { monthly_reports: {}, member_contributions: [] };
    try {
        const fileContent = await fs.readFile(dataFile, 'utf8');
        jsonData = JSON.parse(fileContent);
    } catch (error) {
        console.log('Creating new data.json for contributions');
        await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
    }

    const memberIndex = jsonData.member_contributions.findIndex(m => m.member_name === data.member_name);
    if (memberIndex >= 0) {
        jsonData.member_contributions[memberIndex].contributions = {
            ...jsonData.member_contributions[memberIndex].contributions,
            [month]: data.contributions[month]
        };
        jsonData.member_contributions[memberIndex].amount = Object.values(jsonData.member_contributions[memberIndex].contributions).reduce((sum, val) => sum + val, 0);
        jsonData.member_contributions[memberIndex].last_contribution_date = data.last_contribution_date;
        jsonData.member_contributions[memberIndex].shares = data.shares;
        console.log(`Updated contribution for ${data.member_name}`);
    } else {
        jsonData.member_contributions.push({
            member_name: data.member_name,
            amount: data.amount,
            last_contribution_date: data.last_contribution_date,
            shares: data.shares,
            contributions: { [month]: data.contributions[month] }
        });
        console.log(`Added new contribution for ${data.member_name}`);
    }

    await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
    console.log(`Successfully wrote contribution for ${data.member_name} to data.json`);
    return { success: true, message: `Contribution added for ${data.member_name}` };
}

// POST /api/add-contribution
app.post('/api/add-contribution', async (req, res) => {
    try {
        console.log('POST /api/add-contribution - Received:', JSON.stringify(req.body, null, 2));
        const { month, data } = req.body;

        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            console.error('POST /api/add-contribution - Error: Invalid month format');
            return res.status(400).json({ error: 'Valid month (YYYY-MM) is required' });
        }

        const result = await addMemberContribution(data, month);
        res.json(result);
    } catch (error) {
        console.error('POST /api/add-contribution - Failed:', error.message);
        res.status(500).json({ error: 'Failed to add contribution', details: error.message });
    }
});

// POST /api/update-balance-sheet
app.post('/api/update-balance-sheet', async (req, res) => {
    try {
        console.log('POST /api/update-balance-sheet - Received:', JSON.stringify(req.body, null, 2));
        const { action, month, data } = req.body;

        if (!action || action !== 'updateBalanceSheet') {
            console.error('POST /api/update-balance-sheet - Error: Invalid action');
            return res.status(400).json({ error: 'Invalid action' });
        }
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            console.error('POST /api/update-balance-sheet - Error: Invalid month format');
            return res.status(400).json({ error: 'Valid month (YYYY-MM) is required' });
        }
        if (!data || typeof data !== 'object') {
            console.error('POST /api/update-balance-sheet - Error: Invalid data object');
            return res.status(400).json({ error: 'Valid data object is required' });
        }

        const requiredFields = [
            'opening_kcb_balance', 'opening_lofty_balance', 'total_member_contributions_kcb',
            'total_loan_repayments_kcb', 'total_loan_repayments_lofty', 'interest_on_loans_kcb',
            'interest_on_deposits_lofty', 'other_income_kcb', 'other_income_lofty',
            'total_loan_disbursements_kcb', 'total_loan_disbursements_lofty',
            'bank_charges_kcb', 'bank_charges_lofty', 'petty_cash_utilized_kcb',
            'petty_cash_utilized_lofty', 'agm_facilitation_kcb', 'agm_facilitation_lofty',
            'welfare_kitty_utilized_kcb', 'welfare_kitty_utilized_lofty',
            'other_expenses_kcb', 'other_expenses_lofty', 'total_inflows',
            'total_outflows', 'kcb_balance', 'lofty_balance', 'total_balance'
        ];
        for (const field of requiredFields) {
            if (!(field in data) || typeof data[field] !== 'number' || data[field] < 0) {
                console.error(`POST /api/update-balance-sheet - Error: Invalid ${field}`);
                return res.status(400).json({ error: `Valid ${field} is required` });
            }
        }

        let jsonData = { monthly_reports: {}, member_contributions: [] };
        try {
            const fileContent = await fs.readFile(dataFile, 'utf8');
            jsonData = JSON.parse(fileContent);
        } catch (error) {
            console.log('POST /api/update-balance-sheet - Creating new data.json');
            await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
        }

        jsonData.monthly_reports[month] = data;
        console.log(`POST /api/update-balance-sheet - Updated monthly_reports for ${month}`);
        await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
        console.log(`POST /api/update-balance-sheet - Successfully wrote financial data for ${month}`);
        res.json({ success: true, message: `Financial data updated for ${month}` });
    } catch (error) {
        console.error('POST /api/update-balance-sheet - Failed:', error.message);
        res.status(500).json({ error: 'Failed to update financial data', details: error.message });
    }
});

// GET /api/search-member
app.get('/api/search-member', async (req, res) => {
    try {
        console.log('GET /api/search-member - Query:', req.query);
        const name = req.query.name ? req.query.name.toLowerCase() : '';
        if (!name) {
            console.error('GET /api/search-member - Error: Name query parameter is required');
            return res.status(400).json({ error: 'Name query parameter is required' });
        }

        const fileContent = await fs.readFile(dataFile, 'utf8');
        const jsonData = JSON.parse(fileContent);
        const members = jsonData.member_contributions.filter(m => m.member_name.toLowerCase().includes(name));
        console.log(`GET /api/search-member - Found ${members.length} members matching "${name}"`);
        res.json({ members });
    } catch (error) {
        console.error('GET /api/search-member - Failed:', error.message);
        res.status(500).json({ error: 'Failed to search members', details: error.message });
    }
});

// Debug endpoint
app.get('/api/debug/files', async (req, res) => {
    try {
        const files = await fs.readdir(__dirname);
        res.json({ files });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
