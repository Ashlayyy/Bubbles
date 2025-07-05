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

    const eventsDir = this.devMode ? "./src/events" : "./build/bot/src/events";
    const eventEmitterTypes: EventEmitterType[] = [];

    await forNestedDirsFiles(eventsDir, async (eventFilePath, dir, file) => {
      // Validate directory
      const eventEmitterType = eventEmitterTypeFromDir(dir);
      if (!eventEmitterTypes.includes(eventEmitterType)) {
        logger.debug(`\t${camel2Display(EventEmitterType[eventEmitterType])}`);
        eventEmitterTypes.push(eventEmitterType);
      }

      // Load module
      const event = await importDefaultESM(eventFilePath, isBaseEvent);
      const eventFileName = file.replace(/\.[^/.]+$/, "");

      // Bind event to its corresponding event emitter
      if (eventEmitterType === EventEmitterType.Client && event.isClient()) {
        event.bindToEventEmitter(client);
      } else if (eventEmitterType === EventEmitterType.Prisma && event.isPrisma()) {
        event.bindToEventEmitter();
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
    });

    logger.debug("Successfully loaded events");
  }
}
