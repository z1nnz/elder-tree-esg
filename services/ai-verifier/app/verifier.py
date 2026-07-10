import json
import os
from base64 import b64decode
from binascii import Error as Base64Error

from google import genai
from google.genai import types

from .image_pipeline import download_and_sanitize, sanitize_image_bytes
from .schemas import (
    ModelClassification,
    PhotoVerificationRequest,
    VerificationDecision,
    VerificationResult,
)


PASS_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.55


def apply_rules(
    request: PhotoVerificationRequest,
    classification: ModelClassification,
    model_name: str,
) -> VerificationResult:
    labels = {label.strip().lower() for label in classification.labels}
    required = {label.strip().lower() for label in request.required_labels}
    forbidden = {label.strip().lower() for label in request.forbidden_labels}
    reason_codes: list[str] = []

    if classification.unsafe_content:
        reason_codes.append("UNSAFE_CONTENT")
    if forbidden.intersection(labels):
        reason_codes.append("FORBIDDEN_LABEL")
    missing = (
        set()
        if request.match_any_required and (not required or required.intersection(labels))
        else required.difference(labels)
    )
    if missing:
        reason_codes.append("MISSING_REQUIRED_LABEL")
    if classification.contains_face:
        reason_codes.append("FACE_PRESENT_NOT_ANALYZED")

    hard_failure = any(
        code in reason_codes for code in ("UNSAFE_CONTENT", "FORBIDDEN_LABEL")
    )
    if hard_failure or classification.confidence < REVIEW_THRESHOLD:
        decision = VerificationDecision.FAIL
    elif missing or classification.confidence < PASS_THRESHOLD:
        decision = VerificationDecision.REVIEW
    else:
        decision = VerificationDecision.PASS

    if classification.confidence < PASS_THRESHOLD:
        reason_codes.append("LOW_CONFIDENCE")
    if not reason_codes:
        reason_codes.append("RULES_SATISFIED")

    return VerificationResult(
        evidence_id=request.evidence_id,
        decision=decision,
        confidence=classification.confidence,
        labels=sorted(labels),
        reason_codes=reason_codes,
        explanation=classification.description,
        model=model_name,
        rule_version=request.rule_version,
        exif_removed=request.image_url is not None,
        human_review_required=decision == VerificationDecision.REVIEW,
    )


async def verify_photo(request: PhotoVerificationRequest) -> VerificationResult:
    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    if not api_key or (request.image_url is None and request.image_base64 is None):
        classification = ModelClassification(
            labels=[],
            confidence=0,
            description="No Gemini key or image was configured.",
        )
        return apply_rules(request, classification, "rules-only")

    if request.image_base64 is not None:
        try:
            raw_bytes = b64decode(request.image_base64, validate=True)
        except Base64Error as error:
            raise ValueError("Image payload is not valid base64") from error
        image_bytes, mime_type = sanitize_image_bytes(
            raw_bytes,
            request.content_type or "image/jpeg",
        )
    else:
        image_bytes, mime_type = await download_and_sanitize(str(request.image_url))
    prompt = f"""
You verify low-pressure daily activity evidence. The task is:
{request.task_title}

Return only a structured classification. Identify visible objects and context.
Do not identify people, infer identity, age, health, emotion, or sensitive traits.
Required labels: {json.dumps(request.required_labels, ensure_ascii=False)}
Forbidden labels: {json.dumps(request.forbidden_labels, ensure_ascii=False)}
Confidence must represent how strongly the image supports the task.
"""
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=[
            prompt,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ModelClassification,
            temperature=0,
        ),
    )
    classification = ModelClassification.model_validate_json(response.text or "{}")
    return apply_rules(request, classification, model_name)
