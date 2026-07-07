import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  DashboardSnapshot,
  DeviceDesiredState,
  DeviceReportedState,
  FamilyMessage,
  ImpactBatchSummary,
  ReviewItem,
  TaskSummary,
  TreeSummary,
  VerificationDecision,
} from "@elder-tree/contracts";
import { randomUUID } from "node:crypto";
import { nextStageAt, stageForPoints } from "./tree-growth";

const TASK_PHOTO_ID = "11111111-1111-4111-8111-111111111111";
const TASK_HYDRATION_PHOTO_ID = "55555555-5555-4555-8555-555555555555";
const TASK_WATER_ID = "22222222-2222-4222-8222-222222222222";
const TASK_WALK_ID = "33333333-3333-4333-8333-333333333333";
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";

interface EvidenceRecord {
  id: string;
  assignmentId: string;
  storagePath: string;
  sha256: string | null;
  completed: boolean;
}

interface AuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  note: string | null;
  createdAt: string;
}

@Injectable()
export class DemoStoreService {
  private tasks: TaskSummary[] = [
    {
      id: TASK_PHOTO_ID,
      title: "拍下今天的一抹綠",
      description: "找一株植物，拍下讓你停下來多看一眼的地方。",
      verificationMode: "PHOTO_AI",
      growthPoints: 80,
      status: "AVAILABLE",
      startedAt: null,
      minimumSeconds: null,
      dueAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      capability: { enabled: false, reason: "BLAZE_REQUIRED" },
    },
    {
      id: TASK_HYDRATION_PHOTO_ID,
      title: "拍下今天的水杯",
      description: "讓水杯或水瓶清楚入鏡，提醒自己慢慢補水。",
      verificationMode: "PHOTO_AI",
      growthPoints: 35,
      status: "AVAILABLE",
      startedAt: null,
      minimumSeconds: null,
      dueAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      capability: { enabled: false, reason: "BLAZE_REQUIRED" },
    },
    {
      id: TASK_WATER_ID,
      title: "慢慢喝一杯水",
      description: "為自己倒杯水，坐下來慢慢喝完。",
      verificationMode: "SELF_CHECK",
      growthPoints: 30,
      status: "AVAILABLE",
      startedAt: null,
      minimumSeconds: null,
      dueAt: null,
      capability: { enabled: true, reason: null },
    },
    {
      id: TASK_WALK_ID,
      title: "十分鐘散步",
      description: "在住家附近走一小段，累了隨時可以休息。",
      verificationMode: "TIMER",
      growthPoints: 60,
      status: "IN_PROGRESS",
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      minimumSeconds: 600,
      dueAt: null,
      capability: { enabled: true, reason: null },
    },
  ];

