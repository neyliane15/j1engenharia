import pino from 'pino';
import { env, isProd } from '../config/env';

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  base: { service: 'emptra-api', env: env.NODE_ENV },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.passwordHash', '*.password'],
    remove: true,
  },
  transport: isProd
    ? undefined
    : { target: 'pino/file', options: { destination: 1 } },
});
