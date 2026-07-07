import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import type { MzxmlUploadFile } from "./mzxml-upload.js";

const SESSION_ROOT = path.join(os.tmpdir(), "metabo-mzxml-sessions");
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type MzxmlSession = {
  id: string;
  userId: number;
  dir: string;
  files: MzxmlUploadFile[];
  createdAt: number;
};

function sessionDir(id: string) {
  return path.join(SESSION_ROOT, id);
}

function isExpired(session: MzxmlSession) {
  return Date.now() - session.createdAt > SESSION_TTL_MS;
}

export function createMzxmlSession(userId: number): MzxmlSession {
  fs.mkdirSync(SESSION_ROOT, { recursive: true });
  const id = crypto.randomUUID();
  const dir = sessionDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const session: MzxmlSession = { id, userId, dir, files: [], createdAt: Date.now() };
  saveMzxmlSession(session);
  return session;
}

export function loadMzxmlSession(sessionId: string, userId: number): MzxmlSession | null {
  const dir = sessionDir(sessionId);
  const metaPath = path.join(dir, ".session.json");
  if (!fs.existsSync(metaPath)) return null;
  const session = JSON.parse(fs.readFileSync(metaPath, "utf8")) as MzxmlSession;
  if (session.userId !== userId || isExpired(session)) {
    destroyMzxmlSession(sessionId);
    return null;
  }
  session.files = session.files.filter((f) => fs.existsSync(f.path));
  return session;
}

function saveMzxmlSession(session: MzxmlSession) {
  fs.writeFileSync(path.join(session.dir, ".session.json"), JSON.stringify(session));
}

export function addFileToMzxmlSession(
  sessionId: string,
  userId: number,
  file: { path: string; filename: string }
): MzxmlSession | null {
  const session = loadMzxmlSession(sessionId, userId);
  if (!session) return null;
  session.files = session.files.filter((f) => f.filename !== file.filename);
  session.files.push({ path: file.path, filename: file.filename });
  saveMzxmlSession(session);
  return session;
}

export function getSessionUploadFiles(sessionId: string, userId: number): MzxmlUploadFile[] {
  return loadMzxmlSession(sessionId, userId)?.files ?? [];
}

export function destroyMzxmlSession(sessionId: string) {
  const dir = sessionDir(sessionId);
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

export async function cleanupMzxmlSession(sessionId: string) {
  destroyMzxmlSession(sessionId);
}
