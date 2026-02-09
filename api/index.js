const { app, readyPromise } = require('../server/index');

module.exports = async (req, res) => {
  await readyPromise;
  app(req, res);
};
