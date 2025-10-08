// WhaleOS Desktop Application
class WhaleOS {
    constructor() {
        this.containers = new Map();
        this.windows = new Map();
        this.zIndexCounter = 100;
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

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalType = btn.dataset.modal;
                if (modalType === 'about') this.hideAboutModal();
                if (modalType === 'files') this.hideFileBrowser();
                if (modalType === 'file-viewer') this.hideFileViewer();
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
                    loading: '🐋 Launching Claude Code container...',
                    ready: '✓ Claude Code ready!'
                },
                gemini: {
                    name: 'Gemini Terminal',
                    emoji: '🔷',
                    loading: '🔷 Launching Gemini CLI container...',
                    ready: '✓ Gemini CLI ready!'
                },
                openai: {
                    name: 'OpenAI Codex Terminal',
                    emoji: '⚡',
                    loading: '⚡ Launching OpenAI Codex container...',
                    ready: '✓ OpenAI Codex ready!'
                }
            };

            const config = containerTypes[type];
            const containerName = `${config.name} ${this.containers.size + 1}`;

            // Show loading notification
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
                throw new Error('Failed to create container');
            }

            const data = await response.json();
            this.containers.set(data.id, data);

            // Wait a bit for container to be ready
            setTimeout(() => {
                this.createWindow(data, config.emoji);
                this.showNotification(config.ready);
            }, 3000);

            this.updateContainerCount();
        } catch (error) {
            console.error('Error creating container:', error);
            this.showNotification('❌ Failed to create container', true);
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
                    <p>Loading Claude Code terminal...</p>
                </div>
                <iframe src="http://localhost:${containerData.port}" style="display:none;"></iframe>
            </div>
            <div class="resize-handle"></div>
        `;

        document.getElementById('windows-container').appendChild(windowEl);

        // Setup window controls
        this.setupWindowControls(windowEl, windowId);
        this.setupWindowDragging(windowEl);
        this.setupWindowResize(windowEl);

        // Create taskbar button
        this.createTaskbarButton(containerData, windowId);

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
        const taskbarBtn = document.querySelector(`[data-window-id="${windowId}"]`);
        if (taskbarBtn) taskbarBtn.classList.remove('active');
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
            windowEl.style.height = 'calc(100vh - 48px)';
            windowEl.style.left = '0';
            windowEl.style.top = '0';
            windowEl.dataset.maximized = 'true';
        }
    }

    async closeWindow(windowEl, windowId) {
        if (confirm('Close this Claude Code terminal? The container will be stopped.')) {
            try {
                // Remove window
                windowEl.remove();
                this.windows.delete(windowId);

                // Remove taskbar button
                const taskbarBtn = document.querySelector(`[data-window-id="${windowId}"]`);
                if (taskbarBtn) taskbarBtn.remove();

                // Stop container
                await fetch(`/api/containers/${windowId}`, {
                    method: 'DELETE'
                });

                this.containers.delete(windowId);
                this.updateContainerCount();
                this.showNotification('Container stopped');
            } catch (error) {
                console.error('Error closing window:', error);
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

        // Update taskbar buttons
        document.querySelectorAll('.taskbar-app').forEach(btn => {
            btn.classList.remove('active');
        });

        const windowId = windowEl.id.replace('window-', '');
        const taskbarBtn = document.querySelector(`[data-window-id="${windowId}"]`);
        if (taskbarBtn) taskbarBtn.classList.add('active');
    }

    showAboutModal() {
        document.getElementById('about-modal').classList.add('active');
    }

    hideAboutModal() {
        document.getElementById('about-modal').classList.remove('active');
    }

    updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('clock').textContent = timeString;
    }

    updateContainerCount() {
        document.getElementById('container-count').textContent =
            `Containers: ${this.containers.size}`;
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
}

// Initialize WhaleOS when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.whaleOS = new WhaleOS();
    console.log('🐋 WhaleOS Desktop initialized');
});
