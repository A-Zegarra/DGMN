"""Recortes DS originales del protagonista, Gabumon/Patamon y sus evoluciones.

Solo lee los originales. Requiere Pillow. No interpola, recolorea ni dibuja
nuevos ángulos: las direcciones ausentes reutilizan/reflejan vistas existentes.
"""
from pathlib import Path
from PIL import Image, ImageOps
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/client/src/assets/sprites"
CELL = 48
FEET = 44
CONFIG = {
    "tamer": {
        "size": (328, 626), "background": [(0, 128, 128), (0, 176, 104)],
        "frames": [(2 + c * 34, 40 + r * 34, 34 + c * 34, 72 + r * 34) for r in range(8) for c in range(3)],
        "directions": [[r * 3, r * 3 + 1, r * 3 + 2] for r in [0, 4, 2, 6, 1, 7, 3, 5]],
        "mirror": [], "rows": 5,
        "credits": "RadSpyro y redblueyellow", "sheet": 48323,
        "limitations": "Protagonista masculino original con ocho direcciones de idle/caminar. No se usan los retratos ni las poses de caída. No hay selección de apariencia ni recoloreado.",
    },
    "gabumon": {
        "size": (412, 203), "background": [(0, 128, 128), (200, 216, 160)],
        "frames": [(310 + c * 34, 2 + r * 34, 342 + c * 34, 34 + r * 34) for r in range(5) for c in range(3)],
        "directions": [[12, 13, 12], [0, 1, 2], [6, 7, 8], [9, 10, 11], [14, 14, 14], [9, 10, 11], [6, 7, 8], [3, 4, 5]],
        "mirror": [5, 6], "rows": 7,
        "attack": (100, 116, 196, 196), "hit": (2, 116, 96, 196),
        "credits": "redblueyellow", "sheet": 41249,
        "limitations": "Se reutilizan/reflejan las vistas disponibles. La espalda solo incluye una pose; el frente tiene dos pasos. Ataque y reacción usan poses de combate originales, no una secuencia específica de daño.",
    },
    "patamon": {
        "size": (355, 134), "background": [(255, 0, 255), (116, 236, 96)],
        "frames": [(15 + c * 33, 65, 47 + c * 33, 97) for c in range(10)],
        "directions": [[6, 7, 8], [3, 4, 5], [3, 4, 5], [0, 1, 2], [0, 1, 2], [0, 1, 2], [3, 4, 5], [3, 4, 5]],
        "mirror": [5, 6, 7], "rows": 7,
        "attack": (211, 1, 273, 64), "hit": (80, 1, 143, 64),
        "credits": "Mighty Jetters y redblueyellow", "sheet": 48422,
        "limitations": "Las vistas no incluyen ocho ángulos completos; se usa la más cercana o su reflejo. Ataque y reacción se ajustan desde poses originales con nearest-neighbor.",
    },
    "garurumon": {
        "size": (313, 294), "background": [(0, 176, 0), (88, 168, 88)],
        "frames": [(4 + c * 34, 258, 36 + c * 34, 290) for c in range(9)],
        "directions": [[6, 7, 8], [0, 1, 2], [3, 4, 5], [0, 1, 2], [0, 1, 2], [0, 1, 2], [3, 4, 5], [0, 1, 2]],
        "mirror": [5, 6, 7], "rows": 7,
        "attack": (108, 127, 204, 254), "hit": (4, 127, 100, 254),
        "credits": "RadSpyro", "sheet": 48583,
        "limitations": "No hay espalda completa: se reutiliza/refleja la vista más cercana. Las poses grandes se reducen con nearest-neighbor, conservando colores y contornos negros.",
    },
    "angemon": {
        "size": (312, 425), "background": [(0, 128, 128), (80, 176, 88)],
        "frames": [(4 + c * 34, 340, 36 + c * 34, 404) for c in range(9)],
        "directions": [[6, 7, 8], [0, 1, 2], [3, 4, 5], [0, 1, 2], [0, 1, 2], [0, 1, 2], [3, 4, 5], [0, 1, 2]],
        "mirror": [5, 6, 7], "rows": 7,
        "attack": (108, 183, 204, 335), "hit": (4, 183, 100, 335),
        "credits": "A.J. Nitro y Dazz", "sheet": 48611,
        "limitations": "No hay ocho ángulos completos; se reutiliza/refleja la vista disponible más cercana. Ataque y reacción usan poses originales, no una secuencia específica de daño.",
    },
}


