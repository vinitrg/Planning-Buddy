// Planning Buddy - Core Application Logic

class PlanningBuddyApp {
    constructor() {
        this.tasks = [];
        this.archivedTasks = [];
        this.q2CompletedCount = 0;
        this.hideCompleted = true;
        
        // Gmail/JIRA sync properties
        this.gapiInited = false;
        this.gisInited = false;
        this.accessToken = null;
        this.discoveredJiraTickets = [];
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderDashboard();
        this.updateStats();
        this.checkWeeklyPlanning();
    }

    // Data Management
    loadData() {
        const savedTasks = localStorage.getItem('planningBuddy_tasks');
        const savedArchived = localStorage.getItem('planningBuddy_archived');
        const savedQ2Count = localStorage.getItem('planningBuddy_q2Count');
        
        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
        }
        if (savedArchived) {
            this.archivedTasks = JSON.parse(savedArchived);
        }
        if (savedQ2Count) {
            this.q2CompletedCount = parseInt(savedQ2Count);
        }
    }

    saveData() {
        localStorage.setItem('planningBuddy_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('planningBuddy_archived', JSON.stringify(this.archivedTasks));
        localStorage.setItem('planningBuddy_q2Count', this.q2CompletedCount.toString());
    }

    // Task Management
    createTask(title, source = 'manual', jiraTicket = '', quadrant = 'uncategorized', priority = 'medium') {
        const task = {
            id: this.generateId(),
            title: title.trim(),
            source: source,
            jiraTicket: jiraTicket,
            quadrant: quadrant,
            priority: priority,
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        };
        
        this.tasks.push(task);
        this.saveData();
        this.renderDashboard();
        this.updateStats();
        
        return task;
    }

    updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
            this.saveData();
            this.renderDashboard();
            this.updateStats();
        }
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveData();
        this.renderDashboard();
        this.updateStats();
    }

    completeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'completed';
            task.dateCompleted = new Date().toISOString();
            
            // Track Q2 completions
            if (task.quadrant === 'q2') {
                this.q2CompletedCount++;
            }
            
            this.saveData();
            this.renderDashboard();
            this.updateStats();
            this.updateQ2Counter();
            
            this.showCompletionMessage(task);
        }
    }

    archiveTask(taskId) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = this.tasks[taskIndex];
            task.dateArchived = new Date().toISOString();
            
            this.archivedTasks.push(task);
            this.tasks.splice(taskIndex, 1);
            
            this.saveData();
            this.renderDashboard();
            this.updateStats();
        }
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
        const activeTasks = this.tasks.filter(t => t.status === 'active');
        const total = activeTasks.length;
        
        if (total === 0) {
            document.getElementById('q1Percent').textContent = '0';
            document.getElementById('q2Percent').textContent = '0';
            document.getElementById('q3Percent').textContent = '0';
            document.getElementById('q4Percent').textContent = '0';
            document.getElementById('q1Warning').style.display = 'none';
            return;
        }
        
        const counts = {
            q1: activeTasks.filter(t => t.quadrant === 'q1').length,
            q2: activeTasks.filter(t => t.quadrant === 'q2').length,
            q3: activeTasks.filter(t => t.quadrant === 'q3').length,
            q4: activeTasks.filter(t => t.quadrant === 'q4').length
        };
        
        const percentages = {
            q1: Math.round((counts.q1 / total) * 100),
            q2: Math.round((counts.q2 / total) * 100),
            q3: Math.round((counts.q3 / total) * 100),
            q4: Math.round((counts.q4 / total) * 100)
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
        
        // Update task stats
        const completedToday = this.tasks.filter(t => 
            t.status === 'completed' && 
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
        
        counter.textContent = `${this.q2CompletedCount}/20`;
        
        const remaining = 20 - this.q2CompletedCount;
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
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
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
        this.showJiraLoading(true);
        this.showJiraStatus('');
        
        try {
            gapi.client.setToken({access_token: this.accessToken});
            
            // Calculate date 7 days ago
            const date = new Date();
            date.setDate(date.getDate() - 7);
            const after = date.toISOString().split('T')[0];
            
            const response = await gapi.client.gmail.users.messages.list({
                'userId': 'me',
                'q': `after:${after}`,
                'maxResults': 100
            });
            
            if (!response.result.messages) {
                this.showJiraLoading(false);
                this.showJiraStatus('No emails found in the last 7 days');
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
            this.showJiraLoading(false);
            this.displayJiraTickets();
            
        } catch (error) {
            this.showJiraLoading(false);
            this.showJiraStatus('Error fetching emails: ' + error.message, 'error');
            console.error('Gmail API Error:', error);
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
        
        let addedCount = 0;
        
        checkboxes.forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            const ticketData = this.discoveredJiraTickets[index];
            
            // Check if this ticket is already in tasks
            const existingTask = this.tasks.find(t => t.jiraTicket === ticketData.ticket);
            if (existingTask) {
                console.log(`Task for ${ticketData.ticket} already exists, skipping`);
                return;
            }
            
            // Create task from JIRA ticket
            this.createTask(
                ticketData.subject.replace(/^(Re:|Fwd?:|\[.*?\])\s*/gi, '').trim(),
                'jira',
                ticketData.ticket,
                'uncategorized',
                'medium'
            );
            
            addedCount++;
        });
        
        this.closeJiraModal();
        
        if (addedCount > 0) {
            alert(`Added ${addedCount} JIRA tasks to your Uncategorized bucket. Please categorize them into Q1/Q2/Q3/Q4.`);
        }
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

    // Navigation and Modal Management
    showJiraSync() {
        document.getElementById('jiraModal').classList.add('active');
        this.maybeEnableJiraSync();
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
        return this.tasks.filter(t => t.quadrant === quadrant);
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