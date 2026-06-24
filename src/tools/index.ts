import type { McpServer } from "@modelcontextprotocol/server";
import { registerImageConvertTool } from "./image-convert";
import { registerMetadataReadTool } from "./metadata-read";

export function registerAllTools(server: McpServer) {
  registerMetadataReadTool(server);
  registerImageConvertTool(server);
}
