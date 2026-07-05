from app.schemas import ModelClassification, PhotoVerificationRequest
from app.verifier import apply_rules


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
