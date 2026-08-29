import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configureHttp } from "./http/configure-http";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureHttp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("同行成林服務介面")
    .setDescription("Daily tasks, companion tree, family, IoT, and simulated ESG impact")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.PORT ?? 4100);
  await app.listen(port, "0.0.0.0");
  console.log(`同行成林服務已啟動：http://localhost:${port}/api/v1`);
}

void bootstrap();
