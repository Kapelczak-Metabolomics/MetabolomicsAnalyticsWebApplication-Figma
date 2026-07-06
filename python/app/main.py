"""MetaboAnalytics Python analysis & mzXML import service."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analysis_engine import run_analysis
from app.mzxml_parser import extract_zip_mzxml, parse_mzxml_files, save_upload_to_temp

app = FastAPI(title="MetaboAnalytics Python Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "python-analysis"}


@app.post("/import/mzxml")
async def import_mzxml(
    files: list[UploadFile] = File(...),
    groups: str | None = Form(None),
) -> dict[str, Any]:
    """
    Parse mzXML file(s) or a zip of mzXML files into a feature matrix.

    Optional `groups` JSON: {"sample_filename": "GroupA", ...}
    """
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    group_map: dict[str, str] = {}
    if groups:
        try:
            group_map = json.loads(groups)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid groups JSON: {e}") from e

    temp_dir = tempfile.mkdtemp(prefix="mzxml_")
    paths: list[str] = []

    try:
        for upload in files:
            content = await upload.read()
            if not content:
                continue
            fname = upload.filename or "upload.mzxml"
            if fname.lower().endswith(".zip"):
                zip_path = os.path.join(temp_dir, fname)
                with open(zip_path, "wb") as f:
                    f.write(content)
                paths.extend(extract_zip_mzxml(zip_path, temp_dir))
            else:
                path = save_upload_to_temp(fname, content)
                paths.append(path)

        if not paths:
            raise HTTPException(status_code=400, detail="No mzXML files found in upload")

        result = parse_mzxml_files(paths, group_map)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
        for p in paths:
            if os.path.exists(p) and temp_dir not in p:
                try:
                    os.remove(p)
                except OSError:
                    pass


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
