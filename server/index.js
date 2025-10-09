import express from 'express';
import Docker from 'dockerode';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import fs from 'fs';
import { exec } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Docker will be initialized asynchronously in start()
let docker;

const PORT = process.env.PORT || 3001;
const containers = new Map(); // Store container info: id -> { containerId, port, name }

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Image configurations
const imageConfigs = {
  claude: {
    name: 'proteos-claude',
    dockerfile: 'dockerfile.claude',
    env: 'ANTHROPIC_API_KEY'
  },
  gemini: {
    name: 'proteos-gemini',
    dockerfile: 'dockerfile.gemini',
    env: 'GEMINI_API_KEY'
  },
  openai: {
    name: 'proteos-openai',
    dockerfile: 'dockerfile.openai',
    env: 'OPENAI_API_KEY'
  }
};

// Build Docker images if they don't exist
async function ensureImageExists(type) {
  const config = imageConfigs[type];
  try {
    await docker.getImage(config.name).inspect();
    console.log(`✓ ${config.name} image exists`);
  } catch (error) {
    console.log(`Building ${config.name} image...`);
    const stream = await docker.buildImage({
      context: join(__dirname, '..'),
      src: [config.dockerfile, '.env']
    }, { t: config.name, dockerfile: config.dockerfile });

    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
    });
    console.log(`✓ ${config.name} image built`);
  }
}

// Ensure all images exist
async function ensureAllImages() {
  await ensureImageExists('claude');
  await ensureImageExists('gemini');
  await ensureImageExists('openai');
}

