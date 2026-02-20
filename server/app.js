const express = require('express');
const path = require('path');
const pagesRoutes = require('./routes/pages.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const exportRoutes = require('./routes/export.routes');
const backupRoutes = require('./routes/backup.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Share current path with all views for nav highlighting
app.use((req, res, next) => {
	res.locals.currentPath = req.path;
	next();
});

app.use('/backup', backupRoutes);
app.use('/exports', exportRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/', pagesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
