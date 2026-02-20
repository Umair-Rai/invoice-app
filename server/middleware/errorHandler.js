const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).send(
    '<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Something went wrong</h1></body></html>'
  );
};

module.exports = errorHandler;
