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
import zlib
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

import numpy as np

try:
    import pymzml
except ImportError:  # pragma: no cover
    pymzml = None


def _round_mz(mz: float, decimals: int = 2) -> float:
    return round(float(mz), decimals)


@dataclass
class Ms1Scan:
    rt_minutes: float | None
    mzs: list[float]
    intensities: list[float]


@dataclass
class MetaboliteTarget:
    name: str
    mz: float
    adduct: str | None = None
    rt: float | None = None


def _retention_minutes_from_element(elem: ET.Element) -> float | None:
    for attr in ("retentionTime", "retention_time", "retTime"):
        value = elem.get(attr)
        if value is not None:
            try:
                rt = float(value)
                # mzXML commonly stores seconds; values > 20 are likely seconds.
                return rt / 60.0 if rt > 20 else rt
            except ValueError:
                continue
    for child in elem.iter():
        tag = _local_tag(child.tag)
        if tag in ("retentionTime", "retention_time") and child.text:
            try:
                rt = float(child.text.strip())
                return rt / 60.0 if rt > 20 else rt
            except ValueError:
                continue
    return None


def _peaks_from_spectrum(spectrum: ET.Element) -> tuple[list[float], list[float]]:
    mzs: list[float] = []
    intensities: list[float] = []

    peaks_b64 = spectrum.get("peaksBase64")
    if peaks_b64:
        precision = spectrum.get("precision", "32")
        byte_order = spectrum.get("byteOrder", "network")
        mzs, intensities = _decode_mzxml_peaks(peaks_b64, precision, byte_order)
        return mzs, intensities

    mz_array: list[float] | None = None
    intensity_array: list[float] | None = None

    for child in spectrum.iter():
        tag = _local_tag(child.tag)
        if tag in ("mzXMLPeaks", "peaks") and child.text and child.text.strip():
            precision = child.get("precision", "32")
            byte_order = child.get("byteOrder", child.get("byteorder", "network"))
            compression = child.get("compressionType", child.get("compression", "none"))
            mzs, intensities = _decode_mzxml_peaks(child.text, precision, byte_order, compression)
            return mzs, intensities
        if tag == "binaryDataArray":
            kind = _binary_array_kind(child)
            binary_elem = next((c for c in child if _local_tag(c.tag) == "binary"), None)
            if kind and binary_elem is not None and binary_elem.text:
                values = _decode_mzml_binary(binary_elem.text)
                if kind == "mz":
                    mz_array = values
                else:
                    intensity_array = values

    if mz_array and intensity_array:
        return mz_array, intensity_array
    return mzs, intensities


def _extract_ms1_scans_xml(path: str) -> list[Ms1Scan]:
    scans: list[Ms1Scan] = []
    root = ET.parse(path).getroot()
    for spectrum in root.iter():
        tag = _local_tag(spectrum.tag)
        if tag not in ("spectrum", "scan"):
            continue
        if _ms_level_from_element(spectrum) != 1:
            continue
        mzs, intensities = _peaks_from_spectrum(spectrum)
        if not mzs:
            continue
        scans.append(Ms1Scan(_retention_minutes_from_element(spectrum), mzs, intensities))
    return scans


def _extract_ms1_scans(path: str) -> list[Ms1Scan]:
    """Return MS1 scans with optional RT and peak arrays."""
    _validate_ms_file(path)
    for extractor in (_extract_ms1_scans_xml,):
        try:
            scans = extractor(path)
            if scans:
                return scans
        except Exception:
            continue

    # Fallback: aggregate bins as a single pseudo-scan (no RT).
    bins = _extract_ms1_bins(path)
    if not bins:
        return []
    mzs = list(bins.keys())
    intensities = [bins[m] for m in mzs]
    return [Ms1Scan(None, mzs, intensities)]


def _nearest_peak_intensity(
    mzs: list[float],
    intensities: list[float],
    target_mz: float,
    mz_tolerance: float,
) -> float:
    best = 0.0
    for mz, intensity in zip(mzs, intensities, strict=False):
        if intensity and float(intensity) > 0 and abs(float(mz) - target_mz) <= mz_tolerance:
            best = max(best, float(intensity))
    return best


