import { ValidationPipe, type INestApplication } from "@nestjs/common";

// Keep live acceptance and the deployed server on the same HTTP contract.
export function configureHttp(app: INestApplication) {
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}
