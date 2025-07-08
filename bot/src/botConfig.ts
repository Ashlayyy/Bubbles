import { ActivityType } from "discord.js";
import { constants, copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import lodash from "lodash";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import { isDevEnvironment } from "./functions/general/environment.js";

// eslint-disable-next-line @typescript-eslint/unbound-method
const { capitalize } = lodash;

// Zod schemas
const ActivityOptionSchema = z
  .object({
    name: z.string(),
    type: z.enum(["playing", "streaming", "listening", "watching", "competing"]),
    url: z
      .string()
      .regex(/^https:\/\/(www\.)?(twitch\.tv|youtube\.com)\/.+$/, "must be a valid youtube or twitch url")
      .optional(),
  })
  .refine(
    (data) => {
      // URL should only be present when type is streaming
      if (data.type !== "streaming" && data.url !== undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'URL should only be present when type is "streaming"',
      path: ["url"],
    }
  );

const WelcomeGoodbyeConfigSchema = z.object({
  messages: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i, "must be a valid hex color"),
    })
  ),
});

const BotConfigSchema = z.object({
  name: z.string(),
  activities: z.array(ActivityOptionSchema).min(1, "should have at least one activity"),
  welcome: WelcomeGoodbyeConfigSchema.optional(),
  goodbye: WelcomeGoodbyeConfigSchema.optional(),
});

// TypeScript types inferred from Zod schemas
export interface ActivityOption {
  name: string;
  type: Exclude<ActivityType, ActivityType.Custom>;
  url?: string;
}

export type WelcomeGoodbyeConfig = z.infer<typeof WelcomeGoodbyeConfigSchema>;
export interface BotConfig {
  name: string;
  activities: ActivityOption[];
  welcome?: WelcomeGoodbyeConfig;
  goodbye?: WelcomeGoodbyeConfig;
}

let config: BotConfig | undefined;

/** Load config from filesystem or generate it from defaults.
 *
 * Can NOT use logger inside this function as the logger requires the config file!
 */
export function getConfigFile(): BotConfig {
  if (config === undefined) {
    const DEFAULT_CONFIG_FILE_NAME = "config.default.yaml";

    const isDev = isDevEnvironment();
    const configFileName = isDev ? "config.dev.yaml" : "config.yaml";

    if (!existsSync(configFileName)) {
      console.info(`Generating "${configFileName}"`);

      if (isDev) {
        // Edit and then copy - but keep raw data to preserve string types
        const fileContent = readFileSync(DEFAULT_CONFIG_FILE_NAME, "utf-8");
        const rawData = parseYaml(fileContent) as Record<string, unknown>;

        // Only modify the name, keep everything else as-is
        rawData.name = (rawData.name as string) + "-dev";

        writeFileSync(configFileName, stringifyYaml(rawData), {
          encoding: "utf-8",
          flag: "wx", // error if already exists
        });
      } else {
        // Simply copy

        copyFileSync(DEFAULT_CONFIG_FILE_NAME, configFileName, constants.COPYFILE_EXCL); // error if already exists
      }

      console.info(`Successfully generated "${configFileName}"\n`);
    }
    config = parseFile(configFileName);
  }

  return config;
}

function parseFile(fileName: string): BotConfig {
  const fileContent = readFileSync(fileName, "utf-8");

  let rawData: unknown;
  if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
    rawData = parseYaml(fileContent);
  } else {
    // Fallback to JSON for backward compatibility
    rawData = JSON.parse(fileContent);
  }

  try {
    const validatedData = BotConfigSchema.parse(rawData);
    return fromValidatedData(validatedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      let errorMsg = "Invalid config file:";
      error.errors.forEach(({ path, message }) => {
        errorMsg += `\n\t${path.join(".")} ${message}`;
      });
      throw new Error(errorMsg);
    }
    throw error;
  }
}

function fromValidatedData(data: z.infer<typeof BotConfigSchema>): BotConfig {
  const activities: ActivityOption[] = data.activities.map((a) => {
    return {
      name: a.name,
      type: ActivityType[capitalize(a.type) as keyof typeof ActivityType] as Exclude<ActivityType, ActivityType.Custom>,
      url: a.url,
    };
  });

  return {
    name: data.name,
    activities,
    welcome: data.welcome,
    goodbye: data.goodbye,
  };
}
