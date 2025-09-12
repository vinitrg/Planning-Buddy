// Sample data for development and testing
function loadSampleData() {
    const sampleTasks = [
        // Uncategorized tasks
        {
            id: 'task_001',
            title: 'Review Q3 roadmap presentation',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'uncategorized',
            priority: 'medium',
            status: 'active',
            dateCreated: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_002',
            title: 'Update API documentation',
            source: 'jira',
            jiraTicket: 'BDC-456',
            quadrant: 'uncategorized',
            priority: 'medium',
            status: 'active',
            dateCreated: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_003',
            title: 'Investigate customer churn metrics',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'uncategorized',
            priority: 'medium',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },

        // Q1 tasks (Urgent + Important)
        {
            id: 'task_004',
            title: 'Fix production bug',
            source: 'jira',
            jiraTicket: 'BDC-123',
            quadrant: 'q1',
            priority: 'high',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_005',
            title: 'Prepare emergency hotfix release',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q1',
            priority: 'high',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_006',
            title: 'Review critical PR before EOD',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q1',
            priority: 'medium',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },

        // Q2 tasks (Important, Not Urgent)
        {
            id: 'task_007',
            title: 'Design new architecture for Q4',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q2',
            priority: 'high',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_008',
            title: 'Research new ML framework',
            source: 'jira',
            jiraTicket: 'BM-789',
            quadrant: 'q2',
            priority: 'medium',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_009',
            title: 'Create team training plan',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q2',
            priority: 'medium',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_010',
            title: 'Implement caching strategy',
            source: 'jira',
            jiraTicket: 'BDC-567',
            quadrant: 'q2',
            priority: 'medium',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_011',
            title: 'Write technical blog post',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q2',
            priority: 'low',
            status: 'completed',
            dateCreated: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
            dateCompleted: new Date().toISOString(),
            dateArchived: null
        },

        // Q3 tasks (Urgent, Not Important)
        {
            id: 'task_012',
            title: 'Respond to vendor emails',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q3',
            priority: 'low',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },
        {
            id: 'task_013',
            title: 'Schedule routine sync meeting',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q3',
            priority: 'low',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        },

        // Q4 tasks (Neither)
        {
            id: 'task_014',
            title: 'Organize old documentation',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q4',
            priority: 'low',
            status: 'active',
            dateCreated: new Date().toISOString(),
            dateCompleted: null,
            dateArchived: null
        }
    ];

    const sampleArchivedTasks = [
        {
            id: 'archived_001',
            title: 'Complete onboarding documentation',
            source: 'braindump',
            jiraTicket: '',
            quadrant: 'q2',
            priority: 'medium',
            status: 'completed',
            dateCreated: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
            dateCompleted: new Date(Date.now() - 518400000).toISOString(), // 6 days ago
            dateArchived: new Date(Date.now() - 432000000).toISOString()  // 5 days ago
        }
    ];

    // Save to localStorage
    localStorage.setItem('planningBuddy_tasks', JSON.stringify(sampleTasks));
    localStorage.setItem('planningBuddy_archived', JSON.stringify(sampleArchivedTasks));
    localStorage.setItem('planningBuddy_q2Count', '5'); // Some completed Q2 tasks
    
    alert('Sample data loaded! Refresh the page to see it.');
}

function clearAllData() {
    if (confirm('This will delete all your tasks and data. Are you sure?')) {
        localStorage.removeItem('planningBuddy_tasks');
        localStorage.removeItem('planningBuddy_archived');
        localStorage.removeItem('planningBuddy_q2Count');
        alert('All data cleared! Refresh the page.');
    }
}

// Add buttons to load/clear sample data (for development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    document.addEventListener('DOMContentLoaded', function() {
        const devControls = document.createElement('div');
        devControls.style.cssText = 'position: fixed; bottom: 10px; left: 10px; z-index: 1000; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-size: 12px;';
        devControls.innerHTML = `
            <strong>Dev Controls:</strong><br>
            <button onclick="loadSampleData()" style="margin: 2px; padding: 4px 8px; font-size: 11px;">Load Sample Data</button>
            <button onclick="clearAllData()" style="margin: 2px; padding: 4px 8px; font-size: 11px;">Clear All Data</button>
        `;
        document.body.appendChild(devControls);
    });
}

// Make functions global
window.loadSampleData = loadSampleData;
window.clearAllData = clearAllData;