import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @Length(1, 40)
  displayName!: string;
}

export class SetActiveHouseholdDto {
  @ApiProperty()
  @IsUUID()
  householdId!: string;
}

export class JoinHouseholdDto {
  @ApiProperty()
  @IsString()
  @Length(8, 8)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 24)
  relationship!: string;
}

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
  @IsIn(["image/jpeg", "image/png"])
  contentType!: string;
}

export class CompleteEvidenceDto {
  @ApiProperty()
  @IsString()
  @Length(8, 128)
  sha256!: string;
}

export class CompleteGeminiPhotoTaskDto {
  @ApiProperty({ example: "image/jpeg" })
  @IsIn(["image/jpeg", "image/png"])
  contentType!: string;

  @ApiProperty({ description: "Base64-encoded sanitized image bytes" })
  @IsString()
  @MaxLength(14_000_000)
  imageBase64!: string;

  @ApiPropertyOptional({ description: "Prevents duplicate growth awards" })
  @IsOptional()
  @IsString()
  @Length(8, 120)
  idempotencyKey?: string;
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

export class LineTestPushDto {
  @ApiProperty()
  @IsUUID()
  lineBindingId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 160)
  message?: string;
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

export class ExplorationEventDto {
  @ApiProperty()
  @IsString()
  @Length(8, 100)
  eventKey!: string;

  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  accuracyMeters!: number;

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;
}

export class StartExplorationSessionDto {
  @ApiProperty()
  @IsUUID()
  routeId!: string;
}

export class CreateExplorationRouteDto {
  @ApiProperty()
  @IsString()
  @Length(3, 80)
  slug!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiProperty()
  @IsString()
  @Length(8, 500)
  description!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 80)
  badgeName!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 80)
  badgeAssetKey!: string;
}

export class UpdateExplorationRouteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  badgeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  badgeAssetKey?: string;
}

export class CreateExplorationQuestDto {
  @ApiProperty()
  @IsUUID()
  routeId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100)
  sequence!: number;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  locationName!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 40)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 300)
  safetyNote?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  accessibilityTags!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 500)
  sourceUrl?: string;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  title!: string;

  @ApiProperty()
  @IsString()
  @Length(4, 500)
  description!: string;

  @ApiProperty({ enum: ["SELF_CHECK", "TIMER"] })
  @IsIn(["SELF_CHECK", "TIMER"])
  verificationMode!: "SELF_CHECK" | "TIMER";

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  minimumSeconds?: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(50)
  growthPoints!: number;

  @ApiProperty({ enum: ["DISTANCE", "GEOFENCE"] })
  @IsIn(["DISTANCE", "GEOFENCE"])
  triggerType!: "DISTANCE" | "GEOFENCE";

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(150)
  radiusMeters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(20_000)
  unlockDistanceMeters?: number;
}

export class UpdateExplorationQuestDto extends CreateExplorationQuestDto {}

export class ReorderExplorationQuestsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  questIds!: string[];
}

export class RadarMissionEventDto {
  @ApiProperty()
  @IsString()
  @Length(8, 100)
  eventKey!: string;

  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  accuracyMeters!: number;

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;
}

export class CompleteRadarMissionDto {
  @ApiPropertyOptional({ description: "Prevents duplicate growth awards" })
  @IsOptional()
  @IsString()
  @Length(8, 120)
  idempotencyKey?: string;
}

export class CreateRadarMissionDto {
  @ApiProperty()
  @IsString()
  @Length(2, 100)
  title!: string;

  @ApiProperty()
  @IsString()
  @Length(8, 500)
  description!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 40)
  category!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 40)
  tag!: string;

  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;

  @ApiProperty()
  @IsInt()
  @Min(25)
  @Max(150)
  radiusMeters!: number;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ enum: ["SELF_CHECK", "TIMER"] })
  @IsIn(["SELF_CHECK", "TIMER"])
  verificationMode!: "SELF_CHECK" | "TIMER";

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  minimumSeconds?: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(50)
  growthPoints!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  badgeName?: string;
}

export class UpdateRadarMissionDto extends CreateRadarMissionDto {}

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
