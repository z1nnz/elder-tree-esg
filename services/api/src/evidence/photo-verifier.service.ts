import {
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  verificationResultSchema,
  type VerificationResult,
} from "@elder-tree/contracts";

interface VerifyPhotoInput {
  evidenceId: string;
  taskTitle: string;
  imageUrl: string;
  requiredLabels: string[];
  forbiddenLabels: string[];
  matchAnyRequired?: boolean;
}

interface VerifyInlinePhotoInput {
  evidenceId: string;
  taskTitle: string;
  imageBase64: string;
  contentType: string;
  requiredLabels: string[];
  forbiddenLabels: string[];
  matchAnyRequired?: boolean;
}

@Injectable()
export class PhotoVerifierService {
  async verify(input: VerifyPhotoInput): Promise<VerificationResult> {
    return this.requestVerification({
      evidence_id: input.evidenceId,
      task_title: input.taskTitle,
      image_url: input.imageUrl,
      required_labels: input.requiredLabels,
      forbidden_labels: input.forbiddenLabels,
      match_any_required: input.matchAnyRequired ?? false,
      rule_version: "1.0.0",
    });
  }

  async verifyInline(input: VerifyInlinePhotoInput): Promise<VerificationResult> {
    return this.requestVerification({
      evidence_id: input.evidenceId,
      task_title: input.taskTitle,
      image_base64: input.imageBase64,
      content_type: input.contentType,
      required_labels: input.requiredLabels,
      forbidden_labels: input.forbiddenLabels,
      match_any_required: input.matchAnyRequired ?? false,
      rule_version: "1.0.0",
    });
  }

  private async requestVerification(
    body: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const baseUrl =
      process.env.AI_VERIFIER_URL ?? "http://127.0.0.1:4400";
    const response = await fetch(`${baseUrl}/verify/photo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Photo verifier returned ${response.status}`,
      );
    }
    const result = (await response.json()) as Record<string, unknown>;
    return verificationResultSchema.parse({
      decision: result.decision,
      confidence: result.confidence,
      labels: result.labels,
      reasonCodes: result.reason_codes,
      explanation: result.explanation,
      model: result.model,
      ruleVersion: result.rule_version,
    });
  }
}
