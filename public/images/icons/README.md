# ProteOS Custom Icons

This directory contains custom icons used throughout the ProteOS interface.

## Required Icon Files

Place your custom PNG or SVG files in this directory with the following names:

### Desktop Icons
- `claude.svg` / `claude.png` - Claude Code terminal icon
- `gemini.svg` / `gemini.png` - Gemini CLI terminal icon
- `openai.svg` / `openai.png` - OpenAI Codex terminal icon
- `files.svg` / `files.png` - File browser icon
- `logs.svg` / `logs.png` - System logs icon
- `about.svg` / `about.png` - About/info icon

## Icon Specifications

### Desktop Icons
- **Size**: 48x48 pixels
- **Format**: SVG (preferred) or PNG
- **Background**: Transparent
- **Style**: Should work well against dark ocean-themed background

### Window Title Icons
- **Size**: 20x20 pixels (automatically resized from desktop icons)
- **Format**: SVG (preferred) or PNG
- **Background**: Transparent

### Minimized Bar & Sessions Widget Icons
- **Size**: 18-20 pixels (automatically resized)
- **Format**: SVG (preferred) or PNG
- **Background**: Transparent

## Fallback Behavior

The application includes automatic fallback handling:
1. First tries to load `.svg` version
2. If SVG fails, automatically falls back to `.png` version via `onerror` attribute
3. If both fail, falls back to emoji icons (🐋, 🔷, ⚡)

## Usage

Simply place your icon files in this directory and they will be automatically used throughout the interface:
- Desktop icons
- Window titles
- Minimized sessions bar
- Active sessions widget

## Tips

- Use SVG format for best quality at all sizes
- Ensure icons are clearly visible on dark backgrounds
- Consider using white or light colors with slight transparency
- Test icons at different sizes to ensure clarity
