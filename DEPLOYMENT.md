# WhaleOS Deployment Guide

WhaleOS offers multiple deployment methods to suit different use cases.

## 📦 Deployment Options

### Option 1: Docker Compose (Recommended)

The easiest way to run WhaleOS in production.

**Pros:**
- ✅ One command deployment
- ✅ Automatic container management
- ✅ Easy updates and maintenance
- ✅ Built-in restart policies
- ✅ Network isolation

**Quick Start:**

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd WhaleOS

# 2. Create .env file with your API keys
cp .env.example .env
nano .env  # Add your actual API keys

# 3. Start WhaleOS
docker-compose up -d

# 4. Access at http://localhost:3000
```

**Commands:**
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Update
git pull && docker-compose up -d --build
```

---

### Option 2: Docker Run

For manual Docker deployment without compose.

```bash
# Build the image
docker build -t whaleos:latest .

# Run the container
docker run -d \
  --name whaleos \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/workspace:/workspace \
  -e ANTHROPIC_API_KEY=your-key \
  -e GEMINI_API_KEY=your-key \
  -e OPENAI_API_KEY=your-key \
  whaleos:latest
```

---

### Option 3: Native Node.js

Run directly on your system without containers.

**Prerequisites:**
- Node.js 20+
- Docker installed and running

**Setup:**
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your API keys

# Start server
npm start
```

---

## 🔐 Security Considerations

### API Keys
- Never commit `.env` file with real keys
- Use environment variables in production
- Rotate keys regularly

### Docker Socket Access
WhaleOS needs access to Docker socket to manage containers:
```bash
-v /var/run/docker.sock:/var/run/docker.sock
```

**Security implications:**
- Container has root access to Docker
- Only run in trusted environments
- Consider using Docker socket proxy for production

### Network Security
```bash
# Bind to localhost only
-p 127.0.0.1:3000:3000

# Use reverse proxy (nginx, Caddy) for HTTPS
```

---

## 🌐 Production Deployment

### With Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### With Caddy (Automatic HTTPS)

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

---

## 🚀 Cloud Deployment

### Docker Hub Distribution

```bash
# Build and tag
docker build -t yourusername/whaleos:latest .

# Push to Docker Hub
docker push yourusername/whaleos:latest

# Others can pull and run
docker pull yourusername/whaleos:latest
docker run -d -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e ANTHROPIC_API_KEY=xxx \
  -e GEMINI_API_KEY=xxx \
  -e OPENAI_API_KEY=xxx \
  yourusername/whaleos:latest
```

### AWS/DigitalOcean/GCP

1. Provision a VM with Docker installed
2. Clone repo or pull Docker image
3. Run with docker-compose
4. Configure firewall for port 3000
5. Set up domain and SSL certificate

---

## 🔄 Updates and Maintenance

### Updating WhaleOS

**Docker Compose:**
```bash
git pull
docker-compose down
docker-compose up -d --build
```

**Docker Run:**
```bash
docker stop whaleos
docker rm whaleos
git pull
docker build -t whaleos:latest .
docker run -d ... # your run command
```

### Backing Up Data

```bash
# Backup workspace
tar -czf whaleos-backup-$(date +%Y%m%d).tar.gz workspace/

# Restore
tar -xzf whaleos-backup-20251008.tar.gz
```

---

## 📊 Monitoring

### Health Check

WhaleOS includes a built-in health check:
```bash
curl http://localhost:3000
```

### Docker Health Status

```bash
docker ps --filter "name=whaleos" --format "table {{.Names}}\t{{.Status}}"
```

### Logs

```bash
# Docker Compose
docker-compose logs -f

# Docker Run
docker logs -f whaleos

# Native
# Logs go to console
```

---

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs whaleos

# Common issues:
# 1. Port already in use
# 2. Missing API keys
# 3. Docker socket not accessible
```

### Can't Create AI Containers

```bash
# Verify Docker socket is mounted
docker exec whaleos docker ps

# Check API keys are set
docker exec whaleos env | grep API_KEY
```

### Permission Denied Errors

```bash
# Ensure Docker socket has correct permissions
ls -la /var/run/docker.sock

# On Linux, add user to docker group
sudo usermod -aG docker $USER
```

---

## 🎯 Best Practices

1. **Use Docker Compose** for simplicity
2. **Mount workspace volume** for persistent storage
3. **Set resource limits** in production:
   ```yaml
   services:
     whaleos:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 4G
   ```
4. **Enable logging** to external service
5. **Regular backups** of workspace directory
6. **Monitor container health** with alerting
7. **Use HTTPS** in production with reverse proxy

---

## 📚 Additional Resources

- Main README: [README.md](README.md)
- Gemini CLI Guide: [README.gemini.md](README.gemini.md)
- GitHub Issues: Report bugs and request features

---

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude Code API key | For Claude |
| `GEMINI_API_KEY` | Gemini CLI API key | For Gemini |
| `OPENAI_API_KEY` | OpenAI Codex API key | For OpenAI |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (production/development) | No |

---

## 🆘 Support

If you encounter issues:

1. Check the logs
2. Verify API keys are set correctly
3. Ensure Docker is running
4. Check port availability
5. Review this deployment guide
6. Open an issue on GitHub

---

## 📄 License

MIT License - See LICENSE file for details
