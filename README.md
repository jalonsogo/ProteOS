# 🌊 ProteOS (P/OS)

> *"Shape-shifting intelligence from the depths of containerization"*

**ProteOS** — derived from **Proteus (Πρωτεύς)**, the Greek sea god of shape-shifting, wisdom, and prophecy. Just as Proteus could transform into any form, ProteOS adapts seamlessly between multiple AI providers, embodying flexibility and intelligence while maintaining Docker's oceanic heritage.

![ProteOS](https://img.shields.io/badge/status-production-green) ![Docker](https://img.shields.io/badge/docker-required-blue) ![Node](https://img.shields.io/badge/node-20+-green) ![AI](https://img.shields.io/badge/AI-3%20providers-purple)

## 🎭 The Mythology

**Proteus (Πρωτεύς)** was an ancient Greek sea deity known for:
- **Shape-shifting** — Symbolizing P/OS's ability to seamlessly switch between AI providers
- **Wisdom & Prophecy** — Representing the intelligence and insight of AI assistants
- **The Sea** — Perfectly connecting with Docker's whale and oceanic lineage
- **Adaptation** — Just as Proteus changed forms, P/OS adapts to your workflow

## ✨ Features

### 🌊 Ocean-Themed UI Design
- **Deep Ocean Aesthetic**: Immersive underwater gradient background with particle effects
- **Professional Icons**: Clean Lucide SVG icons throughout the interface
- **Glassmorphism Effects**: Modern backdrop blur and translucent elements
- **Dynamic Background**: Custom PNG background support with gradient overlay

### 🖥️ Desktop OS Experience
- **Familiar Interface**: Icons, windows, top navigation bar just like a real OS
- **Multi-Window Management**: Drag, resize, minimize, maximize multiple containers
- **Persistent Sessions**: Your work survives container restarts
- **Unlimited Instances**: Spawn multiple instances of the same AI provider concurrently

### 🎭 Multi-AI Provider Support
- **🐋 Claude Code** (Anthropic Claude 3.5 Sonnet)
- **🔷 Gemini CLI** (Google Gemini 2.5 Pro)
- **⚡ OpenAI Codex** (OpenAI GPT-4/Codex)

### 🐳 Docker-Powered
- **Isolated Containers**: Each AI runs in its own environment
- **Resource Efficient**: Only active containers consume resources
- **Easy Scaling**: Spawn unlimited AI instances

### 📁 File System
- **Persistent Storage**: Each container gets its own workspace
- **File Browser**: View and manage files across all containers
- **Easy Access**: Files stored locally in `workspace/containers/`

### 📊 System Monitoring
- **Live System Logs**: Dedicated window showing real-time operations and events
- **Log Filtering**: Filter logs by level (Info, Success, Warning, Error)
- **Auto-Scroll**: Optional automatic scrolling to latest log entries
- **Debug Visibility**: Track container creation, connections, and failures instantly

### 🌐 Web-Based
- **No Installation**: Access from any browser
- **Remote Access**: Run on server, access from anywhere
- **Cross-Platform**: Works on Mac, Linux, Windows

## 🏗️ Architecture

```
ProteOS/
├── server/
│   └── index.js          # Express server + Docker orchestration
├── public/
│   ├── index.html        # Desktop UI with Lucide icons
│   ├── styles.css        # Ocean-themed styling with glassmorphism
│   ├── app.js            # Window manager + logging system + API client
│   └── background.png    # Ocean background image (19MB)
├── dockerfile            # Claude Code image
├── dockerfile.gemini     # Gemini CLI image
├── dockerfile.openai     # OpenAI Codex image
├── Dockerfile            # Main P/OS container
├── docker-compose.yml    # One-command deployment
└── package.json          # Dependencies
```

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd ProteOS

# 2. Configure API keys
cp .env.example .env
nano .env  # Add your API keys

# 3. Start ProteOS
docker-compose up -d

# 4. Open your browser
open http://localhost:3000
```

### Using Native Node.js

```bash
# 1. Install dependencies
npm install

# 2. Configure API keys
cp .env.example .env
nano .env

# 3. Start server
npm start

# 4. Access at http://localhost:3000
```

## 🔑 API Keys

ProteOS supports three AI providers. Configure the ones you want to use:

```env
# Claude Code (Anthropic)
ANTHROPIC_API_KEY=your-claude-key
# Get from: https://console.anthropic.com/

# Gemini CLI (Google)
GEMINI_API_KEY=your-gemini-key
# Get from: https://aistudio.google.com/apikey

# OpenAI Codex
OPENAI_API_KEY=your-openai-key
# Get from: https://platform.openai.com/api-keys

# Server configuration
PORT=3000
```

## 🎮 Usage

### Launching AI Terminals

1. Click any AI provider icon on the desktop:
   - **Claude Code** (bot icon) — Anthropic's Claude
   - **Gemini CLI** (sparkles icon) — Google's Gemini
   - **OpenAI Codex** (zap icon) — OpenAI's GPT

2. Wait 3-5 seconds for container startup

3. Start coding with AI assistance!

4. Launch multiple instances of the same provider for parallel workflows

### Window Management

- **Drag**: Click title bar to move windows
- **Resize**: Drag bottom-right corner
- **Minimize**: Yellow `−` button (window hidden but container runs)
- **Maximize**: Green `□` button (fullscreen view)
- **Close**: Red `×` button (stops container permanently)
- **Bring to Front**: Click any window to focus it

### System Logs

- Click **System Logs** icon (terminal icon) on desktop
- Opens dedicated window showing all system events
- **Filter logs**: Click Info/Success/Warning/Error buttons
- **Clear logs**: Trash icon clears all entries
- **Auto-scroll**: Toggle to follow latest logs (arrow icon)
- Monitor container creation, connections, and failures in real-time

### File Browser

- Click **Files** icon (folder icon) on desktop
- Select a container from dropdown
- Navigate directories and view files
- All files persisted in `workspace/containers/`

### Top Navigation Bar

- **ProteOS Logo**: Shows system branding
- **Settings**: Configure system preferences
- **Folders**: Quick access to workspace directories
- **Help**: Documentation and support
- **Submit Bugs**: Report issues on GitHub
- **URL Badge**: Current server address (e.g., http://localhost:3001)
- **System Clock**: Real-time clock display

## 🎯 AI Provider Comparison

| Provider | Model | Context | Image Size | Free Tier |
|----------|-------|---------|------------|-----------|
| **🐋 Claude** | 3.5 Sonnet | 200K | 331MB | Usage-based |
| **🔷 Gemini** | 2.5 Pro | 1M | 651MB | 1K req/day |
| **⚡ OpenAI** | GPT-4/Codex | varies | 632MB | Pay-as-you-go |

## 📦 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive deployment guide including:

- Docker Compose deployment
- Cloud hosting (AWS, GCP, DigitalOcean)
- Reverse proxy configuration (nginx, Caddy)
- Security best practices
- Production optimization
- Monitoring and maintenance

## 🛠️ API Endpoints

### Container Management

```http
# Create container
POST /api/containers/create
Content-Type: application/json
{
  "name": "My AI Terminal",
  "type": "claude" | "gemini" | "openai"
}

# List containers
GET /api/containers

# Stop container
DELETE /api/containers/:id

# Get container stats
GET /api/containers/:id/stats
```

### File Operations

```http
# Browse files
GET /api/containers/:id/files?path=/some/path

# Read file
GET /api/containers/:id/files/read?path=/file.txt
```

## 🔒 Security

- **API Keys**: Stored as environment variables, never committed
- **Docker Socket**: Requires careful consideration in production
- **File Access**: Restricted to container workspaces only
- **Network**: Isolated container networks
- **HTTPS**: Use reverse proxy in production

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed security guidelines.

## 🐛 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs -f

# Verify API keys
docker-compose exec proteos env | grep API_KEY

# Check Docker
docker ps
```

### Terminal Not Loading
- Wait 5-10 seconds for initialization
- Check browser console for errors
- Verify port availability (3000, 7681+)
- Try refreshing the page

### Permission Issues
```bash
# Ensure Docker socket is accessible
ls -la /var/run/docker.sock

# On Linux, add user to docker group
sudo usermod -aG docker $USER
```

## 🗺️ Roadmap

- [x] Multi-AI provider support
- [x] Persistent file storage
- [x] File browser and viewer
- [x] Docker Compose deployment
- [x] Ocean-themed UI design
- [x] Lucide icon integration
- [x] System log viewer window
- [x] Multiple concurrent instances per provider
- [x] Dynamic port allocation
- [x] Glassmorphism effects
- [ ] User authentication
- [ ] Container resource monitoring dashboard
- [ ] Container templates/presets
- [ ] Mobile responsive design
- [ ] Theme customization (background images, colors)
- [ ] Keyboard shortcuts
- [ ] Session recording/playback
- [ ] Drag-and-drop file uploads
- [ ] Terminal command history

## 🤝 Contributing

Contributions welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 📄 License

MIT License - See [LICENSE](LICENSE) file

## 🙏 Credits

**ProteOS** is built with:

- [Claude Code](https://claude.com/claude-code) by Anthropic
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) by Google
- [OpenAI Codex](https://github.com/openai/codex) by OpenAI
- [ttyd](https://github.com/tsl0922/ttyd) for web terminals
- [Docker](https://docker.com) for containerization
- [Express](https://expressjs.com) for the server
- [Lucide](https://lucide.dev) for beautiful SVG icons

---

<div align="center">

**🌊 ProteOS — Shape-shifting AI containers from the depths 🌊**

*"Like Proteus, we adapt. Like the ocean, we contain multitudes."*

</div>
