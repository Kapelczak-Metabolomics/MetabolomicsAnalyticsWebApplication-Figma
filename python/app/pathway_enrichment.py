"""Live pathway enrichment via KEGG and Reactome public APIs."""

from __future__ import annotations

import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from typing import Any

import numpy as np
from scipy import stats
from statsmodels.stats.multitest import multipletests

KEGG_REST = "https://rest.kegg.jp"
REACTOME_ANALYSIS = "https://reactome.org/AnalysisService"
REACTOME_CONTENT = "https://reactome.org/ContentService"

_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 3600.0
_KEGG_DELAY = 0.34  # stay under KEGG rate limits (~3 req/s)


def _cached(key: str, loader):
    now = time.time()
    hit = _CACHE.get(key)
    if hit and now - hit[0] < _CACHE_TTL:
        return hit[1]
    value = loader()
    _CACHE[key] = (now, value)
    return value


def _http_get(url: str, timeout: float = 20.0) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "MetaboAnalytics/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read().decode("utf-8", errors="replace")


def _http_post(url: str, body: str, content_type: str = "text/plain", timeout: float = 30.0) -> str:
    data = body.encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": "MetaboAnalytics/1.0", "Content-Type": content_type},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read().decode("utf-8", errors="replace")


def _clean_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip())


def _apply_fdr(pvals: list[float], method: str = "BH") -> list[float]:
    if not pvals:
        return []
    if method == "Bonferroni":
        _, adj, _, _ = multipletests(pvals, method="bonferroni")
    elif method == "None":
        return pvals
    else:
        _, adj, _, _ = multipletests(pvals, method="fdr_bh")
    return [float(a) for a in adj]


def _kegg_find_compound(name: str) -> str | None:
    query = urllib.parse.quote(_clean_name(name))
    if not query:
        return None

    def load():
        time.sleep(_KEGG_DELAY)
        text = _http_get(f"{KEGG_REST}/find/compound/{query}")
        for line in text.splitlines():
            if not line.strip():
                continue
            cpd = line.split("\t", 1)[0].strip()
            if cpd.startswith("C") and cpd[1:].isdigit():
                return cpd
        return None

    try:
        return _cached(f"kegg:find:{query.lower()}", load)
    except (urllib.error.URLError, TimeoutError):
        return None


def _kegg_pathways_for_compounds(compound_ids: list[str]) -> dict[str, set[str]]:
    pathways: dict[str, set[str]] = defaultdict(set)
    unique = sorted({c for c in compound_ids if c})
    for i in range(0, len(unique), 8):
        batch = unique[i : i + 8]
        key = "kegg:link:" + "+".join(batch)

        def load(ids=batch):
            time.sleep(_KEGG_DELAY)
            joined = "+".join(f"cpd:{c}" for c in ids)
            text = _http_get(f"{KEGG_REST}/link/pathway/{joined}")
            mapping: dict[str, set[str]] = defaultdict(set)
            for line in text.splitlines():
                parts = line.split("\t")
                if len(parts) != 2:
                    continue
                cpd, pathway = parts[0].replace("cpd:", ""), parts[1].replace("path:", "")
                mapping[cpd].add(pathway)
            return mapping

        try:
            batch_map = _cached(key, load)
            for cpd, pset in batch_map.items():
                pathways[cpd].update(pset)
        except (urllib.error.URLError, TimeoutError):
            continue
    return pathways


def _kegg_pathway_title(pathway_id: str) -> str:
    def load():
        time.sleep(_KEGG_DELAY)
        text = _http_get(f"{KEGG_REST}/get/{pathway_id}")
        for line in text.splitlines():
            if line.startswith("NAME"):
                return line.replace("NAME", "", 1).strip().split(" - ")[0].strip()
        return pathway_id.replace("path:", "")

    try:
        return _cached(f"kegg:title:{pathway_id}", load)
    except (urllib.error.URLError, TimeoutError):
        return pathway_id.replace("path:", "")


