import { PrismaClient } from "@prisma/client";

const firebaseUid = process.argv[2]?.trim();
if (!firebaseUid) {
  console.error("Usage: npm run admin:grant -- <firebase-uid>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.update({
    where: { firebaseUid },
    data: { role: "PLATFORM_ADMIN" },
    select: { firebaseUid: true, displayName: true, role: true },
  });
  console.log(
    `Granted ${user.role} to ${user.displayName} (${user.firebaseUid}).`,
  );
} finally {
  await prisma.$disconnect();
}
