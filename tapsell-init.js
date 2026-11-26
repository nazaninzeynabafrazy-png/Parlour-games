/* Tapsell ads for the Android app ONLY. The website never loads this file.
   The build adds it to the app only when you saved TAPSELL_APP_KEY in GitHub.
   Settings come from tapsell-config.js (written by the build):
     window.TAPSELL_CFG = { appKey, bannerZone, interstitialZone, everyNthGame }
   Leave a zone empty and that kind of ad is simply off. */
(function () {
  var C = window.TAPSELL_CFG || {};
  if (!C.appKey) return;
  var tries = 0, started = false, adId = null, opens = 0, every = parseInt(C.everyNthGame, 10) || 3;

  function wait() {
    if (window.tapsell && typeof window.tapsell.initialize === 'function') return start();
    if (++tries < 40) setTimeout(wait, 750);
  }
  function start() {
    if (started) return; started = true;
    try {
      window.tapsell.initialize(C.appKey);
      if (C.bannerZone) {
        window.tapsell.requestBannerAd(C.bannerZone, window.tapsell_banner_320x50, window.tapsell_bottom, window.tapsell_center);
      }
      if (C.interstitialZone) loadAd();
      hookGames();
    } catch (e) { /* ads must never break the games */ }
  }
  function loadAd() {
    try {
      adId = null;
      window.tapsell.requestAd(C.interstitialZone, true, function (r) {
        if (r && r.action === 'onAdAvailable') adId = r.adId;
        else if (r && r.action === 'onExpiring') loadAd();
      });
    } catch (e) {}
  }
  function showAd() {
    if (!adId) return;
    var id = adId; adId = null;
    try {
      window.tapsell.showAd(id, false, false, window.tapsell_rotation_unlocked, false, function (r) {
        if (r && r.action === 'onClosed') setTimeout(loadAd, 500);
      });
    } catch (e) { loadAd(); }
  }
  // Show one full-screen ad every N-th time a game is opened (never while a game is running).
  function hookGames() {
    if (!C.interstitialZone || typeof window.openGame !== 'function') return;
    var orig = window.openGame;
    window.openGame = function () {
      opens++;
      if (opens % every === 0 && adId) { showAd(); }
      return orig.apply(this, arguments);
    };
  }
  wait();
})();
