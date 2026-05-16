// Run as Administrator: node service/install.js
import { Service } from 'node-windows';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name:        'ViralShelf Dashboard',
  description: 'ViralShelf local dashboard server — runs at http://127.0.0.1:4317',
  script:      path.join(__dirname, '..', 'server.js'),
  nodeOptions: ['--max_old_space_size=512'],
  env: [{ name: 'NODE_ENV', value: 'production' }],
  wait: 2,   // seconds between restart attempts
  grow: 0.5, // exponential backoff factor
});

svc.on('install',   () => { svc.start(); console.log('Service installed and started.'); });
svc.on('error',     (e) => console.error('Service error:', e));
svc.install();
