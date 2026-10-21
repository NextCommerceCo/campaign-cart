import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { build } from 'vite';
import { describe, readArgs, startDev } from './server';

const TUNNEL_URL = /https:\/\/[-a-z0-9]+\.trycloudflare\.com/;

export function tunnelUrl(log: string): string | undefined {
  return TUNNEL_URL.exec(log)?.[0];
}

if (import.meta.main) {
  const options = readArgs(process.argv);
  const token = randomBytes(9).toString('base64url');
  const { label, detail } = describe(options.api ?? 'mock');

  console.log('  Building the SDK…');
  await build({ logLevel: 'warn' });
  const { origin, close } = await startDev({ ...options, dist: true, share: true, token, quiet: true });

  console.log(`\n  Campaign SDK QA — ${label}: ${detail}`);
  if (label === 'FULL') console.log(`  ⚠ Orders placed through this link are real orders on campaign ${options.key}.`);
  console.log(`\n  On this machine:  ${origin}/?qa=${token}`);

  if (process.argv.includes('--no-tunnel')) {
    console.log('\n  No tunnel (--no-tunnel). Press Ctrl+C to stop.\n');
  } else {
    const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', origin], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    tunnel.on('error', () => {
      console.log('\n  cloudflared is not installed. Install it once:');
      console.log('  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
      console.log('  or run with --no-tunnel to test on this machine only.\n');
    });
    let shown = false;
    const watch = (chunk: Buffer) => {
      const url = !shown && tunnelUrl(chunk.toString());
      if (!url) return;
      shown = true;
      console.log(`  Share with QA:    ${url}/?qa=${token}`);
      console.log('\n  The link works only while this command runs. Press Ctrl+C to stop.\n');
    };
    tunnel.stdout.on('data', watch);
    tunnel.stderr.on('data', watch);
    const stop = () => {
      tunnel.kill();
      void close().then(() => process.exit(0));
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }
}
