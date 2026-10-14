#!/usr/bin/env python3
"""
Remove background from MIVO logo images
Converts light gray/white backgrounds to transparent
"""

from PIL import Image
import os

def remove_background(input_path, output_path, threshold=240):
    """
    Remove light-colored background from an image

    Args:
        input_path: Path to input PNG file
        output_path: Path to output PNG file
        threshold: RGB threshold (pixels lighter than this become transparent)
    """
    # Open image
    img = Image.open(input_path)

    # Convert to RGBA if not already
    img = img.convert("RGBA")

    # Get image data
    datas = img.getdata()

    new_data = []
    for item in datas:
        # If pixel is very light (close to white/gray background), make it transparent
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))  # Transparent
        else:
            new_data.append(item)

    # Update image data
    img.putdata(new_data)

    # Save with transparency
    img.save(output_path, "PNG")
    print(f"[OK] Processed: {output_path}")

def main():
    public_dir = "public"

    logos = [
        ("mivo-logo-horizontal.png", "mivo-logo-horizontal-transparent.png"),
        ("mivo-logo-square.png", "mivo-logo-square-transparent.png"),
    ]

    for input_name, output_name in logos:
        input_path = os.path.join(public_dir, input_name)
        output_path = os.path.join(public_dir, output_name)

        if os.path.exists(input_path):
            remove_background(input_path, output_path, threshold=240)
        else:
            print(f"[ERROR] Not found: {input_path}")

    print("\n[OK] Logo processing complete!")
    print("Transparent logos saved with '-transparent' suffix")

if __name__ == "__main__":
    main()
