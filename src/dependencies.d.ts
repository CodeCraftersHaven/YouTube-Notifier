import type { Cooldowns, Prisma } from '#adapters';
import { YTClient } from '#bot';
import type { Sparky } from '#sern';
import type { CoreDependencies } from '@sern/handler';
import type { Publisher } from '@sern/publisher';

declare global {
  interface Dependencies extends CoreDependencies {
    '@sern/client': YTClient;
    publisher: Publisher;
    '@sern/logger': Sparky;
    prisma: Prisma;
    cooldowns: Cooldowns;
  }
}

export {};
