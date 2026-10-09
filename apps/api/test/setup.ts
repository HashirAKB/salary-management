// D-051: API tests never touch the network.
globalThis.fetch = async () => {
  throw new Error('Network is disabled in tests');
};
