// ProteOS Desktop Application
class ProteOS {
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

        document.getElementById('settings-menu')?.addEventListener('click', () => {
            this.showSettings();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalType = btn.dataset.modal;
                if (modalType === 'about') this.hideAboutModal();
                if (modalType === 'files') this.hideFileBrowser();
                if (modalType === 'file-viewer') this.hideFileViewer();
                if (modalType === 'logs') this.hideLogViewer();
                if (modalType === 'settings') this.hideSettings();
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
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') this.hideSettings();
        });

        // Settings controls
        document.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchSettingsSection(item.dataset.section);
            });
        });

        document.getElementById('save-api-keys-btn')?.addEventListener('click', () => {
            this.saveApiKeys();
        });

        document.getElementById('theme-selector')?.addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
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
                    icon: '<img src="images/icons/apps/Claude.svg" alt="Claude" class="window-icon" onerror="this.src=\'images/icons/apps/Claude.png\'">',
                    fallbackIcon: '<i data-lucide="terminal" style="width: 20px; height: 20px;"></i>',
                    loading: 'Launching Claude Code container...',
                    ready: 'Claude Code ready!'
                },
                gemini: {
                    name: 'Gemini Terminal',
                    icon: '<img src="images/icons/apps/Gemini.svg" alt="Gemini" class="window-icon" onerror="this.src=\'images/icons/apps/Gemini.png\'">',
                    fallbackIcon: '<i data-lucide="sparkles" style="width: 20px; height: 20px;"></i>',
                    loading: 'Launching Gemini CLI container...',
                    ready: 'Gemini CLI ready!'
                },
                openai: {
                    name: 'OpenAI Codex Terminal',
                    icon: '<img src="images/icons/apps/OpenAI.svg" alt="OpenAI" class="window-icon" onerror="this.src=\'images/icons/apps/OpenAI.png\'">',
                    fallbackIcon: '<i data-lucide="zap" style="width: 20px; height: 20px;"></i>',
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
                this.createWindow(data, config.icon || config.fallbackIcon, type);
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

    createWindow(containerData, icon = '<i data-lucide="terminal" style="width: 20px; height: 20px;"></i>', type = 'claude') {
        const windowId = containerData.id;

        // Create window element
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.id = `window-${windowId}`;
        windowEl.dataset.containerType = type;
        windowEl.style.width = '900px';
        windowEl.style.height = '600px';
        windowEl.style.left = `${100 + this.windows.size * 30}px`;
        windowEl.style.top = `${80 + this.windows.size * 30}px`;
        windowEl.style.zIndex = this.zIndexCounter++;

        windowEl.innerHTML = `
            <div class="window-header">
                <div class="window-title">
                    <span class="window-icon-wrapper">${icon}</span>
                    <span>${containerData.name}</span>
                </div>
                <div class="window-controls">
                    <button class="window-control local-terminal" data-action="local-terminal" title="Open in local iTerm">
                        <i data-lucide="square-terminal" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button class="window-control minimize" data-action="minimize">−</button>
                    <button class="window-control maximize" data-action="maximize">□</button>
                    <button class="window-control close" data-action="close">×</button>
                </div>
            </div>
            <div class="window-content">
                <div class="loading-message">
                    <div class="loading-spinner"><i data-lucide="loader" style="width: 32px; height: 32px; animation: spin 1s linear infinite;"></i></div>
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

        this.windows.set(windowId, { element: windowEl, data: containerData, type: type });

        // Bring to front on click
        windowEl.addEventListener('mousedown', () => {
            this.bringToFront(windowEl);
        });

        // Initialize Lucide icons for the new window
        setTimeout(() => lucide.createIcons(), 10);

        // Update sessions widget
        this.updateSessionsWidget();
    }

    setupWindowControls(windowEl, windowId) {
        const controls = windowEl.querySelectorAll('.window-control');

        controls.forEach(control => {
            control.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = control.dataset.action;

                switch(action) {
                    case 'local-terminal':
                        this.openLocalTerminal(windowId);
                        break;
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

        // Get window data
        const windowData = this.windows.get(windowId);
        if (!windowData) return;

        // Create minimized session button
        this.addMinimizedSession(windowEl, windowId, windowData);

        // Show the minimized bar
        this.updateMinimizedBar();

        // Update sessions widget
        this.updateSessionsWidget();
    }

    addMinimizedSession(windowEl, windowId, windowData) {
        const minimizedBar = document.getElementById('minimized-bar');

        console.log('addMinimizedSession called', { windowId, minimizedBar });

        // Check if already exists
        if (document.getElementById(`minimized-${windowId}`)) {
            console.log('Minimized session already exists');
            return;
        }

        // Get icon from window
        const windowTitle = windowEl.querySelector('.window-title');
        const iconWrapper = windowTitle?.querySelector('.window-icon-wrapper');
        const titleElement = windowTitle?.querySelector('span:last-child');

        // Check if icon is an img element or Lucide icon
        let icon = '<i data-lucide="terminal" style="width: 18px; height: 18px;"></i>';
        if (iconWrapper) {
            const imgElement = iconWrapper.querySelector('img.window-icon');
            if (imgElement) {
                icon = imgElement.outerHTML;
            } else {
                icon = iconWrapper.innerHTML || '<i data-lucide="terminal" style="width: 18px; height: 18px;"></i>';
            }
        }

        const title = titleElement?.textContent || windowData.data?.name || 'Window';

        // Create minimized session element
        const sessionEl = document.createElement('div');
        sessionEl.className = 'minimized-session';
        sessionEl.id = `minimized-${windowId}`;
        sessionEl.innerHTML = `
            <span class="session-icon">${icon}</span>
            <span class="session-title">${title}</span>
            <span class="session-close">×</span>
        `;

        // Click to restore
        sessionEl.addEventListener('click', (e) => {
            if (!e.target.classList.contains('session-close')) {
                this.restoreWindow(windowEl, windowId);
            }
        });

        // Close button
        sessionEl.querySelector('.session-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeWindow(windowEl, windowId);
        });

        minimizedBar.appendChild(sessionEl);
    }

    restoreWindow(windowEl, windowId) {
        windowEl.classList.remove('minimized');
        this.bringToFront(windowEl);

        // Remove from minimized bar
        const minimizedSession = document.getElementById(`minimized-${windowId}`);
        if (minimizedSession) {
            minimizedSession.remove();
        }

        this.updateMinimizedBar();

        // Update sessions widget
        this.updateSessionsWidget();
    }

    updateMinimizedBar() {
        const minimizedBar = document.getElementById('minimized-bar');
        const hasMinimized = minimizedBar.querySelectorAll('.minimized-session').length > 0;

        console.log('updateMinimizedBar called', { hasMinimized, count: minimizedBar.querySelectorAll('.minimized-session').length });

        if (hasMinimized) {
            minimizedBar.classList.add('has-minimized');
            console.log('Minimized bar should now be visible');
        } else {
            minimizedBar.classList.remove('has-minimized');
            console.log('Minimized bar should now be hidden');
        }
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

                // Remove from minimized bar if present
                const minimizedSession = document.getElementById(`minimized-${windowId}`);
                if (minimizedSession) {
                    minimizedSession.remove();
                    this.updateMinimizedBar();
                }

                // Stop container
                const response = await fetch(`/api/containers/${windowId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error('Failed to stop container');
                }

                this.containers.delete(windowId);
                this.updateContainerCount();
                this.updateSessionsWidget();
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
            <i data-lucide="terminal" style="width: 16px; height: 16px;"></i>
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

        // Update sessions widget to reflect active window
        this.updateSessionsWidget();

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
        console.log(isError ? '[ERROR]' : '[SUCCESS]', message);

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

            const icon = file.type === 'directory'
                ? '<i data-lucide="folder" style="width: 20px; height: 20px; color: #fbbf24;"></i>'
                : '<i data-lucide="file" style="width: 20px; height: 20px; color: #9ca3af;"></i>';
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

        // Re-initialize Lucide icons for file browser
        setTimeout(() => lucide.createIcons(), 10);
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
            this.showNotification('Failed to read file', true);
        }
    }

    showFileViewer(fileData) {
        const titleEl = document.getElementById('file-viewer-title');
        titleEl.innerHTML = `<i data-lucide="file-text" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 8px;"></i>${fileData.name}`;
        document.getElementById('file-content').textContent = fileData.content;
        document.getElementById('file-viewer-modal').classList.add('active');
        setTimeout(() => lucide.createIcons(), 10);
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
        const prefix = {
            info: '[INFO]',
            success: '[SUCCESS]',
            warning: '[WARNING]',
            error: '[ERROR]'
        };
        console.log(`${prefix[level]} [${timeString}] ${message}`);

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

        // Update sessions widget
        this.updateSessionsWidget();

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

        // Remove from minimized bar if present
        const minimizedSession = document.getElementById(`minimized-${windowId}`);
        if (minimizedSession) {
            minimizedSession.remove();
            this.updateMinimizedBar();
        }

        // Update sessions widget
        this.updateSessionsWidget();

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

    updateSessionsWidget() {
        const sessionsList = document.getElementById('sessions-list');
        const sessionsCount = document.getElementById('sessions-count');

        // Clear current list
        sessionsList.innerHTML = '';

        // Get all windows
        const windows = Array.from(this.windows.entries());

        if (windows.length === 0) {
            sessionsList.innerHTML = '<div class="sessions-empty">No active sessions</div>';
            sessionsCount.textContent = '0';
            return;
        }

        sessionsCount.textContent = windows.length;

        // Create session items
        windows.forEach(([windowId, windowData]) => {
            const windowEl = windowData.element;
            const isMinimized = windowEl.classList.contains('minimized');
            const isActive = parseInt(windowEl.style.zIndex) === this.zIndexCounter - 1;

            // Get icon from window
            const windowTitle = windowEl.querySelector('.window-title');
            const iconWrapper = windowTitle?.querySelector('.window-icon-wrapper');
            const titleElement = windowTitle?.querySelector('span:last-child');

            // Check if icon is an img element or Lucide icon
            let icon = '<i data-lucide="terminal" style="width: 20px; height: 20px;"></i>';
            if (iconWrapper) {
                const imgElement = iconWrapper.querySelector('img.window-icon');
                if (imgElement) {
                    icon = imgElement.outerHTML;
                } else {
                    icon = iconWrapper.innerHTML || '<i data-lucide="terminal" style="width: 20px; height: 20px;"></i>';
                }
            }

            const title = titleElement?.textContent || windowData.data?.name || 'Window';

            const sessionItem = document.createElement('div');
            sessionItem.className = 'session-item';
            if (isActive && !isMinimized) sessionItem.classList.add('active');
            if (isMinimized) sessionItem.classList.add('minimized');

            sessionItem.innerHTML = `
                <div class="session-item-icon">${icon}</div>
                <div class="session-item-info">
                    <div class="session-item-name">${title}</div>
                    <div class="session-item-status">
                        <span class="session-status-dot"></span>
                        <span>${isMinimized ? 'Minimized' : 'Active'}</span>
                    </div>
                </div>
                <div class="session-item-actions">
                    <button class="session-action-btn minimize" title="${isMinimized ? 'Restore' : 'Minimize'}">${isMinimized ? '□' : '−'}</button>
                    <button class="session-action-btn close" title="Close">×</button>
                </div>
            `;

            // Click on item to focus/restore window
            sessionItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('session-action-btn')) {
                    if (isMinimized) {
                        this.restoreWindow(windowEl, windowId);
                    } else {
                        this.bringToFront(windowEl);
                    }
                    this.updateSessionsWidget();
                }
            });

            // Minimize/restore button
            const minimizeBtn = sessionItem.querySelector('.minimize');
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isMinimized) {
                    this.restoreWindow(windowEl, windowId);
                } else {
                    this.minimizeWindow(windowEl, windowId);
                }
            });

            // Close button
            const closeBtn = sessionItem.querySelector('.close');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeWindow(windowEl, windowId);
            });

            sessionsList.appendChild(sessionItem);
        });

        // Re-initialize Lucide icons
        setTimeout(() => lucide.createIcons(), 10);
    }

    // Settings Methods
    showSettings() {
        document.getElementById('settings-modal').classList.add('active');
        this.loadSettings();
        this.loadWallpapers();
        this.loadWorkspaceFolders();
    }

    hideSettings() {
        document.getElementById('settings-modal').classList.remove('active');
    }

    switchSettingsSection(section) {
        // Update sidebar menu items
        document.querySelectorAll('.settings-menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content sections
        document.querySelectorAll('.settings-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        // Re-initialize Lucide icons
        setTimeout(() => lucide.createIcons(), 10);
    }

    loadSettings() {
        // Load theme
        const theme = localStorage.getItem('proteOS_theme') || 'dark';
        document.getElementById('theme-selector').value = theme;
        document.body.dataset.theme = theme;

        // Load API keys
        const anthropicKey = localStorage.getItem('proteOS_anthropic_key') || '';
        const geminiKey = localStorage.getItem('proteOS_gemini_key') || '';
        const openaiKey = localStorage.getItem('proteOS_openai_key') || '';

        document.getElementById('anthropic-key').value = anthropicKey;
        document.getElementById('gemini-key').value = geminiKey;
        document.getElementById('openai-key').value = openaiKey;
    }

    changeTheme(theme) {
        document.body.dataset.theme = theme;
        localStorage.setItem('proteOS_theme', theme);
        this.addLog('info', `Theme changed to ${theme} mode`);
        this.showNotification(`Theme changed to ${theme} mode`);
    }

    async loadWallpapers() {
        const wallpaperGrid = document.getElementById('wallpaper-grid');
        wallpaperGrid.innerHTML = '<div class="loading">Loading wallpapers...</div>';

        try {
            const response = await fetch('/api/wallpapers');
            if (!response.ok) {
                throw new Error('Failed to load wallpapers');
            }

            const wallpapers = await response.json();

            if (wallpapers.length === 0) {
                wallpaperGrid.innerHTML = '<div class="empty-state">No wallpapers available</div>';
                return;
            }

            // Get current wallpaper or default to ocean-depths.png
            const currentWallpaper = localStorage.getItem('proteOS_wallpaper') || 'ocean-depths.png';

            // Apply saved wallpaper on load
            this.applyWallpaper(currentWallpaper);

            wallpaperGrid.innerHTML = '';
            wallpapers.forEach(wallpaper => {
                const wallpaperItem = document.createElement('div');
                wallpaperItem.className = 'wallpaper-item';
                if (wallpaper === currentWallpaper) {
                    wallpaperItem.classList.add('active');
                }

                wallpaperItem.innerHTML = `
                    <img src="images/wallpapers/${wallpaper}" alt="${wallpaper}">
                    <div class="wallpaper-item-check"><i data-lucide="check" style="width: 16px; height: 16px;"></i></div>
                `;

                wallpaperItem.addEventListener('click', () => {
                    this.changeWallpaper(wallpaper);
                });

                wallpaperGrid.appendChild(wallpaperItem);
            });

            // Re-initialize Lucide icons for wallpaper checkmarks
            setTimeout(() => lucide.createIcons(), 10);
        } catch (error) {
            console.error('Error loading wallpapers:', error);
            wallpaperGrid.innerHTML = '<div class="empty-state">Error loading wallpapers</div>';
        }
    }

    applyWallpaper(wallpaper) {
        const desktop = document.querySelector('.desktop');
        const isLightTheme = document.body.dataset.theme === 'light';
        const gradient = isLightTheme
            ? 'linear-gradient(0deg, rgba(255, 255, 255, 0.5) 0%, transparent 30%)'
            : 'linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0%, transparent 30%)';

        desktop.style.backgroundImage = `
            ${gradient},
            url('images/wallpapers/${wallpaper}')
        `;
        desktop.style.backgroundSize = 'cover';
        desktop.style.backgroundPosition = 'center';
        desktop.style.backgroundRepeat = 'no-repeat';
    }

    changeWallpaper(wallpaper) {
        // Update active state
        document.querySelectorAll('.wallpaper-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.closest('.wallpaper-item').classList.add('active');

        // Apply wallpaper
        this.applyWallpaper(wallpaper);

        // Save preference
        localStorage.setItem('proteOS_wallpaper', wallpaper);

        // Re-initialize Lucide icons after updating active state
        setTimeout(() => lucide.createIcons(), 10);

        this.addLog('info', `Wallpaper changed to ${wallpaper}`);
        this.showNotification('Wallpaper changed');
    }

    async loadWorkspaceFolders() {
        const foldersList = document.getElementById('folders-list');
        foldersList.innerHTML = '<div class="loading">Loading folders...</div>';

        try {
            const response = await fetch('/api/workspace/folders');
            if (!response.ok) {
                throw new Error('Failed to load folders');
            }

            const folders = await response.json();

            if (folders.length === 0) {
                foldersList.innerHTML = '<div class="empty-state">No workspace folders yet</div>';
                return;
            }

            foldersList.innerHTML = '';
            folders.forEach(folder => {
                const folderItem = document.createElement('div');
                folderItem.className = 'folder-item';

                folderItem.innerHTML = `
                    <div class="folder-item-icon">
                        <i data-lucide="folder"></i>
                    </div>
                    <div class="folder-item-info">
                        <div class="folder-item-name">${folder.name}</div>
                        <div class="folder-item-path">${folder.path}</div>
                    </div>
                    <div class="folder-item-actions">
                        <button class="folder-action-btn view" data-folder="${folder.name}">
                            <i data-lucide="eye"></i>
                            View
                        </button>
                        <button class="folder-action-btn delete" data-folder="${folder.name}">
                            <i data-lucide="trash-2"></i>
                            Delete
                        </button>
                    </div>
                `;

                // View button
                folderItem.querySelector('.view').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.viewWorkspaceFolder(folder.name);
                });

                // Delete button
                folderItem.querySelector('.delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteWorkspaceFolder(folder.name);
                });

                foldersList.appendChild(folderItem);
            });

            // Re-initialize Lucide icons
            setTimeout(() => lucide.createIcons(), 10);
        } catch (error) {
            console.error('Error loading folders:', error);
            foldersList.innerHTML = '<div class="empty-state">Error loading folders</div>';
        }
    }

    viewWorkspaceFolder(folderName) {
        // Close settings and open file browser
        this.hideSettings();

        // TODO: Implement opening file browser for specific workspace folder
        // For now, just show a notification
        this.showNotification(`Opening folder: ${folderName}`);
        this.addLog('info', `Viewing workspace folder: ${folderName}`);
    }

    async deleteWorkspaceFolder(folderName) {
        if (!confirm(`Delete workspace folder "${folderName}"? This will remove all files in the folder.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/workspace/folders/${folderName}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete folder');
            }

            this.addLog('success', `Deleted workspace folder: ${folderName}`);
            this.showNotification('Folder deleted');

            // Reload folders list
            this.loadWorkspaceFolders();
        } catch (error) {
            console.error('Error deleting folder:', error);
            this.addLog('error', `Failed to delete folder: ${error.message}`);
            this.showNotification('Failed to delete folder', true);
        }
    }

    saveApiKeys() {
        const anthropicKey = document.getElementById('anthropic-key').value.trim();
        const geminiKey = document.getElementById('gemini-key').value.trim();
        const openaiKey = document.getElementById('openai-key').value.trim();

        // Save to localStorage
        if (anthropicKey) localStorage.setItem('proteOS_anthropic_key', anthropicKey);
        if (geminiKey) localStorage.setItem('proteOS_gemini_key', geminiKey);
        if (openaiKey) localStorage.setItem('proteOS_openai_key', openaiKey);

        // Also send to server
        fetch('/api/settings/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                anthropic: anthropicKey,
                gemini: geminiKey,
                openai: openaiKey
            })
        }).then(response => {
            if (response.ok) {
                this.addLog('success', 'API keys saved successfully');
                this.showNotification('API keys saved successfully');
            } else {
                throw new Error('Failed to save API keys');
            }
        }).catch(error => {
            console.error('Error saving API keys:', error);
            this.addLog('error', 'Failed to save API keys to server');
            this.showNotification('API keys saved locally, but failed to sync to server', true);
        });
    }

    async openLocalTerminal(containerId) {
        try {
            const containerData = this.containers.get(containerId);
            if (!containerData) {
                throw new Error('Container not found');
            }

            this.addLog('info', `Opening local iTerm for ${containerData.name}...`);
            this.showNotification('Opening local iTerm terminal...');

            const response = await fetch('/api/terminal/local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    containerId: containerId,
                    workspacePath: containerData.workspaceDir
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to open local terminal');
            }

            const data = await response.json();
            this.addLog('success', `Local iTerm opened for ${containerData.name}`);
            this.showNotification('Local iTerm terminal opened');
        } catch (error) {
            console.error('Error opening local terminal:', error);
            this.addLog('error', `Failed to open local terminal: ${error.message}`);
            this.showNotification('Failed to open local terminal', true);
        }
    }
}

// Initialize ProteOS when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.proteOS = new ProteOS();
    console.log('[PROTEOS] Desktop initialized');
    window.proteOS.addLog('info', 'ProteOS System initialized - Shape-shifting AI platform ready');
    window.proteOS.addLog('info', `Server URL: ${window.location.origin}`);

    // Update URL display in taskbar with actual server URL
    const urlDisplay = document.getElementById('url-display');
    if (urlDisplay) {
        urlDisplay.textContent = window.location.origin;
    }
});
