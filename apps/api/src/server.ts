import { loadConfig } from './config';
import { buildApp } from './app';

const cfg = loadConfig();
const { app, deps } = await buildApp(cfg);

const health = await deps.anchor.backend.health();
app.log.info(
  { anchor: deps.anchor.backend.info, health },
  deps.anchor.backend.info.backend === 'local'
    ? 'Anchoring to the LOCAL development ledger. Run `pnpm chain` + `pnpm deploy:local` for on-chain anchoring.'
    : `Anchoring to ${deps.anchor.backend.info.networkName} (contract ${deps.anchor.backend.info.contract})`,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: cfg.host, port: cfg.port });
