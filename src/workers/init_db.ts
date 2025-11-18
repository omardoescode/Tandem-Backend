import fs from "fs";
import path from "path";
import pool from "@/db/pool";

const client = await pool.connect();

try {
  const dir = path.resolve("./migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");

    // naive split by semicolon; good enough for schema files
    const statements = raw
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`Running ${file}: ${statements.length} statements`);

    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        if (err instanceof Error)
          console.error("ERROR running statement:", err.message);
      }
    }
  }
} finally {
  client.release();
}
