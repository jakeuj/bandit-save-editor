'use strict';
// Chromium refuses these ports with net::ERR_UNSAFE_PORT (kRestrictedPorts in net/base/port_util.cc, the Fetch "bad port" list).
const unsafePorts = new Set([1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103,
  104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531,
  532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000,
  6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

function configuredPort() {
  const port = Number(process.env.BANDIT_BROWSER_PORT || 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid BANDIT_BROWSER_PORT');
  return port;
}

// Listen on 127.0.0.1 and return the bound port. A fixed port is used as given and fails when it is busy; a random one (0)
// is drawn again whenever the OS hands out a port Chromium blocks, otherwise that one test fails with ERR_UNSAFE_PORT.
async function listenLoopback(server, port = configuredPort(), attempts = 20) {
  for (let attempt = 1; ; attempt++) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    const bound = server.address().port;
    if (port !== 0 || !unsafePorts.has(bound)) return bound;
    await new Promise(resolve => server.close(resolve));
    if (attempt >= attempts) throw Error(`OS kept assigning Chromium-blocked ports; last ${bound}`);
  }
}
module.exports = {unsafePorts, configuredPort, listenLoopback};
