"""Recorta píxeles originales de la hoja TSR 48418. Requiere Pillow.

No redibuja ni interpola píxeles. La hoja solo contiene vistas frontal,
diagonal y lateral; las vistas derechas son reflejos y las traseras
reutilizan la diagonal disponible (no son direcciones originales nuevas).
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "art-source/ds-sheets/agumon_raw.png"
OUTPUT = ROOT / "apps/client/src/assets/sprites/agumon-ds.png"
CELL = 48


def prepare():
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (352, 144):
        raise ValueError(f"Hoja inesperada: {source.size}; se esperaba 352×144")
    # Límites verificados visualmente: las primeras 8 celdas inferiores.
    boundaries = [13, 45, 78, 111, 144, 177, 210, 243, 276]
    frames = []
    for left, right in zip(boundaries, boundaries[1:]):
        frame = source.crop((left, 75, right, 107))
        pixels = frame.load()
        for y in range(frame.height):
            for x in range(frame.width):
                r, g, b, _ = pixels[x, y]
                if (r, g, b) in [(255, 0, 255), (112, 232, 80)]:
                    pixels[x, y] = (0, 0, 0, 0)
        # El margen verde exacto se identifica además por el píxel superior izquierdo de la hoja.
        background = source.getpixel((0, 0))[:3]
        for y in range(frame.height):
            for x in range(frame.width):
                if pixels[x, y][:3] == background:
                    pixels[x, y] = (0, 0, 0, 0)
        box = frame.getbbox()
        if not box:
            raise ValueError("Fotograma vacío")
        frames.append(frame.crop(box))

    atlas = Image.new("RGBA", (CELL * 8, CELL * 7))
    # Cámara frente, diagonal izq., lateral izq., diagonal trasera aproximada,
    # espalda aproximada, diagonal dcha., lateral dcha., diagonal frontal dcha.
    cycles = [(6, 7, 6), (3, 4, 5), (0, 1, 2), (3, 4, 5),
              (3, 4, 5), (3, 4, 5), (0, 1, 2), (3, 4, 5)]
    for direction, cycle in enumerate(cycles):
        for row, step in enumerate([0, 0, 1, 2, 1]):
            frame = frames[cycle[step]]
            if direction >= 5:
                frame = ImageOps.mirror(frame)
            atlas.alpha_composite(frame, (direction * CELL + (CELL - frame.width) // 2,
                                          row * CELL + 44 - frame.height))
    # Poses grandes originales: ataque (columnas 3/4), reacción (columna 1).
    # Reducción nearest-neighbor para mantener tamaño constante respecto al overworld.
    for row, bounds in [(5, (208, 0, 270, 74)), (6, (82, 0, 144, 74))]:
        pose = source.crop(bounds)
        p = pose.load()
        for y in range(pose.height):
            for x in range(pose.width):
                if p[x, y][:3] in [(255, 0, 255), source.getpixel((0, 0))[:3]]:
                    p[x, y] = (0, 0, 0, 0)
        pose = pose.crop(pose.getbbox())
        pose = pose.resize((round(pose.width * 32 / pose.height), 32), Image.Resampling.NEAREST)
        for direction in range(8):
            frame = ImageOps.mirror(pose) if direction >= 5 else pose
            atlas.alpha_composite(frame, (direction * CELL + (CELL - frame.width) // 2,
                                          row * CELL + 44 - frame.height))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT)
    print(f"Atlas original preparado: {OUTPUT} ({atlas.width}×{atlas.height})")


if __name__ == "__main__":
    prepare()
