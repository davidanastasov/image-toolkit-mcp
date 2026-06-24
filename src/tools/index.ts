import type { McpServer } from "@modelcontextprotocol/server";
import { registerImageCompressTool } from "./image-compress";
import { registerImageConvertTool } from "./image-convert";
import { registerImageHashTool } from "./image-hash";
import { registerImageResizeTool } from "./image-resize";
import { registerImageSrcsetTool } from "./image-srcset";
import { registerMetadataReadTool } from "./metadata-read";
import { registerMetadataStripTool } from "./metadata-strip";
import { registerPwaGenerateTool } from "./pwa-generate";

export function registerAllTools(server: McpServer) {
  registerMetadataReadTool(server);
  registerMetadataStripTool(server);
  registerImageHashTool(server);
  registerImageCompressTool(server);
  registerImageConvertTool(server);
  registerImageResizeTool(server);
  registerImageSrcsetTool(server);
  registerPwaGenerateTool(server);
}
