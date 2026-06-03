const server = require('../server.js');

module.exports = async (req, res) => {
  await server(req, res);
};
