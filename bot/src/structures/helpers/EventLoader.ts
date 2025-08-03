import { PathResolver } from "@shared/utils/pathResolver";
import { existsSync } from "fs";
import { forNestedDirsFiles, importDefaultESM } from "../../functions/general/fs.js";
import { camel2Display } from "../../functions/general/strings.js";
import logger from "../../logger.js";
import type Client from "../Client.js";
import { EventEmitterType, eventEmitterTypeFromDir, isBaseEvent } from "../Event.js";

export class EventLoader {
  private devMode: boolean;

  constructor(devMode: boolean) {
    this.devMode = devMode;
  }

  async loadEvents(client: Client): Promise<void> {
    logger.info("Loading events");
    logger.debug(`🎭 EventLoader: Dev mode: ${this.devMode}`);

    // Use centralized path resolver for reliable path resolution
    const paths = PathResolver.getCommonPaths(import.meta.url);
    const eventsDir = PathResolver.resolveForEnvironment({
      devPath: "src/events",
      prodPath: "bot/build/src/events",
      isDevMode: this.devMode,
      baseDir: paths.projectRoot,
    });

    logger.debug(`🎭 EventLoader: Events directory resolved to: ${eventsDir}`);
    logger.debug(`🎭 EventLoader: Directory exists: ${existsSync(eventsDir)}`);

    const eventEmitterTypes: EventEmitterType[] = [];

    await forNestedDirsFiles(eventsDir, async (eventFilePath, dir, file) => {
      logger.debug(`🎭 EventLoader: Processing event file: ${eventFilePath}`);
      logger.debug(`🎭 EventLoader: Event directory: ${dir}, File: ${file}`);
      // Validate directory
      const eventEmitterType = eventEmitterTypeFromDir(dir);
      if (!eventEmitterTypes.includes(eventEmitterType)) {
        logger.debug(`\t${camel2Display(EventEmitterType[eventEmitterType])}`);
        eventEmitterTypes.push(eventEmitterType);
      }

      try {
        // Load module
        const event = await importDefaultESM(eventFilePath, isBaseEvent);
        const eventFileName = file.replace(/\.[^/.]+$/, "");
        logger.debug(`🎭 EventLoader: Successfully loaded event: ${eventFileName}`);

        // Bind event to its corresponding event emitter
        if (eventEmitterType === EventEmitterType.Client && event.isClient()) {
          event.bindToEventEmitter(client);
          logger.debug(`🎭 EventLoader: Bound ${eventFileName} to Discord client`);
        } else if (eventEmitterType === EventEmitterType.Prisma && event.isPrisma()) {
          event.bindToEventEmitter();
          logger.debug(`🎭 EventLoader: Bound ${eventFileName} to Prisma client`);
        } else {
          throw new Error(
            `Event file does not match expected emitter type ("${EventEmitterType[eventEmitterType]}"): "${eventFileName}"` +
              `. ` +
              `This file probably belongs in a different directory (i.e. ...events/client instead of ...events/prisma)`
          );
        }

        // Log now to signify loading this file is complete
        if (event.event !== eventFileName) {
          logger.debug(`\t\t"${eventFileName}" -> ${event.event}`);
        } else {
          logger.debug(`\t\t${eventFileName}`);
        }
      } catch (error) {
        logger.error(`🎭 EventLoader: Failed to load event ${file}:`, error);
        throw error; // Re-throw to maintain existing error handling behavior
      }
    });

    logger.debug("Successfully loaded events");
    logger.info(
      `🎭 EventLoader: Loaded events for ${String(eventEmitterTypes.length)} emitter types: ${eventEmitterTypes.map((t) => EventEmitterType[t]).join(", ")}`
    );
  }
}
