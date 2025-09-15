// Planning Buddy Database Layer - localStorage Implementation
// Updated: 2024-12-13 - Fixed editTask integration
class PlanningBuddyDB {
    constructor() {
        this.STORAGE_KEYS = {
            TASKS: 'planningBuddy_tasks',
            ARCHIVED: 'planningBuddy_archived', 
            SYNC_META: 'planningBuddy_syncMeta',
            USER_PROFILE: 'planningBuddy_userProfile',
            STATS: 'planningBuddy_stats',
            Q2_COUNT: 'planningBuddy_q2Count',
            CONFIG: 'planningBuddy_config'
        };
        
        this.initializeDatabase();
    }

    // Initialize database with default values
    initializeDatabase() {
        // Initialize sync metadata if not exists
        if (!this.getSyncMeta()) {
            this.setSyncMeta({
                lastJiraSync: null,
                lastSuccessfulSync: null,
                syncInProgress: false,
                lastSyncError: null,
                failedSyncAttempts: 0,
                initialSyncDays: 7,
                safetyNetHours: 24,
                statsLastCalculated: null,
                totalTasksProcessed: 0,
                duplicatesResolved: 0
            });
        }

        // Initialize empty arrays if not exists
        if (!this.getTasks()) {
            this.setTasks([]);
        }
        
        if (!this.getArchivedTasks()) {
            this.setArchivedTasks([]);
        }

        // Initialize Q2 counter
        if (!localStorage.getItem(this.STORAGE_KEYS.Q2_COUNT)) {
            localStorage.setItem(this.STORAGE_KEYS.Q2_COUNT, '0');
        }
    }

    // Task CRUD Operations
    getTasks() {
        const tasks = localStorage.getItem(this.STORAGE_KEYS.TASKS);
        return tasks ? JSON.parse(tasks) : [];
    }

    setTasks(tasks) {
        localStorage.setItem(this.STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }

    addTask(taskData) {
        const task = this.createTaskObject(taskData);
        const tasks = this.getTasks();
        tasks.push(task);
        this.setTasks(tasks);
        return task;
    }

    updateTask(taskId, updates) {
        const tasks = this.getTasks();
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
            tasks[taskIndex] = {
                ...tasks[taskIndex],
                ...updates,
                dateUpdated: new Date().toISOString()
            };
            this.setTasks(tasks);
            return tasks[taskIndex];
        }
        return null;
    }

    deleteTask(taskId) {
        const tasks = this.getTasks();
        const filteredTasks = tasks.filter(t => t.id !== taskId);
        this.setTasks(filteredTasks);
        return filteredTasks.length !== tasks.length;
    }

    getTaskById(taskId) {
        const tasks = this.getTasks();
        return tasks.find(t => t.id === taskId) || null;
    }

    getTasksByQuadrant(quadrant) {
        const tasks = this.getTasks();
        return tasks.filter(t => t.quadrant === quadrant);
    }

