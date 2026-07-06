import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    role: string;
  };
}

@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || request.path.endsWith("/health")) {
      return true;
    }

    if (
      process.env.NODE_ENV !== "production" &&
      process.env.DEMO_MODE !== "false"
    ) {
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

    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const canCheckRevocation = Boolean(
      process.env.FIREBASE_CLIENT_EMAIL && privateKey,
    );
    if (!getApps().length) {
      if (!process.env.FIREBASE_PROJECT_ID) {
        throw new UnauthorizedException("Firebase Admin is not configured");
      }
      if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
        });
      } else {
        initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
      }
    }

    try {
      const decoded = await getAuth().verifyIdToken(token, canCheckRevocation);
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
