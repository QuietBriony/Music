"""Generate Hazama FM PWA icons.

Produces:
  icons/icon-192.png        — Android Chrome / desktop install
  icons/icon-512.png        — splash + larger displays
  icons/icon-512-maskable.png — Android adaptive icon (safe zone 80%)
  icons/apple-touch-icon.png — iOS home-screen (180x180, square)

Run from the repo root:
  python scripts/make-icons.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)

# Hazama FM palette (matches style.css custom properties)
BG_DEEP = (4, 14, 24)
BG_MID = (8, 22, 36)
BG_LIGHT = (11, 36, 64)
ACCENT_GLASS = (125, 240, 212)   # --accent-glass
ACCENT_SOFT = (156, 198, 255)    # --accent-soft
ACCENT_DIM = (70, 130, 180)


def radial_gradient(size: int) -> Image.Image:
    """Subtle radial-ish gradient: dark navy with a faint center glow."""
    img = Image.new("RGB", (size, size), BG_DEEP)
    cx = cy = size / 2
    # Build a single-channel mask for the glow then paste BG_LIGHT through it.
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    max_r = size * 0.55
    # Concentric soft circles, increasing alpha toward center.
    steps = 28
    for i in range(steps):
        r = max_r * (1 - i / steps)
        alpha = int(8 + (i / steps) * 70)
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
    glow = Image.new("RGB", (size, size), BG_LIGHT)
    img = Image.composite(glow, img, mask.filter(ImageFilter.GaussianBlur(size / 36)))
    return img


def draw_rings(img: Image.Image, content_radius: float) -> None:
    """Draw 3 concentric rings + center dot inside content_radius."""
    size = img.size[0]
    cx = cy = size / 2
    d = ImageDraw.Draw(img, "RGBA")

    # Outer faint halo ring
    halo_r = content_radius * 0.95
    halo_w = max(2, int(size / 220))
    d.ellipse(
        [cx - halo_r, cy - halo_r, cx + halo_r, cy + halo_r],
        outline=(*ACCENT_DIM, 110),
        width=halo_w,
    )

    # Three primary rings, mint glass color
    radii = [content_radius * 0.78, content_radius * 0.55, content_radius * 0.32]
    widths = [max(3, int(size / 110)), max(2, int(size / 140)), max(2, int(size / 180))]
    alphas = [255, 220, 180]
    for r, w, a in zip(radii, widths, alphas):
        d.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(*ACCENT_GLASS, a),
            width=w,
        )

    # Center dot — accent soft (light blue) to break up the green
    dot_r = max(4, int(size / 38))
    d.ellipse(
        [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
        fill=(*ACCENT_SOFT, 255),
    )

    # 4 small tick marks at compass points, just inside outer halo
    tick_r_outer = content_radius * 0.9
    tick_r_inner = content_radius * 0.86
    tick_w = max(2, int(size / 180))
    for angle_deg in (0, 90, 180, 270):
        a = math.radians(angle_deg)
        x1 = cx + tick_r_outer * math.cos(a)
        y1 = cy + tick_r_outer * math.sin(a)
        x2 = cx + tick_r_inner * math.cos(a)
        y2 = cy + tick_r_inner * math.sin(a)
        d.line([(x1, y1), (x2, y2)], fill=(*ACCENT_GLASS, 220), width=tick_w)


def make_icon(size: int, *, maskable: bool = False) -> Image.Image:
    img = radial_gradient(size)
    # Maskable: content fits in central 80% (so OS-applied mask doesn't clip)
    safe = 0.40 if maskable else 0.46
    content_radius = size * safe
    draw_rings(img, content_radius)
    return img


def save(img: Image.Image, name: str) -> None:
    p = OUT / name
    img.save(p, "PNG", optimize=True)
    print(f"  wrote {p.relative_to(ROOT)}  ({img.size[0]}x{img.size[1]})")


def main() -> None:
    print(f"Writing icons to {OUT}")
    save(make_icon(192), "icon-192.png")
    save(make_icon(512), "icon-512.png")
    save(make_icon(512, maskable=True), "icon-512-maskable.png")
    save(make_icon(180), "apple-touch-icon.png")
    # Smaller fallback for older Android.
    save(make_icon(96), "icon-96.png")


if __name__ == "__main__":
    main()
