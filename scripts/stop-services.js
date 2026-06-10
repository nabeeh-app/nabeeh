#!/usr/bin/env node
const { execSync } = require('child_process');

function killByPort(port) {
  try {
    const pids = execSync(`lsof -t -i :${port}`, { encoding: 'utf-8' }).trim();
    if (pids) {
      pids.split('\n').forEach(pid => {
        try { process.kill(Number(pid), 'SIGTERM'); } catch {}
      });
      console.log(`Killed process on port ${port}`);
    }
  } catch {
    console.log(`No process on port ${port}`);
  }
}

killByPort(5000);
killByPort(3000);