def _pick_target_intensity(
    scans: list[Ms1Scan],
    target: MetaboliteTarget,
    mz_tolerance: float,
    rt_tolerance: float,
) -> float:
    if not scans:
        return 0.0

    if target.rt is not None:
        rt_matches = [
            scan
            for scan in scans
            if scan.rt_minutes is not None and abs(scan.rt_minutes - target.rt) <= rt_tolerance
        ]
        search_scans = rt_matches or [scan for scan in scans if scan.rt_minutes is not None]
        if not search_scans:
            search_scans = scans
        elif not rt_matches:
            search_scans = sorted(
                search_scans,
                key=lambda scan: abs((scan.rt_minutes or 0.0) - target.rt),
            )[:3]
    else:
        search_scans = scans

    best = 0.0
    for scan in search_scans:
        best = max(best, _nearest_peak_intensity(scan.mzs, scan.intensities, target.mz, mz_tolerance))
    return best


def _scan_rt_minutes(scan: Ms1Scan, index: int) -> float:
    if scan.rt_minutes is not None:
        return float(scan.rt_minutes)
    return float(index)


def extract_xic_from_scans(
    scans: list[Ms1Scan],
    target_mz: float,
    mz_tolerance: float = 0.01,
) -> list[dict[str, float]]:
    """Build an extracted ion chromatogram (RT vs summed target m/z intensity)."""
    points: list[dict[str, float]] = []
    for index, scan in enumerate(scans):
        intensity = _nearest_peak_intensity(scan.mzs, scan.intensities, target_mz, mz_tolerance)
        points.append({"rt": _scan_rt_minutes(scan, index), "intensity": intensity})
    points.sort(key=lambda point: point["rt"])
    return points


