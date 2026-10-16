import { existsSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const bot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootModules = resolve(bot, '../node_modules');

const links = [
  {
    link: resolve(rootModules, 'discord.js'),
    target: resolve(bot, 'node_modules/discord.js'),
  },
  {
    link: resolve(rootModules, 'discord-voip/node_modules/discord-api-types'),
    target: resolve(bot, 'node_modules/discord-api-types'),
  },
];

for (const { link, target } of links) {
  if (!existsSync(target) || existsSync(link)) continue;
  symlinkSync(target, link, 'junction');
}
