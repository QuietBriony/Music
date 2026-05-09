"""Generate Hazama FM + Music Core Rig PWA icons.

Produces:
  icons/icon-{96,192,512,512-maskable}.png       — Hazama FM (mint rings)
  icons/apple-touch-icon.png                     — Hazama FM iOS (180x180)
  icons/mixer-{96,192,512,512-maskable}.png      — Mixer (warm 9-fader radial)
  icons/mixer-apple-touch-icon.png               — Mixer iOS (180x180)

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


# ---- Mixer icon (9-fader radial, warm) -----------------------------------

ACCENT_HEAT = (255, 207, 112)    # --accent-heat
ACCENT_RED = (255, 138, 60)
MIXER_BG_LIGHT = (28, 18, 36)


def mixer_radial_gradient(size: int) -> Image.Image:
    """Same dark navy floor but with a faintly warmer center for the mixer."""
    img = Image.new("RGB", (size, size), BG_DEEP)
    cx = cy = size / 2
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    max_r = size * 0.55
    steps = 28
    for i in range(steps):
        r = max_r * (1 - i / steps)
        alpha = int(8 + (i / steps) * 80)
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
    glow = Image.new("RGB", (size, size), MIXER_BG_LIGHT)
    img = Image.composite(glow, img, mask.filter(ImageFilter.GaussianBlur(size / 36)))
    return img


def draw_fader_radial(img: Image.Image, content_radius: float) -> None:
    """9 radial fader marks around a small center hub.

    Visual mnemonic for the 9 UCM faders (ENERGY/WAVE/MIND/CREATION/VOID/
    CIRCLE/BODY/RESOURCE/OBSERVER). Each fader is a line from inner_r to outer_r
    with a 'knob' dot at a varying position so it reads like sliders.
    """
    size = img.size[0]
    cx = cy = size / 2
    d = ImageDraw.Draw(img, "RGBA")

    # Outer faint frame ring.
    halo_r = content_radius * 0.95
    halo_w = max(2, int(size / 220))
    d.ellipse(
        [cx - halo_r, cy - halo_r, cx + halo_r, cy + halo_r],
        outline=(*ACCENT_HEAT, 90),
        width=halo_w,
    )

    # 9 faders, evenly spaced around the circle, starting at top.
    n = 9
    inner_r = content_radius * 0.30
    outer_r = content_radius * 0.86
    track_w = max(2, int(size / 180))
    knob_r = max(3, int(size / 36))

    # Knob position per fader (0..1 along track) — pseudo-snapshot of UCM mid state.
    knob_pos = [0.55, 0.62, 0.50, 0.58, 0.32, 0.66, 0.55, 0.62, 0.50]

    for i in range(n):
        # Start at top (-90deg) and go clockwise.
        angle = math.radians(-90 + (360 / n) * i)
        cos_a, sin_a = math.cos(angle), math.sin(angle)

        x1 = cx + inner_r * cos_a
        y1 = cy + inner_r * sin_a
        x2 = cx + outer_r * cos_a
        y2 = cy + outer_r * sin_a

        # Track (faded) line
        d.line([(x1, y1), (x2, y2)], fill=(*ACCENT_HEAT, 130), width=track_w)

        # Knob — heat color, slight shift toward red for variety
        kr = inner_r + (outer_r - inner_r) * knob_pos[i]
        kx = cx + kr * cos_a
        ky = cy + kr * sin_a
        knob_color = ACCENT_HEAT if i % 2 == 0 else ACCENT_RED
        d.ellipse([kx - knob_r, ky - knob_r, kx + knob_r, ky + knob_r], fill=(*knob_color, 255))

    # Center hub — small glowing ring.
    hub_r = inner_r * 0.78
    d.ellipse(
        [cx - hub_r, cy - hub_r, cx + hub_r, cy + hub_r],
        outline=(*ACCENT_HEAT, 220),
        width=max(2, int(size / 160)),
    )

    # Center dot (warmer red so it pops against the heat ring)
    dot_r = max(3, int(size / 48))
    d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=(*ACCENT_RED, 255))


def make_mixer_icon(size: int, *, maskable: bool = False) -> Image.Image:
    img = mixer_radial_gradient(size)
    safe = 0.40 if maskable else 0.46
    content_radius = size * safe
    draw_fader_radial(img, content_radius)
    return img


def save(img: Image.Image, name: str) -> None:
    p = OUT / name
    img.save(p, "PNG", optimize=True)
    print(f"  wrote {p.relative_to(ROOT)}  ({img.size[0]}x{img.size[1]})")


def main() -> None:
    print(f"Writing icons to {OUT}")
    # Hazama FM icons
    save(make_icon(192), "icon-192.png")
    save(make_icon(512), "icon-512.png")
    save(make_icon(512, maskable=True), "icon-512-maskable.png")
    save(make_icon(180), "apple-touch-icon.png")
    save(make_icon(96), "icon-96.png")
    # Mixer icons
    save(make_mixer_icon(192), "mixer-192.png")
    save(make_mixer_icon(512), "mixer-512.png")
    save(make_mixer_icon(512, maskable=True), "mixer-512-maskable.png")
    save(make_mixer_icon(180), "mixer-apple-touch-icon.png")
    save(make_mixer_icon(96), "mixer-96.png")


if __name__ == "__main__":
    main()
