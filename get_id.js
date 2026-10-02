const os = require('os');
const crypto = require('crypto');

function getMachineId() {
  try {
    const cpus = os.cpus();
    const raw = `${cpus[0]?.model || 'cpu'}|${os.hostname()}|${os.platform()}|${os.arch()}|${os.totalmem()}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
    return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
  } catch (e) {
    return 'UNKN-0000-0000-0000';
  }
}

console.log(getMachineId());
