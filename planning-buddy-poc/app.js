// Planning Buddy - Core Application Logic
// Updated: 2024-12-13 14:30 - Fixed editTask database integration

class PlanningBuddyApp {
    constructor() {
        this.hideCompleted = true;
        
        // Gmail/JIRA sync properties
        this.gapiInited = false;
        this.gisInited = false;
        this.accessToken = null;
        this.discoveredJiraTickets = [];
        
        // Initialize database - ensure it exists
        this.initializeDatabase();
        
        this.init();
    }

    initializeDatabase() {
        // Ensure database is available
        if (window.planningBuddyDB) {
            this.db = window.planningBuddyDB;
        } else {
            console.error('PlanningBuddyDB not found! Make sure database.js is loaded first.');
            // Try to create it manually as fallback
            if (typeof PlanningBuddyDB !== 'undefined') {
                this.db = new PlanningBuddyDB();
            } else {
                alert('Database initialization failed. Please refresh the page.');
                return;
            }
        }
        
        console.log('Database initialized:', this.db);
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderDashboard();
        this.updateStats();
        this.checkWeeklyPlanning();
        this.displayLastSyncTime();
    }

    // Data Management - Now using database layer
    loadData() {
        // Database handles initialization and loading
        // No longer need to manage local arrays
    }

    saveData() {
        // Database handles saving automatically
        // No longer need manual localStorage management
    }

    // Convenience methods to get data from database
    getTasks() {
        return this.db.getTasks();
    }

    getArchivedTasks() {
        return this.db.getArchivedTasks();
    }

    getQ2Count() {
        return this.db.getQ2Count();
    }

    // Task Management - Updated to use database
    createTask(title, source = 'manual', jiraTicket = '', quadrant = 'uncategorized', priority = 'medium', origin = 'manual') {
        const taskData = {
            title: title.trim(),
            source: source,
            origin: origin,
            jiraTicket: jiraTicket,
            quadrant: quadrant,
            priority: priority,
            status: 'active'
        };
        
        const task = this.db.addTask(taskData);
        this.renderDashboard();
        this.updateStats();
        
        return task;
    }

    updateTask(taskId, updates) {
        const updatedTask = this.db.updateTask(taskId, updates);
        if (updatedTask) {
            this.renderDashboard();
            this.updateStats();
        }
        return updatedTask;
    }

    deleteTask(taskId) {
        const deleted = this.db.deleteTask(taskId);
        if (deleted) {
            this.renderDashboard();
            this.updateStats();
        }
        return deleted;
    }

    completeTask(taskId) {
        const task = this.db.getTaskById(taskId);
        if (task) {
            const updates = {
                status: 'completed',
                dateCompleted: new Date().toISOString()
            };
            
            this.updateTask(taskId, updates);
            
            // Track Q2 completions
            if (task.quadrant === 'q2') {
                this.db.incrementQ2Count();
            }
            
            this.updateQ2Counter();
            this.showCompletionMessage(task);
        }
    }

    archiveTask(taskId) {
        const archived = this.db.archiveTask(taskId, 'manual');
        if (archived) {
            this.renderDashboard();
            this.updateStats();
        }
        return archived;
    }

    categorizeTask(taskId, quadrant, priority = 'medium') {
        this.updateTask(taskId, { quadrant, priority });
        this.checkWeeklyPlanning();
    }

    // Rendering
    renderDashboard() {
        const quadrants = ['uncategorized', 'q1', 'q2', 'q3', 'q4'];
        
        quadrants.forEach(quadrant => {
            this.renderQuadrant(quadrant);
        });
        
        this.updateTaskCounts();
    }

