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

// Build the Claude Code Docker image if it doesn't exist
async function ensureImageExists() {
  try {
    await docker.getImage('whaleos-claude').inspect();
    console.log('✓ WhaleOS Claude image exists');
  } catch (error) {
    console.log('Building WhaleOS Claude image...');
    const stream = await docker.buildImage({
      context: join(__dirname, '..'),
      src: ['dockerfile', '.env']
    }, { t: 'whaleos-claude' });

    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
    });
    console.log('✓ WhaleOS Claude image built');
  }
}

// Create a new Claude Code container
app.post('/api/containers/create', async (req, res) => {
  try {
    const containerId = `claude-${Date.now()}`;
    const containerName = req.body.name || `Claude Terminal ${containers.size + 1}`;

    // Find an available port starting from 7681
    let port = 7681 + containers.size;

    // Create persistent workspace directory for this container
    const workspaceDir = join(__dirname, '..', 'workspace', 'containers', containerId);
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    const container = await docker.createContainer({
      Image: 'whaleos-claude',
      name: containerId,
      Env: [`ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`],
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
    await ensureImageExists();

    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════╗
║            WhaleOS Server                ║
╠══════════════════════════════════════════╣
║  🐋 Desktop OS for Claude Code           ║
║  🌐 Web UI: http://localhost:${PORT}      ║
║  🔧 API: http://localhost:${PORT}/api     ║
╚══════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
