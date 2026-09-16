/**
 * Ensure Next.js builds from the on-disk path casing.
 *
 * On Windows, navigating with a differently-cased drive/path (e:\ vs E:\)
 * duplicates Node module instances — including Next's workAsyncStorage —
 * and prerender fails with "Expected workStore to be initialized".
 *
 * Resolving this file via import.meta.url + realpath yields the true casing.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = fs.realpathSync(path.join(scriptDir, ".."));
process.chdir(root);

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [nextBin, ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
