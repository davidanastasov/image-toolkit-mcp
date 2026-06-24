import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ErrorCode } from "@/lib/error";
import { pwaGenerateHandler } from "@/tools/pwa-generate";
import { fixture } from "../helpers/fixtures";

const TMP_DIR = join(import.meta.dir, "../../.tmp-pwa-test");

beforeAll(() => mkdirSync(TMP_DIR, { recursive: true }));
afterAll(() =>
  import("node:fs").then((fs) =>
    fs.rmSync(TMP_DIR, { recursive: true, force: true }),
  ),
);

function parse(result: Awaited<ReturnType<typeof pwaGenerateHandler>>) {
  const block = result.content[0];
  if (!block || block.type !== "text") throw new Error("Expected text block");
  return JSON.parse(block.text) as Record<string, unknown>;
}

describe("pwa_generate", () => {
  test("generates PNG icon files for all standard sizes", async () => {
    const result = await pwaGenerateHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
      name: "Test App",
    });
    expect(result.isError).toBeUndefined();
    const data = parse(result);
    const files = data.files as Array<{ path: string; purpose: string }>;
    const regularFiles = files.filter((f) => f.purpose === "any");
    expect(regularFiles.length).toBeGreaterThan(0);
    for (const f of regularFiles) {
      expect(existsSync(f.path)).toBe(true);
    }
  });

  test("generates maskable icon variants", async () => {
    const data = parse(
      await pwaGenerateHandler({
        image_path: fixture("sample-rgb.jpg"),
        output_dir: TMP_DIR,
        name: "Test App",
      }),
    );
    const files = data.files as Array<{ path: string; purpose: string }>;
    const maskable = files.filter((f) => f.purpose === "maskable");
    expect(maskable.length).toBeGreaterThan(0);
    for (const f of maskable) {
      expect(existsSync(f.path)).toBe(true);
    }
  });

  test("generates site.webmanifest with correct name", async () => {
    const data = parse(
      await pwaGenerateHandler({
        image_path: fixture("sample-rgb.jpg"),
        output_dir: TMP_DIR,
        name: "My PWA",
      }),
    );
    expect(existsSync(data.manifest_path as string)).toBe(true);
    const manifest = JSON.parse(
      readFileSync(data.manifest_path as string, "utf8"),
    );
    expect(manifest.name).toBe("My PWA");
  });

  test("manifest icons array includes entries for all generated files", async () => {
    const data = parse(
      await pwaGenerateHandler({
        image_path: fixture("sample-rgb.jpg"),
        output_dir: TMP_DIR,
        name: "Test App",
      }),
    );
    const manifest = data.manifest as {
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
    const hasMaskable = manifest.icons.some((i) => i.purpose === "maskable");
    expect(hasMaskable).toBe(true);
  });

  test("manifest uses provided short_name when given", async () => {
    const data = parse(
      await pwaGenerateHandler({
        image_path: fixture("sample-rgb.jpg"),
        output_dir: TMP_DIR,
        name: "My Progressive Web App",
        short_name: "MyApp",
      }),
    );
    expect((data.manifest as Record<string, unknown>).short_name).toBe("MyApp");
  });

  test("manifest uses theme_color when provided", async () => {
    const data = parse(
      await pwaGenerateHandler({
        image_path: fixture("sample-rgb.jpg"),
        output_dir: TMP_DIR,
        name: "Test App",
        theme_color: "#123456",
      }),
    );
    expect((data.manifest as Record<string, unknown>).theme_color).toBe(
      "#123456",
    );
  });

  test("returns html string with manifest and apple-touch-icon links", async () => {
    const data = parse(
      await pwaGenerateHandler({
        image_path: fixture("sample-rgb.jpg"),
        output_dir: TMP_DIR,
        name: "Test App",
      }),
    );
    const html = data.html as string;
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain("theme-color");
  });

  test("each file entry has path, filename, size, purpose, and size_bytes", async () => {
    const data = parse(
      await pwaGenerateHandler({
        image_path: fixture("sample-rgb.jpg"),
        output_dir: TMP_DIR,
        name: "Test App",
      }),
    );
    const files = data.files as Array<Record<string, unknown>>;
    const first = files[0];
    expect(typeof first.path).toBe("string");
    expect(typeof first.filename).toBe("string");
    expect(typeof first.size).toBe("string");
    expect(typeof first.purpose).toBe("string");
    expect(typeof first.size_bytes).toBe("number");
  });

  test("returns FILE_NOT_FOUND for missing input", async () => {
    const result = await pwaGenerateHandler({
      image_path: "/no/such.jpg",
      output_dir: TMP_DIR,
      name: "Test App",
    });
    expect(result.isError).toBe(true);
    const body = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(body.code).toBe(ErrorCode.FILE_NOT_FOUND);
  });

  test("returns OUTPUT_NOT_WRITABLE for non-existent output directory", async () => {
    const result = await pwaGenerateHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: "/no/such/dir",
      name: "Test App",
    });
    expect(result.isError).toBe(true);
    const body = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(body.code).toBe(ErrorCode.OUTPUT_NOT_WRITABLE);
  });
});
