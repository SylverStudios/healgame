/**
 * Ask the OS for a free ephemeral TCP port. smoke/journey previously pinned
 * 4173/4174 with --strictPort, so parallel verify runs — and orphaned preview
 * servers left by crashed runs — failed with "Port in use". Dynamic ports make
 * the gate safe to run concurrently from multiple sessions/worktrees.
 */
import net from 'node:net';

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}
