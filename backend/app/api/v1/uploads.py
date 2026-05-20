import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/uploads", tags=["Uploads"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_FILE_TYPES = ALLOWED_IMAGE_TYPES | {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
}


async def _save_upload(file: UploadFile, subfolder: str) -> dict:
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )
    upload_dir = os.path.join(settings.UPLOAD_DIR, subfolder)
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "file")[1].lower() or ".bin"
    filename = f"{uuid.uuid4()}{ext}"
    with open(os.path.join(upload_dir, filename), "wb") as f:
        f.write(contents)
    return {
        "url": f"/uploads/{subfolder}/{filename}",
        "original_name": file.filename,
        "size": len(contents),
        "content_type": file.content_type,
    }


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _current_user=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Only image files are allowed (JPEG, PNG, GIF, WebP).")
    return JSONResponse(await _save_upload(file, "images"))


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    _current_user=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(400, "File type not allowed.")
    return JSONResponse(await _save_upload(file, "files"))
