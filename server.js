const express = require('express');
const { Octokit } = require('@octokit/core');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors({ origin: 'https://ekverified.github.io' }));
app.use(express.json());
app.use(express.static(__dirname));

// GitHub API setup
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.GITHUB_OWNER || 'ekverified';
const repo = process.env.GITHUB_REPO || 'i8-smart-backend';
const path = 'data.json';

// Initialize data.json in repository if it doesn't exist
async function initializeDataFile() {
    try {
        console.log(`Initializing data.json in ${owner}/${repo}/${path}`);
        await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path });
        console.log('data.json already exists in repository');
    } catch (error) {
        if (error.status === 404) {
            console.log('Creating new data.json in repository');
            const initialData = JSON.stringify({ monthly_reports: {}, member_contributions: [] }, null, 2);
            await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                owner,
                repo,
                path,
                message: 'Initialize data.json',
                content: Buffer.from(initialData).toString('base64')
            });
            console.log('Initialized data.json with:', initialData);
        } else {
            console.error('Failed to initialize data.json:', error.message);
            throw error;
        }
    }
}
initializeDataFile();

// Helper to get data.json content
async function getData() {
    try {
        const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path });
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Failed to read data.json:', error.message);
        throw error;
    }
}

// Helper to save data.json
async function saveData(data, commitMessage) {
    try {
        const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path });
        const sha = response.data.sha;
        const content = JSON.stringify(data, null, 2);
        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner,
            repo,
            path,
            message: commitMessage,
            content: Buffer.from(content).toString('base64'),
            sha
        });
        console.log(`Saved data.json: ${content}`);
    } catch (error) {
        console.error('Failed to save data.json:', error.message);
        throw error;
    }
}

// GET /api/data
app.get('/api/data', async (req, res) => {
    try {
        console.log('GET /api/data - Fetching from GitHub');
        const data = await getData();
        console.log('GET /api/data - Data fetched:', JSON.stringify(data, null, 2));
        res.json(data);
    } catch (error) {
        console.error('GET /api/data - Failed:', error.message);
        res.status(500).json({ error: 'Failed to read data', details: error.message });
    }
});

// Shared function for adding member contributions
async function addMemberContribution(data, month) {
    if (!data || typeof data !== 'object') throw new Error('Invalid data object');
    if (!data.member_name || typeof data.member_name !== 'string') throw new Error('Valid member_name is required');
    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) throw new Error('Valid positive amount is required');
    if (!data.contributions || !data.contributions[month]) throw new Error(`Contribution for ${month} is required`);

    const jsonData = await getData();
    console.log('addMemberContribution - Current data:', JSON.stringify(jsonData, null, 2));

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

    console.log('addMemberContribution - Saving to GitHub:', JSON.stringify(jsonData, null, 2));
    await saveData(jsonData, `Add contribution for ${data.member_name} in ${month}`);
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

        const jsonData = await getData();
        console.log('POST /api/update-balance-sheet - Current data:', JSON.stringify(jsonData, null, 2));

        jsonData.monthly_reports[month] = data;
        console.log('POST /api/update-balance-sheet - Saving to GitHub:', JSON.stringify(jsonData, null, 2));
        await saveData(jsonData, `Update financial data for ${month}`);
        console.log(`POST /api/update-balance-sheet - Successfully saved financial data for ${month}`);
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

        const jsonData = await getData();
        console.log('GET /api/search-member - Current data:', JSON.stringify(jsonData, null, 2));
        const members = jsonData.member_contributions.filter(m => m.member_name.toLowerCase().includes(name));
        console.log(`GET /api/search-member - Found ${members.length} members matching "${name}"`);
        res.json({ members });
    } catch (error) {
        console.error('GET /api/search-member - Failed:', error.message);
        res.status(500).json({ error: 'Failed to search members', details: error.message });
    }
});

// Debug endpoint
app.get('/api/debug/data', async (req, res) => {
    try {
        console.log('GET /api/debug/data - Fetching from GitHub');
        const data = await getData();
        console.log('GET /api/debug/data - Data:', JSON.stringify(data, null, 2));
        res.json(data);
    } catch (error) {
        console.error('GET /api/debug/data - Failed:', error.message);
        res.status(500).json({ error: 'Failed to fetch debug data', details: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
