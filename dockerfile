# Smallest working image - Alpine with native ttyd
FROM node:20-alpine

# Add edge community repo for ttyd and install minimal packages
RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk add --no-cache \
    ttyd \
    bash \
    git \
    && rm -rf /var/cache/apk/*

# Install Claude Code with production flag to minimize size
RUN npm install -g @anthropic-ai/claude-code --production --no-audit --no-fund && \
    npm cache clean --force && \
    rm -rf /tmp/* /root/.npm

# Create startup script that properly maintains the session
RUN echo '#!/bin/bash' > /start.sh && \
    echo 'if [ -z "$ANTHROPIC_API_KEY" ]; then' >> /start.sh && \
    echo '  echo "Error: Set ANTHROPIC_API_KEY environment variable"' >> /start.sh && \
    echo '  echo "Exiting..."' >> /start.sh && \
    echo '  sleep 5' >> /start.sh && \
    echo '  exit 1' >> /start.sh && \
    echo 'fi' >> /start.sh && \
    echo '' >> /start.sh && \
    echo 'echo "Claude Code ready at http://localhost:7681"' >> /start.sh && \
    echo 'echo ""' >> /start.sh && \
    echo 'echo "Available commands:"' >> /start.sh && \
    echo 'echo "  claude-code help    - Show help"' >> /start.sh && \
    echo 'echo "  claude-code chat    - Start chat"' >> /start.sh && \
    echo 'echo "  claude-code edit    - Edit files"' >> /start.sh && \
    echo 'echo ""' >> /start.sh && \
    chmod +x /start.sh

# Set proper environment for interactive terminal
ENV TERM=xterm-256color
ENV SHELL=/bin/bash

EXPOSE 7681
WORKDIR /workspace

# Use ttyd with proper options for interactive terminal
# -W: Allow write permissions (keyboard input)
# -t: Terminal options
CMD ["ttyd", "-W", "-p", "7681", "-t", "titleFixed=Claude Code Terminal", "-t", "theme={'background':'#1e1e1e','foreground':'#ffffff'}", "/bin/bash", "-il", "-c", "source /start.sh; exec bash -i"]