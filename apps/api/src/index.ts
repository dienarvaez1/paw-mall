import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { AppEnv } from './env';
import { errorResponse } from './lib/http';
import { healthRoute } from './routes/health';
import { v1Route } from './routes/v1';

const app = new Hono<AppEnv>();

// The app on a phone calls the API directly; Expo web in a browser needs CORS.
app.use('*', cors());
app.route('/health', healthRoute);
app.route('/v1', v1Route);

app.notFound((c) => errorResponse(c, 404, 'NOT_FOUND'));
app.onError((error, c) => {
  console.error(error);
  return errorResponse(c, 500, 'INTERNAL_ERROR');
});

export default app;
