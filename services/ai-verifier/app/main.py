import os

from fastapi import FastAPI, HTTPException

from .schemas import HealthResponse, PhotoVerificationRequest, VerificationResult
from .verifier import verify_photo


app = FastAPI(
    title="Elder Tree AI Verifier",
    version="0.1.0",
    description="Privacy-conscious photo evidence classification and rule evaluation.",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        mode="gemini" if os.getenv("GEMINI_API_KEY") else "rules",
        model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
    )


@app.post("/verify/photo", response_model=VerificationResult)
async def verify_photo_endpoint(
    request: PhotoVerificationRequest,
) -> VerificationResult:
    try:
        return await verify_photo(request)
    except (ValueError, OSError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail="The external verification provider was unavailable.",
        ) from error
