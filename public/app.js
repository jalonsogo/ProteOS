// WhaleOS Desktop Application
class WhaleOS {
    constructor() {
        this.containers = new Map();
        this.windows = new Map();
        this.zIndexCounter = 100;
        this.logs = [];
        this.currentLogFilter = 'all';
        this.autoScroll = true;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateClock();
        this.loadContainers();
        setInterval(() => this.updateClock(), 1000);
        setInterval(() => this.updateContainerCount(), 5000);
    }

    setupEventListeners() {
        // Container icons - create new container (support both click and double-click)
        const containerIcons = document.querySelectorAll('.desktop-icon[data-container-type]');

        containerIcons.forEach(icon => {
            let clickTimer = null;
            const containerType = icon.dataset.containerType;

            icon.addEventListener('click', () => {
                if (clickTimer === null) {
                    clickTimer = setTimeout(() => {
                        clickTimer = null;
                        this.createContainer(containerType);
                    }, 300);
                } else {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                    this.createContainer(containerType);
                }
            });
        });

        // Files icon
        document.getElementById('files-icon').addEventListener('click', () => {
            this.showFileBrowser();
        });

        // About icon
        document.getElementById('about-icon').addEventListener('click', () => {
            this.showAboutModal();
        });

        // Logs icon
        document.getElementById('logs-icon').addEventListener('click', () => {
            this.showLogViewer();
        });

        // Menu items
        document.getElementById('folders-menu')?.addEventListener('click', () => {
            this.showFileBrowser();
        });

        document.getElementById('help-menu')?.addEventListener('click', () => {
            this.showAboutModal();
        });

        document.getElementById('bugs-menu')?.addEventListener('click', () => {
            window.open('https://github.com/jalonsogo/ProteOS/issues', '_blank');
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalType = btn.dataset.modal;
                if (modalType === 'about') this.hideAboutModal();
                if (modalType === 'files') this.hideFileBrowser();
                if (modalType === 'file-viewer') this.hideFileViewer();
                if (modalType === 'logs') this.hideLogViewer();
            });
        });

        // Close modals on background click
        document.getElementById('about-modal').addEventListener('click', (e) => {
            if (e.target.id === 'about-modal') this.hideAboutModal();
        });
        document.getElementById('files-modal').addEventListener('click', (e) => {
            if (e.target.id === 'files-modal') this.hideFileBrowser();
        });
        document.getElementById('file-viewer-modal').addEventListener('click', (e) => {
            if (e.target.id === 'file-viewer-modal') this.hideFileViewer();
        });

        // File browser controls
        document.getElementById('file-browser-container-select').addEventListener('change', (e) => {
            this.currentBrowserContainer = e.target.value;
            this.currentBrowserPath = '';
            this.loadFiles();
        });

        document.querySelector('.path-back-btn').addEventListener('click', () => {
            this.goBackInPath();
        });
    }

    async createContainer(type = 'claude') {
        try {
            const containerTypes = {
                claude: {
                    name: 'Claude Terminal',
                    emoji: '🐋',
                    loading: 'Launching Claude Code container...',
                    ready: 'Claude Code ready!'
                },
                gemini: {
                    name: 'Gemini Terminal',
                    emoji: '🔷',
                    loading: 'Launching Gemini CLI container...',
                    ready: 'Gemini CLI ready!'
                },
                openai: {
                    name: 'OpenAI Codex Terminal',
                    emoji: '⚡',
                    loading: 'Launching OpenAI Codex container...',
                    ready: 'OpenAI Codex ready!'
                }
            };

            const config = containerTypes[type];
            const containerName = `${config.name} ${this.containers.size + 1}`;

            // Log and show loading
            this.addLog('info', config.loading);
            this.showNotification(config.loading);

            const response = await fetch('/api/containers/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: containerName,
                    type: type
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create container: ${errorText}`);
            }

            const data = await response.json();
            this.containers.set(data.id, data);
            this.addLog('success', `Container created: ${containerName} (ID: ${data.id})`);

            // Wait a bit for container to be ready
            setTimeout(() => {
                this.createWindow(data, config.emoji);
                this.showNotification(config.ready);
                this.addLog('success', config.ready);
            }, 3000);

            this.updateContainerCount();
        } catch (error) {
            console.error('Error creating container:', error);
            this.addLog('error', `Failed to create container: ${error.message}`);
            this.showNotification('Failed to create container', true);
        }
    }

    createWindow(containerData, emoji = '🐋') {
        const windowId = containerData.id;

        // Create window element
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.id = `window-${windowId}`;
        windowEl.style.width = '900px';
        windowEl.style.height = '600px';
        windowEl.style.left = `${100 + this.windows.size * 30}px`;
        windowEl.style.top = `${80 + this.windows.size * 30}px`;
        windowEl.style.zIndex = this.zIndexCounter++;

        windowEl.innerHTML = `
            <div class="window-header">
                <div class="window-title">
                    <span>${emoji}</span>
                    <span>${containerData.name}</span>
                </div>
                <div class="window-controls">
                    <button class="window-control minimize" data-action="minimize">−</button>
                    <button class="window-control maximize" data-action="maximize">□</button>
                    <button class="window-control close" data-action="close">×</button>
                </div>
            </div>
            <div class="window-content">
                <div class="loading-message">
                    <div class="loading-spinner">⏳</div>
                    <p>Loading terminal...</p>
                </div>
                <iframe src="${window.location.protocol}//${window.location.hostname}:${containerData.port}" style="display:none;"></iframe>
            </div>
            <div class="resize-handle"></div>
        `;

        document.getElementById('windows-container').appendChild(windowEl);

        // Setup window controls
        this.setupWindowControls(windowEl, windowId);
        this.setupWindowDragging(windowEl);
        this.setupWindowResize(windowEl);

        // Create taskbar button (disabled - no taskbar-apps container in new design)
        // this.createTaskbarButton(containerData, windowId);

        // Show iframe after loading
        const iframe = windowEl.querySelector('iframe');
        const loadingMsg = windowEl.querySelector('.loading-message');

        iframe.onload = () => {
            setTimeout(() => {
                loadingMsg.style.display = 'none';
                iframe.style.display = 'block';
            }, 1000);
        };

        this.windows.set(windowId, { element: windowEl, data: containerData });

        // Bring to front on click
        windowEl.addEventListener('mousedown', () => {
            this.bringToFront(windowEl);
        });
    }

    setupWindowControls(windowEl, windowId) {
        const controls = windowEl.querySelectorAll('.window-control');

        controls.forEach(control => {
            control.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = control.dataset.action;

                switch(action) {
                    case 'minimize':
                        this.minimizeWindow(windowEl, windowId);
                        break;
                    case 'maximize':
                        this.maximizeWindow(windowEl);
                        break;
                    case 'close':
                        this.closeWindow(windowEl, windowId);
                        break;
                }
            });
        });
    }

    setupWindowDragging(windowEl) {
        const header = windowEl.querySelector('.window-header');
        let isDragging = false;
        let currentX, currentY, initialX, initialY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('window-control')) return;

            isDragging = true;
            initialX = e.clientX - windowEl.offsetLeft;
            initialY = e.clientY - windowEl.offsetTop;

            this.bringToFront(windowEl);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            windowEl.style.left = currentX + 'px';
            windowEl.style.top = Math.max(0, currentY) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    setupWindowResize(windowEl) {
        const resizeHandle = windowEl.querySelector('.resize-handle');
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(windowEl.style.width);
            startHeight = parseInt(windowEl.style.height);

            e.preventDefault();
            this.bringToFront(windowEl);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);

            windowEl.style.width = Math.max(400, width) + 'px';
            windowEl.style.height = Math.max(300, height) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    minimizeWindow(windowEl, windowId) {
        windowEl.classList.add('minimized');
        // Taskbar button functionality disabled in new design
        // const taskbarBtn = document.querySelector(`[data-window-id="${windowId}"]`);
        // if (taskbarBtn) taskbarBtn.classList.remove('active');
    }

    maximizeWindow(windowEl) {
        if (windowEl.dataset.maximized === 'true') {
            // Restore
            windowEl.style.width = windowEl.dataset.oldWidth;
            windowEl.style.height = windowEl.dataset.oldHeight;
            windowEl.style.left = windowEl.dataset.oldLeft;
            windowEl.style.top = windowEl.dataset.oldTop;
            windowEl.dataset.maximized = 'false';
        } else {
            // Maximize
            windowEl.dataset.oldWidth = windowEl.style.width;
            windowEl.dataset.oldHeight = windowEl.style.height;
            windowEl.dataset.oldLeft = windowEl.style.left;
            windowEl.dataset.oldTop = windowEl.style.top;

            windowEl.style.width = '100%';
            windowEl.style.height = 'calc(100vh - 36px)';
            windowEl.style.left = '0';
            windowEl.style.top = '0';
            windowEl.dataset.maximized = 'true';
        }
    }

    async closeWindow(windowEl, windowId) {
        if (confirm('Close this Claude Code terminal? The container will be stopped.')) {
            try {
                const containerName = this.containers.get(windowId)?.name || windowId;
                this.addLog('info', `Stopping container: ${containerName}`);

                // Remove window
                windowEl.remove();
                this.windows.delete(windowId);

                // Taskbar button functionality disabled in new design
                // const taskbarBtn = document.querySelector(`[data-window-id="${windowId}"]`);
                // if (taskbarBtn) taskbarBtn.remove();

                // Stop container
                const response = await fetch(`/api/containers/${windowId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error('Failed to stop container');
                }

                this.containers.delete(windowId);
                this.updateContainerCount();
                this.addLog('success', `Container stopped: ${containerName}`);
                this.showNotification('Container stopped');
            } catch (error) {
                console.error('Error closing window:', error);
                this.addLog('error', `Failed to stop container: ${error.message}`);
                this.showNotification('Error stopping container', true);
            }
        }
    }

    createTaskbarButton(containerData, windowId) {
        const button = document.createElement('div');
        button.className = 'taskbar-app active';
        button.dataset.windowId = windowId;
        button.innerHTML = `
            <span>🐋</span>
            <span>${containerData.name}</span>
        `;

        button.addEventListener('click', () => {
            const windowEl = document.getElementById(`window-${windowId}`);
            if (windowEl.classList.contains('minimized')) {
                windowEl.classList.remove('minimized');
                this.bringToFront(windowEl);
                button.classList.add('active');
            } else {
                this.minimizeWindow(windowEl, windowId);
            }
        });

        document.getElementById('taskbar-apps').appendChild(button);
    }

    bringToFront(windowEl) {
        windowEl.style.zIndex = this.zIndexCounter++;

        // Taskbar button functionality disabled in new design
        // document.querySelectorAll('.taskbar-app').forEach(btn => {
        //     btn.classList.remove('active');
        // });
        // const windowId = windowEl.id.replace('window-', '');
        // const taskbarBtn = document.querySelector(`[data-window-id="${windowId}"]`);
        // if (taskbarBtn) taskbarBtn.classList.add('active');
    }

    showAboutModal() {
        document.getElementById('about-modal').classList.add('active');
    }

    hideAboutModal() {
        document.getElementById('about-modal').classList.remove('active');
    }

    updateClock() {
        const now = new Date();
        const dateString = now.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(',', '');
        document.getElementById('clock').textContent = dateString;
    }

    updateContainerCount() {
        // Container count removed from new design
    }

    async loadContainers() {
        try {
            const response = await fetch('/api/containers');
            const containers = await response.json();

            containers.forEach(container => {
                this.containers.set(container.id, container);
                this.createWindow(container);
            });

            this.updateContainerCount();
        } catch (error) {
            console.error('Error loading containers:', error);
        }
    }

    showNotification(message, isError = false) {
        console.log(isError ? '❌' : '✓', message);

        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        if (isError) toast.classList.add('error');
        toast.textContent = message;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // File Browser Methods
    showFileBrowser() {
        this.currentBrowserPath = '';
        this.populateContainerSelect();
        document.getElementById('files-modal').classList.add('active');
    }

    hideFileBrowser() {
        document.getElementById('files-modal').classList.remove('active');
    }

    populateContainerSelect() {
        const select = document.getElementById('file-browser-container-select');
        select.innerHTML = '';

        if (this.containers.size === 0) {
            select.innerHTML = '<option>No containers running</option>';
            document.getElementById('file-list').innerHTML =
                '<div class="empty-state">No containers available. Launch a Claude terminal first!</div>';
            return;
        }

        this.containers.forEach((container, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = container.name;
            select.appendChild(option);
        });

        this.currentBrowserContainer = select.value;
        this.loadFiles();
    }

    async loadFiles() {
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '<div class="loading">Loading files...</div>';

        document.getElementById('current-path').textContent = '/' + this.currentBrowserPath;
        document.querySelector('.path-back-btn').disabled = !this.currentBrowserPath;

        try {
            const response = await fetch(
                `/api/containers/${this.currentBrowserContainer}/files?path=${encodeURIComponent(this.currentBrowserPath)}`
            );

            if (!response.ok) {
                throw new Error('Failed to load files');
            }

            const data = await response.json();

            if (data.type === 'directory') {
                this.displayFiles(data.files);
            }
        } catch (error) {
            console.error('Error loading files:', error);
            fileList.innerHTML = '<div class="empty-state">Error loading files</div>';
        }
    }

    displayFiles(files) {
        const fileList = document.getElementById('file-list');

        if (files.length === 0) {
            fileList.innerHTML = '<div class="empty-state">This directory is empty</div>';
            return;
        }

        // Sort: directories first, then alphabetically
        files.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        fileList.innerHTML = '';

        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            const icon = file.type === 'directory' ? '📁' : '📄';
            const size = file.type === 'file' ? this.formatFileSize(file.size) : '';

            fileItem.innerHTML = `
                <div class="file-icon">${icon}</div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">${size} ${new Date(file.modified).toLocaleString()}</div>
                </div>
            `;

            fileItem.addEventListener('click', () => {
                if (file.type === 'directory') {
                    this.openDirectory(file.name);
                } else {
                    this.openFile(file.name);
                }
            });

            fileList.appendChild(fileItem);
        });
    }

    openDirectory(name) {
        this.currentBrowserPath = this.currentBrowserPath
            ? `${this.currentBrowserPath}/${name}`
            : name;
        this.loadFiles();
    }

    goBackInPath() {
        if (!this.currentBrowserPath) return;

        const parts = this.currentBrowserPath.split('/');
        parts.pop();
        this.currentBrowserPath = parts.join('/');
        this.loadFiles();
    }

    async openFile(name) {
        const filePath = this.currentBrowserPath
            ? `${this.currentBrowserPath}/${name}`
            : name;

        try {
            const response = await fetch(
                `/api/containers/${this.currentBrowserContainer}/files/read?path=${encodeURIComponent(filePath)}`
            );

            if (!response.ok) {
                throw new Error('Failed to read file');
            }

            const data = await response.json();
            this.showFileViewer(data);
        } catch (error) {
            console.error('Error reading file:', error);
            this.showNotification('❌ Failed to read file', true);
        }
    }

    showFileViewer(fileData) {
        document.getElementById('file-viewer-title').textContent = `📄 ${fileData.name}`;
        document.getElementById('file-content').textContent = fileData.content;
        document.getElementById('file-viewer-modal').classList.add('active');
    }

    hideFileViewer() {
        document.getElementById('file-viewer-modal').classList.remove('active');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // System Log Methods
    addLog(level, message) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const logEntry = {
            time: timeString,
            level: level, // 'info', 'success', 'warning', 'error'
            message: message,
            timestamp: now
        };

        this.logs.push(logEntry);

        // Also log to console
        const emoji = {
            info: 'ℹ️',
            success: '✓',
            warning: '⚠️',
            error: '❌'
        };
        console.log(`${emoji[level]} [${timeString}] ${message}`);

        // Update UI if log viewer is open
        if (document.getElementById('logs-modal').classList.contains('active')) {
            this.appendLogToUI(logEntry);
        }
    }

    appendLogToUI(logEntry) {
        // Check if log viewer window is open
        const logWindow = document.getElementById('window-system-logs');
        if (!logWindow) return;

        const logViewer = logWindow.querySelector('#window-log-viewer');
        if (!logViewer) return;

        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${logEntry.level}`;
        logElement.dataset.level = logEntry.level;

        logElement.innerHTML = `
            <span class="log-time">${logEntry.time}</span>
            <span class="log-level">${logEntry.level}</span>
            <span class="log-message">${logEntry.message}</span>
        `;

        logViewer.appendChild(logElement);

        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            logViewer.scrollTop = logViewer.scrollHeight;
        }

        // Apply current filter
        if (this.currentLogFilter !== 'all' && logEntry.level !== this.currentLogFilter) {
            logElement.classList.add('hidden');
        }
    }

    showLogViewer() {
        // Check if log viewer window already exists
        if (this.windows.has('system-logs')) {
            const existingWindow = document.getElementById('window-system-logs');
            if (existingWindow) {
                this.bringToFront(existingWindow);
                return;
            }
        }

        // Create log viewer window
        const windowId = 'system-logs';
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.id = `window-${windowId}`;
        windowEl.style.width = '900px';
        windowEl.style.height = '600px';
        windowEl.style.left = '100px';
        windowEl.style.top = '80px';
        windowEl.style.zIndex = this.zIndexCounter++;

        windowEl.innerHTML = `
            <div class="window-header">
                <div class="window-title">
                    <i data-lucide="terminal" style="width: 16px; height: 16px;"></i>
                    <span>ProteOS System Logs</span>
                </div>
                <div class="window-controls">
                    <button class="window-control minimize" data-action="minimize">−</button>
                    <button class="window-control maximize" data-action="maximize">□</button>
                    <button class="window-control close" data-action="close-logs">×</button>
                </div>
            </div>
            <div class="window-content log-window-content">
                <div class="log-window-toolbar">
                    <div class="log-filters">
                        <button class="log-filter-btn active" data-level="all">All</button>
                        <button class="log-filter-btn" data-level="info">Info</button>
                        <button class="log-filter-btn" data-level="success">Success</button>
                        <button class="log-filter-btn" data-level="warning">Warning</button>
                        <button class="log-filter-btn" data-level="error">Error</button>
                    </div>
                    <div class="log-controls">
                        <button class="log-control-btn" id="window-clear-logs-btn" title="Clear logs">
                            <i data-lucide="trash-2"></i>
                        </button>
                        <button class="log-control-btn" id="window-auto-scroll-btn" title="Auto-scroll" data-active="true">
                            <i data-lucide="arrow-down"></i>
                        </button>
                    </div>
                </div>
                <div class="log-viewer" id="window-log-viewer"></div>
            </div>
            <div class="resize-handle"></div>
        `;

        document.getElementById('windows-container').appendChild(windowEl);

        // Setup window controls
        this.setupLogWindowControls(windowEl, windowId);
        this.setupWindowDragging(windowEl);
        this.setupWindowResize(windowEl);

        // Populate with existing logs
        const logViewer = windowEl.querySelector('#window-log-viewer');
        this.logs.forEach(log => {
            const logElement = document.createElement('div');
            logElement.className = `log-entry log-${log.level}`;
            logElement.dataset.level = log.level;
            logElement.innerHTML = `
                <span class="log-time">${log.time}</span>
                <span class="log-level">${log.level}</span>
                <span class="log-message">${log.message}</span>
            `;
            logViewer.appendChild(logElement);
        });

        // Scroll to bottom
        if (this.autoScroll) {
            logViewer.scrollTop = logViewer.scrollHeight;
        }

        // Store window reference
        this.windows.set(windowId, { element: windowEl, type: 'logs' });

        // Bring to front on click
        windowEl.addEventListener('mousedown', () => {
            this.bringToFront(windowEl);
        });

        // Re-initialize Lucide icons
        setTimeout(() => lucide.createIcons(), 100);

        this.addLog('info', 'System log viewer opened');
    }

    setupLogWindowControls(windowEl, windowId) {
        const controls = windowEl.querySelectorAll('.window-control');

        controls.forEach(control => {
            control.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = control.dataset.action;

                switch(action) {
                    case 'minimize':
                        this.minimizeWindow(windowEl, windowId);
                        break;
                    case 'maximize':
                        this.maximizeWindow(windowEl);
                        break;
                    case 'close-logs':
                        this.closeLogWindow(windowEl, windowId);
                        break;
                }
            });
        });

        // Filter buttons
        windowEl.querySelectorAll('.log-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                windowEl.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentLogFilter = e.target.dataset.level;
                this.filterLogsInWindow(windowEl);
            });
        });

        // Clear logs button
        windowEl.querySelector('#window-clear-logs-btn')?.addEventListener('click', () => {
            this.clearLogsInWindow(windowEl);
        });

        // Auto-scroll button
        windowEl.querySelector('#window-auto-scroll-btn')?.addEventListener('click', (e) => {
            this.autoScroll = !this.autoScroll;
            e.currentTarget.dataset.active = this.autoScroll;
        });
    }

    closeLogWindow(windowEl, windowId) {
        windowEl.remove();
        this.windows.delete(windowId);
        this.addLog('info', 'System log viewer closed');
    }

    filterLogsInWindow(windowEl) {
        const logEntries = windowEl.querySelectorAll('.log-entry');
        logEntries.forEach(entry => {
            if (this.currentLogFilter === 'all') {
                entry.classList.remove('hidden');
            } else {
                if (entry.dataset.level === this.currentLogFilter) {
                    entry.classList.remove('hidden');
                } else {
                    entry.classList.add('hidden');
                }
            }
        });
    }

    clearLogsInWindow(windowEl) {
        if (confirm('Clear all system logs?')) {
            this.logs = [];
            const logViewer = windowEl.querySelector('#window-log-viewer');
            logViewer.innerHTML = '';
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            logViewer.innerHTML = `
                <div class="log-entry log-info">
                    <span class="log-time">${timeString}</span>
                    <span class="log-level">INFO</span>
                    <span class="log-message">Logs cleared</span>
                </div>
            `;
            this.addLog('info', 'System logs cleared');
        }
    }

    clearLogs() {
        if (confirm('Clear all system logs?')) {
            this.logs = [];
            document.getElementById('log-viewer').innerHTML = `
                <div class="log-entry log-info">
                    <span class="log-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                    <span class="log-level">INFO</span>
                    <span class="log-message">Logs cleared</span>
                </div>
            `;
            this.addLog('info', 'System logs cleared');
        }
    }

    filterLogs() {
        const logEntries = document.querySelectorAll('.log-entry');
        logEntries.forEach(entry => {
            if (this.currentLogFilter === 'all') {
                entry.classList.remove('hidden');
            } else {
                if (entry.dataset.level === this.currentLogFilter) {
                    entry.classList.remove('hidden');
                } else {
                    entry.classList.add('hidden');
                }
            }
        });
    }
}

// Initialize WhaleOS when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.whaleOS = new WhaleOS();
    console.log('🐋 ProteOS Desktop initialized');
    window.whaleOS.addLog('info', 'ProteOS System initialized - Shape-shifting AI platform ready');
    window.whaleOS.addLog('info', `Server URL: ${window.location.origin}`);
});
