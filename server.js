const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000; // Align with Render’s port

// Middleware
app.use(cors({ origin: 'https://ekverified.github.io' })); // Restrict to GitHub Pages
app.use(express.json()); // Parse JSON bodies
app.use(express.static(path.join(__dirname))); // Serve static files from root

// Data file path
const dataFile = path.join(__dirname, 'data.json');

// Initialize data.json if it doesn’t exist
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

// GET endpoint to fetch data.json
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

// Shared function to add member contribution
async function addMemberContribution(data, month) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data object');
  }
  if (!data.member_name || typeof data.member_name !== 'string') {
    throw new Error('Valid member_name is required');
  }
  if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
    throw new Error('Valid positive amount is required');
  }
  if (!data.contributions || !data.contributions[month]) {
    throw new Error(`Contribution for ${month} is required`);
  }

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
  return { success: true, message: `Contribution added for ${data.member_name}` };
}

// POST endpoint to update data.json (for balance sheet)
app.post('/api/update-data', async (req, res) => {
  try {
    console.log('POST /api/update-data - Received:', JSON.stringify(req.body, null, 2));
    const { action, month, data } = req.body;

    if (!action) {
      console.error('POST /api/update-data - Error: Action is required');
      return res.status(400).json({ error: 'Action is required' });
    }

    let jsonData = { monthly_reports: {}, member_contributions: [] };
    try {
      const fileContent = await fs.readFile(dataFile, 'utf8');
      jsonData = JSON.parse(fileContent);
    } catch (error) {
      console.log('POST /api/update-data - Creating new data.json');
      await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
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
      const requiredFields = [
        'opening_kcb_balance', 'total_member_contributions_kcb', 'total_loan_repayments_kcb',
        'total_loan_disbursements_kcb', 'bank_charges_kcb', 'opening_lofty_balance',
        'total_loan_repayments_lofty', 'total_loan_disbursements_lofty', 'bank_charges_lofty'
      ];
      for (const field of requiredFields) {
        if (!(field in data) || typeof data[field] !== 'number' || data[field] < 0) {
          console.error(`POST /api/update-data - Error: Invalid ${field}`);
          return res.status(400).json({ error: `Valid ${field} is required` });
        }
      }
      jsonData.monthly_reports[month] = data;
      console.log(`POST /api/update-data - Updated monthly_reports for ${month}`);
      await fs.writeFile(dataFile, JSON.stringify(jsonData, null, 2));
      res.json({ success: true, message: `Financial data updated for ${month}` });
    } else {
      console.error('POST /api/update-data - Error: Invalid action');
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('POST /api/update-data - Failed:', error.message);
    res.status(500).json({ error: 'Failed to update data' });
  }
});

// POST endpoint for member contributions
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
    res.status(500).json({ error: error.message || 'Failed to add contribution' });
  }
});

// POST endpoint for balance sheet (for compatibility)
app.post('/api/update-balance-sheet', async (req, res) => {
  console.log('POST /api/update-balance-sheet - Received:', JSON.stringify(req.body, null, 2));
  req.body.action = 'updateBalanceSheet';
  return app._router.handle(req, res); // Keep for compatibility, but monitor
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
