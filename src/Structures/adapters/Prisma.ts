import { PrismaClient } from '@prisma/client';
import { env, Sparky } from '#sern';
import { Init } from '@sern/handler';

export class Prisma extends PrismaClient implements Init {
  private url = env.MONGODB_URI;
  connectionStatus = 'disconnected';
  databaseName = '';
  constructor(private logger: Sparky) {
    super();
  }

  async init() {
    this.logger.info('[PRISMA]- Initializing Prisma Client...');
    await this.connect();
  }

  private async connect() {
    await this.$connect()
      .then(() => {
        this.logger.success('[PRISMA]- Connected to Database!');
        this.connectionStatus = 'connected';
        this.databaseName = this.url.split('/').pop()!.split('?')[0]!;
      })
      .catch(err => {
        this.logger.error('[PRISMA]- Failed to connect to Database!');
        this.connectionStatus = 'error';
      });
  }
}
