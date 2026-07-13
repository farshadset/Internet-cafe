const app = require('../server.js');

module.exports = async (req, res) => {
  if (app.dbReady) await app.dbReady;
  return app(req, res);
};
