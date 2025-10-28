import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.json({ name: 'Omar Mohammad' }));

export default app;
