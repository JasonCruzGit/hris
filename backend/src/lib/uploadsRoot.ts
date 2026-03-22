import fs from "node:fs";
import path from "node:path";

/**
 * Absolute path to `backend/uploads`, regardless of `process.cwd()`.
 * Ensures the directory exists (multer and static need a real folder).
 */
export function uploadsRoot(): string {
  const dir = path.join(__dirname, "..", "..", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
