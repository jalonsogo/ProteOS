import express from 'express';
import Docker from 'dockerode';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const docker = new Docker();

const PORT = process.env.PORT || 3000;
const containers = new Map(); // Store container info: id -> { containerId, port, name }

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Image configurations
const imageConfigs = {
  claude: {
    name: 'proteos-claude',
    dockerfile: 'dockerfile',
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
  try {
    const type = req.body.type || 'claude';
    const config = imageConfigs[type];

    if (!config) {
      return res.status(400).json({ error: 'Invalid container type' });
    }

    const containerId = `${type}-${Date.now()}`;
    const containerName = req.body.name || `${type.charAt(0).toUpperCase() + type.slice(1)} Terminal ${containers.size + 1}`;

    // Find an available port starting from 7681
    let port = 7681 + containers.size;

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

    const container = await docker.createContainer({
      Image: config.name,
      name: containerId,
      Env: [`${config.env}=${apiKey}`],
      HostConfig: {
        PortBindings: {
          '7681/tcp': [{ HostPort: port.toString() }]
        },
        Binds: [
          `${workspaceDir}:/workspace`
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