    // Task Factory - Creates standardized task objects
    createTaskObject(data) {
        const now = new Date().toISOString();
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
            id: taskId,
            title: data.title || 'Untitled Task',
            
            // Origin & Source
            origin: data.origin || 'manual',
            source: data.source || 'manual',
            jiraTicket: data.jiraTicket || '',
            jiraUrl: data.jiraTicket ? `https://procoretech.atlassian.net/browse/${data.jiraTicket}` : '',
            
            // Categorization
            quadrant: data.quadrant || 'uncategorized',
            priority: data.priority || 'medium',
            status: data.status || 'active',
            
            // Timestamps
            dateCreated: data.dateCreated || now,
            dateUpdated: now,
            dateCompleted: data.dateCompleted || null,
            dateArchived: data.dateArchived || null,
            
            // Sync metadata
            syncOriginTimestamp: data.syncOriginTimestamp || now,
            lastSyncedAt: data.lastSyncedAt || now,
            syncVersion: data.syncVersion || 1
        };
    }

    // Archive Operations
    getArchivedTasks() {
        const archived = localStorage.getItem(this.STORAGE_KEYS.ARCHIVED);
        return archived ? JSON.parse(archived) : [];
    }

    setArchivedTasks(archivedTasks) {
        localStorage.setItem(this.STORAGE_KEYS.ARCHIVED, JSON.stringify(archivedTasks));
    }

    archiveTask(taskId, reason = 'manual') {
        const task = this.getTaskById(taskId);
        if (!task) return false;

        const now = new Date().toISOString();
        const archivedTask = {
            ...task,
            dateArchived: now,
            archiveDate: now,
            archiveReason: reason,
            originalQuadrant: task.quadrant,
            
            // Calculate time in quadrant
            timeInQuadrant: task.dateUpdated ? 
                new Date(now).getTime() - new Date(task.dateUpdated).getTime() : 0,
            
            // Simple quadrant history for now
            quadrantHistory: [
                { quadrant: task.quadrant, timestamp: task.dateUpdated || task.dateCreated }
            ]
        };

        // Add to archive
        const archived = this.getArchivedTasks();
        archived.push(archivedTask);
        this.setArchivedTasks(archived);

        // Remove from active tasks
        this.deleteTask(taskId);

        return true;
    }

    // Duplicate Resolution
    findDuplicates(newTask) {
        const existingTasks = this.getTasks();
        return existingTasks.filter(task => {
            // Check for JIRA ticket duplicates
            if (newTask.jiraTicket && task.jiraTicket === newTask.jiraTicket) {
                return true;
            }
            // Could add other duplicate detection logic here
            return false;
        });
    }

    resolveDuplicate(newTask) {
        const duplicates = this.findDuplicates(newTask);
        let resolvedCount = 0;

        duplicates.forEach(existingTask => {
            const newTimestamp = new Date(newTask.syncOriginTimestamp).getTime();
            const existingTimestamp = new Date(existingTask.syncOriginTimestamp).getTime();

            // Keep newer version, remove older
            if (newTimestamp > existingTimestamp) {
                this.deleteTask(existingTask.id);
                resolvedCount++;
            }
        });

        // Add new task to uncategorized if we removed duplicates
        if (resolvedCount > 0) {
            const taskToAdd = { ...newTask, quadrant: 'uncategorized' };
            return this.addTask(taskToAdd);
        }

        // No duplicates found or existing is newer
        return null;
    }

    // Sync Operations
    getSyncMeta() {
        const meta = localStorage.getItem(this.STORAGE_KEYS.SYNC_META);
        return meta ? JSON.parse(meta) : null;
    }

    setSyncMeta(metadata) {
        localStorage.setItem(this.STORAGE_KEYS.SYNC_META, JSON.stringify(metadata));
    }

    updateSyncMeta(updates) {
        const current = this.getSyncMeta() || {};
        const updated = { ...current, ...updates };
        this.setSyncMeta(updated);
        return updated;
    }

    // Calculate sync time range based on delta sync strategy
    calculateSyncTimeRange() {
        const syncMeta = this.getSyncMeta();
        const now = new Date();
        const safetyNetMs = syncMeta.safetyNetHours * 60 * 60 * 1000; // 24h default
        const safetyNet = new Date(now.getTime() - safetyNetMs);

        if (!syncMeta.lastJiraSync) {
            // First sync: go back initial sync days
            const initialSyncMs = syncMeta.initialSyncDays * 24 * 60 * 60 * 1000; // 7 days default
            return new Date(now.getTime() - initialSyncMs);
        }

        const lastSyncDate = new Date(syncMeta.lastJiraSync);
        
        // Use earlier of lastSync or safetyNet
        return lastSyncDate < safetyNet ? lastSyncDate : safetyNet;
    }

    // Batch operations for sync
    addTasksBatch(tasksArray) {
        const addedTasks = [];
        const resolvedDuplicates = [];

        tasksArray.forEach(taskData => {
            // Check for duplicates first
            const resolvedTask = this.resolveDuplicate(taskData);
            if (resolvedTask) {
                addedTasks.push(resolvedTask);
                resolvedDuplicates.push(taskData.jiraTicket || taskData.title);
            } else {
                // No duplicates, add normally
                const duplicates = this.findDuplicates(taskData);
                if (duplicates.length === 0) {
                    const newTask = this.addTask(taskData);
                    addedTasks.push(newTask);
                }
            }
        });

        // Update sync metadata
        if (resolvedDuplicates.length > 0) {
            const syncMeta = this.getSyncMeta();
            this.updateSyncMeta({
                duplicatesResolved: syncMeta.duplicatesResolved + resolvedDuplicates.length
            });
        }

        return {
            addedTasks,
            resolvedDuplicates,
            totalProcessed: tasksArray.length
        };
    }

    // Q2 Counter Operations
    getQ2Count() {
        return parseInt(localStorage.getItem(this.STORAGE_KEYS.Q2_COUNT) || '0');
    }

    incrementQ2Count() {
        const current = this.getQ2Count();
        const newCount = current + 1;
        localStorage.setItem(this.STORAGE_KEYS.Q2_COUNT, newCount.toString());
        return newCount;
    }

    resetQ2Count() {
        localStorage.setItem(this.STORAGE_KEYS.Q2_COUNT, '0');
        return 0;
    }

    // Statistics and Analytics
    calculateStats() {
        const tasks = this.getTasks();
        const archived = this.getArchivedTasks();
        const now = new Date().toISOString();

        const stats = {
            calculatedAt: now,
            activeTasks: {
                total: tasks.length,
                uncategorized: tasks.filter(t => t.quadrant === 'uncategorized').length,
                q1: tasks.filter(t => t.quadrant === 'q1').length,
                q2: tasks.filter(t => t.quadrant === 'q2').length,
                q3: tasks.filter(t => t.quadrant === 'q3').length,
                q4: tasks.filter(t => t.quadrant === 'q4').length
            },
            completed: {
                total: archived.length,
                thisWeek: archived.filter(t => {
                    const archiveDate = new Date(t.dateArchived);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return archiveDate > weekAgo;
                }).length
            },
            q2Progress: {
                count: this.getQ2Count(),
                sandwichesEarned: Math.floor(this.getQ2Count() / 20),
                progressToNext: this.getQ2Count() % 20
            }
        };

        localStorage.setItem(this.STORAGE_KEYS.STATS, JSON.stringify(stats));
        this.updateSyncMeta({ statsLastCalculated: now });
        
        return stats;
    }

    getStats() {
        const stats = localStorage.getItem(this.STORAGE_KEYS.STATS);
        return stats ? JSON.parse(stats) : this.calculateStats();
    }

    // Utility Methods
    clearAllData() {
        Object.values(this.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.initializeDatabase();
    }

    exportData() {
        const data = {};
        Object.entries(this.STORAGE_KEYS).forEach(([name, key]) => {
            const value = localStorage.getItem(key);
            data[name] = value ? JSON.parse(value) : null;
        });
        return data;
    }

    importData(data) {
        Object.entries(data).forEach(([name, value]) => {
            if (value !== null && this.STORAGE_KEYS[name]) {
                localStorage.setItem(this.STORAGE_KEYS[name], JSON.stringify(value));
            }
        });
    }
}

// Create global instance
window.planningBuddyDB = new PlanningBuddyDB();

// Make it available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlanningBuddyDB;
}