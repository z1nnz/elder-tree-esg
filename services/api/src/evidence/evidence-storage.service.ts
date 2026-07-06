import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getStorage } from "firebase-admin/storage";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png"]);

@Injectable()
export class EvidenceStorageService {
  private file(path: string) {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new ServiceUnavailableException("Firebase Storage is not configured");
    }
    return getStorage().bucket(bucketName).file(path);
  }

  async assertUploaded(path: string, expectedContentType: string): Promise<void> {
    const [metadata] = await this.file(path).getMetadata();
    const size = Number(metadata.size ?? 0);
    const contentType = metadata.contentType ?? expectedContentType;
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException("Unsupported evidence content type");
    }
    if (size <= 0 || size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException("Evidence image must be between 1 byte and 10 MB");
    }
  }

  async createSignedReadUrl(path: string): Promise<string> {
    const [url] = await this.file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + 5 * 60 * 1000,
    });
    return url;
  }

  async deleteObject(path: string): Promise<void> {
    await this.file(path).delete({ ignoreNotFound: true });
  }
}
