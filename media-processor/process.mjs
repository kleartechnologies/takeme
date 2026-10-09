import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export async function isolatedNormalize(bytes, digest = createHash("sha256").update(bytes).digest("hex"), expectedMime) {
  const dir = await mkdtemp(join(tmpdir(), "takeme-image-"));
  try {
    await writeFile(join(dir, "input"), bytes, { flag: "wx", mode: 0o600 });
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--max-old-space-size=256", fileURLToPath(new URL("decode-worker.mjs", import.meta.url)), join(dir, "input"), dir, digest, ...(expectedMime ? [expectedMime] : [])], { stdio: "ignore", env: Object.fromEntries(["PATH","LD_LIBRARY_PATH","TMPDIR","MALLOC_ARENA_MAX","VIPS_CONCURRENCY"].flatMap(key => process.env[key] ? [[key,process.env[key]]] : [])) });
      const timer = setTimeout(() => { child.kill("SIGKILL"); }, 45_000);
      child.on("error", e => { clearTimeout(timer); reject(e); });
      child.on("exit", code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error("photo-processing-failed")); });
    });
    const result = JSON.parse(await readFile(join(dir, "result.json"), "utf8"));
    for (const [name, variant] of Object.entries(result.variants)) variant.bytes = await readFile(join(dir, `${name}.webp`));
    return result;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
