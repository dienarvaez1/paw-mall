import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { AppEnv } from './env';
import { errorResponse } from './lib/http';
import { writeRateLimit } from './middleware/rate-limit';
import { healthRoute } from './routes/health';
import { v1Route } from './routes/v1';

const app = new Hono<AppEnv>();

// The app on a phone calls the API directly and sends no Origin; only Expo web in a browser needs
// CORS, and only the origins in CORS_ORIGINS get it.
app.use('*', (c, next) =>
  cors({ origin: allowedOrigins(c.env.CORS_ORIGINS), allowMethods: ['GET', 'POST'] })(c, next),
);
app.use('/v1/*', writeRateLimit);
app.route('/health', healthRoute);
app.route('/v1', v1Route);

app.notFound((c) => errorResponse(c, 404, 'NOT_FOUND'));
app.onError((error, c) => {
  console.error(error);
  return errorResponse(c, 500, 'INTERNAL_ERROR');
});

function allowedOrigins(list: string | undefined): string[] {
  return (list ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export default app;
