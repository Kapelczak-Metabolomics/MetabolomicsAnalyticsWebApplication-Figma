import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";

export const MAX_MZXML_UPLOAD_BYTES = 500 * 1024 * 1024;

export type MzxmlUploadFile = {
  path: string;
  filename: string;
};

const uploadDir = path.join(os.tmpdir(), "metabo-mzxml-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^\w.\-()+ ]/g, "_");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
  },
});

export const mzxmlUpload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_MZXML_UPLOAD_BYTES, files: 50 },
});

export function uploadsFromRequest(files: Express.Multer.File[] | undefined): MzxmlUploadFile[] {
  if (!files?.length) return [];
  return files.map((f) => ({
    path: f.path,
    filename: f.originalname || path.basename(f.path),
  }));
}

export async function cleanupUploadFiles(files: MzxmlUploadFile[]): Promise<void> {
  await Promise.all(files.map((f) => fs.promises.unlink(f.path).catch(() => undefined)));
}
