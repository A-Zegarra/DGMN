"""Atlas DS de la línea evolutiva: solo lee las hojas del usuario, nunca las modifica.

Requiere Pillow. Cada atlas: 8 columnas × 7 filas (idle, 4 pasos,
ataque y reacción). Se reutiliza la vista más próxima donde faltan direcciones;
no se inventan vistas traseras. Las poses de combate se ajustan con nearest.
"""
from pathlib import Path
from PIL import Image, ImageOps
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/client/src/assets/sprites"
CONFIG = {
    "devimon": {
        "source": "art-source/ds-sheets/devimon_raw.png",
        "size": (406, 334), "background": [(0, 128, 128), (120, 176, 240)],
        "frames": [(x, y, x + 32, y + 64) for y in [2, 68, 134, 200] for x in [304, 338, 372]],
        "directions": [[0, 1, 2], [3, 4, 5], [3, 4, 5], [6, 7, 8],
                       [6, 7, 8], [9, 10, 11], [9, 10, 11], [0, 1, 2]],
        "mirror": [], "attack": (100, 167, 196, 303), "hit": (2, 167, 82, 303),
        "credits": "redblueyellow", "sheet": 48593,
    },
    "koromon": {
        "size": (187, 204), "background": [(128, 3, 175)],
        "frames": [(x, y, x + 25, y + 23) for y in [103, 126, 150, 174] for x in [89, 115, 141]],
        "directions": [[0, 1, 2], [0, 1, 2], [0, 1, 2], [3, 4, 5],
                       [3, 4, 5], [9, 10, 11], [6, 7, 8], [6, 7, 8]],
        "mirror": [], "attack": (48, 51, 94, 86), "hit": (5, 51, 47, 86),
        "credits": "Atlanta", "sheet": 20462,
    },
    "greymon": {
        "size": (346, 387), "background": [(0, 128, 128), (80, 176, 88)],
        "frames": [(x, 302, x + 32, 366) for x in [4, 41, 78, 120, 157, 194, 236, 273]],
        "directions": [[6, 7, 6], [0, 1, 2], [3, 4, 5], [0, 1, 2],
                       [0, 1, 2], [0, 1, 2], [3, 4, 5], [0, 1, 2]],
        "mirror": [5, 6, 7], "attack": (4, 172, 108, 292), "hit": (118, 42, 222, 162),
        "credits": "A.J. Nitro y redblueyellow", "sheet": 48406,
    },
    "metalgreymon": {
        "size": (395, 432), "background": [],
        "frames": [(18, 305, 57, 338), (18, 349, 57, 384), (18, 390, 57, 428),
                   (65, 304, 105, 337), (65, 348, 105, 383), (65, 389, 105, 427),
                   (130, 319, 169, 354), (130, 364, 169, 406)],
        "directions": [[6, 7, 6], [0, 1, 2], [0, 1, 2], [0, 1, 2],
                       [6, 7, 6], [3, 4, 5], [3, 4, 5], [3, 4, 5]],
        "mirror": [], "attack": (0, 145, 130, 301), "hit": (141, 145, 280, 301),
        "credits": "RadSpyro", "sheet": 48322,
    },
    "wargreymon": {
        "size": (408, 518), "background": [(0, 128, 128), (80, 176, 88)],
        "frames": [(x, 435, x + 32, 499) for x in [4, 38, 72, 106, 140, 174, 208, 242]],
        "directions": [[6, 7, 6], [3, 4, 5], [0, 1, 2], [3, 4, 5],
                       [3, 4, 5], [3, 4, 5], [0, 1, 2], [3, 4, 5]],
        "mirror": [5, 6, 7], "attack": (4, 238, 132, 430), "hit": (140, 238, 268, 430),
        "credits": "A.J. Nitro y redblueyellow", "sheet": 48613,
    },
}


