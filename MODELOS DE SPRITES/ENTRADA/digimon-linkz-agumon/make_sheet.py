from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(r"C:\Users\argzz\Desktop\ROJECTDGMN")
RAW = ROOT / "MODELOS DE SPRITES/ENTRADA/digimon-linkz-agumon/sprites_raw"
OUT = ROOT / "apps/client/public/sprites"
OUT.mkdir(parents=True, exist_ok=True)

CELL = 96
DIRS = 8
FRAMES = 5
OUTLINE = (24, 15, 5, 255)

# Combinar todos los sprites para calcular una paleta común.
combined = Image.new("RGB", (CELL * DIRS, CELL * FRAMES), (255, 0, 255))
for frame in range(FRAMES):
    for direction in range(DIRS):
        img = Image.open(RAW / f"f{frame}_d{direction}.png").convert("RGBA")
        alpha = img.getchannel("A").point(lambda a: 255 if a >= 110 else 0)
        rgb = Image.new("RGB", img.size, (255, 0, 255))
        rgb.paste(img.convert("RGB"), mask=alpha)
        combined.paste(rgb, (direction * CELL, frame * CELL))

palette_source = combined.quantize(colors=28, method=Image.MEDIANCUT, dither=Image.Dither.NONE)

sheet = Image.new("RGBA", (CELL * DIRS, CELL * FRAMES), (0, 0, 0, 0))
for frame in range(FRAMES):
    for direction in range(DIRS):
        img = Image.open(RAW / f"f{frame}_d{direction}.png").convert("RGBA")
        alpha = img.getchannel("A").point(lambda a: 255 if a >= 110 else 0)
        rgb = img.convert("RGB")
        quantized = rgb.quantize(
            palette=palette_source, dither=Image.Dither.NONE
        ).convert("RGBA")
        quantized.putalpha(alpha)

        # Contorno de 1 píxel alrededor de la silueta, sin fondo opaco.
        grown = alpha.filter(ImageFilter.MaxFilter(3))
        outside = ImageChops.subtract(grown, alpha)
        outlined = Image.new("RGBA", img.size, (0, 0, 0, 0))
        outlined.paste(quantized, mask=alpha)
        outlined.paste(Image.new("RGBA", img.size, OUTLINE), mask=outside)

        sheet.paste(outlined, (direction * CELL, frame * CELL))

sheet_path = OUT / "agumon_sheet.png"
sheet.save(sheet_path)
print("SHEET", sheet_path, sheet.size, sheet_path.stat().st_size)

preview = sheet.resize((sheet.width * 4, sheet.height * 4), Image.Resampling.NEAREST)
preview_dir = ROOT / "MODELOS DE SPRITES/ENTRADA/digimon-linkz-agumon/sprites_preview"
preview_dir.mkdir(parents=True, exist_ok=True)
preview_path = preview_dir / "agumon_sheet_preview.png"
preview.save(preview_path)
print("PREVIEW", preview_path, preview.size)

# Recorte del primer frame para revisar el detalle.
sheet.crop((0, 0, CELL * 2, CELL * 2)).resize(
    (512, 512), Image.Resampling.NEAREST
).save(preview_dir / "agumon_sprite_detail.png")
print("DETAIL", preview_dir / "agumon_sprite_detail.png")
