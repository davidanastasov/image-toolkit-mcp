import { Client, StdioClientTransport } from "@modelcontextprotocol/client";
import { afterAll } from "bun:test";
import assert from "node:assert";

async function connectTestClient() {
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["src/server.ts"],
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

export async function createTestClient() {
  let client = await connectTestClient();

  afterAll(async () => {
    await client.close();
  });

  return {
    get client() {
      return client;
    },
  };
}

export function assertTextBlock(
  block: unknown,
): asserts block is { type: "text"; text: string } {
  assert(block, "Expected content block");
  assert(typeof block === "object", "Expected object block");
  assert("type" in block, "Missing type");
  assert(block.type === "text", "Expected text block");
  assert("text" in block, "Missing text");
}