// Create a new container
app.post('/api/containers/create', async (req, res) => {
  console.log('📦 Container creation request received:', req.body);
  try {
    const type = req.body.type || 'claude';
    const config = imageConfigs[type];

    if (!config) {
      return res.status(400).json({ error: 'Invalid container type' });
    }

    const containerId = `${type}-${Date.now()}`;
    const containerName = req.body.name || `${type.charAt(0).toUpperCase() + type.slice(1)} Terminal ${containers.size + 1}`;

    // Find next available port by getting the highest used port and incrementing
    const usedPorts = Array.from(containers.values()).map(c => c.port);
    const port = usedPorts.length > 0 ? Math.max(...usedPorts) + 1 : 7681;

    // Create persistent workspace directory for this container
    const workspaceDir = join(__dirname, '..', 'workspace', 'containers', containerId);
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    // Get the appropriate API key
    const apiKey = process.env[config.env];
    if (!apiKey) {
      return res.status(500).json({ error: `${config.env} not set in environment` });
    }

    // Use host workspace path for Docker bind mounts (when running in container)
    // Otherwise use the local workspace path (when running directly on host)
    const hostWorkspacePath = process.env.HOST_WORKSPACE_PATH
      ? join(process.env.HOST_WORKSPACE_PATH, 'containers', containerId)
      : workspaceDir;

    const container = await docker.createContainer({
      Image: config.name,
      name: containerId,
      Env: [`${config.env}=${apiKey}`],
      HostConfig: {
        PortBindings: {
          '7681/tcp': [{ HostPort: port.toString() }]
        },
        Binds: [
          `${hostWorkspacePath}:/workspace`
        ],
        AutoRemove: true
      }
    });

    await container.start();

    const info = {
      containerId: container.id,
      name: containerName,
      type: type,
      port: port,
      workspaceDir: workspaceDir,
      created: new Date().toISOString()
    };

    containers.set(containerId, info);

    res.json({
      success: true,
      id: containerId,
      ...info
    });
  } catch (error) {
    console.error('Error creating container:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all containers
app.get('/api/containers', async (req, res) => {
  const containerList = Array.from(containers.entries()).map(([id, info]) => ({
    id,
    ...info
  }));
  res.json(containerList);
});

// Stop and remove a container
app.delete('/api/containers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const info = containers.get(id);

    if (!info) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const container = docker.getContainer(info.containerId);
    await container.stop();
    containers.delete(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error stopping container:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get container stats
app.get('/api/containers/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const info = containers.get(id);

    if (!info) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const container = docker.getContainer(info.containerId);
    const stats = await container.stats({ stream: false });

    res.json({
      cpu: stats.cpu_stats,
      memory: stats.memory_stats,
      network: stats.networks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Browse files in container workspace
app.get('/api/containers/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    const { path: subPath = '' } = req.query;
    const info = containers.get(id);

    if (!info) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const fullPath = join(info.workspaceDir, subPath);

    // Security check: ensure path is within workspace
    if (!fullPath.startsWith(info.workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const files = fs.readdirSync(fullPath).map(name => {
        const filePath = join(fullPath, name);
        const fileStat = fs.statSync(filePath);
        return {
          name,
          type: fileStat.isDirectory() ? 'directory' : 'file',
          size: fileStat.size,
          modified: fileStat.mtime
        };
      });
      res.json({ type: 'directory', files });
    } else {
      res.json({ type: 'file', name: subPath });
    }
  } catch (error) {
    console.error('Error browsing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Read file content
app.get('/api/containers/:id/files/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { path: subPath } = req.query;
    const info = containers.get(id);

    if (!info || !subPath) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const fullPath = join(info.workspaceDir, subPath);

    // Security check
    if (!fullPath.startsWith(info.workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot read directory' });
    }

    // Check file size (limit to 1MB for display)
    if (stat.size > 1024 * 1024) {
      return res.status(400).json({ error: 'File too large to display' });
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({
      content,
      name: subPath,
      size: stat.size,
      modified: stat.mtime
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of available wallpapers
app.get('/api/wallpapers', (req, res) => {
  try {
    const wallpapersDir = join(__dirname, '../public/images/wallpapers');

    // Create wallpapers directory if it doesn't exist
    if (!fs.existsSync(wallpapersDir)) {
      fs.mkdirSync(wallpapersDir, { recursive: true });
      return res.json([]);
    }

    const files = fs.readdirSync(wallpapersDir);
    const wallpapers = files.filter(file => {
      const ext = file.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    });

    res.json(wallpapers);
  } catch (error) {
    console.error('Error loading wallpapers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of workspace folders
app.get('/api/workspace/folders', (req, res) => {
  try {
    const workspaceDir = join(__dirname, '../workspace/containers');

    // Create workspace directory if it doesn't exist
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
      return res.json([]);
    }

    const folders = fs.readdirSync(workspaceDir)
      .filter(name => {
        const fullPath = join(workspaceDir, name);
        return fs.statSync(fullPath).isDirectory();
      })
      .map(name => {
        const fullPath = join(workspaceDir, name);
        const stat = fs.statSync(fullPath);
        return {
          name,
          path: fullPath,
          created: stat.birthtime,
          modified: stat.mtime
        };
      });

    res.json(folders);
  } catch (error) {
    console.error('Error loading workspace folders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete workspace folder
app.delete('/api/workspace/folders/:name', (req, res) => {
  try {
    const { name } = req.params;
    const workspaceDir = join(__dirname, '../workspace/containers');
    const folderPath = join(workspaceDir, name);

    // Security check: ensure path is within workspace
    if (!folderPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Remove folder recursively
    fs.rmSync(folderPath, { recursive: true, force: true });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save API keys (store in .env file or environment)
app.post('/api/settings/api-keys', (req, res) => {
  try {
    const { anthropic, gemini, openai } = req.body;

    // Update environment variables in memory
    if (anthropic) process.env.ANTHROPIC_API_KEY = anthropic;
    if (gemini) process.env.GEMINI_API_KEY = gemini;
    if (openai) process.env.OPENAI_API_KEY = openai;

    // Optionally, write to .env file (be careful with this in production)
    const envPath = join(__dirname, '../.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add keys
    const updateEnvVar = (content, key, value) => {
      if (!value) return content;
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + `\n${key}=${value}`;
      }
    };

    envContent = updateEnvVar(envContent, 'ANTHROPIC_API_KEY', anthropic);
    envContent = updateEnvVar(envContent, 'GEMINI_API_KEY', gemini);
    envContent = updateEnvVar(envContent, 'OPENAI_API_KEY', openai);

    fs.writeFileSync(envPath, envContent.trim() + '\n');

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving API keys:', error);
    res.status(500).json({ error: error.message });
  }
});

// Open local iTerm terminal
app.post('/api/terminal/local', (req, res) => {
  try {
    const { containerId, workspacePath } = req.body;

    // Check if running on macOS
    if (process.platform !== 'darwin') {
      return res.status(400).json({
        error: 'Local terminal opening is only supported on macOS'
      });
    }

    if (!containerId || !workspacePath) {
      return res.status(400).json({
        error: 'Container ID and workspace path are required'
      });
    }

    // Check if workspace directory exists
    if (!fs.existsSync(workspacePath)) {
      return res.status(404).json({
        error: 'Workspace directory not found'
      });
    }

    // Use iTerm2 URL scheme to open a new window in the workspace directory
    // Format: iterm2://open?path=<absolute_path>
    const escapedPath = encodeURIComponent(workspacePath);
    const itermUrl = `iterm2://open?path=${escapedPath}`;

    // Open iTerm with the URL scheme
    exec(`open "${itermUrl}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error opening iTerm:', error);
        // Fallback: try to open iTerm and cd to the directory using AppleScript
        const appleScript = `
          tell application "iTerm"
            activate
            create window with default profile
            tell current session of current window
              write text "cd '${workspacePath.replace(/'/g, "'\\\\''")}'"
            end tell
          end tell
        `;

        exec(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`, (scriptError) => {
          if (scriptError) {
            console.error('Error with AppleScript fallback:', scriptError);
            return res.status(500).json({
              error: 'Failed to open iTerm. Make sure iTerm is installed.'
            });
          }

          console.log(`✓ Opened local iTerm terminal for ${containerId} at ${workspacePath}`);
          res.json({
            success: true,
            message: 'iTerm terminal opened',
            path: workspacePath
          });
        });
        return;
      }

      console.log(`✓ Opened local iTerm terminal for ${containerId} at ${workspacePath}`);
      res.json({
        success: true,
        message: 'iTerm terminal opened',
        path: workspacePath
      });
    });
  } catch (error) {
    console.error('Error opening local terminal:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket handler for terminal proxy (if needed for custom features)
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Initialize and start server
async function start() {
  try {
    // Initialize Docker connection with fallback options
    console.log('Initializing Docker connection...');
    try {
      docker = new Docker({ socketPath: '/var/run/docker.sock' });
      await docker.ping();
      console.log('✓ Connected to Docker via /var/run/docker.sock');
    } catch (error) {
      console.log('Failed to connect via /var/run/docker.sock, trying alternative...');
      try {
        docker = new Docker({ socketPath: '/Users/javieralonso/.docker/run/docker.sock' });
        await docker.ping();
        console.log('✓ Connected to Docker via ~/.docker/run/docker.sock');
      } catch (error2) {
        console.error('Failed to connect to Docker:', error2.message);
        console.error('Make sure Docker Desktop is running');
        process.exit(1);
      }
    }

    await ensureAllImages();

    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════╗
║       🌊 ProteOS (P/OS) Server 🌊        ║
║   Shape-shifting AI from the depths      ║
╠═══════════════════════════════════════════╣
║  🐋 Claude  🔷 Gemini  ⚡ OpenAI           ║
║  🌐 Web UI: http://localhost:${PORT}       ║
║  🔧 API: http://localhost:${PORT}/api      ║
╚═══════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
