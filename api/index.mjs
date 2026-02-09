import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { app, readyPromise } = require('../server/index');

export default async (req, res) => {
  await readyPromise;
  app(req, res);
};
