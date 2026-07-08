import fs from "fs";
import os from "os";
import path from "path";
import { query } from "../db/index.js";
import { deleteS3Prefix, loadS3Config, uploadS3Object, type S3Config } from "./s3.js";
import { GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { clientFromConfig } from "./s3.js";

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

export interface RawDatasetFileInfo {
  filename: string;
  sizeBytes: number;
  modifiedAt: string;
}

function isMzxmlFilename(name: string) {
  return /\.(mzxml|mzml|xml)$/i.test(name);
}

export async function listRawDatasetFiles(rawFilePath?: string | null): Promise<RawDatasetFileInfo[]> {
  if (!rawFilePath) return [];
  const parsed = parseStoragePath(rawFilePath);

  if (parsed.provider === "s3" && parsed.prefix) {
    const s3 = await loadS3Config();
    if (!s3?.bucket) return [];
    const client = clientFromConfig(s3);
    const prefix = parsed.prefix.endsWith("/") ? parsed.prefix : `${parsed.prefix}/`;
    const page = await client.send(new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix }));
    return (page.Contents ?? [])
      .filter((obj) => obj.Key && !obj.Key.endsWith("/"))
      .map((obj) => {
        const filename = path.basename(obj.Key!);
        return {
          filename,
          sizeBytes: obj.Size ?? 0,
          modifiedAt: obj.LastModified?.toISOString() ?? new Date().toISOString(),
        };
      })
      .filter((f) => isMzxmlFilename(f.filename))
      .sort((a, b) => a.filename.localeCompare(b.filename));
  }

  if (!parsed.localPath || !fs.existsSync(parsed.localPath)) return [];
  return fs
    .readdirSync(parsed.localPath)
    .filter((name) => isMzxmlFilename(name))
    .map((filename) => {
      const stat = fs.statSync(path.join(parsed.localPath!, filename));
      return {
        filename,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export async function deleteRawDatasetFile(rawFilePath: string | null | undefined, filename: string) {
  if (!rawFilePath) throw new Error("Dataset has no raw files");
  const safeName = path.basename(filename);
  const parsed = parseStoragePath(rawFilePath);

  if (parsed.provider === "s3" && parsed.prefix) {
    const s3 = await loadS3Config();
    if (!s3?.bucket) throw new Error("S3 storage is not configured");
    const key = `${parsed.prefix}/${safeName}`;
    const client = clientFromConfig(s3);
    await client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
    return;
  }

  if (!parsed.localPath) throw new Error("Invalid storage path");
  const dest = path.join(parsed.localPath, safeName);
  if (!fs.existsSync(dest)) throw new Error("File not found");
  fs.rmSync(dest, { force: true });
}

/** Materialize raw dataset files to a temp directory for Python re-processing. */
export async function materializeRawDatasetFiles(
  rawFilePath: string | null | undefined,
  filenames?: string[]
): Promise<{ workDir: string; files: RawFileInput[] }> {
  if (!rawFilePath) throw new Error("Dataset has no raw files");
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "metabo-raw-"));
  const parsed = parseStoragePath(rawFilePath);
  const wanted = filenames?.map((f) => path.basename(f));

  if (parsed.provider === "s3" && parsed.prefix) {
    const s3 = await loadS3Config();
    if (!s3?.bucket) throw new Error("S3 storage is not configured");
    const client = clientFromConfig(s3);
    const prefix = parsed.prefix.endsWith("/") ? parsed.prefix : `${parsed.prefix}/`;
    const page = await client.send(new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix }));
    const objects = (page.Contents ?? []).filter((obj) => obj.Key && !obj.Key.endsWith("/"));
    for (const obj of objects) {
      const filename = path.basename(obj.Key!);
      if (!isMzxmlFilename(filename)) continue;
      if (wanted?.length && !wanted.includes(filename)) continue;
      const dest = path.join(workDir, filename);
      const res = await client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: obj.Key! }));
      const body = await res.Body?.transformToByteArray();
      if (!body) continue;
      fs.writeFileSync(dest, Buffer.from(body));
    }
  } else if (parsed.localPath && fs.existsSync(parsed.localPath)) {
    for (const name of fs.readdirSync(parsed.localPath)) {
      if (!isMzxmlFilename(name)) continue;
      if (wanted?.length && !wanted.includes(name)) continue;
      fs.copyFileSync(path.join(parsed.localPath, name), path.join(workDir, name));
    }
  }

  const files = fs
    .readdirSync(workDir)
    .filter((name) => isMzxmlFilename(name))
    .map((name) => ({ filename: name, path: path.join(workDir, name) }));

  if (!files.length) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw new Error("No mzXML files found in dataset storage");
  }

  return { workDir, files };
}

export function cleanupWorkDir(workDir: string) {
  if (workDir && fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
