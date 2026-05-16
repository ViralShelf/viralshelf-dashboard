// Run as Administrator: node service/uninstall.js
import { Service } from 'node-windows';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name:   'ViralShelf Dashboard',
  script: path.join(__dirname, '..', 'server.js'),
});

svc.on('uninstall', () => console.log('Service removed.'));
svc.on('error',     (e) => console.error('Error:', e));
svc.uninstall();
