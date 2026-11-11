// Straw Hat Strike's link to the bounty board: fetches the top ten for the title and the
// poster, gets each run its ticket, and posts the name typed on a poster that made the board.
// The name is typed through the room's hidden text box (scene/textInput), so a phone raises
// its keyboard and a desk keyboard just types.
import { getBoard, startRun, postScore } from "@/shared/services/strikeApi";
import { NAME_MAX } from "./strawHatStrike";

/**
 * @param {{ textInput: { startTyping: Function, stopTyping: Function, typing: object | null, caretOn: boolean }, api?: object }} deps
 * @returns hooks for createStrike, plus refresh() and attach(game)
 */
export function createStrikeBoard({ textInput, api = { getBoard, startRun, postScore } }) {
  let game = null;
  let ticket = null;
  let runs = 0;
  let fetchedAt = -Infinity;
  const field = {
    id: "strikeName",
    maxLength: NAME_MAX,
    get: () => game?.entry?.name ?? "",
    set: (value) => {
      if (!game?.entry) return;
      game.entry.name = value.replace(/\n/g, "").slice(0, NAME_MAX);
      // a new go at a refused name
      if (game.entry.state === "refused") game.entry.state = "typing";
    },
    // the TV is redrawn every frame while it's on
    redraw: () => {},
    onEnter: () => post(),
  };

  async function refresh({ force = false } = {}) {
    if (!game) return;
    // the board changes slowly; once every half minute is plenty
    if (!force && performance.now() - fetchedAt < 30000 && game.boardState === "ready") return;
    fetchedAt = performance.now();
    if (game.boardState !== "ready") game.boardState = "loading";
    const result = await api.getBoard();
    if (!game) return;
    if (result.ok) Object.assign(game, { board: result.top || [], boardState: "ready" });
    else if (!game.board.length) game.boardState = "offline";
  }

  async function post() {
    const entry = game?.entry;
    if (!entry || entry.state === "sending" || entry.state === "posted") return;
    if (!entry.name.trim()) return game.posted({ ok: false, reason: "empty" });
    if (!ticket) return game.posted({ ok: false, reason: "token" });
    entry.state = "sending";
    const result = await api.postScore({ token: ticket, score: Math.floor(game.score), stage: game.stage, name: entry.name.trim() });
    if (game.entry !== entry) return;
    game.posted(result);
    // a name that went up, or a run that never will: the keyboard can go
    if (entry.state !== "refused") {
      ticket = null;
      stopName();
    }
  }

  const typingHere = () => textInput.typing?.id === field.id;
  function focusName() {
    if (!typingHere()) textInput.startTyping(field);
  }
  function stopName() {
    if (typingHere()) textInput.stopTyping();
  }

  return {
    attach(g) {
      game = g;
    },
    refresh,
    // hooks for the game
    onStart() {
      ticket = null;
      // a ticket that arrives after another run has begun belongs to nobody
      const run = ++runs;
      api.startRun().then((result) => {
        if (result.ok && run === runs) ticket = result.token;
      });
    },
    onEntry: focusName,
    focusName,
    stopName,
    post,
    caret: () => typingHere() && textInput.caretOn,
  };
}
