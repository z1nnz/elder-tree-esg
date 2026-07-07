import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "./api-auth.guard";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const firebaseUid = request.user?.uid;
    if (!firebaseUid) throw new ForbiddenException("Platform administrator required");
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: { role: true },
    });
    if (user?.role !== "PLATFORM_ADMIN") {
      throw new ForbiddenException("Platform administrator required");
    }
    return true;
  }
}