  private tree: TreeSummary = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "我們家的陪伴樹",
    stage: "SPROUT",
    growthPoints: 180,
    nextStageAt: 250,
    householdName: "林家",
  };

  private messages: FamilyMessage[] = [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      authorName: "小晴",
      body: "阿公，今天看到漂亮的花可以拍給我看喔。",
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      deliveredToDeviceAt: new Date(Date.now() - 44 * 60 * 1000).toISOString(),
    },
  ];

  private reviews: ReviewItem[] = [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      taskTitle: "記錄今天看到的植物",
      participantName: "王奶奶",
      imageUrl:
        "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80",
      confidence: 0.72,
      labels: ["plant", "flower", "outdoor"],
      explanation: "可辨識植物與戶外環境，但主體部分被遮擋，需要人工確認。",
      createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    },
  ];

  private batches: ImpactBatchSummary[] = [
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      title: "七月社區綠化示範批次",
      status: "SIMULATED",
      simulated: true,
      allocatedPoints: 12800,
      equivalentTrees: 12.8,
      publishedAt: null,
    },
  ];

  private desiredState: DeviceDesiredState = {
    activeTaskId: TASK_PHOTO_ID,
    activeTaskTitle: "拍下今天的一抹綠",
    messagePreview: this.messages[0].body,
    treeStage: this.tree.stage,
    growthPoints: this.tree.growthPoints,
    ledScene: "TASK_DUE",
    brightness: 65,
    firmwareTarget: null,
    commandId: null,
    updatedAt: new Date().toISOString(),
  };

  private reportedState: DeviceReportedState = {
    online: true,
    firmwareVersion: "0.1.0",
    ambientLux: 168,
    temperatureC: 25.6,
    humidityPercent: 61,
    presence: true,
    lastInteractionAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    acknowledgedCommandId: null,
    queueDepth: 0,
    updatedAt: new Date().toISOString(),
  };

  private evidence = new Map<string, EvidenceRecord>();
  private idempotencyKeys = new Set<string>();
  private deviceEventKeys = new Set<string>();
  private audits: AuditRecord[] = [];

  listTasks(): TaskSummary[] {
    return structuredClone(this.tasks);
  }

  getTree(): TreeSummary {
    return structuredClone(this.tree);
  }

  startTask(id: string): TaskSummary {
    const task = this.requireTask(id);
    if (task.status === "COMPLETED") {
      throw new ConflictException("Task is already complete");
    }
    task.status = "IN_PROGRESS";
    return structuredClone(task);
  }

  completeTask(id: string, idempotencyKey?: string): TaskSummary {
    const task = this.requireTask(id);
    if (task.verificationMode === "PHOTO_AI") {
      throw new BadRequestException("PHOTO_AI tasks require evidence");
    }
    if (task.status === "COMPLETED") {
      return structuredClone(task);
    }
    const key = idempotencyKey ?? `task:${id}`;
    if (!this.idempotencyKeys.has(key)) {
      this.idempotencyKeys.add(key);
      this.addGrowth(task.growthPoints, `task:${id}`);
    }
    task.status = "COMPLETED";
    return structuredClone(task);
  }

  completeGeminiPhotoTask(id: string, idempotencyKey?: string): TaskSummary {
    const task = this.requireTask(id);
    if (task.verificationMode !== "PHOTO_AI") {
      throw new BadRequestException("This task does not accept photo verification");
    }
    if (task.status === "COMPLETED") {
      return structuredClone(task);
    }
    const key = idempotencyKey ?? `gemini-photo:${id}`;
    if (!this.idempotencyKeys.has(key)) {
      this.idempotencyKeys.add(key);
      this.addGrowth(task.growthPoints, `gemini-photo:${id}`);
    }
    task.status = "COMPLETED";
    return structuredClone(task);
  }

  initializeEvidence(assignmentId: string, fileName: string): EvidenceRecord & {
    uploadUrl: string;
  } {
    const task = this.requireTask(assignmentId);
    if (task.verificationMode !== "PHOTO_AI") {
      throw new BadRequestException("This task does not accept photo evidence");
    }
    task.status = "VERIFYING";
    const id = randomUUID();
    const record: EvidenceRecord = {
      id,
      assignmentId,
      storagePath: `evidence/demo-elder/${id}/${fileName}`,
      sha256: null,
      completed: false,
    };
    this.evidence.set(id, record);
    return {
      ...record,
      uploadUrl: `demo-upload://${record.storagePath}`,
    };
  }

  completeEvidence(id: string, sha256: string): {
    evidenceId: string;
    decision: VerificationDecision;
    reviewId: string;
  } {
    const record = this.evidence.get(id);
    if (!record) throw new NotFoundException("Evidence not found");
    record.sha256 = sha256;
    record.completed = true;

    const reviewId = randomUUID();
    this.reviews.unshift({
      id: reviewId,
      taskTitle: this.requireTask(record.assignmentId).title,
      participantName: "林阿公",
      imageUrl:
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80",
      confidence: 0.73,
      labels: ["plant", "greenery", "outdoor"],
      explanation: "Demo AI 找到植物與戶外線索，信心值落在人工覆核區間。",
      createdAt: new Date().toISOString(),
    });
    return { evidenceId: id, decision: "REVIEW", reviewId };
  }

  listReviews(): ReviewItem[] {
    return structuredClone(this.reviews);
  }

  decideReview(id: string, decision: "PASS" | "FAIL", note?: string): ReviewItem {
    const index = this.reviews.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException("Review item not found");
    const [item] = this.reviews.splice(index, 1);
    const task = this.tasks.find((candidate) => candidate.title === item.taskTitle);
    if (decision === "PASS" && task && task.status !== "COMPLETED") {
      task.status = "COMPLETED";
      this.addGrowth(task.growthPoints, `review:${id}`);
    } else if (task) {
      task.status = "REJECTED";
    }
    this.audits.unshift({
      id: randomUUID(),
      action: `VERIFICATION_${decision}`,
      entityType: "VerificationRun",
      entityId: id,
      note: note ?? null,
      createdAt: new Date().toISOString(),
    });
    return item;
  }

  listMessages(): FamilyMessage[] {
    return structuredClone(this.messages);
  }

  createMessage(body: string): FamilyMessage {
    const now = new Date().toISOString();
    const message: FamilyMessage = {
      id: randomUUID(),
      authorName: "小晴",
      body,
      createdAt: now,
      deliveredToDeviceAt: this.reportedState.online ? now : null,
    };
    this.messages.unshift(message);
    this.desiredState = {
      ...this.desiredState,
      messagePreview: body,
      ledScene: "MESSAGE",
      commandId: randomUUID(),
      updatedAt: now,
    };
    return structuredClone(message);
  }

  listDevices() {
    return [
      {
        id: DEVICE_ID,
        serialNumber: "TREE-DEMO-001",
        name: "客廳陪伴樹",
        claimed: true,
        desiredState: structuredClone(this.desiredState),
        reportedState: structuredClone(this.reportedState),
      },
    ];
  }

  claimDevice(serialNumber: string, claimCode: string) {
    if (serialNumber !== "TREE-DEMO-001" || claimCode !== "246810") {
      throw new BadRequestException("Invalid serial number or claim code");
    }
    return this.listDevices()[0];
  }

  getDeviceState(id: string) {
    this.requireDevice(id);
    return {
      desired: structuredClone(this.desiredState),
      reported: structuredClone(this.reportedState),
    };
  }

  commandDevice(id: string, update: { messagePreview?: string; brightness?: number }) {
    this.requireDevice(id);
    const now = new Date().toISOString();
    this.desiredState = {
      ...this.desiredState,
      ...update,
      ledScene: update.messagePreview ? "MESSAGE" : this.desiredState.ledScene,
      commandId: randomUUID(),
      updatedAt: now,
    };
    return structuredClone(this.desiredState);
  }

  ingestDeviceEvent(
    id: string,
    event: {
      eventKey: string;
      eventType: string;
      occurredAt: string;
      payload?: Record<string, unknown>;
    },
  ) {
    this.requireDevice(id);
    if (this.deviceEventKeys.has(event.eventKey)) {
      return { accepted: true, duplicate: true };
    }
    this.deviceEventKeys.add(event.eventKey);
    this.reportedState = {
      ...this.reportedState,
      online: true,
      lastInteractionAt: event.occurredAt,
      queueDepth: Number(event.payload?.queueDepth ?? this.reportedState.queueDepth),
      updatedAt: new Date().toISOString(),
    };
    return { accepted: true, duplicate: false };
  }

  getSnapshot(): DashboardSnapshot {
    return {
      participantCount: 48,
      completedTaskCount: this.tasks.filter((task) => task.status === "COMPLETED").length + 326,
      pendingReviewCount: this.reviews.length,
      connectedDeviceCount: this.reportedState.online ? 1 : 0,
      impactPoolPoints: 24750,
      simulatedTreeCount: 24,
    };
  }

  listBatches(): ImpactBatchSummary[] {
    return structuredClone(this.batches);
  }

  createBatch(title: string, allocatedPoints: number, simulated: true) {
    if (!simulated) {
      throw new BadRequestException("MVP only permits simulated impact batches");
    }
    const batch: ImpactBatchSummary = {
      id: randomUUID(),
      title,
      status: "DRAFT",
      simulated: true,
      allocatedPoints,
      equivalentTrees: Math.round((allocatedPoints / 1000) * 10) / 10,
      publishedAt: null,
    };
    this.batches.unshift(batch);
    this.audits.unshift({
      id: randomUUID(),
      action: "IMPACT_BATCH_CREATED",
      entityType: "ImpactBatch",
      entityId: batch.id,
      note: "simulated=true",
      createdAt: new Date().toISOString(),
    });
    return structuredClone(batch);
  }

  publishBatch(id: string): ImpactBatchSummary {
    const batch = this.batches.find((item) => item.id === id);
    if (!batch) throw new NotFoundException("Impact batch not found");
    batch.status = "PUBLISHED";
    batch.publishedAt = new Date().toISOString();
    return structuredClone(batch);
  }

  listAudits(): AuditRecord[] {
    return structuredClone(this.audits);
  }

  private requireTask(id: string) {
    const task = this.tasks.find((candidate) => candidate.id === id);
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  private requireDevice(id: string) {
    if (id !== DEVICE_ID) throw new NotFoundException("Device not found");
  }

  private addGrowth(points: number, key: string) {
    if (this.idempotencyKeys.has(`growth:${key}`)) return;
    this.idempotencyKeys.add(`growth:${key}`);
    this.tree.growthPoints += points;
    this.tree.stage = stageForPoints(this.tree.growthPoints);
    this.tree.nextStageAt = nextStageAt(this.tree.growthPoints);
    this.desiredState = {
      ...this.desiredState,
      treeStage: this.tree.stage,
      growthPoints: this.tree.growthPoints,
      ledScene: this.tree.stage === "MATURE" ? "MATURE" : "GROWTH",
      commandId: randomUUID(),
      updatedAt: new Date().toISOString(),
    };
  }
}
