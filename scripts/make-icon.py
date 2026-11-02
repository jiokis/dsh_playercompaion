from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from _paths import ROOT


def gradient(size, top, bottom):
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    width, height = size
    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(4))
        draw.line((0, y, width, y), fill=color)
    return image


def main():
    scale = 4
    size = 128 * scale
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Rounded dark tile with a subtle blue edge.
    tile_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(tile_mask).rounded_rectangle((8 * scale, 8 * scale, size - 8 * scale, size - 8 * scale), radius=26 * scale, fill=255)
    tile = gradient((size, size), (18, 24, 38, 255), (10, 14, 24, 255))
    canvas.alpha_composite(Image.composite(tile, Image.new("RGBA", (size, size), (0, 0, 0, 0)), tile_mask))

    edge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle((10 * scale, 10 * scale, size - 10 * scale, size - 10 * scale), radius=24 * scale, outline=(75, 108, 255, 110), width=2 * scale)
    canvas.alpha_composite(edge)

    # Soft blue glow behind the bookmark.
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((31 * scale, 25 * scale, 97 * scale, 103 * scale), fill=(75, 108, 255, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(10 * scale))
    canvas.alpha_composite(glow)

    # Bookmark body.
    bookmark = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bookmark)
    draw.polygon(
        [
            (43 * scale, 31 * scale),
            (85 * scale, 31 * scale),
            (85 * scale, 99 * scale),
            (64 * scale, 82 * scale),
            (43 * scale, 99 * scale),
        ],
        fill=(91, 124, 255, 255),
    )
    # Inner highlight.
    draw.polygon(
        [
            (48 * scale, 37 * scale),
            (80 * scale, 37 * scale),
            (80 * scale, 88 * scale),
            (64 * scale, 76 * scale),
            (48 * scale, 88 * scale),
        ],
        fill=(39, 61, 156, 160),
    )
    # Gold focal dot.
    draw.ellipse((56 * scale, 48 * scale, 72 * scale, 64 * scale), fill=(232, 196, 122, 255))
    draw.ellipse((59 * scale, 51 * scale, 66 * scale, 58 * scale), fill=(255, 238, 202, 220))
    canvas.alpha_composite(bookmark)

    # Small side tick like a DSH card accent.
    accent = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(accent).rounded_rectangle((26 * scale, 44 * scale, 31 * scale, 84 * scale), radius=3 * scale, fill=(75, 108, 255, 220))
    canvas.alpha_composite(accent)

    out = canvas.resize((128, 128), Image.Resampling.LANCZOS)
    path = ROOT / "icon.png"
    out.save(path, "PNG")
    print(path, path.stat().st_size)


if __name__ == "__main__":
    main()
