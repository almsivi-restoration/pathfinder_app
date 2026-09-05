"""Generate the Game Master's Workbench application icon.

Theme-matched to the UI: near-black charcoal panel, carved beige-stone frame
(thicker across the top, like the window nameplate band), and a gold gear
sigil. Rendered procedurally at 1024px and downscaled; run from anywhere:

    python frontend/build-resources/generate_icon.py

Outputs frontend/public/icon.png (source of truth for electron-builder) and a
256px copy alongside it. No game assets are used; everything here is drawn
from primitives.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
FRAME = (179, 163, 126)       # --mw-frame
FRAME_LO = (119, 105, 78)     # --mw-frame-lo
FRAME_DARK = (6, 5, 4)        # --mw-frame-dark
PANEL_HI = (31, 28, 23)       # --mw-panel-hi
PANEL_LO = (12, 10, 7)        # --mw-panel-lo
GOLD = (227, 200, 122)        # --mw-gold-bright
GOLD_DARK = (176, 141, 79)    # --mw-gold

OUT_DIR = Path(__file__).resolve().parent.parent / "public"


def vgrad(size: int, top: tuple, bottom: tuple) -> Image.Image:
    """Vertical two-stop gradient."""
    base = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / (size - 1)
        base.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return base.resize((size, size))


def draw_gear(draw: ImageDraw.Draw, cx: float, cy: float, teeth: int,
              r_tip: float, r_root: float, r_hole: float) -> None:
    """Closed polygon gear: alternating tip/root vertices, trapezoid teeth."""
    import math

    points = []
    steps = teeth * 4  # root-edge, tip-edge, tip-edge, root-edge per tooth
    for i in range(steps):
        frac = i / steps
        angle = frac * 2 * math.pi - math.pi / 2
        within = (i % 4)
        radius = r_tip if within in (1, 2) else r_root
        points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    draw.polygon(points, fill=GOLD, outline=GOLD_DARK, width=6)
    draw.ellipse(
        [cx - r_hole, cy - r_hole, cx + r_hole, cy + r_hole],
        fill=PANEL_LO, outline=GOLD_DARK, width=6,
    )


def main() -> None:
    s = SIZE
    img = vgrad(s, PANEL_HI, PANEL_LO).convert("RGBA")
    draw = ImageDraw.Draw(img)

    # Carved stone frame, thicker across the top (the nameplate band).
    edge = s // 42
    top_band = s // 10
    draw.rectangle([0, 0, s - 1, s - 1], outline=FRAME_DARK, width=edge * 2)
    draw.rectangle([edge, edge, s - 1 - edge, s - 1 - edge], outline=FRAME, width=edge)
    draw.rectangle([edge, edge, s - 1 - edge, top_band], fill=FRAME)
    draw.line([edge, top_band, s - 1 - edge, top_band], fill=FRAME_LO, width=4)

    # Subtle inner bevel below the nameplate band.
    draw.line([edge, top_band + 6, s - 1 - edge, top_band + 6], fill=FRAME_DARK, width=3)

    # Gold gear sigil, centered in the field below the nameplate band.
    cx = s * 0.5
    cy = (top_band + s) / 2
    r_tip = (s - top_band) * 0.33
    draw_gear(draw, cx, cy, teeth=12, r_tip=r_tip, r_root=r_tip * 0.82, r_hole=r_tip * 0.35)
    # Axle dot.
    draw.ellipse([cx - s * 0.022, cy - s * 0.022, cx + s * 0.022, cy + s * 0.022], fill=GOLD)

    # Soft drop shadow under the gear for depth.
    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        [cx - s * 0.26, cy + r_tip * 0.88, cx + s * 0.26, cy + r_tip * 1.02],
        fill=(0, 0, 0, 120),
    )
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(12)))

    # Save the 1024 master plus the full hicolor size set that electron-builder
    # expects for Linux (a single file is packaged with an unresolved "0x0"
    # size; the directory of <size>x<size>.png files is the reliable input).
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    icons_dir = OUT_DIR / "icons"
    icons_dir.mkdir(exist_ok=True)
    img.save(OUT_DIR / "icon.png")
    for size in (16, 24, 32, 48, 64, 96, 128, 256, 512, 1024):
        img.resize((size, size), Image.LANCZOS).save(icons_dir / f"{size}x{size}.png")
    print(f"wrote {OUT_DIR / 'icon.png'} and {len(list(icons_dir.iterdir()))} sized icons")


if __name__ == "__main__":
    main()
