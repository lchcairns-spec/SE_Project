const API_BASE = 'http://localhost:3000/api';

// State management
let currentUser = null;
let authToken = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Check if user is already logged in
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (token) {
        authToken = token;
        fetchUserInfo();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab) {
            btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
        }
    });

    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('createPollForm').addEventListener('submit', handleCreatePoll);

    // Buttons
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('create-poll-btn')?.addEventListener('click', () => openModal('create-poll-modal'));
    document.getElementById('create-poll-btn-creator')?.addEventListener('click', () => openModal('create-poll-modal'));
    document.getElementById('admin-panel-btn')?.addEventListener('click', () => openAdminPanel());
    document.getElementById('my-polls-btn')?.addEventListener('click', () => openMyPolls());

    // Modal close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// Switch auth tabs
function switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });

    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
}

// API helper
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        throw error;
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const twoFactorToken = document.getElementById('2fa-token').value;

    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');

    try {
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, twoFactorToken })
        });

        if (data.requires2FA) {
            document.getElementById('2fa-group').style.display = 'block';
            errorDiv.textContent = '2FA token required';
            errorDiv.classList.add('show');
            return;
        }

        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        currentUser = data.user;

        showMainContent();
        loadPolls();
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

// Handle register
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    const errorDiv = document.getElementById('register-error');
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');

    try {
        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        errorDiv.textContent = 'Registration successful! Please login.';
        errorDiv.classList.add('show');
        errorDiv.style.color = '#28a745';
        switchAuthTab('login');
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

// Fetch user info
async function fetchUserInfo() {
    try {
        const user = await apiCall('/auth/me');
        currentUser = user;
        showMainContent();
        loadPolls();
    } catch (error) {
        localStorage.removeItem('authToken');
        authToken = null;
    }
}

// Show main content
function showMainContent() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-section').style.display = 'block';
    document.getElementById('logout-btn').style.display = 'block';
    document.getElementById('user-info').textContent = `${currentUser.email} (${currentUser.role})`;

    // Show role-specific buttons
    if (currentUser.role === 'poll_admin') {
        document.getElementById('admin-actions').style.display = 'flex';
    } else if (currentUser.role === 'vote_creator') {
        document.getElementById('creator-actions').style.display = 'flex';
    }
}

// Handle logout
function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('main-section').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('admin-actions').style.display = 'none';
    document.getElementById('creator-actions').style.display = 'none';
}

// Load polls
async function loadPolls() {
    try {
        const polls = await apiCall('/polls/available');
        displayPolls(polls);
    } catch (error) {
        console.error('Failed to load polls:', error);
    }
}

// Display polls
function displayPolls(polls) {
    const container = document.getElementById('polls-list');
    
    if (!polls || polls.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No available polls at the moment.</p>';
        return;
    }

    container.innerHTML = polls.map(poll => `
        <div class="poll-card" onclick="viewPoll(${poll.id})">
            <h3>${poll.title}</h3>
            <p>${poll.description || 'No description'}</p>
            <div class="poll-meta">
                <span class="poll-status ${poll.status}">${poll.status}</span>
                <span>${poll.vote_count || 0} votes</span>
            </div>
        </div>
    `).join('');
}

// View poll details
async function viewPoll(pollId) {
    try {
        const poll = await apiCall(`/polls/${pollId}`);
        displayPollDetails(poll);
        openModal('poll-modal');
    } catch (error) {
        alert('Failed to load poll details: ' + error.message);
    }
}

// Display poll details
function displayPollDetails(poll) {
    const container = document.getElementById('poll-details');
    
    let html = `
        <h2>${poll.title}</h2>
        <p>${poll.description || ''}</p>
        <p><strong>Status:</strong> <span class="poll-status ${poll.status}">${poll.status}</span></p>
    `;

    if (poll.status === 'active' && !poll.hasVoted) {
        html += `
            <div class="vote-options">
                <h3>Select your choice${poll.poll_type === 'multiple' ? 's' : ''}:</h3>
                <form id="voteForm">
                    ${poll.options.map(opt => `
                        <label class="vote-option">
                            <input type="${poll.poll_type === 'single' ? 'radio' : 'checkbox'}" 
                                   name="vote" value="${opt.id}">
                            ${opt.option_text}
                        </label>
                    `).join('')}
                    <button type="submit" class="btn btn-primary" style="margin-top: 20px;">Submit Vote</button>
                </form>
            </div>
        `;

        container.innerHTML = html;
        document.getElementById('voteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            castVote(poll.id, poll.poll_type);
        });
    } else if (poll.hasVoted) {
        html += '<p class="success-message">You have already voted in this poll.</p>';
        html += '<button onclick="viewResults(' + poll.id + ')" class="btn btn-secondary">View Results</button>';
        container.innerHTML = html;
    } else {
        html += '<p>This poll is not currently active.</p>';
        container.innerHTML = html;
    }
}

