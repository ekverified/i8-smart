const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json()); // Parse JSON bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// GET endpoint to fetch data.json
app.get('/api/data', async (req, res) => {
    try {
        const dataFile = path.join(__dirname, 'public', 'js', 'data.json');
        const fileContent = await fs.readFile(dataFile, 'utf8');
        res.json(JSON.parse(fileContent));
    } catch (error) {
        console.error('Error reading data.json:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// POST endpoint to update data.json
app.post('/api/update-data', async (req, res) => {
    try {
        const { action, month, data } = req.body;
        const dataFile = path.join(__dirname, 'public', 'js', 'data.json');
        let jsonData = { monthly_reports: {}, member_contributions: [] };

        // Read existing data or initialize new
        try {
            const fileContent = await fs.readFile(dataFile, 'utf8');
            jsonData = JSON.parse(fileContent);
        } catch (error) {
            console.log('Creating new data.json');
        }

        // Validate request
        if (!action) {
            return res.status(400).json({ error: 'Action is required' });
        }

        if (action === 'updateBalanceSheet') {
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                return res.status(400).json({ error: 'Valid month (YYYY-MM) is required' });
            }
            if (!data || typeof data !== 'object') {
                return res.status(400).json({ error: 'Valid data object is required' });
            }
            // Validate required fields
            const requiredFields = [
                'opening_kcb_balance', 'total_member_contributions_kcb', 'total_loan_repayments_kcb',
                'total_loan_disbursements_kcb', 'bank_charges_kcb', 'opening_lofty_balance',
                'total_member_contributions_lofty', 'total_loan_disbursements_lofty', 'bank_charges_lofty'
            ];
            for (const field of requiredFields) {
                if (!(field in data) || typeof data[field] !== 'number' || data[field] < 0) {
                    return res.status(400).json({ error: `Valid ${field} is required` });
                }
            }
            jsonData.monthly_reports[month] = data;
        } else if (action === 'addMemberContribution') {
            if (!data || typeof data !== 'object') {
                return res.status(400).json({ error: 'Valid data object is required' });
            }
            if (!data.member_name || typeof data.member_name !== 'string') {
                return res.status(400).json({ error: 'Valid member_name is required' });
            }
            if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
                return res.status(400).json({ error: 'Valid positive amount is required' });
            }
            if (!data.contributions || !data.contributions[month]) {
                return res.status(400).json({ error: `Contribution for ${month} is required` });
            }
            // Update existing member or add new
            const memberIndex = jsonData.member_contributions.findIndex(m => m.member_name === data.member_name);
            if (memberIndex >= 0) {
                jsonData.member_contributions[memberIndex] = {
                    ...jsonData.member_contributions[memberIndex],
                    amount: (jsonData.member_contributions[memberIndex].amount || 0) + data.amount,
                    shares: ((jsonData.member_contributions[memberIndex].amount || 0) + data.amount) / 1000,
                    last_contribution_date: new Date().toISOString().split('T')[0],
                    contributions: {
                        ...jsonData.member_contributions[memberIndex].contributions,
                        [month]: (jsonData.member_contributions[memberIndex].contributions?.[month] || 0) + data.contributions[month]
                    }
                };
            } else {
                jsonData.member_contributions.push({
                    member_name: data.member_name,
                    amount: data.amount,
                    shares: data.amount / 1000,
                    last_contribution_date: new Date().toISOString().split('T')[0],
                    contributions: { [month]: data.contributions[month] }
                });
            }
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Write updated data
        await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating data.json:', error);
        res.status(500).json({ error: 'Failed to update data' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});