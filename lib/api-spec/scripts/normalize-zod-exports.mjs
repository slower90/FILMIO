import { readFile, writeFile } from "node:fs/promises";

const indexPath = new URL("../../api-zod/src/index.ts", import.meta.url);
const generatedBarrelExport = "export * from './generated/types';\n";
const source = await readFile(indexPath, "utf8");

if (source.includes(generatedBarrelExport)) {
  await writeFile(indexPath, source.replace(generatedBarrelExport, ""));
}