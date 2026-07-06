import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const [serialNumber, claimCode, ...nameParts] = process.argv.slice(2);
const thingName = nameParts.join(" ").trim() || serialNumber;
const pepper = process.env.DEVICE_CLAIM_PEPPER;

if (!serialNumber || !claimCode || !pepper) {
  throw new Error(
    "Usage: DEVICE_CLAIM_PEPPER=... npm run provision:device -- SERIAL CLAIM_CODE [NAME]",
  );
}

const claimCodeHash = createHash("sha256")
  .update(`${pepper}\u0000${serialNumber}\u0000${claimCode}`)
  .digest("hex");
const prisma = new PrismaClient();

try {
  const device = await prisma.device.upsert({
    where: { serialNumber },
    update: { claimCodeHash, thingName },
    create: {
      serialNumber,
      thingName,
      claimCodeHash,
      firmwareVersion: "0.1.0",
    },
  });
  console.log(`Provisioned ${device.serialNumber} (${device.id})`);
} finally {
  await prisma.$disconnect();
}
