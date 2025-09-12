# Planning Buddy - Gmail JIRA Parser POC

## Overview
This POC fetches emails from your Gmail account and extracts all JIRA ticket references from the last 7 days.

## Setup Instructions

### 1. Add Your Google Cloud Credentials
Edit `config.js` and add your credentials:
1. Go to https://console.cloud.google.com
2. Select project "planning-buddy"
3. Navigate to APIs & Services > Credentials
4. Copy your Client ID and API Key
5. Replace the placeholder values in config.js

### 2. Start Local Server
```bash
# Using Python 3
python3 -m http.server 8000

# Or using Node.js
npx http-server -p 8000
```

### 3. Access the App
Open http://localhost:8000 in your browser

### 4. Authorize and Use
1. Click "Sign In with Google"
2. Authorize the app to read your Gmail
3. Wait for email fetching (max 100 emails from last 7 days)
4. View all JIRA tickets found in the table

## Features
- OAuth 2.0 Google authentication
- Fetches emails from last 7 days
- Parses JIRA ticket patterns (e.g., PROJ-123, ABC-456)
- Displays results in clean HTML table
- Shows ticket number, email subject, sender, and date

## Project Structure
```
planning-buddy-poc/
├── index.html      # Main interface
├── script.js       # Gmail API & JIRA parsing logic
├── style.css       # Styling
├── config.js       # API credentials (gitignored)
└── README.md       # This file
```

## Next Steps
- Add task management with Eisenhower Matrix
- Integrate Google Drive for PRD parsing
- Add Google Calendar for scheduling
- Implement time estimation habits