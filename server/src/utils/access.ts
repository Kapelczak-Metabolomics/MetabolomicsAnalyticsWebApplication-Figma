import { query } from "../db/index.js";
import type { AuthUser } from "../middleware/auth.js";

export function isAdmin(user?: AuthUser | null): boolean {
  return user?.role === "Administrator";
}

/**
 * SQL fragment restricting a projects query to those visible to the user:
 * the owner, an invited member (by user id or email), or any project for admins.
 * `alias` is the projects table alias; `paramStart` is the next positional param index.
 */
export function projectVisibilitySql(
  user: AuthUser,
  alias = "p",
  paramStart = 1
): { clause: string; params: unknown[]; nextIndex: number } {
  if (isAdmin(user)) {
    return { clause: "TRUE", params: [], nextIndex: paramStart };
  }
  const idParam = `$${paramStart}`;
  const emailParam = `$${paramStart + 1}`;
  const clause = `(${alias}.owner_id = ${idParam} OR EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = ${alias}.id
        AND (pm.user_id = ${idParam} OR lower(pm.email) = lower(${emailParam}))
    ))`;
  return { clause, params: [user.id, user.email], nextIndex: paramStart + 2 };
}

export async function canAccessProject(user: AuthUser, projectId: number): Promise<boolean> {
  if (isAdmin(user)) {
    const r = await query("SELECT 1 FROM projects WHERE id = $1", [projectId]);
    return r.rows.length > 0;
  }
  const r = await query(
    `SELECT 1 FROM projects p
     WHERE p.id = $1 AND (p.owner_id = $2 OR EXISTS (
       SELECT 1 FROM project_members pm
       WHERE pm.project_id = p.id AND (pm.user_id = $2 OR lower(pm.email) = lower($3))
     ))`,
    [projectId, user.id, user.email]
  );
  return r.rows.length > 0;
}

export async function canAccessDataset(user: AuthUser, datasetId: number): Promise<boolean> {
  if (isAdmin(user)) {
    const r = await query("SELECT 1 FROM datasets WHERE id = $1", [datasetId]);
    return r.rows.length > 0;
  }
  const r = await query(
    `SELECT 1 FROM datasets d JOIN projects p ON p.id = d.project_id
     WHERE d.id = $1 AND (p.owner_id = $2 OR EXISTS (
       SELECT 1 FROM project_members pm
       WHERE pm.project_id = p.id AND (pm.user_id = $2 OR lower(pm.email) = lower($3))
     ))`,
    [datasetId, user.id, user.email]
  );
  return r.rows.length > 0;
}

/**
 * Analyses (experiments) are private to the user who ran them; administrators
 * can see all. Returns a SQL fragment for the experiments alias.
 */
export function experimentVisibilitySql(
  user: AuthUser,
  alias = "e",
  paramStart = 1
): { clause: string; params: unknown[]; nextIndex: number } {
  if (isAdmin(user)) {
    return { clause: "TRUE", params: [], nextIndex: paramStart };
  }
  return { clause: `${alias}.user_id = $${paramStart}`, params: [user.id], nextIndex: paramStart + 1 };
}

export async function canAccessExperiment(user: AuthUser, experimentId: number): Promise<boolean> {
  if (isAdmin(user)) {
    const r = await query("SELECT 1 FROM experiments WHERE id = $1", [experimentId]);
    return r.rows.length > 0;
  }
  const r = await query(
    "SELECT 1 FROM experiments WHERE id = $1 AND user_id = $2",
    [experimentId, user.id]
  );
  return r.rows.length > 0;
}
