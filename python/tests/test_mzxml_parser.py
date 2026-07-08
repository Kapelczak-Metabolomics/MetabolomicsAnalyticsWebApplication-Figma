import base64
import os
import struct
import tempfile
import unittest

from app.mzxml_parser import _extract_ms1_bins, parse_mzxml_files


FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _encode_peaks(pairs: list[tuple[float, float]], precision: str = "32", little: bool = True) -> str:
    fmt = ("<" if little else ">") + ("dd" if precision == "64" else "ff")
    raw = b"".join(struct.pack(fmt, mz, intensity) for mz, intensity in pairs)
    return base64.b64encode(raw).decode("ascii")


class MzxmlParserTests(unittest.TestCase):
    def test_minimal_fixture(self):
        path = os.path.join(FIXTURES, "minimal.mzXML")
        bins = _extract_ms1_bins(path)
        self.assertTrue(bins)

    def test_legacy_scan_peaks_little_endian(self):
        peaks = _encode_peaks([(100.0, 1000.0), (200.0, 500.0)], little=True)
        xml = f"""<?xml version="1.0"?>
<mzXML>
  <msRun scanCount="1">
    <scan num="1" msLevel="1" peaksCount="2">
      <peaks precision="32" byteOrder="little" contentType="raw">{peaks}</peaks>
    </scan>
  </msRun>
</mzXML>"""
        with tempfile.NamedTemporaryFile("w", suffix=".mzXML", delete=False) as f:
            f.write(xml)
            path = f.name
        try:
            bins = _extract_ms1_bins(path)
            self.assertIn(100.0, bins)
            self.assertIn(200.0, bins)
            self.assertEqual(bins[100.0], 1000.0)
        finally:
            os.unlink(path)

    def test_rejects_html_upload(self):
        with tempfile.NamedTemporaryFile("w", suffix=".mzXML", delete=False) as f:
            f.write("<!DOCTYPE html><html><body>Service is not reachable</body></html>")
            path = f.name
        try:
            with self.assertRaisesRegex(ValueError, "HTML error page"):
                _extract_ms1_bins(path)
        finally:
            os.unlink(path)

    def test_parse_multiple_samples(self):
        path = os.path.join(FIXTURES, "minimal.mzXML")
        result = parse_mzxml_files([path])
        self.assertEqual(result["samplesCount"], 1)
        self.assertGreaterEqual(result["featuresCount"], 1)

    def test_targeted_mode_matches_known_mz(self):
        peaks = _encode_peaks([(100.0, 1000.0), (200.0, 500.0)], little=True)
        xml = f"""<?xml version="1.0"?>
<mzXML>
  <msRun scanCount="1">
    <scan num="1" msLevel="1" peaksCount="2">
      <peaks precision="32" byteOrder="little" contentType="raw">{peaks}</peaks>
    </scan>
  </msRun>
</mzXML>"""
        with tempfile.NamedTemporaryFile("w", suffix=".mzXML", delete=False) as f:
            f.write(xml)
            path = f.name
        try:
            targets = [{"name": "CompoundA", "mz": 100.0, "adduct": "[M+H]+", "rt": None}]
            result = parse_mzxml_files([path], targets=targets, targeted=True, mz_tolerance=0.05)
            self.assertTrue(result["targeted"])
            self.assertEqual(result["featuresCount"], 1)
            self.assertIn("CompoundA", result["features"][0]["name"])
            self.assertEqual(result["features"][0]["values"][0], 1000.0)
        finally:
            os.unlink(path)

    def test_extract_xic_from_multiscan_file(self):
        peaks_a = _encode_peaks([(100.0, 500.0)], little=True)
        peaks_b = _encode_peaks([(100.0, 1500.0)], little=True)
        xml = f"""<?xml version="1.0"?>
<mzXML>
  <msRun scanCount="2">
    <scan num="1" msLevel="1" retentionTime="1.0" peaksCount="1">
      <peaks precision="32" byteOrder="little" contentType="raw">{peaks_a}</peaks>
    </scan>
    <scan num="2" msLevel="1" retentionTime="2.0" peaksCount="1">
      <peaks precision="32" byteOrder="little" contentType="raw">{peaks_b}</peaks>
    </scan>
  </msRun>
</mzXML>"""
        with tempfile.NamedTemporaryFile("w", suffix=".mzXML", delete=False) as f:
            f.write(xml)
            path = f.name
        try:
            from app.mzxml_parser import extract_xics_from_files

            result = extract_xics_from_files([path], 100.0, mz_tolerance=0.05)
            self.assertEqual(len(result["traces"]), 1)
            trace = result["traces"][0]
            self.assertEqual(len(trace["rt"]), 2)
            self.assertEqual(max(trace["intensity"]), 1500.0)
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
