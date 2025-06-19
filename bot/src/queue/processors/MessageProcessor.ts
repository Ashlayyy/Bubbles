import type { SendMessageJob } from "@shared/types/queue";
import type {
  EmbedAuthorOptions,
  EmbedData,
  EmbedField,
  EmbedFooterOptions,
  MessageCreateOptions,
  TextChannel,
} from "discord.js";
import { EmbedBuilder } from "discord.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

interface MessagePayload extends MessageCreateOptions {
  content?: string;
  embeds?: EmbedBuilder[];
}

export class MessageProcessor extends BaseProcessor<SendMessageJob> {
  constructor(client: Client) {
    super(client, "MessageProcessor");
  }

  getJobTypes(): string[] {
    return ["SEND_MESSAGE"];
  }

  async processJob(job: SendMessageJob): Promise<ProcessorResult> {
    const { channelId, content, embeds } = job;

    if (!channelId) {
      return {
        success: false,
        error: "Channel ID is required for sending messages",
        timestamp: Date.now(),
      };
    }

    if (!content && (!embeds || embeds.length === 0)) {
      return {
        success: false,
        error: "Message content or embeds are required",
        timestamp: Date.now(),
      };
    }

    try {
      const channel = await this.fetchChannel(channelId);

      if (!channel?.isTextBased()) {
        return {
          success: false,
          error: "Channel is not a text channel",
          timestamp: Date.now(),
        };
      }

      // Build message payload
      const messagePayload: MessagePayload = {};

      if (content) {
        messagePayload.content = content;
      }

      if (embeds && embeds.length > 0) {
        messagePayload.embeds = embeds.map((embedData: unknown) => {
          if (embedData instanceof EmbedBuilder) {
            return embedData;
          }

          // Convert plain objects to EmbedBuilder
          const embed = new EmbedBuilder();
          const data = embedData as Partial<
            EmbedData & {
              thumbnail?: { url: string };
              image?: { url: string };
              fields?: EmbedField[];
            }
          >;

          if (data.title) embed.setTitle(data.title);
          if (data.description) embed.setDescription(data.description);
          if (data.color) embed.setColor(data.color);
          if (data.url) embed.setURL(data.url);
          if (data.timestamp)
            embed.setTimestamp(typeof data.timestamp === "string" ? new Date(data.timestamp) : data.timestamp);
          if (data.footer) embed.setFooter(data.footer as EmbedFooterOptions);
          if (data.author) embed.setAuthor(data.author as EmbedAuthorOptions);
          if (data.thumbnail?.url) embed.setThumbnail(data.thumbnail.url);
          if (data.image?.url) embed.setImage(data.image.url);
          if (data.fields) {
            // Validate fields before adding them
            const validFields = data.fields.filter(
              (field): field is EmbedField =>
                typeof field === "object" && "name" in field && "value" in field && "inline" in field
            );
            if (validFields.length > 0) {
              embed.addFields(...validFields);
            }
          }

          return embed;
        });
      }

      const sentMessage = await (channel as TextChannel).send(messagePayload);

      return {
        success: true,
        data: {
          messageId: sentMessage.id,
          channelId: sentMessage.channelId,
          guildId: sentMessage.guildId,
          timestamp: sentMessage.createdTimestamp,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  protected getEventPrefix(): string {
    return "MESSAGE";
  }

  protected getAdditionalEventData(job: SendMessageJob): Record<string, unknown> {
    return {
      ...super.getAdditionalEventData(job),
      channelId: job.channelId,
      hasContent: !!job.content,
      embedCount: job.embeds?.length ?? 0,
    };
  }
}
