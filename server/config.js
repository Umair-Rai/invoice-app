const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'invoice.db');
const port = process.env.PORT || 3000;

module.exports = {
  dbPath,
  port,
};
