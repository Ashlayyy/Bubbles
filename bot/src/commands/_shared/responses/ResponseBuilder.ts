import { EmbedBuilder } from "discord.js";
import type { CommandResponse } from "../../_core/types.js";

export class ResponseBuilder {
  private response: CommandResponse = {};

  /**
   * Set the content of the response
   */
  content(content: string): this {
    this.response.content = content;
    return this;
  }

  /**
   * Add an embed to the response
   */
  embed(embed: EmbedBuilder): this {
    this.response.embeds ??= [];
    this.response.embeds.push(embed);
    return this;
  }

  /**
   * Create a success embed with green color
   */
  success(title: string, description?: string): this {
    const embed = new EmbedBuilder().setTitle(`✅ ${title}`).setColor(0x00ff00);

    if (description) {
      embed.setDescription(description);
    }

    return this.embed(embed);
  }

  /**
   * Create an error embed with red color
   */
  error(title: string, description?: string): this {
    const embed = new EmbedBuilder().setTitle(`❌ ${title}`).setColor(0xff0000);

    if (description) {
      embed.setDescription(description);
    }

    return this.embed(embed);
  }

  /**
   * Create a warning embed with yellow color
   */
  warning(title: string, description?: string): this {
    const embed = new EmbedBuilder().setTitle(`⚠️ ${title}`).setColor(0xffff00);

    if (description) {
      embed.setDescription(description);
    }

    return this.embed(embed);
  }

  /**
   * Create an info embed with blue color
   */
  info(title: string, description?: string): this {
    const embed = new EmbedBuilder().setTitle(`ℹ️ ${title}`).setColor(0x0099ff);

    if (description) {
      embed.setDescription(description);
    }

    return this.embed(embed);
  }

  /**
   * Set the response as ephemeral
   */
  ephemeral(ephemeral = true): this {
    this.response.ephemeral = ephemeral;
    return this;
  }

  /**
   * Add components to the response
   */
  components(components: any[]): this {
    this.response.components = components;
    return this;
  }

  /**
   * Add files to the response
   */
  files(files: any[]): this {
    this.response.files = files;
    return this;
  }

  /**
   * Build and return the final response
   */
  build(): CommandResponse {
    return { ...this.response };
  }
}
