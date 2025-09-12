// Global variables
let authorizeButton = document.getElementById('authorize-button');
let signoutButton = document.getElementById('signout-button');
let statusMessage = document.getElementById('status-message');
let loadingDiv = document.getElementById('loading');
let resultsSection = document.getElementById('results-section');
let errorSection = document.getElementById('error-section');

// Track initialization state
let gapiInited = false;
let gisInited = false;

// Current access token
let accessToken = null;

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the Gmail API.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: CONFIG.API_KEY,
        discoveryDocs: CONFIG.DISCOVERY_DOCS,
    });
    gapiInited = true;
    maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
    gisInited = true;
    maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries have loaded.
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authorizeButton.style.display = 'block';
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }
}

/**
 * Sign in the user upon button click.
 */
function handleAuthClick() {
    const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: (response) => {
            if (response.error !== undefined) {
                showError('Authorization failed: ' + response.error);
                return;
            }
            
            // Store the access token
            accessToken = response.access_token;
            
            // Update UI
            updateSigninStatus(true);
            
            // Start fetching emails
            fetchAndParseEmails();
        },
    });

    if (accessToken === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({prompt: ''});
    }
}

/**
 * Sign out the user upon button click.
 */
function handleSignoutClick() {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken);
        accessToken = null;
    }
    
    updateSigninStatus(false);
    statusMessage.textContent = 'Signed out successfully';
    resultsSection.style.display = 'none';
    clearError();
}

/**
 * Update the sign-in status and button visibility.
 */
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
        resultsSection.style.display = 'none';
    }
}

// Main function to fetch and parse emails
async function fetchAndParseEmails() {
    showLoading(true);
    clearError();
    
    try {
        // Set the access token for API requests
        gapi.client.setToken({access_token: accessToken});
        
        // Calculate date 7 days ago
        const date = new Date();
        date.setDate(date.getDate() - 7);
        const after = date.toISOString().split('T')[0];
        
        statusMessage.textContent = `Fetching emails from last 7 days...`;
        
        // Fetch emails from Gmail API
        const response = await gapi.client.gmail.users.messages.list({
            'userId': 'me',
            'q': `after:${after}`,
            'maxResults': 100
        });
        
        if (!response.result.messages) {
            showStatus('No emails found in the last 7 days');
            showLoading(false);
            return;
        }
        
        statusMessage.textContent = `Found ${response.result.messages.length} emails, parsing for JIRA tickets...`;
        
        // Fetch full details for each email
        const ticketData = [];
        const processedTickets = new Set(); // To avoid duplicates
        
        for (const message of response.result.messages) {
            const fullMessage = await gapi.client.gmail.users.messages.get({
                'userId': 'me',
                'id': message.id
            });
            
            const parsed = parseEmailForJira(fullMessage.result);
            
            // Add unique tickets only
            parsed.tickets.forEach(ticket => {
                const ticketKey = `${ticket}-${parsed.subject}`;
                if (!processedTickets.has(ticketKey)) {
                    processedTickets.add(ticketKey);
                    ticketData.push({
                        ticket: ticket,
                        subject: parsed.subject,
                        from: parsed.from,
                        date: parsed.date
                    });
                }
            });
        }
        
        displayResults(ticketData);
        
    } catch (error) {
        showError('Error fetching emails: ' + error.message);
        console.error('Full error:', error);
    } finally {
        showLoading(false);
    }
}

// Parse individual email for JIRA tickets
function parseEmailForJira(message) {
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    
    // Get email body (handle both plain and HTML)
    let body = '';
    
    function extractBody(payload) {
        if (payload.body?.data) {
            try {
                return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } catch (e) {
                return '';
            }
        }
        if (payload.parts) {
            return payload.parts.map(part => extractBody(part)).join(' ');
        }
        return '';
    }
    
    body = extractBody(message.payload);
    
    // Combine subject and body for searching
    const searchText = `${subject} ${body}`;
    
    // Find JIRA tickets (format: ABC-123)
    const jiraPattern = /\b[A-Z]{2,}-\d+\b/g;
    const tickets = searchText.match(jiraPattern) || [];
    
    return {
        tickets: [...new Set(tickets)], // Remove duplicates
        subject: subject,
        from: from.replace(/<.*>/, '').trim(), // Clean email address
        date: new Date(date).toLocaleDateString()
    };
}

// Display results in table
function displayResults(ticketData) {
    const tbody = document.getElementById('results-body');
    const summary = document.getElementById('summary');
    
    // Clear previous results
    tbody.innerHTML = '';
    
    if (ticketData.length === 0) {
        summary.textContent = 'No JIRA tickets found in recent emails';
        resultsSection.style.display = 'block';
        return;
    }
    
    // Update summary
    const uniqueTickets = new Set(ticketData.map(t => t.ticket));
    summary.textContent = `Found ${uniqueTickets.size} unique JIRA tickets in ${ticketData.length} email references`;
    
    // Populate table
    ticketData.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="ticket-id">${item.ticket}</td>
            <td>${item.subject}</td>
            <td>${item.from}</td>
            <td>${item.date}</td>
        `;
    });
    
    resultsSection.style.display = 'block';
    statusMessage.textContent = 'Email parsing complete!';
}

// UI Helper functions
function showLoading(show) {
    loadingDiv.style.display = show ? 'block' : 'none';
}

function showError(message) {
    errorSection.textContent = message;
    errorSection.style.display = 'block';
}

function clearError() {
    errorSection.style.display = 'none';
}

function showStatus(message) {
    statusMessage.textContent = message;
}