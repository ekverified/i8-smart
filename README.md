# i-8 SMART BOT

A web application for calculating deposit penalties, loan interest, and tracking financial data for Insightful Eight Co. Ltd. Uses a local `data.json` file, managed via a password-protected admin dashboard with balance sheet functionality.

## Features

- Calculate penalties for late deposits and interest for loans (short, medium, long-term).
- Display balance sheet with monthly inflows, outflows, and balances (KCB and Lofty accounts).
- Paginated member contributions table with loan limits (90% of contributions).
- Admin dashboard to update balance sheet and member contributions.
- Generate and share PDF reports of calculations.
- Progressive Web App (PWA) support.

## Setup

### Local Testing

1. **Install Node.js**: Download from [nodejs.org](https://nodejs.org).
2. **Install Dependencies**:
   ```bash
   cd E:\I8 Sart Bot
   npm init -y
   npm install express
   ```