def extract(source, box, backgrounds, remove_specks=False):
    frame = source.crop(box).convert("RGBA")
    pixels = frame.load()
    for y in range(frame.height):
        for x in range(frame.width):
            if pixels[x, y][:3] in backgrounds:
                pixels[x, y] = (0, 0, 0, 0)
    if remove_specks:
        # Restos aislados de la cuadrícula/celda vecina; conservar la silueta.
        seen = set()
        for y in range(frame.height):
            for x in range(frame.width):
                if (x, y) in seen or not pixels[x, y][3]:
                    continue
                component, stack = [], [(x, y)]
                seen.add((x, y))
                while stack:
                    px, py = stack.pop()
                    component.append((px, py))
                    for dx in [-1, 0, 1]:
                        for dy in [-1, 0, 1]:
                            nx, ny = px + dx, py + dy
                            if 0 <= nx < frame.width and 0 <= ny < frame.height and (nx, ny) not in seen and pixels[nx, ny][3]:
                                seen.add((nx, ny)); stack.append((nx, ny))
                if len(component) < 3:
                    for point in component:
                        pixels[point] = (0, 0, 0, 0)
    bounds = frame.getbbox()
    if not bounds:
        raise ValueError(f"Fotograma vacío: {box}")
    return frame.crop(bounds)


def fit(frame, height=40):
    ratio = min(40 / frame.width, height / frame.height, 1)
    if ratio < 1:
        resized = frame.resize((max(1, round(frame.width * ratio)), max(1, round(frame.height * ratio))), Image.Resampling.NEAREST)
        return resized.crop(resized.getbbox())
    return frame


def prepare():
    OUT.mkdir(parents=True, exist_ok=True)
    provenance = {}
    for species, config in CONFIG.items():
        matches = [ROOT / config["source"]] if "source" in config else list((ROOT / "MODELOS DE SPRITES" / species.upper()).glob("DS*.png"))
        if len(matches) != 1:
            raise ValueError(f"Se esperaba una hoja DS para {species}: {matches}")
        path = matches[0]
        source = Image.open(path).convert("RGBA")
        if source.size != config["size"]:
            raise ValueError(f"Dimensiones inesperadas para {species}: {source.size}")
        frames = [fit(extract(source, box, config["background"], species == "koromon")) for box in config["frames"]]
        # Una escala común para ataque/reacción: evita saltos de tamaño entre poses.
        attack = extract(source, config["attack"], config["background"])
        hit = extract(source, config["hit"], config["background"])
        height = max(frame.height for frame in frames)
        combat_frames = [fit(frame, height) for frame in [attack, hit]]
        atlas = Image.new("RGBA", (384, 336))
        for direction, cycle in enumerate(config["directions"]):
            for row, step in enumerate([0, 0, 1, 2, 1]):
                frame = frames[cycle[step]]
                if direction in config["mirror"]:
                    frame = ImageOps.mirror(frame)
                atlas.alpha_composite(frame, (direction * 48 + (48 - frame.width) // 2, row * 48 + 44 - frame.height))
            for row, frame in enumerate(combat_frames, start=5):
                if direction >= 5:
                    frame = ImageOps.mirror(frame)
                atlas.alpha_composite(frame, (direction * 48 + (48 - frame.width) // 2, row * 48 + 44 - frame.height))
        output = OUT / f"{species}-ds.png"
        atlas.save(output)
        # Ningún fondo sólido, ni etiquetas/créditos incorporados en la textura.
        assert all(atlas.crop((d * 48, r * 48, (d + 1) * 48, (r + 1) * 48)).getbbox()
                   for d in range(8) for r in range(7))
        palette = {pixel for pixel in source.getdata() if pixel[3]}
        assert all(pixel in palette for pixel in atlas.getdata() if pixel[3]), "El atlas debe conservar los colores originales"
        for d in range(8):
            for r in range(7):
                bounds = atlas.crop((d * 48, r * 48, (d + 1) * 48, (r + 1) * 48)).getbbox()
                assert bounds[3] == 44, "Todos los fotogramas deben apoyar los pies en la misma línea"
        provenance[species] = {
            "source": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "credits": config["credits"], "sheet": config["sheet"],
            "url": f"https://www.spriters-resource.com/ds_dsi/dgmnworldds/sheet/{config['sheet']}/",
            "atlas": str(output.relative_to(ROOT)), "dimensions": [384, 336],
            "limitations": "Vistas originales disponibles; se reutiliza/refleja la más cercana donde faltan ángulos. Reacción con pose original y tinte, no secuencia específica de daño.",
        }
        print(f"OK: {species}, {len(frames)} fotogramas de movimiento + 2 poses, {output.name}")
    (ROOT / "art-source/ds-sheets/evolution-provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    prepare()
