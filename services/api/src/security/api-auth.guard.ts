import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    role: string;
  };
}

@Injectable()
export class ApiAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.path.endsWith("/health")) {
      return true;
    }

    if (process.env.DEMO_MODE !== "false") {
      request.user = {
        uid: request.header("x-demo-user") ?? "demo-elder",
        role: request.header("x-demo-role") ?? "PARTICIPANT",
      };
      return true;
    }

    const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      throw new UnauthorizedException("Missing Firebase ID token");
    }

    if (!getApps().length) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
      if (
        !process.env.FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_CLIENT_EMAIL ||
        !privateKey
      ) {
        throw new UnauthorizedException("Firebase Admin is not configured");
      }
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    }

    try {
      const decoded = await getAuth().verifyIdToken(token, true);
      request.user = {
        uid: decoded.uid,
        role: String(decoded.role ?? "PARTICIPANT"),
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or revoked Firebase ID token");
    }
  }
}
