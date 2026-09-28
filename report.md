# Solo — Test Report

**Result: 179/179 automated tests pass. Cards with all tests passing: 150/150 (135 numbered + 15 characters).**
Run them yourself: open `tests.html` in a browser, or run `powershell -ExecutionPolicy Bypass -File tools\run-tests.ps1` (headless Chrome/Edge). Regenerate this file with `tools\build-report.ps1`.

## Read this before trusting the green

- **The tests check the code against *my* reading of the cards.** I wrote the engine and the tests from the same readings.md / rulings.md interpretation. A PASS means "the card does what readings.md (with rulings.md) says", **not** "the card does what the designer intended". Where readings.md was [UNCLEAR], the tests lock in that assumption.
- **Most cards have one or two scenarios** (the main effect, plus a negative case where it's cheap). Interactions between cards are only lightly covered: several reactions at once, planted sabotage cards together with Noct Umbra / Death Finisher, kept cards across many rounds, and so on. A 40-game random smoke test (plus 150 more random games I ran by hand) found no crashes, stuck prompts or illegal states. That shows robustness, not correctness.
- **Bugs found and fixed while testing:** (1) Sun Cross offered to return an *opponent's* card to your hand after you discarded it from their combo; it now only returns your own cards. (2) Face-down cards returned to hand were named in the shared log, which leaked hidden information.
- **Seven early test failures were mistakes in the tests** (wrong expected prompts or illegal setups), not engine bugs. They were fixed in the tests, and the engine wasn't changed to make them pass.

## Things that aren't wrong, but you should know
- **Games are short.** In random play, games average under 4 rounds. Combo totals quickly reach 15–25 against 10 life, so one lopsided clash can end the game. That comes from the rules as written, but the designer may want to look at it.
- **Prompts during the opponent's turn.** Reaction cards (Flash Jab, Life Jab, Mantis Jab, Mantis Uppercut, Sun Cross) and choices like Phoenix Uppercut's discards ask the other player mid-turn. In hotseat that means extra pass-the-device screens.
- **Online play isn't built yet.** The engine is ready for it (one JSON state, action objects, seeded RNG, replayable), but the state object holds both hands. A server will need to send each player a filtered view.
- **UI is simple.** It's clear and complete, but there's no drag-and-drop, no animations, and no deck builder (decks are seeded: 20 cards × 2, either the character's color or all colors).

## UI checks done by hand (in a browser)
Setup screen → start → mulligan prompts → pass-the-device screen → board shows both combos, hands (the other player's hidden), life / energy / power / clash total / deck / hand / discard counts, and whose turn it is. Play buttons are disabled with the reason (placement or energy). Checked: yes/no, card-pick, multi-select and number prompts, Feint buttons, the debug panel (add card to any zone, set stats and character, clear zone, give turn), and the game-over banner.

## Per-card results
Notes are only given where something is doubtful, partly tested, or depends on a judgment call. No note means the card's reading is simple and its test covers it.
### Red

| Card | Test | Notes |
|---|---|---|
| Asher Smith (character) | PASS |  |
| Ember (character) | PASS |  |
| Vlad Crimson (character) | PASS |  |
| Red 1 Flame Jab | PASS |  |
| Red 1 Phoenix Jab | PASS |  |
| Red 1 Blood Jab | PASS |  |
| Red 2 Flame Chop | PASS |  |
| Red 2 Phoenix Chop | PASS |  |
| Red 2 Blood Chop | PASS |  |
| Red 3 Flame Straight | PASS |  |
| Red 3 Phoenix Straight | PASS |  |
| Red 3 Blood Straight | PASS |  |
| Red 4 Flame Cross | PASS |  |
| Red 4 Phoenix Cross | PASS | You always lose the 1 life, even if the opponent has no 0 to discard (readings.md [UNCLEAR] assumption). |
| Red 4 Blood Cross | PASS |  |
| Red 5 Flame Hook | PASS |  |
| Red 5 Phoenix Hook | PASS |  |
| Red 5 Blood Hook | PASS |  |
| Red 6 Flame Uppercut | PASS |  |
| Red 6 Phoenix Uppercut | PASS |  |
| Red 6 Blood Uppercut | PASS |  |
| Red 7 Flame Snap | PASS | With Flame Uppercut in the same combo, the life "loss" turns into a gain. That follows both readings literally, but it may not be what the designer intended. |
| Red 7 Phoenix Snap | PASS |  |
| Red 7 Blood Snap | PASS |  |
| Red 8 Flame Roundhouse | PASS |  |
| Red 8 Phoenix Roundhouse | PASS | The kept card becomes the leftmost card next round, and your next play must match it. Only the basic keep is tested. |
| Red 8 Blood Roundhouse | PASS |  |
| Red 9 Flame Finisher | PASS |  |
| Red 9 Phoenix Finisher | PASS |  |
| Red 9 Blood Finisher | PASS |  |

### Blue

| Card | Test | Notes |
|---|---|---|
| Spring Azula (character) | PASS |  |
| Cian Hack (character) | PASS |  |
| Victoria Castle (character) | PASS | The clash-win "only 1 damage" applies even when Victoria's player wins by a lot, so it's a big drawback. That matches the source. |
| Blue 1 River Jab | PASS |  |
| Blue 1 Check Jab | PASS |  |
| Blue 1 Cyber Jab | PASS |  |
| Blue 2 River Chop | PASS |  |
| Blue 2 Check Chop | PASS |  |
| Blue 2 Cyber Chop | PASS | Copied abilities treat Cyber Chop (now face down, value 0) as "this card", so copying a "next to X" ability checks Cyber Chop's neighbors. This is my own call (see decisions.md). |
| Blue 3 River Straight | PASS |  |
| Blue 3 Check Straight | PASS |  |
| Blue 3 Cyber Straight | PASS |  |
| Blue 4 River Cross | PASS |  |
| Blue 4 Check Cross | PASS |  |
| Blue 4 Cyber Cross | PASS |  |
| Blue 5 River Hook | PASS |  |
| Blue 5 Check Hook | PASS |  |
| Blue 5 Cyber Hook | PASS |  |
| Blue 6 River Uppercut | PASS |  |
| Blue 6 Check Uppercut | PASS |  |
| Blue 6 Cyber Uppercut | PASS |  |
| Blue 7 River Snap | PASS |  |
| Blue 7 Check Snap | PASS |  |
| Blue 7 Cyber Snap | PASS |  |
| Blue 8 River Roundhouse | PASS | Only tested flipping and keeping a card. When the flip is blocked (Umbra Roundhouse, Life Jab, Flash Jab), the card is not kept. That path is implemented but untested. |
| Blue 8 Check Roundhouse | PASS |  |
| Blue 8 Cyber Roundhouse | PASS |  |
| Blue 9 River Finisher | PASS |  |
| Blue 9 Check Finisher | PASS | Only tested flipping the opponent's cards. The option to flip your own cards is implemented but untested. |
| Blue 9 Cyber Finisher | PASS |  |

### Yellow

| Card | Test | Notes |
|---|---|---|
| Sonny Lee (character) | PASS |  |
| Leo Wildheart (character) | PASS | The deck card is put in face up with no combo enter, as readings.md says. A player might expect it to be "played". |
| Master Leo (character) | PASS |  |
| Yellow 1 Sun Jab | PASS |  |
| Yellow 1 Lion Jab | PASS |  |
| Yellow 1 Flash Jab | PASS | Flash Jab is also offered when your own mandatory effects would flip your cards (Cian Hack, Check Hook), which means extra prompts. |
| Yellow 2 Sun Chop | PASS |  |
| Yellow 2 Lion Chop | PASS |  |
| Yellow 2 Flash Chop | PASS |  |
| Yellow 3 Sun Straight | PASS |  |
| Yellow 3 Lion Straight | PASS |  |
| Yellow 3 Flash Straight | PASS |  |
| Yellow 4 Sun Cross | PASS | Ruling applied. It prompts on every discard of one of your cards while it's in your combo (engage, reset, mass discards), which gets noisy. I added one rule of my own: it only returns your own cards. |
| Yellow 4 Lion Cross | PASS |  |
| Yellow 4 Flash Cross | PASS |  |
| Yellow 5 Sun Hook | PASS |  |
| Yellow 5 Lion Hook | PASS |  |
| Yellow 5 Flash Hook | PASS |  |
| Yellow 6 Sun Uppercut | PASS |  |
| Yellow 6 Lion Uppercut | PASS |  |
| Yellow 6 Flash Uppercut | PASS |  |
| Yellow 7 Sun Snap | PASS |  |
| Yellow 7 Lion Snap | PASS |  |
| Yellow 7 Flash Snap | PASS |  |
| Yellow 8 Sun Roundhouse | PASS |  |
| Yellow 8 Lion Roundhouse | PASS |  |
| Yellow 8 Flash Roundhouse | PASS |  |
| Yellow 9 Sun Finisher | PASS |  |
| Yellow 9 Lion Finisher | PASS | Ruling applied: only your own discards count. Cards you discard from the opponent's combo also count as "you discarded". |
| Yellow 9 Flash Finisher | PASS |  |

### Green

| Card | Test | Notes |
|---|---|---|
| Forest Oak (character) | PASS |  |
| Young Joey Sprout (character) | PASS |  |
| Jack Spades (character) | PASS | A pair is checked only against the card on the left, not the whole combo. |
| Green 1 Forest Jab | PASS |  |
| Green 1 Mantis Jab | PASS |  |
| Green 1 Life Jab | PASS |  |
| Green 2 Forest Chop | PASS |  |
| Green 2 Mantis Chop | PASS |  |
| Green 2 Life Chop | PASS |  |
| Green 3 Forest Straight | PASS |  |
| Green 3 Mantis Straight | PASS |  |
| Green 3 Life Straight | PASS |  |
| Green 4 Forest Cross | PASS |  |
| Green 4 Mantis Cross | PASS | "Can't be moved" blocks only reordering and swapping (Forest Snap, Umbra Cross, Umbra Uppercut). Flips, discards and returns to hand still work. Unclear in the source. |
| Green 4 Life Cross | PASS |  |
| Green 5 Forest Hook | PASS |  |
| Green 5 Mantis Hook | PASS |  |
| Green 5 Life Hook | PASS | Uses only the left neighbor. The card is always rightmost when it enters, so this matches readings.md. |
| Green 6 Forest Uppercut | PASS |  |
| Green 6 Mantis Uppercut | PASS | The wording is garbled (readings.md [UNCLEAR]). It's implemented as an optional reaction whenever the opponent plays a printed 1-4. |
| Green 6 Life Uppercut | PASS |  |
| Green 7 Forest Snap | PASS |  |
| Green 7 Mantis Snap | PASS |  |
| Green 7 Life Snap | PASS |  |
| Green 8 Forest Roundhouse | PASS |  |
| Green 8 Mantis Roundhouse | PASS |  |
| Green 8 Life Roundhouse | PASS |  |
| Green 9 Forest Finisher | PASS | Same "this card" choice as Cyber Chop. Copy cards can't copy each other. |
| Green 9 Mantis Finisher | PASS |  |
| Green 9 Life Finisher | PASS |  |

### Black

| Card | Test | Notes |
|---|---|---|
| Noct Umbra (character) | PASS |  |
| Evelyn Shadow (character) | PASS | Only the clash-total part of the reveal is tested. Revealed cards having their abilities switched off (Style, end-of-clash) is implemented but untested. |
| Dante (character) | PASS | 5 colors in one combo is only reachable with the dual-colored Black Hooks. The 5-color branch is tested with a hand-built combo. |
| Black 1 Umbra Jab | PASS |  |
| Black 1 Ink Jab | PASS |  |
| Black 1 Death Jab | PASS |  |
| Black 2 Umbra Chop | PASS |  |
| Black 2 Ink Chop | PASS | Sabotage cards also constrain the opponent's placement: their next card must match the planted card's number or color. That follows the placement rules. |
| Black 2 Death Chop | PASS |  |
| Black 3 Umbra Straight | PASS | **Doubtful design:** read literally, this card only ever throws itself away when a bigger card is played after it, with no upside even when planted. The implementation matches readings.md, but the designer probably meant something else. |
| Black 3 Ink Straight | PASS |  |
| Black 3 Death Straight | PASS |  |
| Black 4 Umbra Cross | PASS |  |
| Black 4 Ink Cross | PASS |  |
| Black 4 Death Cross | PASS |  |
| Black 5 Umbra Hook | PASS |  |
| Black 5 Ink Hook | PASS |  |
| Black 5 Death Hook | PASS |  |
| Black 6 Umbra Uppercut | PASS |  |
| Black 6 Ink Uppercut | PASS |  |
| Black 6 Death Uppercut | PASS |  |
| Black 7 Umbra Snap | PASS |  |
| Black 7 Ink Snap | PASS |  |
| Black 7 Death Snap | PASS |  |
| Black 8 Umbra Roundhouse | PASS |  |
| Black 8 Ink Roundhouse | PASS |  |
| Black 8 Death Roundhouse | PASS | Tested with 2 picks and "Done". The full 5-color case is not tested. |
| Black 9 Umbra Finisher | PASS |  |
| Black 9 Ink Finisher | PASS | **Doubtful design:** its combo enter discards it at once, so you pay 9 energy for nothing except discard synergies. The "stay in combo" line only matters if it gets into a combo without its combo enter resolving (planted, Leo Wildheart, Ink Uppercut). That matches readings.md [UNCLEAR], but the card is probably not what the designer meant. |
| Black 9 Death Finisher | PASS |  |

**Count:** 150 cards listed: 150 PASS, 0 FAIL. Tests: 150 card tests (one per card, many with several checks) + 29 core-rule tests = 179.
