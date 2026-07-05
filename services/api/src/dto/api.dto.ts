import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";

export class CompleteTaskDto {
  @ApiPropertyOptional({ description: "Prevents duplicate growth awards" })
  @IsOptional()
  @IsString()
  @Length(8, 120)
  idempotencyKey?: string;
}

export class InitializeEvidenceDto {
  @ApiProperty()
  @IsUUID()
  assignmentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ example: "image/jpeg" })
  @IsIn(["image/jpeg", "image/png", "image/heic"])
  contentType!: string;
}

export class CompleteEvidenceDto {
  @ApiProperty()
  @IsString()
  @Length(8, 128)
  sha256!: string;
}

export class ReviewDecisionDto {
  @ApiProperty({ enum: ["PASS", "FAIL"] })
  @IsIn(["PASS", "FAIL"])
  decision!: "PASS" | "FAIL";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 300)
  note?: string;
}

export class CreateMessageDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  body!: string;
}

export class ClaimDeviceDto {
  @ApiProperty()
  @IsString()
  @Length(4, 40)
  serialNumber!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 12)
  claimCode!: string;
}

export class DeviceCommandDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  messagePreview?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(100)
  brightness?: number;
}

export class DeviceEventDto {
  @ApiProperty()
  @IsString()
  @Length(8, 100)
  eventKey!: string;

  @ApiProperty({ enum: ["BUTTON_TASK", "BUTTON_FAMILY", "BUTTON_CONFIRM", "STATE"] })
  @IsIn(["BUTTON_TASK", "BUTTON_FAMILY", "BUTTON_CONFIRM", "STATE"])
  eventType!: string;

  @ApiProperty()
  @IsString()
  occurredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class CreateImpactBatchDto {
  @ApiProperty()
  @IsString()
  @Length(3, 100)
  title!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  allocatedPoints!: number;

  @ApiProperty({ default: true })
  @IsBoolean()
  simulated!: true;
}
