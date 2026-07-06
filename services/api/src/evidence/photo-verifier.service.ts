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
}

@Injectable()
export class PhotoVerifierService {
  async verify(input: VerifyPhotoInput): Promise<VerificationResult> {
    const baseUrl =
      process.env.AI_VERIFIER_URL ?? "http://127.0.0.1:4400";
    const response = await fetch(`${baseUrl}/verify/photo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        evidence_id: input.evidenceId,
        task_title: input.taskTitle,
        image_url: input.imageUrl,
        required_labels: input.requiredLabels,
        forbidden_labels: input.forbiddenLabels,
        rule_version: "1.0.0",
      }),
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
