"""Parse mzXML files into sample × feature intensity matrices."""

from __future__ import annotations

import os
import re
import tempfile
import zipfile
from collections import defaultdict
from typing import Any

import numpy as np

try:
    import pymzml
except ImportError:  # pragma: no cover
    pymzml = None


def _round_mz(mz: float, decimals: int = 2) -> float:
    return round(float(mz), decimals)


def _extract_ms1_bins(path: str, mz_decimals: int = 2) -> dict[float, float]:
    """Sum intensities per rounded m/z from MS1 spectra in one mzXML file."""
    if pymzml is None:
        raise RuntimeError("pymzML is not installed")

    bins: dict[float, float] = defaultdict(float)
    reader = pymzml.run.Reader(path)

    for spectrum in reader:
        if spectrum.get("ms level", 1) != 1:
            continue
        mzs = spectrum.mz
        intensities = spectrum.i
        if mzs is None or intensities is None:
            continue
        for mz, intensity in zip(mzs, intensities, strict=False):
            if intensity and intensity > 0:
                key = _round_mz(mz, mz_decimals)
                bins[key] += float(intensity)

    return dict(bins)


def _sample_id_from_filename(filename: str) -> str:
    base = os.path.basename(filename)
    return re.sub(r"\.(mzxml|mzXML|xml)$", "", base, flags=re.IGNORECASE)


def parse_mzxml_files(
    file_paths: list[str],
    groups: dict[str, str] | None = None,
    mz_decimals: int = 2,
) -> dict[str, Any]:
    """
    Parse one or more mzXML files.

    Each file becomes one sample (typical LC-MS metabolomics workflow).
    Features are binned m/z values aggregated across all samples.
    """
    if not file_paths:
        raise ValueError("No mzXML files provided")

    sample_bins: list[tuple[str, str, dict[float, float]]] = []
    for path in file_paths:
        sample_id = _sample_id_from_filename(path)
        group = (groups or {}).get(sample_id) or (groups or {}).get(os.path.basename(path)) or "Group1"
        bins = _extract_ms1_bins(path, mz_decimals)
        if not bins:
            raise ValueError(f"No MS1 data found in {os.path.basename(path)}")
        sample_bins.append((sample_id, group, bins))

    all_mz = sorted({mz for _, _, bins in sample_bins for mz in bins.keys()})
    if not all_mz:
        raise ValueError("No features extracted from mzXML files")

    features = []
    for idx, mz in enumerate(all_mz):
        fid = f"mz_{mz:.2f}".replace(".", "_")
        name = f"m/z {mz:.2f}"
        values = [bins.get(mz) for _, _, bins in sample_bins]
        features.append({
            "featureId": fid,
            "name": name,
            "featureClass": "MS1",
            "pathway": None,
            "values": values,
        })

    samples = [
        {"sampleId": sid, "groupLabel": grp, "values": [bins.get(mz, 0.0) for mz in all_mz]}
        for sid, grp, bins in sample_bins
    ]

    total_cells = len(samples) * len(features)
    missing = sum(1 for f in features for v in f["values"] if v is None or v == 0)
    missing_pct = round((missing / total_cells) * 100, 1) if total_cells else 0.0

    return {
        "samples": samples,
        "features": features,
        "samplesCount": len(samples),
        "featuresCount": len(features),
        "missingPct": missing_pct,
        "sourceFormat": "mzXML",
    }


def save_upload_to_temp(filename: str, content: bytes) -> str:
    """Write uploaded bytes to a temp file and return path."""
    suffix = ".mzxml" if not filename.lower().endswith((".mzxml", ".xml")) else ""
    fd, path = tempfile.mkstemp(suffix=suffix or os.path.splitext(filename)[1] or ".mzxml")
    os.close(fd)
    with open(path, "wb") as f:
        f.write(content)
    return path


def extract_zip_mzxml(zip_path: str, dest_dir: str) -> list[str]:
    """Extract mzXML files from a zip archive."""
    paths: list[str] = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for name in zf.namelist():
            if name.lower().endswith((".mzxml", ".xml")) and not name.endswith("/"):
                out = os.path.join(dest_dir, os.path.basename(name))
                with zf.open(name) as src, open(out, "wb") as dst:
                    dst.write(src.read())
                paths.append(out)
    return paths
