import { Sern, makeDependencies } from '@sern/handler';
import { Publisher } from '@sern/publisher';
import { YTClient } from '#bot';
import { Sparky } from '#sern';
import { Cooldowns, Prisma } from '#adapters';

const logger = new Sparky('debug', 'highlight');
const prisma = new Prisma(logger);
const cooldown = new Cooldowns(prisma);
const client = new YTClient(cooldown);

await makeDependencies(({ add, swap }) => {
  swap('@sern/logger', logger);
  add('prisma', prisma);
  add('cooldowns', cooldown);
  add('@sern/client', client);
  add('publisher', deps => new Publisher(deps['@sern/modules'], deps['@sern/emitter'], deps['@sern/logger']));
});

Sern.init({
  commands: ['./dist/commands', './dist/components'],
  events: ['./dist/events']
});

await client.login();
