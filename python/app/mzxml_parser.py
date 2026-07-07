"""Parse mzXML/mzML files into sample × feature intensity matrices."""

from __future__ import annotations

import base64
import os
import re
import shutil
import struct
import tempfile
import xml.etree.ElementTree as ET
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


def _sample_id_from_filename(filename: str) -> str:
    base = os.path.basename(filename)
    return re.sub(r"\.(mzxml|mzml|xml)$", "", base, flags=re.IGNORECASE)


def _spectrum_ms_level(spectrum: Any) -> int:
    if hasattr(spectrum, "ms_level") and spectrum.ms_level:
        return int(spectrum.ms_level)
    for key in ("ms level", "ms_level", "MSms_level"):
        try:
            val = spectrum.get(key) if hasattr(spectrum, "get") else None
            if val is not None:
                return int(val)
        except Exception:
            continue
    return 1


def _spectrum_peaks(spectrum: Any) -> tuple[Any, Any]:
    mzs = getattr(spectrum, "mz", None)
    intensities = getattr(spectrum, "i", None)
    if mzs is not None and intensities is not None:
        return mzs, intensities
    peaks_attr = getattr(spectrum, "peaks", None)
    if peaks_attr is not None:
        try:
            peaks = peaks_attr("centroid") if callable(peaks_attr) else peaks_attr
            arr = np.asarray(peaks, dtype=float)
            if arr.ndim == 2 and arr.shape[1] >= 2:
                return arr[:, 0], arr[:, 1]
        except Exception:
            pass
    return None, None


