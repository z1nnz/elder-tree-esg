from app.schemas import ModelClassification, PhotoVerificationRequest
import asyncio

from app.verifier import apply_rules, verify_photo


def request(**overrides):
    values = {
        "evidence_id": "evidence-1",
        "task_title": "拍下一株植物",
        "required_labels": ["plant"],
        "rule_version": "1.0.0",
    }
    values.update(overrides)
    return PhotoVerificationRequest(**values)


def test_high_confidence_matching_image_passes():
    result = apply_rules(
        request(),
        ModelClassification(
            labels=["plant", "outdoor"],
            confidence=0.93,
            description="A green plant is clearly visible.",
        ),
        "test-model",
    )
    assert result.decision == "PASS"
    assert result.human_review_required is False


def test_ambiguous_image_requires_review():
    result = apply_rules(
        request(),
        ModelClassification(
            labels=["plant"],
            confidence=0.71,
            description="A plant may be visible behind another object.",
        ),
        "test-model",
    )
    assert result.decision == "REVIEW"
    assert result.human_review_required is True


def test_missing_required_label_never_auto_passes():
    result = apply_rules(
        request(),
        ModelClassification(
            labels=["sky"],
            confidence=0.98,
            description="Only the sky is visible.",
        ),
        "test-model",
    )
    assert result.decision == "REVIEW"
    assert "MISSING_REQUIRED_LABEL" in result.reason_codes


def test_match_any_required_accepts_one_matching_label():
    result = apply_rules(
        request(required_labels=["plant", "flower"], match_any_required=True),
        ModelClassification(
            labels=["flower"],
            confidence=0.93,
            description="A flower is clearly visible.",
        ),
        "test-model",
    )
    assert result.decision == "PASS"


def test_high_confidence_hydration_image_passes():
    result = apply_rules(
        request(required_labels=["water bottle", "cup"], match_any_required=True),
        ModelClassification(
            labels=["cup", "drink"],
            confidence=0.91,
            description="A cup with a drink is clearly visible.",
        ),
        "test-model",
    )
    assert result.decision == "PASS"


def test_unsafe_content_fails():
    result = apply_rules(
        request(),
        ModelClassification(
            labels=["plant"],
            confidence=0.99,
            description="Unsafe content was detected.",
            unsafe_content=True,
        ),
        "test-model",
    )
    assert result.decision == "FAIL"


def test_missing_gemini_key_does_not_pass(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    result = asyncio.run(
        verify_photo(request(image_base64="ZmFrZS1qcGVn", content_type="image/jpeg"))
    )
    assert result.decision == "FAIL"
    assert result.model == "rules-only"
    assert "LOW_CONFIDENCE" in result.reason_codes


def test_demo_override_payload_does_not_bypass_missing_gemini_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    result = asyncio.run(
        verify_photo(
            PhotoVerificationRequest(
                evidence_id="evidence-demo",
                task_title="拍下一株植物",
                image_base64="ZmFrZS1qcGVn",
                content_type="image/jpeg",
                required_labels=["plant"],
                demo_labels=["plant"],
                demo_confidence=0.99,
            )
        )
    )
    assert result.decision == "FAIL"
    assert result.model == "rules-only"
