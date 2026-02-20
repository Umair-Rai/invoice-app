const { port } = require('./config');
// Ensure DB schema is created and migrations run before app starts
const { initDb } = require('./db/init');
initDb();

const app = require('./app');

async function startServer(options = {}) {
  const serverPort = options.port || port;

  return new Promise((resolve, reject) => {
    const server = app.listen(serverPort, '127.0.0.1', () => {
      resolve({ server, port: serverPort });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${serverPort} is already in use. Set PORT env to use a different port.`);
      }
      reject(err);
    });
  });
}

module.exports = { startServer };