def extract_xics_from_files(
    file_paths: list[str],
    target_mz: float,
    mz_tolerance: float = 0.01,
    groups: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Extract XIC traces for one target m/z across multiple mzXML files."""
    if not file_paths:
        raise ValueError("No mzXML files provided")

    traces: list[dict[str, Any]] = []
    for path in file_paths:
        if not os.path.isfile(path):
            raise ValueError(f"File not found: {os.path.basename(path)}")
        sample_id = _sample_id_from_filename(path)
        group = _resolve_group(sample_id, path, groups)
        scans = _extract_ms1_scans(path)
        if not scans:
            continue
        chromatogram = extract_xic_from_scans(scans, target_mz, mz_tolerance)
        traces.append({
            "sampleId": sample_id,
            "groupLabel": group,
            "filename": os.path.basename(path),
            "rt": [point["rt"] for point in chromatogram],
            "intensity": [point["intensity"] for point in chromatogram],
        })

    if not traces:
        raise ValueError("No XIC data could be extracted from mzXML files")

    return {
        "mz": target_mz,
        "mzTolerance": mz_tolerance,
        "traces": traces,
    }


def _slug_feature_id(name: str, mz: float) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower()).strip("_")
    return slug or f"mz_{mz:.2f}".replace(".", "_")


def parse_target_list(raw: list[dict[str, Any]] | None) -> list[MetaboliteTarget]:
    if not raw:
        return []
    targets: list[MetaboliteTarget] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            mz = float(item.get("mz"))
        except (TypeError, ValueError):
            continue
        name = str(item.get("name") or f"m/z {mz}")
        adduct = item.get("adduct")
        rt_raw = item.get("rt")
        rt = None if rt_raw in (None, "") else float(rt_raw)
        targets.append(
            MetaboliteTarget(
                name=name,
                mz=mz,
                adduct=str(adduct) if adduct else None,
                rt=rt,
            )
        )
    return targets


def _sample_id_from_filename(filename: str) -> str:
    base = os.path.basename(filename)
    return re.sub(r"\.(mzxml|mzml|xml)$", "", base, flags=re.IGNORECASE)


def _local_tag(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def _sniff_file_kind(path: str) -> str:
    with open(path, "rb") as f:
        head = f.read(4096).decode("utf-8", errors="ignore").lower()
    if head.lstrip().startswith("<!doctype") or "<html" in head:
        return "html"
    if "<mzml" in head:
        return "mzml"
    if "<mzxml" in head:
        return "mzxml"
    ext = os.path.splitext(path)[1].lower()
    if ext in (".mzxml", ".xml"):
        return "mzxml"
    if ext == ".mzml":
        return "mzml"
    return "unknown"


def _validate_ms_file(path: str) -> None:
    kind = _sniff_file_kind(path)
    if kind == "html":
        raise ValueError(
            "Uploaded file is not mzXML — received an HTML error page instead of spectra data. "
            "Re-upload the file and confirm the Python service stays healthy during import."
        )


def _struct_fmt(precision: str, byte_order: str) -> str:
    endian = ">" if byte_order in ("network", "big", "") else "<"
    return f"{endian}dd" if precision == "64" else f"{endian}ff"


def _decode_mzxml_peaks(
    text: str,
    precision: str = "32",
    byte_order: str = "network",
    compression: str = "none",
) -> tuple[list[float], list[float]]:
    raw = base64.b64decode(text.strip())
    if compression.lower() in ("zlib", "gzip"):
        raw = zlib.decompress(raw)
    fmt = _struct_fmt(precision, byte_order)
    step = 16 if precision == "64" else 8
    mzs: list[float] = []
    intensities: list[float] = []
    for offset in range(0, len(raw) - step + 1, step):
        mz, intensity = struct.unpack_from(fmt, raw, offset)
        mzs.append(float(mz))
        intensities.append(float(intensity))
    return mzs, intensities


def _accumulate_bins(
    bins: dict[float, float],
    mzs: list[float],
    intensities: list[float],
    mz_decimals: int,
) -> None:
    for mz, intensity in zip(mzs, intensities, strict=False):
        if intensity and float(intensity) > 0:
            bins[_round_mz(float(mz), mz_decimals)] += float(intensity)


def _ms_level_from_element(elem: ET.Element) -> int:
    for attr in ("msLevel", "ms_level", "level"):
        value = elem.get(attr)
        if value is not None and str(value).strip().isdigit():
            return int(value)
    for child in elem.iter():
        tag = _local_tag(child.tag)
        if tag in ("msLevel", "ms_level") and child.text and child.text.strip().isdigit():
            return int(child.text.strip())
        if tag == "cvParam":
            name = (child.get("name") or "").lower()
            if name == "ms level" and child.get("value", "").strip().isdigit():
                return int(child.get("value", "1"))
    return 1


def _binary_array_kind(array_elem: ET.Element) -> str | None:
    for child in array_elem.iter():
        if _local_tag(child.tag) != "cvParam":
            continue
        name = (child.get("name") or "").lower()
        if "m/z array" in name or name == "mass-to-charge ratio array":
            return "mz"
        if "intensity array" in name:
            return "intensity"
    return None


def _decode_mzml_binary(text: str, precision_bits: int = 64) -> list[float]:
    raw = base64.b64decode(text.strip())
    if precision_bits >= 64:
        return [float(v) for v in struct.unpack(f">{len(raw) // 8}d", raw)]
    return [float(v) for v in struct.unpack(f">{len(raw) // 4}f", raw)]


def _extract_peaks_from_spectrum(
    spectrum: ET.Element,
    bins: dict[float, float],
    mz_decimals: int,
) -> None:
    peaks_b64 = spectrum.get("peaksBase64")
    if peaks_b64:
        precision = spectrum.get("precision", "32")
        byte_order = spectrum.get("byteOrder", "network")
        mzs, intensities = _decode_mzxml_peaks(peaks_b64, precision, byte_order)
        _accumulate_bins(bins, mzs, intensities, mz_decimals)

    mz_array: list[float] | None = None
    intensity_array: list[float] | None = None

    for child in spectrum.iter():
        tag = _local_tag(child.tag)
        if tag in ("mzXMLPeaks", "peaks") and child.text and child.text.strip():
            precision = child.get("precision", "32")
            byte_order = child.get("byteOrder", child.get("byteorder", "network"))
            compression = child.get("compressionType", child.get("compression", "none"))
            mzs, intensities = _decode_mzxml_peaks(child.text, precision, byte_order, compression)
            _accumulate_bins(bins, mzs, intensities, mz_decimals)
            continue
        if tag == "binaryDataArray":
            kind = _binary_array_kind(child)
            binary_elem = next((c for c in child if _local_tag(c.tag) == "binary"), None)
            if kind and binary_elem is not None and binary_elem.text:
                values = _decode_mzml_binary(binary_elem.text)
                if kind == "mz":
                    mz_array = values
                else:
                    intensity_array = values

    if mz_array and intensity_array:
        _accumulate_bins(bins, mz_array, intensity_array, mz_decimals)


def _extract_ms1_bins_xml(path: str, mz_decimals: int = 2) -> dict[float, float]:
    """Parse inline spectrum/scan peak data from mzXML or mzML."""
    bins: dict[float, float] = defaultdict(float)
    root = ET.parse(path).getroot()

    for spectrum in root.iter():
        tag = _local_tag(spectrum.tag)
        if tag not in ("spectrum", "scan"):
            continue
        if _ms_level_from_element(spectrum) != 1:
            continue
        _extract_peaks_from_spectrum(spectrum, bins, mz_decimals)

    return dict(bins)


def _extract_ms1_bins_indexed(path: str, mz_decimals: int = 2) -> dict[float, float]:
    """Read peak data from indexed mzXML files (ProteoWizard / msconvert)."""
    with open(path, "rb") as f:
        data = f.read()

    index_match = re.search(
        rb"<index\b[^>]*\bname=[\"'](?:scan|spectrum)[\"'][^>]*>(.*?)</index>",
        data,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not index_match:
        return {}

    offsets = re.findall(
        rb"<offset\b[^>]*\bid=[\"']([^\"']*)[\"'][^>]*>(\d+)</offset>",
        index_match.group(1),
        flags=re.IGNORECASE,
    )
    if not offsets:
        return {}

    bins: dict[float, float] = defaultdict(float)
    peaks_re = re.compile(
        rb"<(?:peaks|mzXMLPeaks)\b([^>]*)>([^<]+)</(?:peaks|mzXMLPeaks)>",
        flags=re.IGNORECASE,
    )

    with open(path, "rb") as f:
        for _scan_id, offset_raw in offsets:
            offset = int(offset_raw)
            f.seek(offset)
            chunk = f.read(256 * 1024)
            if not chunk:
                continue
            if b'msLevel="1"' not in chunk and b"msLevel='1'" not in chunk and b"<msLevel>1</msLevel>" not in chunk:
                continue
            text = chunk.decode("utf-8", errors="ignore")
            try:
                elem = ET.fromstring(text[: text.rfind(">") + 1])
            except ET.ParseError:
                continue
            if _ms_level_from_element(elem) != 1:
                continue
            _extract_peaks_from_spectrum(elem, bins, mz_decimals)
            if not bins:
                for attrs_raw, payload in peaks_re.findall(chunk):
                    attrs = attrs_raw.decode("utf-8", errors="ignore")
                    precision = "64" if 'precision="64"' in attrs or "precision='64'" in attrs else "32"
                    byte_order = "little" if "little" in attrs.lower() else "network"
                    compression = "zlib" if "zlib" in attrs.lower() else "none"
                    mzs, intensities = _decode_mzxml_peaks(
                        payload.decode("utf-8", errors="ignore"),
                        precision,
                        byte_order,
                        compression,
                    )
                    _accumulate_bins(bins, mzs, intensities, mz_decimals)

    return dict(bins)


def _extract_ms1_bins_raw(path: str, mz_decimals: int = 2) -> dict[float, float]:
    """Last-resort scan for MS1 peak blocks anywhere in the file."""
    with open(path, "rb") as f:
        data = f.read().decode("utf-8", errors="ignore")

    bins: dict[float, float] = defaultdict(float)
    block_re = re.compile(
        r"<(?:scan|spectrum)\b[^>]*\bmsLevel=[\"']?1[\"']?[^>]*>.*?</(?:scan|spectrum)>",
        flags=re.IGNORECASE | re.DOTALL,
    )
    peaks_re = re.compile(
        r"<(?:peaks|mzXMLPeaks)\b([^>]*)>([^<]+)</(?:peaks|mzXMLPeaks)>",
        flags=re.IGNORECASE,
    )

    for block in block_re.findall(data):
        for attrs, payload in peaks_re.findall(block):
            precision = "64" if 'precision="64"' in attrs or "precision='64'" in attrs else "32"
            byte_order = "little" if "little" in attrs.lower() else "network"
            compression = "zlib" if "zlib" in attrs.lower() else "none"
            mzs, intensities = _decode_mzxml_peaks(payload, precision, byte_order, compression)
            _accumulate_bins(bins, mzs, intensities, mz_decimals)

    return dict(bins)


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
    _validate_ms_file(path)
    kind = _sniff_file_kind(path)
    is_mzxml_family = kind in ("mzxml", "unknown")
    errors: list[str] = []

    for label, extractor in (
        ("XML", _extract_ms1_bins_xml),
        ("indexed", _extract_ms1_bins_indexed),
        ("raw", _extract_ms1_bins_raw),
    ):
        try:
            bins = extractor(path, mz_decimals)
            if bins:
                return bins
            errors.append(f"{label}: no MS1 peaks found")
        except Exception as exc:
            errors.append(f"{label}: {exc}")

    # pymzML is unreliable for mzXML (raises 'str' object has no attribute 'tag')
    if not is_mzxml_family and pymzml is not None:
        try:
            bins = _extract_ms1_bins_pymzml(path, mz_decimals)
            if bins:
                return bins
            errors.append("pymzML: no MS1 peaks found")
        except Exception as exc:
            errors.append(f"pymzML: {exc}")

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
    targets: list[dict[str, Any]] | None = None,
    mz_tolerance: float = 0.01,
    rt_tolerance: float = 0.5,
    targeted: bool = False,
) -> dict[str, Any]:
    """Parse one or more mzXML/mzML files into a feature matrix."""
    if not file_paths:
        raise ValueError("No mzXML files provided")

    target_list = parse_target_list(targets)
    use_targeted = targeted and bool(target_list)

    sample_bins: list[tuple[str, str, dict[float, float]]] = []
    sample_target_values: list[tuple[str, str, list[float]]] = []

    for path in file_paths:
        if not os.path.isfile(path):
            raise ValueError(f"File not found: {os.path.basename(path)}")
        sample_id = _sample_id_from_filename(path)
        group = _resolve_group(sample_id, path, groups)

        if use_targeted:
            scans = _extract_ms1_scans(path)
            if not scans:
                raise ValueError(f"No MS1 data found in {os.path.basename(path)}")
            values = [
                _pick_target_intensity(scans, target, mz_tolerance, rt_tolerance)
                for target in target_list
            ]
            sample_target_values.append((sample_id, group, values))
        else:
            bins = _extract_ms1_bins(path, mz_decimals)
            if not bins:
                raise ValueError(f"No MS1 data found in {os.path.basename(path)}")
            sample_bins.append((sample_id, group, bins))

    if use_targeted:
        features = []
        for index, target in enumerate(target_list):
            label = target.name
            if target.adduct:
                label = f"{target.name} ({target.adduct})"
            if target.rt is not None:
                label = f"{label} @ {target.rt:.2f} min"
            fid = _slug_feature_id(target.name, target.mz)
            values = [row[index] for _, _, row in sample_target_values]
            features.append({
                "featureId": fid,
                "name": label,
                "featureClass": target.adduct or "Targeted MS1",
                "pathway": None,
                "metadata": {"mz": target.mz, "rt": target.rt, "adduct": target.adduct, "targeted": True},
                "values": values,
            })
        samples = [
            {"sampleId": sid, "groupLabel": grp, "values": values}
            for sid, grp, values in sample_target_values
        ]
    else:
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
                "metadata": {"mz": mz, "targeted": False},
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
        "targeted": use_targeted,
        "targetCount": len(target_list) if use_targeted else 0,
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