def extract(source, box, backgrounds):
    assert 0 <= box[0] < box[2] <= source.width and 0 <= box[1] < box[3] <= source.height
    frame = source.crop(box)
    pixels = frame.load()
    for y in range(frame.height):
        for x in range(frame.width):
            if pixels[x, y][:3] in backgrounds:
                pixels[x, y] = (0, 0, 0, 0)
    bounds = frame.getbbox()
    if not bounds:
        raise ValueError(f"Fotograma vacío: {box}")
    return frame.crop(bounds)


def fit(frame, height=40):
    ratio = min(40 / frame.width, height / frame.height, 1)
    if ratio < 1:
        frame = frame.resize((max(1, round(frame.width * ratio)), max(1, round(frame.height * ratio))), Image.Resampling.NEAREST)
        frame = frame.crop(frame.getbbox())
    return frame


def place(atlas, frame, direction, row):
    atlas.alpha_composite(frame, (direction * CELL + (CELL - frame.width) // 2, row * CELL + FEET - frame.height))


def pixels(image):
    # Pillow reciente evita getdata; mantener compatibilidad con versiones previas.
    return image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()


def build(species, config):
    path = ROOT / f"art-source/ds-sheets/{species}_raw.png"
    original = path.read_bytes()
    source = Image.open(path).convert("RGBA")
    if source.size != config["size"]:
        raise ValueError(f"Dimensiones inesperadas: {species} {source.size}")
    frames = [fit(extract(source, bounds, config["background"])) for bounds in config["frames"]]
    atlas = Image.new("RGBA", (CELL * 8, CELL * config["rows"]))
    for direction, cycle in enumerate(config["directions"]):
        for row, step in enumerate([0, 1, 0, 2, 0]):
            frame = frames[cycle[step]]
            if direction in config["mirror"]:
                frame = ImageOps.mirror(frame)
            place(atlas, frame, direction, row)
    if config["rows"] == 7:
        height = max(frame.height for frame in frames)
        for row, key in [(5, "attack"), (6, "hit")]:
            frame = fit(extract(source, config[key], config["background"]), height)
            for direction in range(8):
                place(atlas, ImageOps.mirror(frame) if direction >= 5 else frame, direction, row)
    # Ni interpolación, ni etiquetas, ni fondo. Pies siempre sobre la misma línea.
    palette = {p for p in pixels(source) if p[3] and p[:3] not in config["background"]}
    assert all(p in palette for p in pixels(atlas) if p[3]), f"Paleta alterada: {species}"
    for direction in range(8):
        for row in range(config["rows"]):
            box = atlas.crop((direction * CELL, row * CELL, (direction + 1) * CELL, (row + 1) * CELL)).getbbox()
            assert box and box[3] == FEET, f"Celda vacía/desalineada: {species} {direction} {row}"
    assert path.read_bytes() == original, "Nunca modificar las hojas originales"
    return atlas, {
        "source": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(original).hexdigest(),
        "sourceDimensions": list(source.size), "sheet": config["sheet"], "credits": config["credits"],
        "url": f"https://www.spriters-resource.com/ds_dsi/dgmnworldds/asset/{config['sheet']}/",
        "archive": f"https://web.archive.org/web/2024im_/https://www.spriters-resource.com/download/{config['sheet']}/",
        "dimensions": list(atlas.size), "columns": 8, "rows": config["rows"],
        "limitations": config["limitations"],
    }


def prepare():
    OUT.mkdir(parents=True, exist_ok=True)
    provenance = {}
    for species, config in CONFIG.items():
        atlas, entry = build(species, config)
        output = OUT / f"{species}-ds.png"
        atlas.save(output)
        entry["atlas"] = output.relative_to(ROOT).as_posix()
        entry["atlasSha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
        provenance[species] = entry
        print(f"OK: {species}, {atlas.width}×{atlas.height}, {len(config['frames'])} fotogramas originales")
    (ROOT / "art-source/ds-sheets/party-provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    prepare()
