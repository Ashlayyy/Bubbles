import type { Guild, User } from "discord.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";

interface TicketMessage {
  id: string;
  messageId: string;
  userId: string;
  content: string | null;
  attachments: string[];
  embeds: unknown[];
  isSystemMsg: boolean;
  createdAt: Date;
}

interface TicketData {
  id: string;
  ticketNumber: number;
  guildId: string;
  userId: string;
  channelId: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  createdAt: Date;
  closedAt: Date | null;
  closedReason: string | null;
  messages: TicketMessage[];
}

interface TranscriptOptions {
  format?: "html" | "txt" | "both";
  includeAttachments?: boolean;
  includeEmbeds?: boolean;
  theme?: "light" | "dark";
}

export class TicketTranscriptGenerator {
  private guild: Guild;

  constructor(guild: Guild) {
    this.guild = guild;
  }

  /**
   * Generate a transcript for a ticket
   */
  async generateTranscript(
    ticketId: string,
    options: TranscriptOptions = {}
  ): Promise<{ html?: AttachmentBuilder; txt?: AttachmentBuilder; embed: EmbedBuilder }> {
    const { format = "html", includeAttachments = true, includeEmbeds = true, theme = "light" } = options;

    try {
      // Get ticket data
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!ticket) {
        throw new Error("Ticket not found");
      }

      const ticketMessages = ticket.messages as TicketMessage[];

      // Get users mentioned in the transcript
      const userIds = [...new Set(ticketMessages.map((msg) => msg.userId))];
      const users = new Map<string, User>();

      for (const userId of userIds) {
        try {
          const user = await this.guild.client.users.fetch(userId);
          users.set(userId, user);
        } catch {
          // User not found, we'll use fallback
        }
      }

      const results: { html?: AttachmentBuilder; txt?: AttachmentBuilder; embed: EmbedBuilder } = {
        embed: this.createTranscriptEmbed(ticket, ticketMessages.length),
      };

      if (format === "html" || format === "both") {
        const htmlContent = this.generateHTMLTranscript(ticket, ticketMessages, users, {
          includeAttachments,
          includeEmbeds,
          theme,
        });

        results.html = new AttachmentBuilder(Buffer.from(htmlContent, "utf-8"), {
          name: `ticket-${ticket.ticketNumber.toString().padStart(4, "0")}-transcript.html`,
        });
      }

      if (format === "txt" || format === "both") {
        const txtContent = this.generateTextTranscript(ticket, ticketMessages, users, {
          includeAttachments,
        });

        results.txt = new AttachmentBuilder(Buffer.from(txtContent, "utf-8"), {
          name: `ticket-${ticket.ticketNumber.toString().padStart(4, "0")}-transcript.txt`,
        });
      }

      return results;
    } catch (error) {
      logger.error("Error generating ticket transcript:", error);
      throw error;
    }
  }

  /**
   * Generate HTML transcript with beautiful styling
   */
  private generateHTMLTranscript(
    ticket: TicketData,
    messages: TicketMessage[],
    users: Map<string, User>,
    options: { includeAttachments: boolean; includeEmbeds: boolean; theme: string }
  ): string {
    const { includeAttachments, includeEmbeds, theme } = options;

    const ticketCreator = users.get(ticket.userId);
    const createdAt = new Date(ticket.createdAt).toLocaleString();
    const closedAt = ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : "Still Open";

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket #${ticket.ticketNumber.toString().padStart(4, "0")} Transcript</title>
    <style>
        ${this.getHTMLStyles(theme)}
    </style>
</head>
<body>
    <div class="container">
        <header class="ticket-header">
            <div class="ticket-info">
                <h1>🎫 Ticket #${ticket.ticketNumber.toString().padStart(4, "0")}</h1>
                <div class="ticket-meta">
                    <div class="meta-item">
                        <span class="label">Title:</span>
                        <span class="value">${this.escapeHtml(ticket.title)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Category:</span>
                        <span class="value">${this.escapeHtml(ticket.category)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Creator:</span>
                        <span class="value">${ticketCreator ? this.escapeHtml(ticketCreator.tag) : "Unknown User"}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Created:</span>
                        <span class="value">${createdAt}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Closed:</span>
                        <span class="value">${closedAt}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Status:</span>
                        <span class="value status-${ticket.status.toLowerCase()}">${ticket.status}</span>
                    </div>
                </div>
            </div>
            <div class="server-info">
                <h3>${this.escapeHtml(this.guild.name)}</h3>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
        </header>

        <div class="messages-container">
            <h2>📝 Messages (${messages.length})</h2>
    `;

    // Add initial description if available
    if (ticket.description) {
      html += `
            <div class="message system-message">
                <div class="message-header">
                    <span class="author">📋 Ticket Description</span>
                    <span class="timestamp">${createdAt}</span>
                </div>
                <div class="message-content">
                    ${this.escapeHtml(ticket.description).replace(/\n/g, "<br>")}
                </div>
            </div>
      `;
    }

    // Add messages
    for (const message of messages) {
      const user = users.get(message.userId);
      const messageTime = new Date(message.createdAt).toLocaleString();

      html += `
            <div class="message ${message.isSystemMsg ? "system-message" : "user-message"}">
                <div class="message-header">
                    <div class="author-info">
                        <span class="author ${message.isSystemMsg ? "system" : "user"}">
                            ${message.isSystemMsg ? "🤖 System" : user ? this.escapeHtml(user.tag) : "Unknown User"}
                        </span>
                        ${user && !message.isSystemMsg ? `<span class="user-id">(${user.id})</span>` : ""}
                    </div>
                    <span class="timestamp">${messageTime}</span>
                </div>
                <div class="message-content">
                    ${message.content ? this.escapeHtml(message.content).replace(/\n/g, "<br>") : "<em>No content</em>"}
                </div>
      `;

      // Add attachments if included
      if (includeAttachments && message.attachments.length > 0) {
        html += `
                <div class="attachments">
                    <strong>📎 Attachments:</strong>
                    <ul>
        `;
        for (const attachment of message.attachments) {
          html += `<li><a href="${attachment}" target="_blank">${attachment}</a></li>`;
        }
        html += `
                    </ul>
                </div>
        `;
      }

      // Add embeds if included
      if (includeEmbeds && message.embeds.length > 0) {
        html += `
                <div class="embeds">
                    <strong>📝 Embeds:</strong>
                    <div class="embed-count">${message.embeds.length} embed(s)</div>
                </div>
        `;
      }

      html += "</div>";
    }

    html += `
        </div>
        
        <footer class="transcript-footer">
            <p>Generated by Bubbles Bot • ${new Date().toLocaleString()}</p>
            <p>Total Messages: ${messages.length} • Participants: ${users.size}</p>
        </footer>
    </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Generate plain text transcript
   */
  private generateTextTranscript(
    ticket: TicketData,
    messages: TicketMessage[],
    users: Map<string, User>,
    options: { includeAttachments: boolean }
  ): string {
    const { includeAttachments } = options;

    const ticketCreator = users.get(ticket.userId);
    const createdAt = new Date(ticket.createdAt).toLocaleString();
    const closedAt = ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : "Still Open";

    let transcript = `
=====================================
🎫 TICKET TRANSCRIPT
=====================================

Ticket #${ticket.ticketNumber.toString().padStart(4, "0")}
Title: ${ticket.title}
Category: ${ticket.category}
Creator: ${ticketCreator ? ticketCreator.tag : "Unknown User"}
Created: ${createdAt}
Closed: ${closedAt}
Status: ${ticket.status}
Server: ${this.guild.name}

=====================================
📝 MESSAGES (${messages.length} total)
=====================================

`;

    // Add initial description
    if (ticket.description) {
      transcript += `[${createdAt}] 📋 Ticket Description:\n${ticket.description}\n\n`;
    }

    // Add messages
    for (const message of messages) {
      const user = users.get(message.userId);
      const messageTime = new Date(message.createdAt).toLocaleString();
      const authorName = message.isSystemMsg ? "🤖 System" : user ? user.tag : "Unknown User";

      transcript += `[${messageTime}] ${authorName}:\n`;

      if (message.content) {
        transcript += `${message.content}\n`;
      }

      if (includeAttachments && message.attachments.length > 0) {
        transcript += `📎 Attachments: ${message.attachments.join(", ")}\n`;
      }

      if (message.embeds.length > 0) {
        transcript += `📝 Embeds: ${message.embeds.length} embed(s)\n`;
      }

      transcript += "\n";
    }

    transcript += `
=====================================
📊 SUMMARY
=====================================

Total Messages: ${messages.length}
Participants: ${users.size}
Generated: ${new Date().toLocaleString()}
Generated by: Bubbles Bot

=====================================
`;

    return transcript;
  }

  /**
   * Create transcript embed for Discord
   */
  private createTranscriptEmbed(ticket: TicketData, messageCount: number): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("📄 Ticket Transcript Generated")
      .setDescription(`Transcript for ticket #${ticket.ticketNumber.toString().padStart(4, "0")} has been generated.`)
      .addFields(
        { name: "🎫 Ticket", value: `#${ticket.ticketNumber.toString().padStart(4, "0")}`, inline: true },
        { name: "📝 Title", value: ticket.title, inline: true },
        { name: "📊 Messages", value: messageCount.toString(), inline: true },
        { name: "📅 Created", value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:F>`, inline: true },
        {
          name: "🔒 Closed",
          value: ticket.closedAt ? `<t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:F>` : "Still Open",
          inline: true,
        },
        { name: "📋 Category", value: ticket.category, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "Generated by Bubbles Bot" });
  }

  /**
   * Get CSS styles for HTML transcript
   */
  private getHTMLStyles(theme: string): string {
    const isDark = theme === "dark";

    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: ${isDark ? "#e4e6ea" : "#2c2f33"};
            background-color: ${isDark ? "#36393f" : "#ffffff"};
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .ticket-header {
            background: ${isDark ? "#2f3136" : "#f8f9fa"};
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 4px solid #7289da;
        }

        .ticket-header h1 {
            color: #7289da;
            margin-bottom: 15px;
        }

        .ticket-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 10px;
        }

        .meta-item {
            display: flex;
            gap: 8px;
        }

        .label {
            font-weight: bold;
            color: ${isDark ? "#b9bbbe" : "#4f545c"};
        }

        .value {
            color: ${isDark ? "#e4e6ea" : "#2c2f33"};
        }

        .status-open { color: #43b581; }
        .status-closed { color: #f04747; }
        .status-pending { color: #faa61a; }

        .server-info {
            text-align: right;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid ${isDark ? "#4f545c" : "#e3e5e8"};
        }

        .messages-container {
            background: ${isDark ? "#2f3136" : "#ffffff"};
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .messages-container h2 {
            color: #7289da;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #7289da;
        }

        .message {
            margin-bottom: 15px;
            padding: 15px;
            border-radius: 8px;
            border-left: 3px solid #7289da;
        }

        .user-message {
            background: ${isDark ? "#36393f" : "#f8f9fa"};
        }

        .system-message {
            background: ${isDark ? "#414339" : "#fff3cd"};
            border-left-color: #ffc107;
        }

        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .author-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .author {
            font-weight: bold;
        }

        .author.system {
            color: #ffc107;
        }

        .author.user {
            color: #7289da;
        }

        .user-id {
            font-size: 0.85em;
            color: ${isDark ? "#72767d" : "#747f8d"};
        }

        .timestamp {
            font-size: 0.85em;
            color: ${isDark ? "#72767d" : "#747f8d"};
        }

        .message-content {
            margin-top: 5px;
            word-wrap: break-word;
        }

        .attachments {
            margin-top: 10px;
            padding: 10px;
            background: ${isDark ? "#2f3136" : "#f1f3f4"};
            border-radius: 5px;
        }

        .attachments ul {
            margin-left: 20px;
            margin-top: 5px;
        }

        .attachments a {
            color: #7289da;
            text-decoration: none;
        }

        .attachments a:hover {
            text-decoration: underline;
        }

        .embeds {
            margin-top: 10px;
            padding: 10px;
            background: ${isDark ? "#2f3136" : "#f1f3f4"};
            border-radius: 5px;
        }

        .embed-count {
            font-size: 0.9em;
            color: ${isDark ? "#b9bbbe" : "#4f545c"};
            margin-top: 5px;
        }

        .transcript-footer {
            text-align: center;
            padding: 20px;
            color: ${isDark ? "#72767d" : "#747f8d"};
            font-size: 0.9em;
            border-top: 1px solid ${isDark ? "#4f545c" : "#e3e5e8"};
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .ticket-meta {
                grid-template-columns: 1fr;
            }
            
            .message-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
            }
        }
    `;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}

/**
 * Helper function to generate transcript for a ticket
 */
export async function generateTicketTranscript(
  guild: Guild,
  ticketId: string,
  options: TranscriptOptions = {}
): Promise<{ html?: AttachmentBuilder; txt?: AttachmentBuilder; embed: EmbedBuilder }> {
  const generator = new TicketTranscriptGenerator(guild);
  return await generator.generateTranscript(ticketId, options);
}
