/* MAFIA WORLD - Character Motion Controller (supplied by the owner; ADAPT notes mark the only changes) */

(function () {
  "use strict";

  const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

  function getPlayer(playerId) {
    return document.querySelector(
      `[data-player-id="${CSS.escape(String(playerId))}"]`
    );
  }

  function setState(element, state) {
    if (!element) return;

    element.classList.remove(
      "sleeping",
      "waking",
      "awake",
      "acting",
      "returning"
    );

    element.classList.add(state);
    element.dataset.motionState = state;
  }

  const MafiaMotion = {

    // Everyone goes to sleep
    sleepAll() {
      document.querySelectorAll(".mafia-player")
        .forEach(player => { if (!player.classList.contains("dead")) setState(player, "sleeping"); }); /* ADAPT: eliminated players keep their "dead" look */

      const scene = document.querySelector(".mafia-scene");
      if (scene) { scene.classList.remove("day", "dawn"); scene.classList.add("night"); } /* ADAPT: also works when the scene was in "dawn" */
    },

    // One player wakes up
    async wakePlayer(playerId) {
      const player = getPlayer(playerId);
      if (!player) return;

      setState(player, "waking");
      await sleep(1800);
      setState(player, "awake");
    },

    // Player looks around during their turn
    startAction(playerId) {
      const player = getPlayer(playerId);
      if (!player) return;

      setState(player, "acting");
    },

    // Player returns to sleep
    async returnToSleep(playerId) {
      const player = getPlayer(playerId);
      if (!player) return;

      setState(player, "returning");
      await sleep(1700);
      setState(player, "sleeping");
    },

    // Sunrise transition
    async sunrise() {
      const scene = document.querySelector(".mafia-scene");
      if (!scene) return;

      scene.classList.remove("night");
      scene.classList.add("dawn");

      await sleep(4000);

      scene.classList.remove("dawn");
      scene.classList.add("day");

      const players = [
        ...document.querySelectorAll(".mafia-player:not(.dead)") /* ADAPT: skip eliminated players */
      ];

      for (const player of players) {
        setState(player, "waking");
      }

      await sleep(1800);

      players.forEach(player => setState(player, "awake"));
    }
  };

  window.MafiaMotion = MafiaMotion;

})();
