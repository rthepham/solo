# Online play: report

What was built, how it was checked, and what to watch out for. Design choices are in `decisions.md` ("Online play").

## What works

Checked by hand in two tabs of one browser (the Chromium-based preview browser on this Windows machine, page served from `localhost` by `tools/serve.ps1`), going through the real PeerJS broker:

- **Host / Join.** Host gets a 5-letter code and a join link. The guest can type the code or open the link. A wrong code says "No game found with code …".
- **Full games.** Two complete games were played to the end through the real UI and network (41 and 51 moves). I used a small script that clicked the visible buttons in each tab at random. The winner was shown correctly on both screens ("You win!" / "Your opponent wins.").
- **Prompts go only to the player who must answer.** That includes mulligans, reset discards, and choices during the opponent's turn. The other screen shows "Waiting for opponent…". There's no pass-the-device screen.
- **Guest refresh mid-game**: rejoined by itself with the same hand and log.
- **Guest leaves the page**: the host's bar turned red, "Opponent disconnected — they can rejoin with code …", within about 3 seconds. The guest came back by reopening the page.
- **Host refresh with the guest away**: the host's game was rebuilt from the saved seed + moves. When the guest came back, both screens matched.
- **Host refresh with the guest still on the page**: the guest showed "Reconnecting…", then reconnected by itself within about 10 seconds. A full game was then finished.
- **Hotseat** is unchanged and still works offline by double-clicking `index.html`. All earlier tests still pass.

Automated (`tests/online.test.js`, 11 tests, in `tests.html` and `node tools/run-tests.js`). These simulate a host and a guest exchanging JSON messages through an in-memory pipe, with no network:
- Random games played to the end by two bots. Each bot decides using only its own view, which shows the views are enough to play. After every move: the guest's view equals the host's filtered view for Player 2 (state and log), and only the player who must choose receives the prompt.
- **Differential hidden-info test**, over 8 games: changing the identity of the host's hand cards, both decks, the host's face-down cards, the seed, the generator state and the pending choice's base state never changes what the guest receives.
- **Field test**, over every message sent to the guest in 8 games: no `seed`, `rng`, `base`, `answers` or `action` fields; decks, the host's hand and the host's face-down cards carry no id or uid; the host's prompts are never sent.
- I checked that these tests catch leaks by injecting five: showing the host's hand, showing face-down cards, showing decks, sending the prompt to both players, and sending the generator state. Each made at least two tests fail.
- Version mismatch is refused in both directions with a clear message. A third player is refused. The guest can't move as Player 1 or use debug actions (nor can the host, online).
- Guest drop and rejoin (same session, and a fresh page with the saved token). Host restore from the saved record gives a byte-identical state, and the guest can reconnect to it.

## Not tested

- **Two different computers on different networks.** I could only test two tabs on one machine. Connecting across the internet is exactly what WebRTC sometimes fails at (see limits). This is the biggest gap. Please try it before relying on it.
- **Firefox, Safari, phones and tablets.** Only a Chromium-based browser was used.
- **Opening `index.html` by double-click (`file://`) for online play.** It should work in Chrome, but it was only tested served over `http://localhost`. On GitHub/Cloudflare Pages it will be `https://`, which is the normal case for WebRTC, but that wasn't tested either.
- **Deploying to GitHub Pages or Cloudflare Pages.** The README steps are standard but were not run (as asked, nothing was deployed).
- **Long or flaky connections**: a laptop going to sleep, switching Wi-Fi, a phone locking its screen mid-game. The reconnect logic should cover them, but I only tested page refreshes and closing the page.
- **The PeerJS broker being down or slow.** The game shows "Lost touch with the PeerJS broker, retrying…", but I never saw that happen.
- **Two hosts using the same browser at once** (two tabs both hosting) works per tab, but "Resume hosting" on the setup screen only remembers the last room.

## Known limits

- **The host's browser holds the full game.** Both hands and the deck order are in the host's memory and localStorage. A host who opens the developer tools can see everything. The guest never receives hidden information. This was accepted in the spec.
- **Some networks can't connect peer to peer.** PeerJS's free setup gives STUN only, no TURN relay. Players behind strict corporate firewalls, some mobile carriers, or "symmetric" NAT may never connect; they'd sit on "Connecting…". Fixing that needs a TURN server, which is not free.
- **Free public broker.** PeerJS's cloud server (0.peerjs.com) is free with no guarantee. If it's down, nobody can start or rejoin a game, though games already connected keep working. Room ids on the broker are global, so ours use a distinctive prefix (`solo-cardgame-room-`).
- **Room codes are the only key.** Anyone with the code can join an empty room, or take over Player 2's seat while it's disconnected. That's fine between friends, but don't post codes publicly.
- **The host must stay.** If the host closes the page, the guest waits ("Reconnecting…") until the host comes back. Leaving a game doesn't send a goodbye, so the other side just sees a disconnect.
- **Host restore is per browser.** The saved game lives in the host browser's localStorage. Clearing site data, or switching browser or computer, loses it.
- **No turn timer.** A player can stall forever.
- **Both players must load the same version.** After updating the site, both must refresh. A mismatch is refused with a message, but there's no automatic update. The version string (`Solo.VERSION` in `js/engine.js`) must be bumped by hand when rules, cards or messages change; if someone forgets, two different versions could play each other.
- **Size of messages.** Each move sends the guest the whole filtered board (a few KB) plus only the new log lines. That's fine for this game, but it isn't optimised.
- **Things a determined guest could still learn, in theory.** The random generator's state is only 32 bits. A guest could, with a lot of offline computing, try to match it against the shuffles they've seen. They still wouldn't get the seed or the deck lists, so they couldn't name hidden cards from it. I don't think this matters for a game between friends, but it's not cryptographically sealed.
