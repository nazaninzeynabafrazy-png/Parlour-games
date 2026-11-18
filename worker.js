// The Parlour site: serves the game files, and forwards the online services
// (/clan/*, /ping, /count, /ref, /refs, /version) to the parlour-counter worker,
// so the game talks to its own address and the browser has nothing to block.
export default {
  async fetch(request, env) {
    return env.COUNTER.fetch(request);
  }
};
