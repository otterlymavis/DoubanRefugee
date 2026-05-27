#!/usr/bin/env python3
"""
Generate PNG icons for the DoubanRefugee browser extension.

Usage (from the extension/ directory):
    python scripts/generate-icons.py

Requires only Python stdlib (struct, zlib, os).
Creates icons/icon16.png, icons/icon48.png, icons/icon128.png.

The icon is a teal rounded-rect background with a white "D" letterform.
"""
import os
import struct
import zlib
import math


# ── PNG encoder (pure stdlib, no Pillow required) ──────────────────────────────

def _chunk(tag: str, data: bytes) -> bytes:
    raw = tag.encode("ascii") + data
    crc = struct.pack(">I", zlib.crc32(raw) & 0xFFFF_FFFF)
    return struct.pack(">I", len(data)) + raw + crc


def encode_png(pixels: list[list[tuple[int, int, int, int]]]) -> bytes:
    """Encode a 2-D list of (R,G,B,A) tuples as a PNG byte string."""
    height = len(pixels)
    width  = len(pixels[0])

    # IHDR: width, height, 8-bit RGBA
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)

    # Raw scanlines (filter byte 0 = None + RGBA bytes)
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter: none
        for r, g, b, a in row:
            raw += bytes([r, g, b, a])

    idat = zlib.compress(bytes(raw), 9)

    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk("IHDR", ihdr)
        + _chunk("IDAT", idat)
        + _chunk("IEND", b"")
    )


# ── Icon drawing helpers ───────────────────────────────────────────────────────

def lerp(a, b, t):
    return a + (b - a) * t


def blend(bg, fg):
    """Alpha-composite fg over bg (both RGBA tuples 0-255)."""
    a = fg[3] / 255.0
    return (
        round(lerp(bg[0], fg[0], a)),
        round(lerp(bg[1], fg[1], a)),
        round(lerp(bg[2], fg[2], a)),
        255,
    )


def draw_rounded_rect(px, size, x0, y0, x1, y1, radius, color):
    """Draw a filled rounded rectangle into px (RGBA list-of-lists)."""
    r, g, b, a = color
    for y in range(y0, y1):
        for x in range(x0, x1):
            # Distance to nearest corner center
            cx = max(x0 + radius, min(x, x1 - radius))
            cy = max(y0 + radius, min(y, y1 - radius))
            dist = math.hypot(x - cx, y - cy)
            if dist <= radius:
                alpha = min(255, round(a * min(1.0, radius - dist + 0.5)))
                px[y][x] = blend(px[y][x], (r, g, b, alpha))


def draw_letter_D(px, size, color):
    """Draw a simple 'D' letterform scaled to the icon size."""
    w = size
    h = size
    r, g, b = color[:3]

    # Character bounding box: center of icon, ~55% width, ~65% height
    margin_x = round(w * 0.28)
    margin_y = round(h * 0.20)
    cw = w - margin_x * 2   # character width
    ch = h - margin_y * 2   # character height
    thick = max(1, round(cw * 0.25))  # stroke thickness

    # Vertical stem (left side)
    for y in range(margin_y, margin_y + ch):
        for x in range(margin_x, margin_x + thick):
            alpha = 255
            px[y][x] = blend(px[y][x], (r, g, b, alpha))

    # Curved right side: approximate semicircle
    cx = margin_x + thick  # start of curve
    radius_outer = ch / 2.0
    radius_inner = radius_outer - thick
    center_y = margin_y + ch / 2.0

    for y in range(margin_y, margin_y + ch):
        dy = y - center_y
        if abs(dy) > radius_outer:
            continue
        x_outer = cx + math.sqrt(max(0, radius_outer**2 - dy**2))
        x_inner = cx + math.sqrt(max(0, radius_inner**2 - dy**2))
        x0 = round(x_inner)
        x1 = round(x_outer)
        for x in range(x0, min(x1 + 1, w)):
            alpha = 255
            px[y][x] = blend(px[y][x], (r, g, b, alpha))

    # Horizontal serifs (top and bottom)
    serif_w = min(round(cw * 0.55), w - margin_x)
    for x in range(margin_x, margin_x + serif_w):
        for y in range(margin_y, margin_y + thick):
            px[y][x] = blend(px[y][x], (r, g, b, 255))
    for x in range(margin_x, margin_x + serif_w):
        for y in range(margin_y + ch - thick, margin_y + ch):
            if 0 <= y < h and 0 <= x < w:
                px[y][x] = blend(px[y][x], (r, g, b, 255))


def make_icon(size: int) -> bytes:
    # Background: transparent to start
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]

    # Teal rounded rectangle background
    bg_color = (16, 111, 105, 255)   # #106f69
    radius = max(2, round(size * 0.18))
    draw_rounded_rect(px, size, 0, 0, size, size, radius, bg_color)

    # White "D"
    draw_letter_D(px, size, (255, 255, 255, 255))

    return encode_png(px)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir  = os.path.join(script_dir, "..", "icons")
    os.makedirs(icons_dir, exist_ok=True)

    for size in [16, 48, 128]:
        png = make_icon(size)
        path = os.path.join(icons_dir, f"icon{size}.png")
        with open(path, "wb") as f:
            f.write(png)
        print(f"OK icons/icon{size}.png  ({len(png):,} bytes)")

    print("\nIcons generated!")
    print("Load the extension in Chrome:")
    print("  chrome://extensions  -> Developer mode ON  -> Load unpacked  -> select extension/")


if __name__ == "__main__":
    main()
