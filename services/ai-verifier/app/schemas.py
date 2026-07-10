from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class VerificationDecision(StrEnum):
    PASS = "PASS"
    REVIEW = "REVIEW"
    FAIL = "FAIL"


class PhotoVerificationRequest(BaseModel):
    evidence_id: str
    task_title: str
    image_url: HttpUrl | None = None
    image_base64: str | None = Field(default=None, max_length=14_000_000)
    content_type: str | None = None
    required_labels: list[str] = Field(default_factory=list, max_length=10)
    forbidden_labels: list[str] = Field(default_factory=list, max_length=10)
    match_any_required: bool = False
    rule_version: str = "1.0.0"


class ModelClassification(BaseModel):
    labels: list[str] = Field(max_length=20)
    confidence: float = Field(ge=0, le=1)
    description: str = Field(max_length=300)
    unsafe_content: bool = False
    contains_face: bool = False


class VerificationResult(BaseModel):
    evidence_id: str
    decision: VerificationDecision
    confidence: float = Field(ge=0, le=1)
    labels: list[str]
    reason_codes: list[str]
    explanation: str
    model: str
    rule_version: str
    exif_removed: bool
    human_review_required: bool


class HealthResponse(BaseModel):
    status: Literal["ok"]
    mode: Literal["rules", "gemini"]
    model: str
