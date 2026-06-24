import { afterAll } from "bun:test";
import assert from "node:assert";
import type { ContentBlock } from "@modelcontextprotocol/client";
import { Client, StdioClientTransport } from "@modelcontextprotocol/client";

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
  const client = await connectTestClient();

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

export function assertErrorBlock(
  block?: ContentBlock,
  code?: string,
  message?: string,
) {
  assert(block, "Expected content block");
  assert(typeof block === "object", "Expected object block");
  assert(block.type === "text", "Expected text block");

  const body = JSON.parse(block.text);

  assert("code" in body, "Missing code");
  if (code !== undefined) {
    assert(body.code === code, `Expected code ${code}, got ${body.code}`);
  }

  assert("message" in body, "Missing message");
  if (message !== undefined) {
    assert(
      body.message === message,
      `Expected message ${message}, got ${body.message}`,
    );
  }
}