def enrich_kegg(sig_names: list[str], bg_names: list[str], config: dict | None = None) -> dict[str, Any]:
    config = config or {}
    fdr_method = str(config.get("fdrMethod", "BH"))
    min_size = int(config.get("minPathwaySize", 2))
    max_size = int(config.get("maxPathwaySize", 500))

    bg_map = {n: _kegg_find_compound(n) for n in bg_names}
    sig_map = {n: bg_map.get(n) or _kegg_find_compound(n) for n in sig_names}

    bg_ids = [c for c in bg_map.values() if c]
    sig_ids = [c for c in sig_map.values() if c]
    if not sig_ids:
        return {
            "pathways": [],
            "significantFeatures": len(sig_names),
            "categories": [],
            "database": "KEGG",
            "organism": config.get("organism", "Homo sapiens"),
            "warning": "No significant metabolites could be mapped to KEGG compound IDs.",
            "engine": "python-kegg",
        }

    bg_pathways = _kegg_pathways_for_compounds(bg_ids)
    sig_pathways = _kegg_pathways_for_compounds(sig_ids)

    pathway_members_bg: dict[str, set[str]] = defaultdict(set)
    pathway_members_sig: dict[str, set[str]] = defaultdict(set)

    for name, cpd in bg_map.items():
        if not cpd:
            continue
        for pathway in bg_pathways.get(cpd, set()):
            pathway_members_bg[pathway].add(name)

    for name, cpd in sig_map.items():
        if not cpd:
            continue
        for pathway in sig_pathways.get(cpd, set()):
            pathway_members_sig[pathway].add(name)

    mapped_bg = len({n for n, c in bg_map.items() if c})
    mapped_sig = len({n for n, c in sig_map.items() if c})
    total_bg = max(mapped_bg, 1)
    total_sig = max(mapped_sig, 1)

    raw: list[dict[str, Any]] = []
    for pathway_id, bg_members in pathway_members_bg.items():
        size = len(bg_members)
        if size < min_size or size > max_size:
            continue
        hits = len(pathway_members_sig.get(pathway_id, set()))
        if hits == 0:
            continue
        p = float(stats.hypergeom.sf(hits - 1, total_bg, size, total_sig))
        map_id = pathway_id.replace("path:", "").replace("map", "")
        title = _kegg_pathway_title(pathway_id)
        raw.append(
            {
                "name": title,
                "genes": hits,
                "total": size,
                "pValue": p,
                "negLogP": round(-float(np.log10(max(p, 1e-16))), 2),
                "database": "KEGG",
                "url": f"https://www.genome.jp/kegg-bin/show_pathway?{pathway_id.replace('path:', '')}",
                "category": title.split(" ")[0] if title else pathway_id,
                "pathwayId": pathway_id,
            }
        )

    raw.sort(key=lambda x: x["pValue"])
    if raw:
        fdr = _apply_fdr([p["pValue"] for p in raw], fdr_method)
        for row, val in zip(raw, fdr, strict=True):
            row["fdr"] = val

    categories = [
        {"name": name, "count": count}
        for name, count in sorted(
            ((name, sum(1 for p in raw if p["category"] == name)) for name in {p["category"] for p in raw}),
            key=lambda x: -x[1],
        )
    ]

    return {
        "pathways": raw[:20],
        "significantFeatures": len(sig_names),
        "mappedFeatures": mapped_sig,
        "categories": categories,
        "database": "KEGG",
        "organism": config.get("organism", "Homo sapiens"),
        "engine": "python-kegg",
    }


def enrich_reactome(sig_names: list[str], config: dict | None = None) -> dict[str, Any]:
    config = config or {}
    fdr_method = str(config.get("fdrMethod", "BH"))
    identifiers = "\n".join(_clean_name(n) for n in sig_names if _clean_name(n))
    if not identifiers:
        return {
            "pathways": [],
            "significantFeatures": 0,
            "categories": [],
            "database": "Reactome",
            "engine": "python-reactome",
        }

    try:
        token = _http_post(f"{REACTOME_ANALYSIS}/identifiers/", identifiers).strip().strip('"')
        if not token:
            raise ValueError("Reactome returned empty analysis token")
        report = _http_get(f"{REACTOME_ANALYSIS}/report/{token}/")
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        return {
            "pathways": [],
            "significantFeatures": len(sig_names),
            "categories": [],
            "database": "Reactome",
            "warning": f"Reactome API request failed: {e}",
            "engine": "python-reactome",
        }

    raw: list[dict[str, Any]] = []
    for line in report.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        pathway_id, url, name, entities_found, *_rest = parts + [""] * 5
        try:
            hits = int(entities_found)
        except ValueError:
            hits = 0
        if hits <= 0:
            continue
        try:
            p = float(parts[6]) if len(parts) > 6 and parts[6] else 0.05
        except ValueError:
            p = 0.05
        raw.append(
            {
                "name": name,
                "genes": hits,
                "total": hits,
                "pValue": p,
                "negLogP": round(-float(np.log10(max(p, 1e-16))), 2),
                "database": "Reactome",
                "url": url or f"https://reactome.org/PathwayBrowser/#{pathway_id}",
                "category": name.split(" ")[0] if name else "Pathway",
            }
        )

    raw.sort(key=lambda x: x["pValue"])
    if raw:
        fdr = _apply_fdr([p["pValue"] for p in raw], fdr_method)
        for row, val in zip(raw, fdr, strict=True):
            row["fdr"] = val

    categories = [
        {"name": name, "count": count}
        for name, count in sorted(
            ((name, sum(1 for p in raw if p["category"] == name)) for name in {p["category"] for p in raw}),
            key=lambda x: -x[1],
        )
    ]

    return {
        "pathways": raw[:20],
        "significantFeatures": len(sig_names),
        "categories": categories,
        "database": "Reactome",
        "organism": config.get("organism", "Homo sapiens"),
        "engine": "python-reactome",
    }


def run_live_pathway_enrichment(volcano: dict, config: dict | None = None) -> dict[str, Any]:
    config = config or {}
    p_thresh = float(config.get("pThreshold", 0.05))
    database = str(config.get("database", "KEGG"))
    features = volcano.get("features", [])
    sig = [f for f in features if f.get("pValue", 1) < p_thresh]
    sig_names = [str(f.get("name") or f.get("featureId") or "") for f in sig if f.get("name") or f.get("featureId")]
    bg_names = [str(f.get("name") or f.get("featureId") or "") for f in features if f.get("name") or f.get("featureId")]

    if database.lower().startswith("reactome"):
        return enrich_reactome(sig_names, config)

    # KEGG is the default live enrichment backend for metabolite pathway databases.
    return enrich_kegg(sig_names, bg_names, config)