// Cast vote
async function castVote(pollId, pollType) {
    const form = document.getElementById('voteForm');
    const selected = Array.from(form.querySelectorAll('input:checked')).map(input => parseInt(input.value));

    if (selected.length === 0) {
        alert('Please select at least one option');
        return;
    }

    try {
        const result = await apiCall('/votes/cast', {
            method: 'POST',
            body: JSON.stringify({
                pollId,
                selectedOptions: selected
            })
        });

        alert(`Vote cast successfully! Receipt ID: ${result.receiptId}`);
        document.getElementById('poll-modal').style.display = 'none';
        loadPolls();
    } catch (error) {
        alert('Failed to cast vote: ' + error.message);
    }
}

// View results
async function viewResults(pollId) {
    try {
        const results = await apiCall(`/votes/results/${pollId}`);
        displayResults(results);
    } catch (error) {
        alert('Failed to load results: ' + error.message);
    }
}

// Display results
function displayResults(results) {
    const container = document.getElementById('poll-details');
    const maxVotes = Math.max(...results.results.map(r => r.vote_count || 0), 1);

    let html = `
        <h2>Poll Results</h2>
        <p><strong>Total Votes:</strong> ${results.totalVotes}</p>
        <div class="results-container">
            ${results.results.map(result => {
                const percentage = results.totalVotes > 0 
                    ? ((result.vote_count || 0) / results.totalVotes * 100).toFixed(1) 
                    : 0;
                const width = (result.vote_count || 0) / maxVotes * 100;
                return `
                    <div class="result-item">
                        <strong>${result.option_text}</strong>
                        <div class="result-bar" style="width: ${width}%">
                            ${result.vote_count || 0} votes (${percentage}%)
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    container.innerHTML = html;
}

// Create poll
async function handleCreatePoll(e) {
    e.preventDefault();
    const title = document.getElementById('poll-title').value;
    const description = document.getElementById('poll-description').value;
    const pollType = document.getElementById('poll-type').value;
    const allowRevote = document.getElementById('allow-revote').checked;
    const startDate = document.getElementById('poll-start').value;
    const endDate = document.getElementById('poll-end').value;
    const optionsText = document.getElementById('poll-options').value;
    const options = optionsText.split('\n').filter(opt => opt.trim()).map(opt => opt.trim());

    if (options.length < 2) {
        document.getElementById('create-poll-error').textContent = 'At least 2 options required';
        document.getElementById('create-poll-error').classList.add('show');
        return;
    }

    try {
        await apiCall('/polls', {
            method: 'POST',
            body: JSON.stringify({
                title,
                description,
                poll_type: pollType,
                allow_revote: allowRevote,
                start_date: startDate || null,
                end_date: endDate || null,
                options
            })
        });

        alert('Poll created successfully!');
        document.getElementById('create-poll-modal').style.display = 'none';
        document.getElementById('createPollForm').reset();
        // Reload polls list
        setTimeout(() => {
            loadPolls();
        }, 100);
    } catch (error) {
        document.getElementById('create-poll-error').textContent = error.message;
        document.getElementById('create-poll-error').classList.add('show');
    }
}

// Open modal
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

// Open admin panel
async function openAdminPanel() {
    openModal('admin-modal');
    switchAdminTab('statistics');
    loadAdminStatistics();
}

// Switch admin tab
function switchAdminTab(tab) {
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.admin-content-section').forEach(section => {
        section.classList.remove('active');
    });

    const tabButton = document.querySelector(`[data-admin-tab="${tab}"]`);
    const contentSection = document.getElementById(`admin-${tab}`);
    
    if (tabButton) tabButton.classList.add('active');
    if (contentSection) contentSection.classList.add('active');

    // Load tab content
    if (tab === 'statistics') loadAdminStatistics();
    else if (tab === 'polls') loadAdminPolls();
    else if (tab === 'users') loadAdminUsers();
    else if (tab === 'audit') loadAuditLogs();
}

