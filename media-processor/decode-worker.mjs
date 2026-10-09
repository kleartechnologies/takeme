// Native decoding runs in a disposable subprocess, killed by the parent deadline.
import { readFile, writeFile } from "node:fs/promises";
import { normalize } from "./normalize.mjs";
const [input, directory, expectedDigest, expectedMime] = process.argv.slice(2);
try {
  const result = await normalize(await readFile(input), expectedDigest, expectedMime);
  for (const [name, variant] of Object.entries(result.variants)) {
    await writeFile(`${directory}/${name}.webp`, variant.bytes, { flag: "wx", mode: 0o600 });
    delete variant.bytes;
  }
  await writeFile(`${directory}/result.json`, JSON.stringify(result), { flag: "wx", mode: 0o600 });
} catch { process.exitCode = 1; } // Never log image metadata or native parser messages.
