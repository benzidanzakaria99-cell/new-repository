# MAFIA WORLD - character motion system (LOCAL ONLY, nothing deployed or pushed)

## What changed
- source/motion.css, source/motion.js : your CSS and JS, unchanged except these marked edits
  * sleepAll(): skips eliminated ("dead") players; switches the scene class even when it was in "dawn"
  * sunrise(): skips eliminated players
  * motion.css: +3 layout lines (container, image fit, dead look)
- source/stage.js : binds characters to REAL players
  * one `.mafia-player[data-player-id="<real player id>"]` per seated player, built from the server state
  * the player's chosen avatar (0-6) selects the character; every avatar in the UI now shows the new faces
  * night wake-up is decided ONLY on the device that owns the action (own role, plus Mafia teammates that
    device already knows). Nothing is sent over the network and the server protocol did not change.
  * victim choice still goes through the existing server logic (netSend act -> Room.doAct)
  * sunrise() is called together with the existing sky/sun/moon transition; sleepAll() at dusk
- source/assets.js : +7 character cutouts (ch0-6) and +7 face thumbnails (cf0-6), from your sheet's own alpha channel
- characters/ : the 7 full-resolution transparent files cut from the sheet
- server (worker.js): NOT changed. deploy files in outputs/accounts are still the previous version.

## Re-run the local test (needs Node 22 + Playwright)
1. node local-test/server.mjs     (starts http://127.0.0.1:8799, real Room logic over real WebSockets)
2. python3 local-test/e2e.py killer   |   python3 local-test/e2e.py mafia
