import type { McpServer } from "@modelcontextprotocol/server";
import { registerImageCompressTool } from "./image-compress";
import { registerImageConvertTool } from "./image-convert";
import { registerMetadataReadTool } from "./metadata-read";

export function registerAllTools(server: McpServer) {
  registerMetadataReadTool(server);
  registerImageCompressTool(server);
  registerImageConvertTool(server);
}
