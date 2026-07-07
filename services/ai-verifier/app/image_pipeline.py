from io import BytesIO

import httpx
from PIL import Image, ImageOps


MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024
MAX_DIMENSION = 1600


async def download_and_sanitize(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type", "image/jpeg").split(";")[0]
            if content_type not in {"image/jpeg", "image/png", "image/heic"}:
                raise ValueError("Unsupported image content type")
            chunks: list[bytes] = []
            received = 0
            async for chunk in response.aiter_bytes():
                received += len(chunk)
                if received > MAX_DOWNLOAD_BYTES:
                    raise ValueError("Image exceeds 12 MB")
                chunks.append(chunk)

    return sanitize_image_bytes(b"".join(chunks), content_type)


def sanitize_image_bytes(source: bytes, content_type: str) -> tuple[bytes, str]:
    if content_type not in {"image/jpeg", "image/png", "image/heic", "image/webp"}:
        raise ValueError("Unsupported image content type")
    if not source or len(source) > MAX_DOWNLOAD_BYTES:
        raise ValueError("Image exceeds 12 MB")
    image = Image.open(BytesIO(source))
    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    output = BytesIO()
    image.save(output, format="JPEG", quality=88, optimize=True)
    return output.getvalue(), "image/jpeg"
