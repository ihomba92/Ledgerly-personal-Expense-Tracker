"""Profile pictures.

Every upload is opened and re-drawn by Pillow, never stored as sent:
  - only real JPEG, PNG or WebP images are accepted (checked by content, not file name)
  - "decompression bomb" images (tiny files that expand to billions of pixels) are refused
  - photos are turned the right way up, cropped to a centred square and resized to 256 x 256
  - saved as a fresh WebP, so hidden data (GPS location, camera details) is not kept
"""
import io
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 5 * 1024 * 1024
SIZE = 256
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
Image.MAX_IMAGE_PIXELS = 40_000_000  # about 40 megapixels; larger raises DecompressionBombError


class AvatarError(ValueError):
    pass


def process(data: bytes) -> bytes:
    if not data:
        raise AvatarError("That file is empty.")
    if len(data) > MAX_BYTES:
        raise AvatarError("That image is over 5 MB. Choose a smaller one.")
    try:
        with warnings.catch_warnings():
            # Pillow only warns between 1x and 2x MAX_IMAGE_PIXELS; treat that as a refusal too.
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            return _clean(data)
    except AvatarError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning, OSError, SyntaxError) as exc:
        raise AvatarError("That file isn't an image we can use. Upload a JPG, PNG or WebP photo.") from exc


def _clean(data: bytes) -> bytes:
    with Image.open(io.BytesIO(data)) as probe:
        if probe.format not in ALLOWED_FORMATS:
            raise AvatarError("Upload a JPG, PNG or WebP image.")
        probe.verify()  # catches truncated or corrupt files
    with Image.open(io.BytesIO(data)) as image:
        image = ImageOps.exif_transpose(image)  # phone photos taken sideways
        image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
        image = ImageOps.fit(image, (SIZE, SIZE), method=Image.Resampling.LANCZOS)
        out = io.BytesIO()
        image.save(out, "WEBP", quality=85, method=6)  # a new file: no EXIF/GPS carried over
        return out.getvalue()
