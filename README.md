# Image Toolkit MCP

An MCP server exposing image processing and accessibility tools to AI coding assistants.

## Setup

Install dependencies:

```bash
bun install
```

## Commands

```bash
# Testing
bun run test

# Build
bun run build
```

## Project Structure

```
src/
  server.ts        # MCP server entry point
  tools/
    index.ts       # Registers all tools with the server
    metadata.ts    # Example tool: reads image metadata
    resize.ts      # Example tool: resizes images

tests/
  helpers/
    mcp-client.ts    # Helper for testing MCP server
  mcp/
    metadata.test.ts # Tests for metadata tool
    resize.test.ts   # Tests for resize tool
```

## Tech Stack

- **Runtime**: Bun
- **MCP SDK**: `@modelcontextprotocol/server`
- **Schema validation**: Zod v4

## Supported tools

| Tool                | Category      |
| ------------------- | ------------- |
| `metadata_read`     | Info          |
| `image_resize`      | Transform     |
| `image_convert`     | Transform     |
| `image_compress`    | Transform     |
| `alt_text_generate` | Accessibility |
| `pwa_generate`      | Output        |
| `image_hash`        | Info          |
| `contrast_check`    | Accessibility |
| `favicon_generate`  | Output        |
| `metadata_strip`    | Transform     |
| `image_audit`       | Info          |
