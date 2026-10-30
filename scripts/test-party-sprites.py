"""Comprueba originales, atlas reproducibles, paleta, alpha y ocho vistas del domador."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import runpy

ROOT = Path(__file__).resolve().parent.parent
pipeline = runpy.run_path(str(ROOT / "scripts/prepare-party-sprites.py"))
provenance = json.loads((ROOT / "art-source/ds-sheets/party-provenance.json").read_text(encoding="utf-8"))
for species, config in pipeline["CONFIG"].items():
    entry = provenance[species]
    original = (ROOT / entry["source"]).read_bytes()
    assert hashlib.sha256(original).hexdigest() == entry["sha256"], f"Original modificado: {species}"
    atlas, _ = pipeline["build"](species, config)
    stored = (ROOT / entry["atlas"]).read_bytes()
    reproduced = io.BytesIO()
    atlas.save(reproduced, format="PNG")
    assert stored == reproduced.getvalue(), f"Atlas no reproducible: {species}"
    assert hashlib.sha256(stored).hexdigest() == entry["atlasSha256"]
    assert list(atlas.size) == entry["dimensions"]
    assert (ROOT / entry["source"]).read_bytes() == original
    idle = []
    for direction in range(8):
        for row in range(config["rows"]):
            cell = atlas.crop((direction * 48, row * 48, (direction + 1) * 48, (row + 1) * 48))
            assert cell.getbbox()[3] == 44
            assert all(p[3] in (0, 255) for p in pipeline["pixels"](cell)), "Sin alpha interpolado"
            assert all(not cell.getpixel((x, y))[3] for x, y in [(0, 0), (47, 0), (0, 47), (47, 47)])
        idle.append(atlas.crop((direction * 48, 0, (direction + 1) * 48, 48)).tobytes())
    if species == "tamer":
        assert config["rows"] == 5
        assert len(set(idle)) == 8, "El protagonista tiene ocho vistas originales distintas"
        for d in range(8):
            assert atlas.crop((d * 48, 48, (d + 1) * 48, 96)).tobytes() != idle[d], "Paso real, no idle repetido"
    else:
        assert config["rows"] == 7
    print(f"PASS: {species}, integridad, recortes, paleta original, pies y atlas reproducible")
