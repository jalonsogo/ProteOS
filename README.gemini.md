# 🔷 WhaleOS Gemini CLI Image

A minimal Docker image for running Google Gemini CLI in a web-based terminal.

## Image Info

- **Base:** Node.js 20 Alpine (~651MB)
- **Includes:** Gemini CLI, ttyd, bash, git
- **Terminal:** Web-based via ttyd on port 7681

## Prerequisites

- Docker installed and running
- Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Quick Start

### Option 1: Run Directly

```bash
docker run -d \
  -e GEMINI_API_KEY=your-api-key-here \
  -p 7681:7681 \
  -v $(pwd)/workspace:/workspace \
  whaleos-gemini
```

### Option 2: Build from Source

```bash
# Build the image
docker build -f dockerfile.gemini -t whaleos-gemini .

# Run it
docker run -d \
  -e GEMINI_API_KEY=your-api-key-here \
  -p 7681:7681 \
  -v $(pwd)/workspace:/workspace \
  whaleos-gemini
```

## Access

Open your browser and navigate to:
```
http://localhost:7681
```

## Usage

Once inside the terminal, you can use Gemini CLI:

```bash
# Start interactive chat
gemini

# Start chat mode explicitly
gemini chat

# Show help
gemini --help

# Ask a question directly
gemini "What is Docker?"

# Use extensions
gemini extensions list
gemini extensions install <url>
```

## Features

### Gemini CLI Capabilities

- ✅ **Gemini 2.5 Pro** with 1M token context window
- ✅ **Google Search** grounding for up-to-date information
- ✅ **File operations** - read, write, edit files in workspace
- ✅ **Shell commands** - execute bash commands
- ✅ **Web fetching** - retrieve web content
- ✅ **Extensions** - install from Figma, Stripe, and more

### Free Tier

With a personal Google account:
- 60 requests per minute
- 1,000 requests per day
- No credit card required

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Your Gemini API key | Yes |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID (for paid licenses) | No |

## Volume Mounting

Mount `/workspace` to persist your work:

```bash
-v /path/to/your/folder:/workspace
```

All files created in the container will be saved to your local machine.

## Comparison with Claude Code

| Feature | Gemini CLI | Claude Code |
|---------|------------|-------------|
| Model | Gemini 2.5 Pro | Claude 3.5 Sonnet |
| Context | 1M tokens | 200K tokens |
| Free Tier | 1K req/day | Usage-based |
| Extensions | Yes (Figma, Stripe) | MCP Servers |
| Image Size | 651MB | 331MB |

## Troubleshooting

### API Key Not Set

If you see an error about missing API key:

1. Get your key from https://aistudio.google.com/apikey
2. Set it when running the container:
   ```bash
   -e GEMINI_API_KEY=your-actual-key
   ```

### Container Exits Immediately

Check the logs:
```bash
docker logs <container-id>
```

Make sure your API key is valid and set correctly.

## Integration with WhaleOS

This image can be used with the WhaleOS web UI by:

1. Adding a new image type in `server/index.js`
2. Creating a Gemini icon on the desktop
3. Updating the container creation logic

See the main README for WhaleOS integration details.

## Resources

- [Gemini CLI GitHub](https://github.com/google-gemini/gemini-cli)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Get API Key](https://aistudio.google.com/apikey)
- [Hands-on Tutorial](https://codelabs.developers.google.com/gemini-cli-hands-on)
- [Extensions Guide](https://blog.google/technology/developers/gemini-cli-extensions/)

## License

MIT

## Credits

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) by Google
- [ttyd](https://github.com/tsl0922/ttyd) for web terminal
