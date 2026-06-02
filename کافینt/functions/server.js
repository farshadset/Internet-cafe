const express = require('express');
const server = express();

server.use(express.static('.'));
server.use(express.json({ limit: '50mb' }));
server.use(express.urlencoded({ extended: true }));

server.post('/api/register', require('./server.js'));
module.exports.handler = server;
