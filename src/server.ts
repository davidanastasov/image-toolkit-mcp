import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { logger } from "@/lib/logger";
import { registerAllTools } from "./tools";

const server = new McpServer({
  name: "image-toolkit-mcp",
  version: "1.0.0",
});

registerAllTools(server);

try {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("image-toolkit-mcp server ready");
} catch (err) {
  logger.error({ err }, "failed to start server");
  process.exit(1);
}