    renderQuadrant(quadrant) {
        const container = document.getElementById(`${quadrant}-tasks`);
        const tasks = this.getTasksByQuadrant(quadrant);
        
        if (tasks.length === 0) {
            container.innerHTML = `<div class="empty-bucket">No ${quadrant.toUpperCase()} tasks</div>`;
            return;
        }
        
        container.innerHTML = '';
        
        // Group by priority
        const priorityGroups = {
            high: tasks.filter(t => t.priority === 'high'),
            medium: tasks.filter(t => t.priority === 'medium'),
            low: tasks.filter(t => t.priority === 'low')
        };
        
        Object.entries(priorityGroups).forEach(([priority, taskList]) => {
            if (taskList.length > 0 && quadrant !== 'uncategorized') {
                const prioritySection = this.createPrioritySection(priority, taskList, quadrant);
                container.appendChild(prioritySection);
            } else if (quadrant === 'uncategorized') {
                taskList.forEach(task => {
                    container.appendChild(this.createTaskElement(task, quadrant));
                });
            }
        });
        
        // Add uncategorized notice for uncategorized bucket
        if (quadrant === 'uncategorized' && tasks.length > 0) {
            const notice = document.createElement('div');
            notice.className = 'force-categorize';
            notice.innerHTML = '⚠️ These tasks must be categorized before you can work on them';
            container.appendChild(notice);
        }
    }

    createPrioritySection(priority, tasks, quadrant) {
        const section = document.createElement('div');
        section.className = 'priority-group';
        
        const label = document.createElement('div');
        label.className = `priority-label priority-${priority}`;
        const icon = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
        label.innerHTML = `${icon} ${priority.toUpperCase()} PRIORITY (${tasks.length})`;
        
        section.appendChild(label);
        
        tasks.forEach(task => {
            if (!this.hideCompleted || task.status !== 'completed') {
                section.appendChild(this.createTaskElement(task, quadrant));
            }
        });
        
        return section;
    }

    createTaskElement(task, quadrant) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';
        taskDiv.dataset.taskId = task.id;
        
        if (task.status === 'completed') {
            taskDiv.style.opacity = '0.6';
        }
        
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        
        let displayText = task.title;
        if (task.jiraTicket) {
            const jiraUrl = CONFIG.JIRA_BASE_URL ? `${CONFIG.JIRA_BASE_URL}/${task.jiraTicket}` : '#';
            displayText = `<a href="${jiraUrl}" target="_blank" rel="noopener noreferrer">${task.jiraTicket}</a>: ${task.title}`;
        }
        displayText += `<span class="task-source">[${task.source}]</span>`;
        
        taskText.innerHTML = displayText;
        
        const actions = document.createElement('div');
        actions.className = 'task-actions';
        
        if (quadrant === 'uncategorized') {
            // Categorization buttons
            actions.innerHTML = `
                <button class="task-btn" onclick="app.categorizeTask('${task.id}', 'q1', 'high')">→ Q1</button>
                <button class="task-btn" onclick="app.categorizeTask('${task.id}', 'q2', 'medium')">→ Q2</button>
                <button class="task-btn" onclick="app.categorizeTask('${task.id}', 'q3', 'low')">→ Q3</button>
                <button class="task-btn" onclick="app.categorizeTask('${task.id}', 'q4', 'low')">→ Q4</button>
            `;
        } else {
            // Complete/Archive buttons
            const completeBtn = task.status === 'completed' ? 
                '<button class="task-btn" disabled>✓ Done</button>' :
                `<button class="task-btn complete" onclick="app.completeTask('${task.id}')">✓</button>`;
            
            actions.innerHTML = `
                ${completeBtn}
                <button class="task-btn archive" onclick="app.archiveTask('${task.id}')">📁</button>
                <button class="task-btn" onclick="app.editTask('${task.id}')">✏️</button>
            `;
        }
        
        taskDiv.appendChild(taskText);
        taskDiv.appendChild(actions);
        
