import { Ticket, TicketWorkflowExecution, TicketWorkflowStep, TicketWorkflowStepExecution } from "@prisma/client";
import { EmbedBuilder, Guild, TextChannel } from "discord.js";
import { prisma } from "../database/index.js";
import logger from "../logger.js";

interface WorkflowStepConfig {
  message?: {
    content?: string;
    embed?: {
      title?: string;
      description?: string;
      color?: string;
      fields?: { name: string; value: string; inline?: boolean }[];
    };
    channel?: string;
  };
  roleAssign?: {
    roleIds: string[];
    action: "add" | "remove";
    targets: "creator" | "assignee" | "specific";
    userIds?: string[];
  };
  statusChange?: {
    newStatus: string;
    reason?: string;
  };
  escalation?: {
    targetRoleId: string;
    notificationChannel?: string;
    timeoutHours?: number;
  };
  notification?: {
    targets: ("creator" | "assignee" | "role" | "channel")[];
    roleIds?: string[];
    channelIds?: string[];
    message: string;
  };
  delay?: {
    minutes: number;
  };
  condition?: {
    type: "status" | "time" | "field" | "custom";
    operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
    value: string;
    field?: string;
  };
}

// Result types for better type safety
interface MessageStepResult {
  messageId: string;
  channelId: string;
}

interface RoleAssignmentResult {
  userId: string;
  roleId: string;
  action: "add" | "remove";
  success: boolean;
  error?: string;
}

interface RoleAssignStepResult {
  results: RoleAssignmentResult[];
}

interface StatusChangeStepResult {
  oldStatus: string;
  newStatus: string;
  reason?: string;
}

interface EscalationStepResult {
  escalatedTo: string;
  notificationSent: boolean;
}

interface NotificationResult {
  target: "creator" | "assignee" | "role" | "channel";
  roleId?: string;
  channelId?: string;
  success: boolean;
  error?: string;
}

interface NotificationStepResult {
  results: NotificationResult[];
}

interface DelayStepResult {
  delayMinutes: number;
}

interface ConditionStepResult {
  conditionMet: boolean;
  type: string;
  operator: string;
  value: string;
}

type StepResult =
  | MessageStepResult
  | RoleAssignStepResult
  | StatusChangeStepResult
  | EscalationStepResult
  | NotificationStepResult
  | DelayStepResult
  | ConditionStepResult;

// Extended types with relations
interface TicketWorkflowExecutionWithSteps extends TicketWorkflowExecution {
  stepExecutions: TicketWorkflowStepExecution[];
}

export class TicketWorkflowService {
  private guild: Guild;

  constructor(guild: Guild) {
    this.guild = guild;
  }

  /**
   * Execute a workflow for a ticket
   */
  async executeWorkflow(ticketId: string, workflowId: string): Promise<void> {
    try {
      // Get or create workflow execution
      let execution = await prisma.ticketWorkflowExecution.findFirst({
        where: { ticketId, workflowId },
        include: {
          stepExecutions: {
            orderBy: { stepOrder: "asc" },
          },
        },
      });

      if (!execution) {
        // Get workflow steps
        const workflow = await prisma.ticketCategoryWorkflow.findUnique({
          where: { id: workflowId },
          include: {
            steps: {
              orderBy: { stepOrder: "asc" },
            },
          },
        });

        if (!workflow) {
          throw new Error("Workflow not found");
        }

        // Create execution
        execution = await prisma.ticketWorkflowExecution.create({
          data: {
            ticketId,
            workflowId,
            stepExecutions: {
              create: workflow.steps.map((step) => ({
                stepId: step.id,
                stepOrder: step.stepOrder,
                status: "PENDING",
              })),
            },
          },
          include: {
            stepExecutions: {
              orderBy: { stepOrder: "asc" },
            },
          },
        });
      }

      // Execute next pending step
      await this.executeNextStep(execution.id);
    } catch (error) {
      logger.error(`Failed to execute workflow ${workflowId} for ticket ${ticketId}:`, error);
      throw error;
    }
  }

