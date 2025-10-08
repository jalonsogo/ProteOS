# 🐋 WhaleOS

A desktop OS-like web interface for managing multiple containerized Claude Code instances. Click the Claude icon to spawn new terminals, each running in its own Docker container with full isolation.

![WhaleOS](https://img.shields.io/badge/status-alpha-orange) ![Docker](https://img.shields.io/badge/docker-required-blue) ![Node](https://img.shields.io/badge/node-20+-green)

## Features

- 🖥️ **Desktop OS Interface**: Familiar desktop environment with icons, windows, and taskbar
- 🐳 **Docker Container Management**: Each Claude Code instance runs in its own isolated container
- 🪟 **Window Management**: Drag, resize, minimize, maximize, and close windows
- 🔄 **Multiple Instances**: Spawn as many Claude Code terminals as needed
- 🌐 **Web-Based Access**: Access from any browser, no installation needed
- ⚡ **Real-time Updates**: Live container count and system information

## Architecture

```
WhaleOS/
├── server/
│   └── index.js          # Express server + Docker management
├── public/
│   ├── index.html        # Desktop UI
│   ├── styles.css        # OS-like styling
│   └── app.js            # Window manager + API client
├── dockerfile            # Claude Code container image
├── .env                  # API key configuration
└── package.json          # Dependencies
```

## Prerequisites

- Docker Desktop installed and running
- Node.js 20+ installed
- Anthropic API key

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your API key:**
   Edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your-actual-api-key-here
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Usage

### Launching Claude Code Terminals

1. **Double-click the Claude Code icon** (🐋) on the desktop
2. Wait 3-5 seconds for the container to start
3. A new window will appear with the Claude Code terminal
4. Start chatting with Claude!

### Window Management

- **Drag**: Click and drag the window header to move
- **Resize**: Drag the bottom-right corner to resize
- **Minimize**: Click the yellow `−` button
- **Maximize**: Click the green `□` button
- **Close**: Click the red `×` button (stops the container)

### Taskbar

- **Active windows** appear as buttons in the taskbar
- Click a taskbar button to restore a minimized window
- Container count and current time displayed on the right

## API Endpoints

### Create Container
```http
POST /api/containers/create
Content-Type: application/json

{
  "name": "My Claude Terminal"
}
```

### List Containers
```http
GET /api/containers
```

### Stop Container
```http
DELETE /api/containers/:id
```

### Get Container Stats
```http
GET /api/containers/:id/stats
```

## Configuration

### Environment Variables

- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)
- `PORT`: Server port (default: 3000)

### Docker Image

The base Claude Code container is defined in `dockerfile`:
- Based on Alpine Linux with Node.js 20
- Includes ttyd for web terminal access
- Claude Code CLI pre-installed
- Each container exposes a unique port (7681+)

## Development

### Watch Mode
```bash
npm run dev
```

### Building the Docker Image Manually
```bash
docker build -t whaleos-claude .
```

### Running a Container Manually
```bash
docker run -d \
  -e ANTHROPIC_API_KEY=your-key \
  -p 7681:7681 \
  whaleos-claude
```

## Troubleshooting

### Container fails to start
- Ensure Docker Desktop is running
- Check that the API key is set correctly in `.env`
- Verify no port conflicts (3000, 7681+)

### Terminal not loading
- Wait 5-10 seconds for the container to fully initialize
- Check browser console for errors
- Try refreshing the page

### Docker build fails
- Ensure you have internet connection (downloads packages)
- Try clearing Docker cache: `docker system prune`

## Project Structure

### Backend (`server/index.js`)
- Express HTTP server
- Docker API integration via `dockerode`
- Container lifecycle management
- Port allocation and routing

### Frontend (`public/`)
- Vanilla JavaScript (no frameworks)
- Desktop window management system
- Real-time container status updates
- Responsive design

## Roadmap

- [ ] Persistent container sessions
- [ ] Container resource monitoring
- [ ] File sharing between containers
- [ ] User authentication
- [ ] Container templates/presets
- [ ] Mobile responsive layout
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcuts

## License

MIT

## Credits

Built with:
- [Claude Code](https://claude.com/claude-code) by Anthropic
- [ttyd](https://github.com/tsl0922/ttyd) for web terminal
- [Docker](https://docker.com) for containerization
- [Express](https://expressjs.com) for the server