// Load admin statistics
async function loadAdminStatistics() {
    try {
        const stats = await apiCall('/admin/statistics');
        const container = document.getElementById('admin-statistics') || createAdminSection('statistics');
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>${stats.totalUsers}</h3>
                    <p>Total Users</p>
                </div>
                <div class="stat-card">
                    <h3>${stats.totalPolls}</h3>
                    <p>Total Polls</p>
                </div>
                <div class="stat-card">
                    <h3>${stats.totalVotes}</h3>
                    <p>Total Votes</p>
                </div>
                <div class="stat-card">
                    <h3>${stats.activePolls}</h3>
                    <p>Active Polls</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

// Create admin section if doesn't exist
function createAdminSection(id) {
    const container = document.getElementById('admin-content');
    const section = document.createElement('div');
    section.id = `admin-${id}`;
    section.className = 'admin-content-section';
    container.appendChild(section);
    return section;
}

// Load admin polls
async function loadAdminPolls() {
    try {
        const polls = await apiCall('/admin/polls');
        const container = document.getElementById('admin-polls') || createAdminSection('polls');
        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Creator</th>
                        <th>Status</th>
                        <th>Votes</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${polls.map(poll => `
                        <tr>
                            <td>${poll.id}</td>
                            <td>${poll.title}</td>
                            <td>${poll.creator_email}</td>
                            <td><span class="poll-status ${poll.status}">${poll.status}</span></td>
                            <td>${poll.vote_count || 0}</td>
                            <td>
                                <button onclick="changePollStatus(${poll.id}, '${poll.status === 'active' ? 'closed' : 'active'}')" 
                                        class="btn btn-small ${poll.status === 'active' ? 'btn-danger' : 'btn-success'}">
                                    ${poll.status === 'active' ? 'Close' : 'Activate'}
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Failed to load polls:', error);
    }
}

// Change poll status
async function changePollStatus(pollId, status) {
    try {
        await apiCall(`/admin/polls/${pollId}/status`, {
            method: 'POST',
            body: JSON.stringify({ status })
        });
        loadAdminPolls();
        loadPolls();
    } catch (error) {
        alert('Failed to change poll status: ' + error.message);
    }
}

// Load admin users
async function loadAdminUsers() {
    try {
        const users = await apiCall('/admin/users');
        const container = document.getElementById('admin-users') || createAdminSection('users');
        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>${user.email}</td>
                            <td>${user.role}</td>
                            <td>${new Date(user.created_at).toLocaleDateString()}</td>
                            <td>
                                <select onchange="changeUserRole(${user.id}, this.value)">
                                    <option value="voter" ${user.role === 'voter' ? 'selected' : ''}>Voter</option>
                                    <option value="vote_creator" ${user.role === 'vote_creator' ? 'selected' : ''}>Vote Creator</option>
                                    <option value="poll_admin" ${user.role === 'poll_admin' ? 'selected' : ''}>Poll Admin</option>
                                </select>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Change user role
async function changeUserRole(userId, role) {
    try {
        await apiCall(`/admin/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });
        alert('User role updated successfully');
    } catch (error) {
        alert('Failed to update user role: ' + error.message);
    }
}

// Load audit logs
async function loadAuditLogs() {
    try {
        const logs = await apiCall('/admin/audit-logs');
        const container = document.getElementById('admin-audit') || createAdminSection('audit');
        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>User ID</th>
                        <th>Action</th>
                        <th>Resource</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td>${new Date(log.created_at).toLocaleString()}</td>
                            <td>${log.user_id || 'N/A'}</td>
                            <td>${log.action}</td>
                            <td>${log.resource_type || 'N/A'}</td>
                            <td>${log.details || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Failed to load audit logs:', error);
    }
}

// Open my polls
async function openMyPolls() {
    openModal('my-polls-modal');
    try {
        const polls = await apiCall('/polls/my/polls');
        const container = document.getElementById('my-polls-list');
        container.innerHTML = polls.map(poll => `
            <div class="poll-card" onclick="viewPoll(${poll.id})">
                <h3>${poll.title}</h3>
                <p>${poll.description || 'No description'}</p>
                <div class="poll-meta">
                    <span class="poll-status ${poll.status}">${poll.status}</span>
                    <span>${poll.vote_count || 0} votes</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load my polls:', error);
    }
}

// Setup admin tab listeners
document.addEventListener('DOMContentLoaded', () => {
    // Setup admin tab listeners when DOM is ready
    setTimeout(() => {
        const adminTabs = document.querySelectorAll('[data-admin-tab]');
        adminTabs.forEach(btn => {
            btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab));
        });
    }, 100);
});

// Make functions global for onclick handlers
window.viewPoll = viewPoll;
window.viewResults = viewResults;
window.changePollStatus = changePollStatus;
window.changeUserRole = changeUserRole;