        return taskDiv;
    }

    // Statistics and Counters
    updateStats() {
        const stats = this.db.calculateStats();
        const activeTasks = stats.activeTasks;
        const total = activeTasks.total;
        
        if (total === 0) {
            document.getElementById('q1Percent').textContent = '0';
            document.getElementById('q2Percent').textContent = '0';
            document.getElementById('q3Percent').textContent = '0';
            document.getElementById('q4Percent').textContent = '0';
            document.getElementById('q1Warning').style.display = 'none';
            return;
        }
        
        const percentages = {
            q1: Math.round((activeTasks.q1 / total) * 100),
            q2: Math.round((activeTasks.q2 / total) * 100),
            q3: Math.round((activeTasks.q3 / total) * 100),
            q4: Math.round((activeTasks.q4 / total) * 100)
        };
        
        document.getElementById('q1Percent').textContent = percentages.q1;
        document.getElementById('q2Percent').textContent = percentages.q2;
        document.getElementById('q3Percent').textContent = percentages.q3;
        document.getElementById('q4Percent').textContent = percentages.q4;
        
        // Show Q1 warning if > 75%
        const q1Warning = document.getElementById('q1Warning');
        if (percentages.q1 > 75) {
            q1Warning.style.display = 'block';
        } else {
            q1Warning.style.display = 'none';
        }
        
        // Update task stats using archived tasks (completed tasks are archived)
        const archivedTasks = this.db.getArchivedTasks();
        const completedToday = archivedTasks.filter(t => 
            t.status === 'completed' && 
            t.dateCompleted &&
            this.isToday(new Date(t.dateCompleted))
        ).length;
        
        document.getElementById('taskStats').textContent = 
            `${total} active tasks • ${completedToday} completed today`;
    }

    updateTaskCounts() {
        ['uncategorized', 'q1', 'q2', 'q3', 'q4'].forEach(quadrant => {
            const count = this.getTasksByQuadrant(quadrant).filter(t => 
                !this.hideCompleted || t.status !== 'completed'
            ).length;
            document.getElementById(`${quadrant}-count`).textContent = `(${count})`;
        });
    }

    updateQ2Counter() {
        const counter = document.getElementById('q2Counter');
        const reward = document.getElementById('q2Reward');
        const q2Count = this.db.getQ2Count();
        
        counter.textContent = `${q2Count}/20`;
        
        const remaining = 20 - q2Count;
        if (remaining <= 0) {
            reward.textContent = '🎉 You earned a sandwich! 🥪';
        } else {
            reward.textContent = `🥪 ${remaining} more for sandwich!`;
        }
    }

    // UI Event Handlers
    setupEventListeners() {
        // Task source dropdown
        document.getElementById('taskSource').addEventListener('change', (e) => {
            const jiraGroup = document.getElementById('jiraTicketGroup');
            jiraGroup.style.display = e.target.value === 'jira' ? 'block' : 'none';
        });
    }

    // UI Actions
    showAddTask() {
        document.getElementById('taskForm').classList.add('active');
        document.getElementById('taskTitle').focus();
    }

    cancelAddTask() {
        document.getElementById('taskForm').classList.remove('active');
        this.resetTaskForm();
    }

    saveTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const source = document.getElementById('taskSource').value;
        const jiraTicket = document.getElementById('jiraTicket').value.trim();
        
        if (!title) {
            alert('Please enter a task title');
            return;
        }
        
        this.createTask(title, source, jiraTicket);
        this.cancelAddTask();
    }

    editTask(taskId) {
        console.log('editTask called with ID:', taskId);
        console.log('Database instance:', this.db);
        
        if (!this.db) {
            console.error('Database not initialized!');
            alert('Database not ready. Please refresh the page.');
            return;
        }
        
        const task = this.db.getTaskById(taskId);
        console.log('Found task:', task);
        
        if (!task) {
            alert('Task not found');
            return;
        }
        
        const newTitle = prompt('Edit task title:', task.title);
        if (newTitle && newTitle.trim() !== task.title) {
            this.updateTask(taskId, { title: newTitle.trim() });
        }
    }

    resetTaskForm() {
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskSource').value = 'manual';
        document.getElementById('jiraTicket').value = '';
        document.getElementById('jiraTicketGroup').style.display = 'none';
    }

    toggleCompletedTasks() {
        this.hideCompleted = document.getElementById('hideCompleted').checked;
        this.renderDashboard();
    }

    showCompletionMessage(task) {
        const message = task.quadrant === 'q2' 
            ? `Great job! You completed a Q2 strategic task: "${task.title}". Keep focusing on important, non-urgent work!`
            : `Task completed: "${task.title}"`;
        
        // Simple alert for now - could be enhanced with a toast notification
        console.log(message);
    }

    // Weekly Planning
    checkWeeklyPlanning() {
        const uncategorizedTasks = this.getTasksByQuadrant('uncategorized');
        const banner = document.getElementById('planningBanner');
        const countSpan = document.getElementById('uncategorizedCount');
        
        if (uncategorizedTasks.length > 0) {
            countSpan.textContent = uncategorizedTasks.length;
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }
    }

    startWeeklyPlanning() {
        alert('Weekly planning would force categorization of all uncategorized tasks. For now, please categorize them manually using the → buttons.');
    }

    // Gmail/JIRA Sync Functionality
    gapiLoaded() {
        if (typeof gapi !== 'undefined') {
            gapi.load('client', () => this.initializeGapiClient());
        }
    }

    async initializeGapiClient() {
        if (typeof CONFIG !== 'undefined') {
            await gapi.client.init({
                apiKey: CONFIG.API_KEY,
                discoveryDocs: CONFIG.DISCOVERY_DOCS,
            });
            this.gapiInited = true;
            this.maybeEnableJiraSync();
        }
    }

    gisLoaded() {
        this.gisInited = true;
        this.maybeEnableJiraSync();
    }

    maybeEnableJiraSync() {
        if (this.gapiInited && this.gisInited) {
            const signInBtn = document.getElementById('jiraSignInBtn');
            const signOutBtn = document.getElementById('jiraSignOutBtn');
            
            if (signInBtn) {
                signInBtn.style.display = 'block';
                signInBtn.onclick = () => this.handleJiraSignIn();
                signOutBtn.onclick = () => this.handleJiraSignOut();
            }
        }
    }

    handleJiraSignIn() {
        if (typeof google === 'undefined') {
            alert('Google APIs not loaded yet. Please try again in a moment.');
            return;
        }

        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: (response) => {
                if (response.error !== undefined) {
                    this.showJiraStatus('Authorization failed: ' + response.error, 'error');
                    return;
                }
                
                this.accessToken = response.access_token;
                this.updateJiraAuthUI(true);
                this.fetchJiraTicketsFromGmail();
            },
        });

        if (this.accessToken === null) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    }

    handleJiraSignOut() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
            this.accessToken = null;
        }
        
        this.updateJiraAuthUI(false);
        this.showJiraStatus('Signed out successfully');
    }

    updateJiraAuthUI(isSignedIn) {
        const signInBtn = document.getElementById('jiraSignInBtn');
        const signOutBtn = document.getElementById('jiraSignOutBtn');
        
        if (isSignedIn) {
            signInBtn.style.display = 'none';
            signOutBtn.style.display = 'block';
        } else {
            signInBtn.style.display = 'block';
            signOutBtn.style.display = 'none';
            
            // Hide other sections
            document.getElementById('jiraLoadingSection').classList.remove('active');
            document.getElementById('jiraTicketsSection').style.display = 'none';
        }
    }

    async fetchJiraTicketsFromGmail() {
        // No modal loading - processing state handled by caller
        
        try {
            // Access token should already be set by the caller
            // No need to get it again - gapi.client already has the token
            
            // Calculate date range for JIRA emails using delta sync
            const syncTimeRange = this.db.calculateSyncTimeRange();
            const after = syncTimeRange.toISOString().split('T')[0];
            
            const response = await gapi.client.gmail.users.messages.list({
                'userId': 'me',
                'q': `after:${after}`,
                'maxResults': 100
            });
            
            if (!response.result.messages) {
                this.discoveredJiraTickets = [];
                return;
            }
            
            // Fetch full details for each email and parse JIRA tickets
            const ticketData = [];
            const processedTickets = new Set();
            
            for (const message of response.result.messages) {
                const fullMessage = await gapi.client.gmail.users.messages.get({
                    'userId': 'me',
                    'id': message.id
                });
                
                const parsed = this.parseEmailForJira(fullMessage.result);
                
                // Add unique tickets only
                parsed.tickets.forEach(ticket => {
                    if (!processedTickets.has(ticket)) {
                        processedTickets.add(ticket);
                        ticketData.push({
                            ticket: ticket,
                            subject: parsed.subject,
                            from: parsed.from,
                            date: parsed.date
                        });
                    }
                });
            }
            
            this.discoveredJiraTickets = ticketData;
            
        } catch (error) {
            console.error('Gmail API Error:', error);
            throw error; // Re-throw so caller can handle
        }
    }

    parseEmailForJira(message) {
        const headers = message.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
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
        const searchText = `${subject} ${body}`;
        
        // Find JIRA tickets (BDC- or BM- format)
        const jiraPattern = /\b(BDC-|BM-)\d+\b/g;
        const tickets = searchText.match(jiraPattern) || [];
        
        return {
            tickets: [...new Set(tickets)],
            subject: subject,
            from: from.replace(/<.*>/, '').trim(),
            date: new Date(date).toLocaleDateString()
        };
    }

    displayJiraTickets() {
        if (this.discoveredJiraTickets.length === 0) {
            this.showJiraStatus('No JIRA tickets (BDC-* or BM-*) found in recent emails');
            return;
        }
        
        const ticketsList = document.getElementById('jiraTicketsList');
        const ticketsSection = document.getElementById('jiraTicketsSection');
        const ticketCount = document.getElementById('jiraTicketCount');
        
        ticketCount.textContent = this.discoveredJiraTickets.length;
        ticketsList.innerHTML = '';
        
        this.discoveredJiraTickets.forEach((ticketData, index) => {
            const ticketItem = document.createElement('div');
            ticketItem.className = 'jira-ticket-item';
            ticketItem.innerHTML = `
                <input type="checkbox" class="jira-ticket-checkbox" data-index="${index}">
                <div class="jira-ticket-info">
                    <div class="jira-ticket-number">${ticketData.ticket}</div>
                    <div class="jira-ticket-subject">${ticketData.subject}</div>
                    <div style="font-size: 0.8rem; color: #6c757d; margin-top: 0.25rem;">
                        From: ${ticketData.from} • ${ticketData.date}
                    </div>
                </div>
            `;
            ticketsList.appendChild(ticketItem);
        });
        
        ticketsSection.style.display = 'block';
    }

    toggleSelectAllJira() {
        const selectAll = document.getElementById('selectAllJiraTickets');
        const checkboxes = document.querySelectorAll('.jira-ticket-checkbox');
        
        checkboxes.forEach(cb => {
            cb.checked = selectAll.checked;
        });
    }

    addSelectedJiraTasks() {
        const checkboxes = document.querySelectorAll('.jira-ticket-checkbox:checked');
        
        if (checkboxes.length === 0) {
            alert('Please select at least one JIRA ticket to add');
            return;
        }
        
        // Prepare batch of tasks for database
        const tasksToAdd = [];
        
        checkboxes.forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            const ticketData = this.discoveredJiraTickets[index];
            
            // Prepare task data for database (duplicate resolution handled automatically)
            tasksToAdd.push({
                title: ticketData.subject.replace(/^(Re:|Fwd?:|\[.*?\])\s*/gi, '').trim(),
                source: 'jira',
                origin: 'jira',
                jiraTicket: ticketData.ticket,
                quadrant: 'uncategorized',
                priority: 'medium',
                syncOriginTimestamp: ticketData.date // Use email date as origin timestamp
            });
        });
        
        // Use database batch add with duplicate resolution
        const result = this.db.addTasksBatch(tasksToAdd);
        
        this.closeJiraModal();
        this.renderDashboard();
        this.updateStats();
        
        // Show results
        let message = `Added ${result.addedTasks.length} JIRA tasks to your Uncategorized bucket.`;
        if (result.resolvedDuplicates.length > 0) {
            message += `\n\nDuplicate tickets resolved: ${result.resolvedDuplicates.join(', ')}`;
        }
        message += '\n\nPlease categorize them into Q1/Q2/Q3/Q4.';
        
        alert(message);
        
        // Update sync metadata
        this.db.updateSyncMeta({
            lastJiraSync: new Date().toISOString(),
            lastSuccessfulSync: new Date().toISOString(),
            totalTasksProcessed: this.db.getSyncMeta().totalTasksProcessed + result.totalProcessed
        });
    }

    showJiraLoading(show) {
        const loading = document.getElementById('jiraLoadingSection');
        if (show) {
            loading.classList.add('active');
        } else {
            loading.classList.remove('active');
        }
    }

    showJiraStatus(message, type = 'info') {
        const statusDiv = document.getElementById('jiraStatusMessage');
        statusDiv.textContent = message;
        statusDiv.style.color = type === 'error' ? '#dc3545' : '#6c757d';
    }

    // Streamlined JIRA sync - No modal, direct processing
    async showJiraSync() {
        // Check if Google APIs are ready
        if (!this.gapiInited || !this.gisInited) {
            this.setProcessingState(false, 'Google APIs are still loading. Please try again in a moment.');
            return;
        }

        // Additional check for gapi availability
        if (typeof gapi === 'undefined' || typeof google === 'undefined') {
            this.setProcessingState(false, 'Google APIs not loaded. Please refresh the page.');
            return;
        }

        // Disable UI and show processing state
        this.setProcessingState(true, 'Connecting to Google...');

        try {
            // Use Google Identity Services for authentication
            await new Promise((resolve, reject) => {
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CONFIG.CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/gmail.readonly',
                    prompt: '', // Don't always prompt for consent
                    callback: (response) => {
                        if (response.error !== undefined) {
                            reject(new Error('Authentication failed: ' + response.error));
                            return;
                        }
                        // Set the access token for gapi client
                        gapi.client.setToken({access_token: response.access_token});
                        this.accessToken = response.access_token;
                        resolve(response);
                    },
                    error_callback: (error) => {
                        reject(new Error('Authentication error: ' + error.type));
                    }
                });

                this.setProcessingState(true, 'Please complete Google authentication...');
                
                // Add a slight delay to ensure DOM is ready
                setTimeout(() => {
                    try {
                        tokenClient.requestAccessToken({prompt: 'consent'});
                    } catch (error) {
                        reject(new Error('Failed to initiate authentication: ' + error.message));
                    }
                }, 100);
            });

            // Update sync metadata to track delta sync
            const syncTimeRange = this.db.calculateSyncTimeRange();
            this.setProcessingState(true, `Searching emails since ${syncTimeRange.toLocaleDateString()}...`);

            // Fetch and process Gmail messages
            await this.fetchJiraTicketsFromGmail();
            
            // Always update sync metadata - we performed a sync regardless of results
            const syncTime = new Date().toISOString();
            this.db.updateSyncMeta({
                lastJiraSync: syncTime,
                lastSuccessfulSync: syncTime
            });
            
            // If we found tickets, automatically add them
            if (this.discoveredJiraTickets.length > 0) {
                this.setProcessingState(true, 'Processing JIRA tickets...');
                const result = await this.autoAddAllJiraTickets();
                
                // Update task processing counts
                this.db.updateSyncMeta({
                    totalTasksProcessed: this.db.getSyncMeta().totalTasksProcessed + result.totalProcessed
                });
                
                // Show success message
                this.setProcessingState(false, `✅ Added ${result.addedTasks.length} JIRA tasks to Uncategorized bucket`);
            } else {
                this.setProcessingState(false, 'No new JIRA tickets found in recent emails');
            }
            
            // Update the last sync time display
            this.displayLastSyncTime();

        } catch (error) {
            console.error('JIRA sync error:', error);
            this.setProcessingState(false, 'Authentication failed. Please try again.');
        }
    }

    // Auto-add all discovered JIRA tickets with duplicate resolution
    async autoAddAllJiraTickets() {
        const tasksToAdd = this.discoveredJiraTickets.map(ticketData => ({
            title: ticketData.subject.replace(/^(Re:|Fwd?:|\[.*?\])\s*/gi, '').trim(),
            source: 'jira',
            origin: 'jira', 
            jiraTicket: ticketData.ticket,
            quadrant: 'uncategorized',
            priority: 'medium',
            syncOriginTimestamp: ticketData.date
        }));

        // Use database batch add with duplicate resolution
        const result = this.db.addTasksBatch(tasksToAdd);
        
        // Update UI
        this.renderDashboard();
        this.updateStats();

        // Note: Sync metadata is now updated in showJiraSync() for all syncs
        
        return result;
    }

    // Set processing state for UI - disable buttons and show status
    setProcessingState(isProcessing, message = '') {
        const syncButton = document.querySelector('[onclick="showJiraSync()"]');
        const allButtons = document.querySelectorAll('button, .nav-btn');
        const statusArea = document.getElementById('processingStatus') || this.createProcessingStatusArea();

        if (isProcessing) {
            // Disable all buttons
            allButtons.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
            });
            
            // Update sync button text and show spinner
            if (syncButton) {
                syncButton.innerHTML = `<span class="spinner"></span> ${message}`;
                syncButton.style.background = '#6c757d';
            }

            // Show status message
            statusArea.style.display = 'block';
            statusArea.textContent = message;
            statusArea.className = 'processing-status active';

        } else {
            // Re-enable all buttons
            allButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            });

            // Restore sync button with last sync time
            if (syncButton) {
                this.displayLastSyncTime(); // This will update the button text with sync time
                syncButton.style.background = '#17a2b8';
            }

            // Show final message briefly, then hide
            if (message) {
                statusArea.textContent = message;
                statusArea.className = message.includes('✅') ? 'processing-status success' : 'processing-status error';
                setTimeout(() => {
                    statusArea.style.display = 'none';
                }, 3000);
            } else {
                statusArea.style.display = 'none';
            }
        }
    }

    // Display last sync time
    displayLastSyncTime() {
        const syncMeta = this.db.getSyncMeta();
        const syncButton = document.querySelector('[onclick="showJiraSync()"]');
        
        if (!syncMeta || !syncMeta.lastJiraSync) {
            // Never synced
            this.updateSyncButtonText('📧 Sync JIRA from Gmail (Never synced)');
            return;
        }
        
        const lastSync = new Date(syncMeta.lastJiraSync);
        const now = new Date();
        const diffMs = now - lastSync;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        let timeAgo = '';
        if (diffMins < 1) {
            timeAgo = 'just now';
        } else if (diffMins < 60) {
            timeAgo = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else {
            timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        }
        
        // Update button text with last sync info
        this.updateSyncButtonText(`📧 Sync JIRA from Gmail (Last: ${timeAgo})`);
        
        // Also log to console for debugging
        console.log(`Last JIRA sync: ${lastSync.toLocaleString()} (${timeAgo})`);
        if (syncMeta.duplicatesResolved > 0) {
            console.log(`Total duplicates resolved: ${syncMeta.duplicatesResolved}`);
        }
        if (syncMeta.totalTasksProcessed > 0) {
            console.log(`Total tasks processed: ${syncMeta.totalTasksProcessed}`);
        }
    }
    
    // Update sync button text
    updateSyncButtonText(text) {
        const syncButton = document.querySelector('[onclick="showJiraSync()"]');
        if (syncButton && !syncButton.disabled) {
            syncButton.innerHTML = text;
        }
    }

    // Create processing status area if it doesn't exist
    createProcessingStatusArea() {
        let statusArea = document.getElementById('processingStatus');
        if (!statusArea) {
            statusArea = document.createElement('div');
            statusArea.id = 'processingStatus';
            statusArea.className = 'processing-status';
            
            // Insert after navigation - try multiple selectors
            const navigation = document.querySelector('.nav-buttons') || 
                             document.querySelector('.navigation') ||
                             document.querySelector('header') ||
                             document.body.firstElementChild;
            
            if (navigation && navigation.parentNode) {
                navigation.parentNode.insertBefore(statusArea, navigation.nextSibling);
            } else {
                // Fallback: add to body
                document.body.insertBefore(statusArea, document.body.firstChild);
            }
        }
        return statusArea;
    }

    closeJiraModal() {
        document.getElementById('jiraModal').classList.remove('active');
        
        // Reset modal state
        document.getElementById('jiraLoadingSection').classList.remove('active');
        document.getElementById('jiraTicketsSection').style.display = 'none';
        document.getElementById('selectAllJiraTickets').checked = false;
    }

    showBrainDump() {
        alert('Brain dump functionality coming soon! For now, use Add Task to manually add tasks.');
    }

    showArchive() {
        alert('Archive functionality coming soon!');
    }

    // Utility Functions
    getTasksByQuadrant(quadrant) {
        return this.db.getTasksByQuadrant(quadrant);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
}

// Initialize the application
const app = new PlanningBuddyApp();

// Global functions for HTML onclick handlers
window.showAddTask = () => app.showAddTask();
window.cancelAddTask = () => app.cancelAddTask();
window.saveTask = () => app.saveTask();
window.toggleCompletedTasks = () => app.toggleCompletedTasks();
window.startWeeklyPlanning = () => app.startWeeklyPlanning();
window.showJiraSync = () => app.showJiraSync();
window.showBrainDump = () => app.showBrainDump();
window.showArchive = () => app.showArchive();

// Utility function to check last sync details
window.checkLastSync = function() {
    const syncMeta = window.planningBuddyDB.getSyncMeta();
    if (!syncMeta || !syncMeta.lastJiraSync) {
        console.log('❌ JIRA has never been synced with Gmail');
        return;
    }
    
    const lastSync = new Date(syncMeta.lastJiraSync);
    const now = new Date();
    const diffMs = now - lastSync;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    console.log('📧 JIRA Sync Details:');
    console.log('====================');
    console.log(`Last Sync: ${lastSync.toLocaleString()}`);
    
    if (diffMins < 60) {
        console.log(`Time Ago: ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`);
    } else if (diffHours < 24) {
        console.log(`Time Ago: ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`);
    } else {
        console.log(`Time Ago: ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`);
    }
    
    console.log(`Total Tasks Processed: ${syncMeta.totalTasksProcessed || 0}`);
    console.log(`Duplicates Resolved: ${syncMeta.duplicatesResolved || 0}`);
    
    if (syncMeta.lastSyncError) {
        console.log(`⚠️ Last Error: ${syncMeta.lastSyncError}`);
    }
    
    // Next sync will look back to
    const nextSyncRange = window.planningBuddyDB.calculateSyncTimeRange();
    console.log(`Next sync will check emails from: ${nextSyncRange.toLocaleDateString()}`);
    
    return syncMeta;
};