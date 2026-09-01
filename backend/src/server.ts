import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { disconnectPrisma, prisma } from './lib/prisma';

async function bootstrap() {
  // Falhar cedo se o banco não estiver acessível.
  await prisma.$queryRaw`SELECT 1`;

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, app: env.APP_URL },
      `Emptra API no ar em http://localhost:${env.PORT}`,
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'encerrando...');
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
    // Não deixa o processo pendurado se alguma conexão travar.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'falha ao iniciar a API');
  process.exit(1);
});
