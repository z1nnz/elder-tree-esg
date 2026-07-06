import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      transactionOptions: {
        maxWait: 30_000,
        timeout: 60_000,
      },
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
