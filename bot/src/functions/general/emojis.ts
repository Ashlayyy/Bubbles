import * as emojiConverter from "discord-emoji-converter";
import { Client } from "discord.js";

/**
 * Parses a raw emoji string into a more usable format.
 * It can handle literal emojis, custom emoji strings, and shortcodes.
 * @param emojiString - The raw emoji string from a message or user input.
 * @param client - The discord client, used to resolve custom emojis by name.
 * @returns An object with the emoji character, its database identifier, and whether it's animated.
 */
export function parseEmoji(
  emojiString: string,
  client: Client
): { name: string; identifier: string; animated: boolean } | null {
  if (!emojiString) return null;
  const emojiTrimmed = emojiString.trim();

  // Case 1: Custom emoji string, e.g., <:name:id> or <a:name:id>
  const customEmojiRegex = /<(a?):(.+?):(\d+)>/;
  const customMatch = customEmojiRegex.exec(emojiTrimmed);
  if (customMatch) {
    const animated = customMatch[1] === "a";
    const name = customMatch[2];
    const id = customMatch[3];
    return { name: `<${animated ? "a" : ""}:${name}:${id}>`, identifier: id, animated };
  }

  // Case 2: Standard emoji shortcode, e.g., :books:
  try {
    const standardEmoji = emojiConverter.getEmoji(emojiTrimmed);
    // The converter returns the emoji character itself if found.
    return { name: standardEmoji, identifier: standardEmoji, animated: false };
  } catch (error) {
    // Not a valid standard shortcode, ignore and proceed.
  }

  // Case 3: Custom emoji by name, e.g., mycoolemoji
  const customEmojiByName = client.emojis.cache.find((e) => e.name?.toLowerCase() === emojiTrimmed.toLowerCase());
  if (customEmojiByName) {
    return {
      name: customEmojiByName.toString(),
      identifier: customEmojiByName.id,
      animated: customEmojiByName.animated ?? false,
    };
  }

  // Case 4: Literal unicode emoji, e.g., 📚
  // For unicode, the emoji character itself is the name and identifier.
  // This also serves as a fallback for any string that isn't a valid emoji.
  return { name: emojiTrimmed, identifier: emojiTrimmed, animated: false };
}