  /**
   * Execute the next pending step in a workflow
   */
  async executeNextStep(executionId: string): Promise<void> {
    try {
      const execution = await prisma.ticketWorkflowExecution.findUnique({
        where: { id: executionId },
        include: {
          stepExecutions: {
            where: { status: "PENDING" },
            orderBy: { stepOrder: "asc" },
            take: 1,
          },
        },
      });

      if (!execution || execution.stepExecutions.length === 0) {
        // Mark execution as completed
        await prisma.ticketWorkflowExecution.update({
          where: { id: executionId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
        return;
      }

      const stepExecution = execution.stepExecutions[0];

      // Get step details
      const step = await prisma.ticketWorkflowStep.findUnique({
        where: { id: stepExecution.stepId },
      });

      if (!step) {
        throw new Error("Step not found");
      }

      // Mark step as running
      await prisma.ticketWorkflowStepExecution.update({
        where: { id: stepExecution.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      // Execute step based on type
      const result = await this.executeStep(execution.ticketId, step);

      // Mark step as completed
      await prisma.ticketWorkflowStepExecution.update({
        where: { id: stepExecution.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          result: JSON.parse(JSON.stringify(result)), // Safe JSON serialization
        },
      });

      // Execute next step
      await this.executeNextStep(executionId);
    } catch (error) {
      logger.error(`Failed to execute step in execution ${executionId}:`, error);

      // Mark step as failed
      const execution = await prisma.ticketWorkflowExecution.findUnique({
        where: { id: executionId },
        include: {
          stepExecutions: {
            where: { status: "RUNNING" },
            take: 1,
          },
        },
      });

      if (execution && execution.stepExecutions.length > 0) {
        await prisma.ticketWorkflowStepExecution.update({
          where: { id: execution.stepExecutions[0].id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }

      // Mark execution as failed
      await prisma.ticketWorkflowExecution.update({
        where: { id: executionId },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  /**
   * Execute a specific step
   */
  private async executeStep(ticketId: string, step: TicketWorkflowStep): Promise<StepResult> {
    const config = step.config as WorkflowStepConfig;

    // Get ticket details
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    switch (step.type) {
      case "MESSAGE":
        return await this.executeMessageStep(ticket, config.message);

      case "ROLE_ASSIGN":
        return await this.executeRoleAssignStep(ticket, config.roleAssign);

      case "STATUS_CHANGE":
        return await this.executeStatusChangeStep(ticket, config.statusChange);

      case "ESCALATION":
        return await this.executeEscalationStep(ticket, config.escalation);

      case "NOTIFICATION":
        return await this.executeNotificationStep(ticket, config.notification);

      case "DELAY":
        return await this.executeDelayStep(config.delay);

      case "CONDITION":
        return await this.executeConditionStep(ticket, config.condition);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute a message step
   */
  private async executeMessageStep(ticket: Ticket, config: WorkflowStepConfig["message"]): Promise<MessageStepResult> {
    const channelId = config?.channel ?? ticket.channelId;
    const channel = this.guild.channels.cache.get(channelId) as TextChannel;

    if (!channel) {
      throw new Error("Channel not found");
    }

    interface MessageOptions {
      content?: string;
      embeds?: EmbedBuilder[];
    }

    const messageOptions: MessageOptions = {};

    if (config?.content) {
      messageOptions.content = config.content;
    }

    if (config?.embed) {
      const embed = new EmbedBuilder()
        .setTitle(config.embed.title ?? "")
        .setDescription(config.embed.description ?? "")
        .setColor(config.embed.color ? parseInt(config.embed.color.replace("#", ""), 16) : 0x5865f2);

      if (config.embed.fields) {
        embed.addFields(config.embed.fields);
      }

      messageOptions.embeds = [embed];
    }

    const message = await channel.send(messageOptions);
    return { messageId: message.id, channelId: channel.id };
  }

  /**
   * Execute a role assignment step
   */
  private async executeRoleAssignStep(
    ticket: Ticket,
    config: WorkflowStepConfig["roleAssign"]
  ): Promise<RoleAssignStepResult> {
    const results: RoleAssignmentResult[] = [];

    let targetUserIds: string[] = [];

    switch (config?.targets) {
      case "creator":
        targetUserIds = [ticket.userId];
        break;
      case "assignee":
        if (ticket.assignedTo) {
          targetUserIds = [ticket.assignedTo];
        }
        break;
      case "specific":
        targetUserIds = config.userIds ?? [];
        break;
    }

    for (const userId of targetUserIds) {
      const member = this.guild.members.cache.get(userId);
      if (!member) continue;

      for (const roleId of config?.roleIds ?? []) {
        const role = this.guild.roles.cache.get(roleId);
        if (!role) continue;

        try {
          if (config?.action === "add") {
            await member.roles.add(role, `Workflow step: role assignment`);
          } else {
            await member.roles.remove(role, `Workflow step: role removal`);
          }

          results.push({
            userId,
            roleId,
            action: config?.action ?? "add",
            success: true,
          });
        } catch (error) {
          results.push({
            userId,
            roleId,
            action: config?.action ?? "add",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    return { results };
  }

  /**
   * Execute a status change step
   */
  private async executeStatusChangeStep(
    ticket: Ticket,
    config: WorkflowStepConfig["statusChange"]
  ): Promise<StatusChangeStepResult> {
    const newStatus = config?.newStatus ?? ticket.status;

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    return {
      oldStatus: ticket.status,
      newStatus,
      reason: config?.reason,
    };
  }

  /**
   * Execute an escalation step
   */
  private async executeEscalationStep(
    ticket: Ticket,
    config: WorkflowStepConfig["escalation"]
  ): Promise<EscalationStepResult> {
    const targetRoleId = config?.targetRoleId;
    if (!targetRoleId) {
      throw new Error("Target role ID is required for escalation");
    }

    const role = this.guild.roles.cache.get(targetRoleId);
    if (!role) {
      throw new Error("Target role not found");
    }

    // Send notification to role
    let notificationChannel: TextChannel | undefined;
    if (config.notificationChannel) {
      notificationChannel = this.guild.channels.cache.get(config.notificationChannel) as TextChannel;
    } else {
      notificationChannel = this.guild.channels.cache.get(ticket.channelId) as TextChannel;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (notificationChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xff9500)
        .setTitle("🚨 Ticket Escalated")
        .setDescription(`Ticket #${ticket.ticketNumber.toString()} has been escalated to ${role.name}`)
        .addFields(
          { name: "Ticket", value: `#${ticket.ticketNumber.toString()}`, inline: true },
          { name: "Category", value: ticket.category, inline: true },
          { name: "Creator", value: `<@${ticket.userId}>`, inline: true }
        )
        .setTimestamp();

      await notificationChannel.send({
        content: role.toString(),
        embeds: [embed],
      });
    }

    return {
      escalatedTo: targetRoleId,
      notificationSent: Boolean(notificationChannel),
    };
  }

  /**
   * Execute a notification step
   */
  private async executeNotificationStep(
    ticket: Ticket,
    config: WorkflowStepConfig["notification"]
  ): Promise<NotificationStepResult> {
    const results: NotificationResult[] = [];
    const message = config?.message ?? "";

    for (const target of config?.targets ?? []) {
      try {
        switch (target) {
          case "creator": {
            const user = this.guild.members.cache.get(ticket.userId);
            if (user) {
              await user.send(message);
              results.push({ target: "creator", success: true });
            }
            break;
          }
          case "assignee": {
            if (ticket.assignedTo) {
              const user = this.guild.members.cache.get(ticket.assignedTo);
              if (user) {
                await user.send(message);
                results.push({ target: "assignee", success: true });
              }
            }
            break;
          }
          case "role": {
            if (config?.roleIds) {
              for (const roleId of config.roleIds) {
                const role = this.guild.roles.cache.get(roleId);
                if (role) {
                  const channel = this.guild.channels.cache.get(ticket.channelId) as TextChannel;
                  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                  if (channel) {
                    await channel.send(`${role.toString()} ${message}`);
                    results.push({ target: "role", roleId, success: true });
                  }
                }
              }
            }
            break;
          }
          case "channel": {
            if (config?.channelIds) {
              for (const channelId of config.channelIds) {
                const channel = this.guild.channels.cache.get(channelId) as TextChannel;
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (channel) {
                  await channel.send(message);
                  results.push({ target: "channel", channelId, success: true });
                }
              }
            }
            break;
          }
        }
      } catch (error) {
        results.push({
          target,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { results };
  }

  /**
   * Execute a delay step
   */
  private async executeDelayStep(config: WorkflowStepConfig["delay"]): Promise<DelayStepResult> {
    const delayMinutes = config?.minutes ?? 0;
    await new Promise((resolve) => setTimeout(resolve, delayMinutes * 60 * 1000));
    return { delayMinutes };
  }

  /**
   * Execute a condition step
   */
  private async executeConditionStep(
    ticket: Ticket,
    config: WorkflowStepConfig["condition"]
  ): Promise<ConditionStepResult> {
    let conditionMet = false;
    const conditionType = config?.type ?? "status";
    const operator = config?.operator ?? "equals";
    const value = config?.value ?? "";

    switch (conditionType) {
      case "status":
        conditionMet = this.evaluateCondition(ticket.status, operator, value);
        break;
      case "time":
        {
          const now = new Date();
          const ticketAge = now.getTime() - new Date(ticket.createdAt).getTime();
          const thresholdMs = parseInt(value) * 60 * 1000; // value in minutes
          conditionMet = this.evaluateCondition(ticketAge, operator, thresholdMs);
        }
        break;
      case "field":
        if (config?.field) {
          const fieldValue = await prisma.ticketFieldValue.findFirst({
            where: {
              ticketId: ticket.id,
              fieldName: config.field,
            },
          });
          conditionMet = this.evaluateCondition(fieldValue?.value ?? "", operator, value);
        }
        break;
    }

    return { conditionMet, type: conditionType, operator, value };
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(actual: string | number, operator: string, expected: string | number): boolean {
    switch (operator) {
      case "equals":
        return actual === expected;
      case "not_equals":
        return actual !== expected;
      case "greater_than":
        return Number(actual) > Number(expected);
      case "less_than":
        return Number(actual) < Number(expected);
      case "contains":
        return String(actual).includes(String(expected));
      default:
        return false;
    }
  }

  /**
   * Get workflow execution status
   */
  async getExecutionStatus(ticketId: string, workflowId: string): Promise<TicketWorkflowExecutionWithSteps | null> {
    const execution = await prisma.ticketWorkflowExecution.findFirst({
      where: { ticketId, workflowId },
      include: {
        stepExecutions: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    return execution;
  }
}

export function createTicketWorkflowService(guild: Guild): TicketWorkflowService {
  return new TicketWorkflowService(guild);
}
