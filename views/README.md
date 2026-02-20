# Invoice App

Local-first invoice application packaged as an Electron desktop app.

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts Electron in development mode. The app window opens and loads the local Express server.

## Database

The database file is stored at `data/invoice.db`.

To initialize the database manually (creates schema and seeds settings):

```bash
npm run init-db
```

The app will auto-initialize the database on first launch if it does not exist.

## Optional: Start Server Only

To run the Express server without Electron (e.g. for testing):

```bash
npm run start-server
```

Then open http://127.0.0.1:3000 in a browser.

## Build

To create a distributable executable:

```bash
npm run pack
```

Output is in the `dist/` folder. Full installer setup (NSIS for Windows) can be configured in `package.json` build section.
