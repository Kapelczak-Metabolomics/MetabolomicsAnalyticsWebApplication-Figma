"""MetaboAnalytics Python analysis & mzXML import service."""

from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analysis_engine import run_analysis
from app.mzxml_parser import (
    cleanup_work_dir,
    list_mzxml_samples,
    materialize_uploads,
    parse_mzxml_files,
)

app = FastAPI(title="MetaboAnalytics Python Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _read_uploads(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    uploads: list[tuple[str, bytes]] = []
    for upload in files:
        content = await upload.read()
        if content:
            uploads.append((upload.filename or "upload.mzxml", content))
    return uploads


def _parse_groups(groups: str | None) -> dict[str, str]:
    if not groups:
        return {}
    try:
        parsed = json.loads(groups)
        if not isinstance(parsed, dict):
            raise ValueError("groups must be a JSON object")
        return {str(k): str(v) for k, v in parsed.items()}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid groups JSON: {e}") from e


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "python-analysis"}


@app.post("/import/mzxml/preview")
async def preview_mzxml(files: list[UploadFile] = File(...)) -> dict[str, Any]:
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    uploads = await _read_uploads(files)
    work_dir, paths = materialize_uploads(uploads)
    try:
        if not paths:
            raise HTTPException(status_code=400, detail="No mzXML/mzML files found in upload")
        return {"samples": list_mzxml_samples(paths)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    finally:
        cleanup_work_dir(work_dir)


@app.post("/import/mzxml")
async def import_mzxml(
    files: list[UploadFile] = File(...),
    groups: str | None = Form(None),
) -> dict[str, Any]:
    """Parse mzXML/mzML file(s) or a zip archive into a feature matrix."""
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    group_map = _parse_groups(groups)
    uploads = await _read_uploads(files)
    work_dir, paths = materialize_uploads(uploads)

    try:
        if not paths:
            raise HTTPException(status_code=400, detail="No mzXML/mzML files found in upload")
        return parse_mzxml_files(paths, group_map)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    finally:
        cleanup_work_dir(work_dir)


@app.post("/analysis/{analysis_type}")
async def analyze(analysis_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    samples = payload.get("samples", [])
    features = payload.get("features", [])
    config = payload.get("config", {})
    if not samples or not features:
        raise HTTPException(status_code=400, detail="samples and features are required")
    try:
        return run_analysis(analysis_type, samples, features, config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
