import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** AV1-only decoder. No HEIF/HEVC parser or fallback binary is installed. */
export async function decodeAvif(bytes, limits) {
  const directory = await mkdtemp(join(tmpdir(), "takeme-avif-"));
  try {
    const input = join(directory, "input.avif"), output = join(directory, "decoded.png");
    await writeFile(input, bytes, { flag: "wx", mode: 0o600 });
    await promisify(execFile)("/usr/local/bin/avifdec", ["--jobs", "1", "--depth", "8", "--size-limit", String(limits.pixels), "--dimension-limit", String(limits.edge), input, output],
      { timeout: limits.seconds * 1000, killSignal: "SIGKILL", maxBuffer: 16 * 1024, env: Object.fromEntries(["PATH", "LD_LIBRARY_PATH", "TMPDIR"].flatMap(key => process.env[key] ? [[key, process.env[key]]] : [])) });
    if ((await stat(output)).size > limits.pixels * 4 + limits.bytes) throw new Error("decoded-input-too-large");
    return await readFile(output);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