def _local_tag(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def _decode_mzxml_peaks(text: str, precision: str = "32") -> tuple[list[float], list[float]]:
    raw = base64.b64decode(text.strip())
    fmt = ">ff" if precision == "32" else ">dd"
    step = 8 if precision == "32" else 16
    mzs: list[float] = []
    intensities: list[float] = []
    for offset in range(0, len(raw) - step + 1, step):
        mz, intensity = struct.unpack_from(fmt, raw, offset)
        mzs.append(float(mz))
        intensities.append(float(intensity))
    return mzs, intensities


def _extract_ms1_bins_xml(path: str, mz_decimals: int = 2) -> dict[float, float]:
    """Fallback mzXML parser using ElementTree (handles namespaced mzXML 3.x)."""
    bins: dict[float, float] = defaultdict(float)
    root = ET.parse(path).getroot()

    for spectrum in root.iter():
        tag = _local_tag(spectrum.tag)
        if tag not in ("spectrum", "scan"):
            continue
        ms_level = (
            spectrum.get("msLevel")
            or spectrum.get("ms_level")
            or spectrum.get("level")
            or "1"
        )
        if int(ms_level) != 1:
            continue
        for child in spectrum:
            child_tag = _local_tag(child.tag)
            if child_tag not in ("mzXMLPeaks", "peaks"):
                continue
            precision = child.get("precision", "32")
            if not child.text:
                continue
            mzs, intensities = _decode_mzxml_peaks(child.text, precision)
            for mz, intensity in zip(mzs, intensities, strict=False):
                if intensity and float(intensity) > 0:
                    bins[_round_mz(float(mz), mz_decimals)] += float(intensity)

    return dict(bins)


def _extract_ms1_bins_pymzml(path: str, mz_decimals: int = 2) -> dict[float, float]:
    if pymzml is None:
        raise RuntimeError("pymzML is not installed")

    bins: dict[float, float] = defaultdict(float)
    reader = pymzml.run.Reader(path, build_index_from_scratch=True)

    for spectrum in reader:
        if _spectrum_ms_level(spectrum) != 1:
            continue
        mzs, intensities = _spectrum_peaks(spectrum)
        if mzs is None or intensities is None:
            continue
        for mz, intensity in zip(mzs, intensities, strict=False):
            if intensity and float(intensity) > 0:
                key = _round_mz(float(mz), mz_decimals)
                bins[key] += float(intensity)

    return dict(bins)


def _extract_ms1_bins(path: str, mz_decimals: int = 2) -> dict[float, float]:
    """Sum intensities per rounded m/z from MS1 spectra in one mzXML/mzML file."""
    errors: list[str] = []
    is_mzxml = path.lower().endswith((".mzxml", ".xml"))

    # Prefer native XML parsing for mzXML — pymzML often mis-handles mzXML structure
    if is_mzxml:
        try:
            bins = _extract_ms1_bins_xml(path, mz_decimals)
            if bins:
                return bins
            errors.append("XML: no MS1 peaks found")
        except Exception as exc:
            errors.append(f"XML: {exc}")

    if pymzml is not None:
        try:
            bins = _extract_ms1_bins_pymzml(path, mz_decimals)
            if bins:
                return bins
            errors.append("pymzML: no MS1 peaks found")
        except Exception as exc:
            errors.append(f"pymzML: {exc}")

    if not is_mzxml:
        try:
            bins = _extract_ms1_bins_xml(path, mz_decimals)
            if bins:
                return bins
            errors.append("XML: no MS1 peaks found")
        except Exception as exc:
            errors.append(f"XML: {exc}")

    detail = "; ".join(errors) if errors else "no MS1 peaks found"
    raise ValueError(f"Could not parse mzXML ({detail})")


def _resolve_group(sample_id: str, filename: str, groups: dict[str, str] | None) -> str:
    if not groups:
        return "Group1"
    for key in (sample_id, filename, os.path.basename(filename)):
        if key in groups and groups[key]:
            return groups[key]
    return "Group1"


def list_mzxml_samples(file_paths: list[str]) -> list[dict[str, str]]:
    return [
        {"filename": os.path.basename(path), "sampleId": _sample_id_from_filename(path)}
        for path in file_paths
    ]


def parse_mzxml_files(
    file_paths: list[str],
    groups: dict[str, str] | None = None,
    mz_decimals: int = 2,
) -> dict[str, Any]:
    """Parse one or more mzXML/mzML files into a feature matrix."""
    if not file_paths:
        raise ValueError("No mzXML files provided")

    sample_bins: list[tuple[str, str, dict[float, float]]] = []
    for path in file_paths:
        if not os.path.isfile(path):
            raise ValueError(f"File not found: {os.path.basename(path)}")
        sample_id = _sample_id_from_filename(path)
        group = _resolve_group(sample_id, path, groups)
        bins = _extract_ms1_bins(path, mz_decimals)
        if not bins:
            raise ValueError(f"No MS1 data found in {os.path.basename(path)}")
        sample_bins.append((sample_id, group, bins))

    all_mz = sorted({mz for _, _, bins in sample_bins for mz in bins.keys()})
    if not all_mz:
        raise ValueError("No features extracted from mzXML files")

    features = []
    for mz in all_mz:
        fid = f"mz_{mz:.2f}".replace(".", "_")
        name = f"m/z {mz:.2f}"
        values = [bins.get(mz, 0.0) for _, _, bins in sample_bins]
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


def resolve_upload_paths(work_dir: str, paths: list[str]) -> list[str]:
    """Expand ZIP archives and return mzXML/mzML file paths."""
    resolved: list[str] = []
    seen: set[str] = set()
    for path in paths:
        if not os.path.isfile(path):
            continue
        if path.lower().endswith(".zip"):
            for extracted in extract_zip_mzxml(path, work_dir):
                if extracted not in seen:
                    seen.add(extracted)
                    resolved.append(extracted)
            continue
        if extracted_path := path:
            if extracted_path not in seen:
                seen.add(extracted_path)
                resolved.append(extracted_path)
    return resolved


def materialize_uploads(uploads: list[tuple[str, bytes]], work_dir: str | None = None) -> tuple[str, list[str]]:
    """
    Write uploaded file bytes to a working directory, expanding ZIP archives.
    Returns (work_dir, list of mzXML/mzML paths).
    """
    temp_dir = work_dir or tempfile.mkdtemp(prefix="mzxml_")
    os.makedirs(temp_dir, exist_ok=True)
    paths: list[str] = []

    for filename, content in uploads:
        if not content:
            continue
        safe_name = os.path.basename(filename or "upload.mzxml")
        if safe_name.lower().endswith(".zip"):
            zip_path = os.path.join(temp_dir, safe_name)
            with open(zip_path, "wb") as f:
                f.write(content)
            paths.extend(extract_zip_mzxml(zip_path, temp_dir))
        else:
            ext = os.path.splitext(safe_name)[1].lower()
            if ext not in (".mzxml", ".mzml", ".xml"):
                safe_name = f"{safe_name}.mzxml"
            out_path = os.path.join(temp_dir, safe_name)
            with open(out_path, "wb") as f:
                f.write(content)
            paths.append(out_path)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_paths: list[str] = []
    for p in paths:
        if p not in seen:
            seen.add(p)
            unique_paths.append(p)

    return temp_dir, unique_paths


def extract_zip_mzxml(zip_path: str, dest_dir: str) -> list[str]:
    """Extract mzXML/mzML files from a zip archive."""
    paths: list[str] = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for name in zf.namelist():
            if name.endswith("/"):
                continue
            if not name.lower().endswith((".mzxml", ".mzml", ".xml")):
                continue
            out = os.path.join(dest_dir, os.path.basename(name))
            with zf.open(name) as src, open(out, "wb") as dst:
                shutil.copyfileobj(src, dst)
            paths.append(out)
    return paths


def cleanup_work_dir(work_dir: str) -> None:
    if work_dir and os.path.isdir(work_dir):
        shutil.rmtree(work_dir, ignore_errors=True)
