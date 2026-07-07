import fs from "fs";
import path from "path";
import { query } from "../db/index.js";
import { deleteS3Prefix, loadS3Config, uploadS3Object, type S3Config } from "./s3.js";

const RAW_DIR = process.env.RAW_DATA_DIR || "/data/raw";

export interface RawFileInput {
  filename: string;
  buffer?: Buffer;
  path?: string;
}

export interface StorageSettings {
  provider?: "local" | "s3" | string;
  maxUploadMb?: number;
}

export async function loadStorageSettings(): Promise<StorageSettings> {
  const result = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key = 'storage'");
  return (result.rows[0]?.value ?? { provider: "local" }) as StorageSettings;
}

export async function getActiveStorageProvider(): Promise<"local" | "s3"> {
  const storage = await loadStorageSettings();
  if (storage.provider === "s3") {
    const s3 = await loadS3Config();
    if (s3?.bucket && s3.accessKeyId && s3.secretAccessKey) return "s3";
  }
  return "local";
}

function localDatasetDir(datasetId: number) {
  return path.join(RAW_DIR, String(datasetId));
}

function s3DatasetPrefix(datasetId: number) {
  return `raw/${datasetId}`;
}

export function formatStoragePath(provider: "local" | "s3", datasetId: number, bucket?: string) {
  if (provider === "s3" && bucket) return `s3://${bucket}/${s3DatasetPrefix(datasetId)}`;
  return localDatasetDir(datasetId);
}

export function parseStoragePath(rawPath: string): { provider: "local" | "s3"; localPath?: string; bucket?: string; prefix?: string } {
  if (rawPath.startsWith("s3://")) {
    const without = rawPath.slice("s3://".length);
    const slash = without.indexOf("/");
    if (slash === -1) return { provider: "s3", bucket: without, prefix: "" };
    return { provider: "s3", bucket: without.slice(0, slash), prefix: without.slice(slash + 1) };
  }
  return { provider: "local", localPath: rawPath };
}

export async function saveRawDatasetFiles(datasetId: number, files: RawFileInput[]): Promise<string> {
  const provider = await getActiveStorageProvider();

  if (provider === "s3") {
    const s3 = await loadS3Config() as S3Config;
    const prefix = s3DatasetPrefix(datasetId);
    for (const file of files) {
      const key = `${prefix}/${path.basename(file.filename)}`;
      const body = file.buffer ?? (file.path ? fs.readFileSync(file.path) : Buffer.alloc(0));
      await uploadS3Object(s3, key, body, "application/octet-stream");
    }
    return formatStoragePath("s3", datasetId, s3.bucket);
  }

  const dir = localDatasetDir(datasetId);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const dest = path.join(dir, path.basename(file.filename));
    if (file.path) {
      fs.copyFileSync(file.path, dest);
    } else if (file.buffer) {
      fs.writeFileSync(dest, file.buffer);
    }
  }
  return dir;
}

export async function deleteRawDatasetFiles(rawFilePath?: string | null) {
  if (!rawFilePath) return;
  const parsed = parseStoragePath(rawFilePath);
  if (parsed.provider === "s3" && parsed.bucket && parsed.prefix) {
    const s3 = await loadS3Config();
    if (s3?.bucket) await deleteS3Prefix(s3, parsed.prefix.endsWith("/") ? parsed.prefix : `${parsed.prefix}/`);
    return;
  }
  if (parsed.localPath && fs.existsSync(parsed.localPath)) {
    fs.rmSync(parsed.localPath, { recursive: true, force: true });
  }
}
