# Solo — Card Readings

Sources: `Rulebook.txt` and `Solo the Card game.xlsx` (8 sheets: Characters Mono / Number / Wild, and Red / Blue / Yellow / Green / Black Numbers). No other files used.

## 1. Rulebook ambiguities & the interpretation used

1. **Character count.** The Contents list says 12 characters, but the spreadsheet has 15 (5 Mono, 5 Number, 5 Wild). → All 15 are used.
2. **Copies.** The Contents list says "4x 135 unique", but deck building allows at most 2 copies of each named card. → Max 2 copies per name. The "4x" is treated as the print run.
3. **Deck size.** The rulebook says both "40 cards" and "41 card deck". → 1 character + 40 non-character cards = 41.
4. **Energy vs Power.** The Contents list has Life and Power counters, but setup sets Life and *Energy*. The cards clearly use both. → There are three separate stats. **Life** starts at 10 with no maximum. **Energy** starts at 10 and pays card costs; its max is 10. **Power** starts at 0 and adds to your clash total. Power and energy can't go below 0.
5. **Energy and power between rounds** aren't covered. → At the very start of End of Clash/Reset (before step 1), energy refills to max and power resets to 0. Anything gained later in the reset carries into the next round. Energy gains stop at max unless a card says otherwise.
6. **"One of two actions" but three are listed.** → The three actions are Play, Engage and Feint. Using a Feint from the action menu takes your action for the turn. Feints that name their own trigger condition (Yellow 1 Flash Jab, Green 6 Mantis Uppercut, Black 3 Umbra Straight) are reactions and don't take an action.
7. **Engage / clash.** → Engage: draw up to 2 cards, then discard the same number. A clash starts when two actions in a row are both Engage (one from each player). If you can't legally play a card, you must Engage.
8. **Placement "next to it".** → A new card goes in the rightmost slot and must match the **number or color** of the card currently rightmost in your combo. If your combo is empty, any card is legal.
9. **Clash damage.** The text says "difference of current power", but the example uses totals. → Damage = difference in totals (power + sum of combo values). A tie means no damage and no winner. **"Clash win"** isn't in the rules; it means your total was higher, and it resolves right after damage.
10. **Flipping.** → "Flip" means turning a face-up card face down. "When flipped" triggers only then. Turning a card face up ("flip face up" or "unflip") has no trigger. Face-down cards have no abilities and count as 0 in your character's color.
11. **"When discarded"** isn't defined. → It triggers whenever the card is discarded from hand, combo or top of deck, face up or face down (Green 5 Mantis Hook confirms face down counts). It does **not** trigger when combos are cleared in reset step 3; the rules say that isn't discarding.
12. **Terms.** → "Pool" or "card pool" = combo. "Might" = power. "This turn" (Red 9 Phoenix Finisher) = this round. "Opponent's last played card" = the rightmost card of their combo. "Next to X" = an adjacent card; at combo enter, that's the card on its left.
13. **Run / Pair** aren't defined. → A **run** is 3 or more adjacent cards with consecutive numbers, ascending or descending (e.g. 4-5-6). A **pair** is 2 adjacent cards with the same number.
14. **Moving cards into a combo from elsewhere.** → To **"Play"** a card from the deck or discard: it costs 0, goes in the rightmost slot, ignores placement, and its combo enter triggers. To **"Put"** a card into a combo: no cost, no placement check, no combo-enter trigger, face up unless stated.
15. **Cards in the opponent's combo.** → Cards put into an opponent's combo go back to their owner's discard at cleanup. Style / "this combo" cards affect whichever combo they sit in, not always their owner's.
16. **Costs.** → Cost reductions can't take a cost below 0. The card keeps its printed number for placement and clash totals.
17. **Game end.** → The deck-out check happens only in reset step 4. Drawing from an empty deck mid-round draws nothing. If the game ends on deck-out with equal life, it's a draw. If both players hit 0 at the same time, it's a draw.
18. **Timing order.** → Simultaneous effects resolve for the current player first, then left to right. A character's "when you play…" ability resolves *after* the played card's combo-enter effects. Start-of-clash and end-of-clash effects only fire from face-up cards.
19. **Missing data.** The Card Anatomy images and the characters' Life column are blank. → Every character starts at 10 life. The spreadsheet columns "Support Need", "Color Type Names" and Asher Smith's "Triggers to Name" cell are designer notes, not card text.
20. **Round start.** → Round 1 has no rotation. After that, the first player alternates each round. Mulligan is once, optional, and the old hand goes to the bottom of the deck.

## 2. Card readings

### Red

**Characters**
- Red Asher Smith (Rushdown) — Whenever you play a Red card with value 1–3 into your combo, gain +1 Power.
- Red Ember (Rushdown) — Whenever you play a card with an even number, you may play a value-1 card from your discard pile into your combo (free, rightmost, its combo enter triggers). [UNCLEAR] Face-up 1s only; optional.
- Red Vlad Crimson (Blood Letter) — Clash win: gain 2 life.

**Numbers**
- Red 1 Flame Jab — Combo enter: lose 3 life, then draw 1 card.
- Red 1 Phoenix Jab — Combo enter: gain +1 Power for each value-1 card in your combo (this card included). [UNCLEAR] Assumed only your own combo counts.
- Red 1 Blood Jab — Combo enter: draw 1 card, then discard 1 card.
- Red 2 Flame Chop — Combo enter: you lose 2 life and your opponent loses 2 life.
- Red 2 Phoenix Chop — Combo enter: if the card next to it is a 1, gain 2 life.
- Red 2 Blood Chop — Combo enter: if your Power is higher than your opponent's, lose 2 Power and draw 1 card.
- Red 3 Flame Straight — Combo enter: if your combo contains a run of 3, return any number of cards from your discard to your hand whose values total exactly 3. [UNCLEAR] Only face-up cards may be picked, so face-down 0s can't be taken for free.
- Red 3 Phoenix Straight — Combo enter: if your Power is higher than your opponent's, gain 3 life.
- Red 3 Blood Straight — Combo enter: if the card next to it is a 3, gain +3 Power.
- Red 4 Flame Cross — Combo enter: if your Power is higher than your opponent's, gain +2 Power.
- Red 4 Phoenix Cross — Combo enter: lose 1 life, then discard a value-0 (face-down) card from your opponent's combo. [UNCLEAR] You lose the life even if there's no 0 to discard.
- Red 4 Blood Cross — Feint (discard this from your combo): play a 3 from your discard pile into your combo (free), then draw 1 card.
- Red 5 Flame Hook — Combo enter: if your Power is lower than your opponent's, gain +4 Power.
- Red 5 Phoenix Hook — Combo enter: lose 2 life, then flip a card in your opponent's combo face down (you choose).
- Red 5 Blood Hook — Combo enter: discard your whole hand, then draw 3 cards.
- Red 6 Flame Uppercut — Style: while in your combo, whenever you would lose life from one of your own card or character effects, you gain that much life instead (clash damage isn't affected).
- Red 6 Phoenix Uppercut — Combo enter: deal damage equal to your Power to your opponent. They may first discard any number of cards from hand to reduce the damage by the total value of those cards.
- Red 6 Blood Uppercut — Feint (discard this from your combo): gain +X Power, where X = 10 (starting life) − your current life (minimum 0).
- Red 7 Flame Snap — Start of clash: your life drops to 1 (lose all but 1), and you take no damage from this clash.
- Red 7 Phoenix Snap — Clash win: gain life equal to the damage you dealt your opponent this clash.
- Red 7 Blood Snap — Style: while in your combo, your Red cards cost 1 less energy to play.
- Red 8 Flame Roundhouse — End of clash: gain 6 life.
- Red 8 Phoenix Roundhouse — End of clash: choose one other card in your combo. It isn't cleared in reset step 3 and becomes the first (leftmost) card of your combo next round.
- Red 8 Blood Roundhouse — End of clash: draw 3 cards.
- Red 9 Flame Finisher — Costs 1 less energy for each value-1 card in your combo.
- Red 9 Phoenix Finisher — Costs 1 less energy for each life you have lost this round (still a Red 9 for placement). [UNCLEAR] "This turn" read as "this round".
- Red 9 Blood Finisher — Costs 1 less energy for each Power you have (still a Red 9 for placement).

### Blue

**Characters**
- Blue Spring Azula (Zoner) — Whenever you play a Blue card with value 4 or more, flip your opponent's last played (rightmost) combo card face down. Start of clash: gain +1 Power for each face-down card in your opponent's combo.
- Blue Cian Hack (Hit and Run) — Whenever you play an odd-numbered card, after its own abilities resolve, flip it face down (its "when flipped" triggers), then add a 2 from your discard pile to your hand if you have one.
- Blue Victoria Castle (Hazard) — End of clash: draw 2 extra cards. Clash win: instead of the normal difference, deal your opponent exactly 1 damage.

**Numbers**
- Blue 1 River Jab — Patience (combo enter: you may flip this face down). When flipped: your opponent loses 2 Power.
- Blue 1 Check Jab — Combo enter: if the card next to it is a 1 or a 0, gain 1 energy.
- Blue 1 Cyber Jab — Patience. When flipped: draw 1 card, then discard 1 card.
- Blue 2 River Chop — Combo enter: gain +1 Power for each face-down card in your opponent's combo.
- Blue 2 Check Chop — Combo enter: flip a face-up card with value 2 or less in your opponent's combo face down.
- Blue 2 Cyber Chop — When flipped (no Patience, so something else must flip it): copy the combo-enter ability of another face-up card in your combo and resolve it again.
- Blue 3 River Straight — Combo enter: draw 1 card.
- Blue 3 Check Straight — Combo enter: discard cards from the top of your deck equal to the number of odd-valued cards across both combos (this card included). [UNCLEAR] Counts how many odd cards there are, not the sum of their values.
- Blue 3 Cyber Straight — Patience. When flipped: flip a face-up card with value 3 or less in your opponent's combo face down.
- Blue 4 River Cross — Patience. When flipped: your opponent puts the top 2 cards of their deck face down into their combo.
- Blue 4 Check Cross — When flipped (no Patience): your opponent puts the top 2 cards of their deck face down into their combo.
- Blue 4 Cyber Cross — Combo enter: gain +1 Power for each face-down card in your combo.
- Blue 5 River Hook — When flipped (no Patience): your opponent puts a card from their hand face down into their combo (they choose which).
- Blue 5 Check Hook — Combo enter: flip a card in your combo face down (this card allowed); its "when flipped" triggers.
- Blue 5 Cyber Hook — Combo enter: if you have at least two value-0 cards in your combo, flip a card in your opponent's combo face down.
- Blue 6 River Uppercut — Patience. When flipped: discard the top 3 cards of your deck.
- Blue 6 Check Uppercut — Combo enter: if your opponent's Power is higher than yours, they lose 3 Power.
- Blue 6 Cyber Uppercut — Combo enter: gain +1 Power for each face-down card across both combos.
- Blue 7 River Snap — Combo enter: discard the top X cards of your deck, where X = your Power.
- Blue 7 Check Snap — Combo enter: if the card next to it is a 0, your opponent chooses one of their face-up combo cards and flips it face down.
- Blue 7 Cyber Snap — Combo enter: gain 1 life for each face-down card across both combos.
- Blue 8 River Roundhouse — Start of clash: you may flip one card in your combo face down. That card isn't cleared at the end of the clash and stays as the first card of your combo next round. [UNCLEAR] Where it sits next round isn't stated; leftmost assumed, like Red 8 Phoenix Roundhouse.
- Blue 8 Check Roundhouse — End of clash: if you dealt 2 or less damage to your opponent this clash (0 included), draw 2 cards.
- Blue 8 Cyber Roundhouse — Combo enter: if you have at least two value-0 cards in your combo, your opponent loses 2 energy.
- Blue 9 River Finisher — Combo enter: return every face-down card in your combo to your hand, and gain +1 energy for each (up to max).
- Blue 9 Check Finisher — Combo enter: if the card next to it is a 0, do "flip a card" four times (any card in either combo each time). [UNCLEAR] Read as four separate flips, not one card flipped four times.
- Blue 9 Cyber Finisher — Costs 2 less energy for each face-down card in your combo.

### Yellow

**Characters**
- Yellow Sonny Lee (Shoto) — Whenever you play a Yellow card: if your Power is lower than your opponent's, gain +1 Power; if it is higher, draw 1 card then discard 1 card (if equal, nothing).
- Yellow Leo Wildheart (Stance) — Whenever you play an odd-numbered card, put the top card of your deck face up into your combo (no cost, no placement check, no combo enter). Whenever you play an even-numbered card, you may return a face-down card from your combo to your hand. [UNCLEAR] The deck card is assumed to go in face up.
- Yellow Master Leo (Old Master) — Start of clash: if your combo contains a run of 3, gain +3 Power. Start of clash: if your combo contains a run of 5, discard a card from your opponent's combo (you choose). A run of 5 also counts for the run-of-3 bonus.

**Numbers**
- Yellow 1 Sun Jab — When discarded: your opponent gains +2 Power, and you gain +1 energy (up to max).
- Yellow 1 Lion Jab — When discarded: gain +1 Power.
- Yellow 1 Flash Jab — Feint (reaction, while in your combo): when one of your cards would be flipped, you may discard this card instead, and the flip doesn't happen.
- Yellow 2 Sun Chop — Combo enter: gain +1 Power for every 2 cards in your hand (round down).
- Yellow 2 Lion Chop — Combo enter or when flipped: if a card next to it is a 2, gain +2 Power.
- Yellow 2 Flash Chop — Can be played next to a 0 (face-down card) even when the colors don't match.
- Yellow 3 Sun Straight — Combo enter or when flipped: if this card is the end of a run of 3, draw 1 card.
- Yellow 3 Lion Straight — Combo enter: if the card next to it is a 0, your opponent loses 2 Power.
- Yellow 3 Flash Straight — Can be played next to a 0 even when the colors don't match.
- Yellow 4 Sun Cross — Feint (discard this from your combo): return the card you most recently discarded (before this Feint, this round) from your discard pile to your hand. [UNCLEAR] "A card you just discarded" read as your last discard before this one.
- Yellow 4 Lion Cross — Can be played next to a 0 even when the colors don't match.
- Yellow 4 Flash Cross — Combo enter: turn a face-down card in your combo face up. If its value is 4 or more, put it into your hand; if 3 or less, it stays face up in your combo.
- Yellow 5 Sun Hook — Can be played next to a 0 even when the colors don't match.
- Yellow 5 Lion Hook — Style: while in your combo, whenever you discard a card, gain +1 energy (up to max).
- Yellow 5 Flash Hook — Combo enter: if the card next to it is a 0, gain +3 Power.
- Yellow 6 Sun Uppercut — Combo enter: you may discard a card from your combo; if you do, discard a card with value 5 or less from your opponent's combo.
- Yellow 6 Lion Uppercut — Combo enter: if the card next to it is a 0, your opponent puts the top card of their deck face down into their combo.
- Yellow 6 Flash Uppercut — Can be played next to a 0 even when the colors don't match.
- Yellow 7 Sun Snap — When discarded: gain +3 energy (up to max).
- Yellow 7 Lion Snap — Combo enter: you may discard two cards from your combo; if you do, gain +2 energy.
- Yellow 7 Flash Snap — Can be played next to a 0 even when the colors don't match.
- Yellow 8 Sun Roundhouse — Combo enter: discard a card from your opponent's combo (you choose).
- Yellow 8 Lion Roundhouse — Combo enter: turn a face-down card in your combo face up.
- Yellow 8 Flash Roundhouse — When discarded: gain +4 Power.
- Yellow 9 Sun Finisher — Combo enter: discard your whole hand, then draw 5 cards.
- Yellow 9 Lion Finisher — Costs 1 less energy for each card discarded this round, by either player, from any zone (reset-step-3 cleanup doesn't count). [UNCLEAR] Assumed both players' discards count.
- Yellow 9 Flash Finisher — When discarded: turn every card in your discard pile face down, then shuffle your discard pile (this card included) into your deck.

### Green

**Characters**
- Green Forest Oak (Grappler) — Whenever you play a Green card whose value is at least 3 higher than your opponent's last played (rightmost) combo card, gain +1 energy. [UNCLEAR] "Your opponent's" is incomplete; read as their rightmost card (0 if empty or face down), and "3 greater" as "3 or more greater".
- Green Young Joey Sprout (Install) — Whenever you play an even-numbered card, discard the top card of your deck face down. End of clash: if at least 5 face-down cards are in your discard pile, your max energy becomes 18 for the rest of the game (from the next refill).
- Green Jack Spades (Resource User) — Whenever you play a card that forms a pair (same number as the card next to it), gain +1 energy.

**Numbers**
- Green 1 Forest Jab — Combo enter: if the total value of your combo is greater than 10, gain +2 energy.
- Green 1 Mantis Jab — While in your combo: if your opponent would discard a card from your combo, you may discard this card instead.
- Green 1 Life Jab — While in your combo: if your opponent would flip a card in your combo, you may discard this card instead.
- Green 2 Forest Chop — Combo enter: gain life equal to your Power.
- Green 2 Mantis Chop — Patience. When flipped: discard the top 2 cards of your deck face down.
- Green 2 Life Chop — Combo enter: if your combo's total value is greater than your opponent's, gain +2 Power.
- Green 3 Forest Straight — Combo enter: if your opponent's last played (rightmost) combo card has value 0, gain +2 energy.
- Green 3 Mantis Straight — Style: while in your combo, each time you play a card you may pay 1 energy; if you do, each player draws 1 card.
- Green 3 Life Straight — Combo enter: you may discard a card from your combo; if you do, gain +1 energy.
- Green 4 Forest Cross — End of clash: gain 3 bonus energy, which can go above your max.
- Green 4 Mantis Cross — Style: while in your combo, cards in your combo can't be moved, meaning reordered or swapped by any effect. [UNCLEAR] Flipping and discarding are still allowed; only position changes are blocked.
- Green 4 Life Cross — Combo enter: if this card is played at the end of a run (3+), gain +5 energy (up to max).
- Green 5 Forest Hook — Combo enter: if the card next to it is a 5, look at the top 2 cards of your deck. Discard one face down, then play the other into your combo for 0 energy (ignores placement; its combo enter triggers).
- Green 5 Mantis Hook — Patience. When flipped: you may discard 2 cards from your hand face down (their "when discarded" effects still trigger); if you do, gain +3 energy.
- Green 5 Life Hook — Combo enter: you may pay (10 − the value of the card next to it) energy; if you do, draw 2 cards.
- Green 6 Forest Uppercut — Combo enter: if the card next to it is a 6, gain +6 Power.
- Green 6 Mantis Uppercut — Feint (reaction, while in your combo): when your opponent plays a card with value 4 or less, you may discard this card; if you do, they must discard a card from their combo (their choice). [UNCLEAR] The wording is garbled; read as a reactive Feint that you choose to use.
- Green 6 Life Uppercut — Combo enter: if every card in your combo has a higher number than every card in your opponent's combo, gain +4 Power. [UNCLEAR] Read as your lowest card > their highest card; an empty opposing combo counts as true.
- Green 7 Forest Snap — Combo enter: rearrange both combos in any order you choose, ignoring placement rules.
- Green 7 Mantis Snap — If this is the only card in your hand and your opponent has more Power than you, you may play it for 0 energy (placement rules still apply).
- Green 7 Life Snap — Combo enter: each player discards 2 random cards from their hand, face up.
- Green 8 Forest Roundhouse — Start of clash: if your combo has more pairs than your opponent's, gain +6 Power.
- Green 8 Mantis Roundhouse — Style: while in your combo, whenever you Engage and it doesn't start a clash, gain +1 energy.
- Green 8 Life Roundhouse — Combo enter: choose another card in your combo, return it to your hand, and gain energy equal to its value + 1 (up to max). [UNCLEAR] It can't pick itself; that would make a free-energy loop.
- Green 9 Forest Finisher — Combo enter: copy the combo-enter ability of another face-up card in your combo and resolve it again.
- Green 9 Mantis Finisher — Costs 1 less energy for every 3 cards in your discard pile (round down).
- Green 9 Life Finisher — Combo enter: you may spend any amount of energy; gain +5 Power for each energy spent.

### Black

**Characters**
- Black Noct Umbra (Puppet) — Face-down cards in your combo have value 2 instead of 0 (for clash totals, placement matching and card checks). They are still your character's color.
- Black Evelyn Shadow (Bait/Trap) — Whenever you play a 3, each player (you first) puts a card from their hand face down into their combo. Start of clash: turn all face-down cards in both combos face up. Their "when flipped" and other abilities don't activate; they only count their printed number this clash. [UNCLEAR] Assumed to affect both combos, and to also turn off Style/clash abilities on those cards.
- Black Dante (Evil) — Start of clash: if your combo has 3 or more different colors, your opponent discards the top 5 cards of their deck. Start of clash: if your combo has all 5 colors, your opponent loses 1 life for each different color in their combo.

**Numbers**
- Black 1 Umbra Jab — Patience. When flipped: your opponent flips the first (leftmost) card of their combo face down.
- Black 1 Ink Jab — Can be played next to a card of any color (so it is always legal to place).
- Black 1 Death Jab — When flipped (no Patience): if your combo has 3 or more different colors, draw 1 card.
- Black 2 Umbra Chop — Combo enter: put a card from your discard pile into your opponent's combo (face up, rightmost, no combo enter).
- Black 2 Ink Chop — Style: cards cost 1 more energy to play into the combo this card is in. [UNCLEAR] "Your combo" read as "this combo"; it's meant to be put into the opponent's combo with Umbra Chop and similar cards.
- Black 2 Death Chop — Combo enter: flip a face-up Black card (in either combo, this card allowed) face down.
- Black 3 Umbra Straight — Forced Feint: when the owner of the combo it's in plays a card with value higher than 3, this card must be discarded from that combo. [UNCLEAR] Read as automatic self-discard, not a choice.
- Black 3 Ink Straight — Combo enter: put a card from your discard pile into your opponent's combo.
- Black 3 Death Straight — Combo enter: you may flip a card in your combo face down; if you do, draw 2 cards then discard 1. [UNCLEAR] Name is blank in the sheet ("Straight"); "Death" assumed from the Black family names.
- Black 4 Umbra Cross — Combo enter: your opponent swaps the first and last cards of their combo.
- Black 4 Ink Cross — When flipped (no Patience): return a face-down card from your combo to your hand (this card allowed).
- Black 4 Death Cross — Combo enter: put a card from your discard pile into your opponent's combo. [UNCLEAR] Name is blank in the sheet; "Death" assumed.
- Black 5 Umbra Hook — This card is also Blue (it counts as both Black and Blue for placement and color counts).
- Black 5 Ink Hook — This card is also Red (Black and Red).
- Black 5 Death Hook — This card is also Green (Black and Green). [UNCLEAR] Name is blank in the sheet; "Death" assumed.
- Black 6 Umbra Uppercut — Combo enter: rearrange your opponent's combo in any order you like, ignoring placement rules.
- Black 6 Ink Uppercut — Style: cards that enter the combo this card is in don't trigger their combo-enter abilities.
- Black 6 Death Uppercut — Combo enter: put a card from your discard pile into your opponent's combo. [UNCLEAR] Name is blank in the sheet; "Death" assumed.
- Black 7 Umbra Snap — Combo enter: draw 2 cards.
- Black 7 Ink Snap — Combo enter: flip every other card in your combo face down; if at least one was flipped, put the top 2 cards of your deck face down into your combo.
- Black 7 Death Snap — Combo enter: if you have at least 2 face-down cards in your combo, turn one of them face up. [UNCLEAR] Name is blank in the sheet; "Death" assumed.
- Black 8 Umbra Roundhouse — Style: cards in the combo this card is in can't be flipped.
- Black 8 Ink Roundhouse — Style: whenever a card is played into the combo this card is in, that combo's owner discards the top card of their deck face up.
- Black 8 Death Roundhouse — Combo enter: choose up to five value-1 cards from your discard pile, each a different color, and play them into your combo in any order (free, ignoring placement). Their combo-enter effects resolve left to right. [UNCLEAR] Name is blank in the sheet; "Death" assumed.
- Black 9 Umbra Finisher — Combo enter: put a card from your discard pile face down into your combo.
- Black 9 Ink Finisher — Combo enter: discard this card from your combo (this triggers "when discarded" effects). End of clash: if this card is still in a combo, it isn't cleared and stays for next round. [UNCLEAR] The two lines conflict. The second only matters if the card got into a combo without its combo enter resolving (put there by an effect, or blocked by Ink Uppercut).
- Black 9 Death Finisher — Style: each face-down card in the combo this card is in gets +3 value. [UNCLEAR] Name is blank in the sheet; "Death" assumed.

## 3. Count

| Group | Characters | Numbered |
|---|---|---|
| Red | 3 | 27 |
| Blue | 3 | 27 |
| Yellow | 3 | 27 |
| Green | 3 | 27 |
| Black | 3 | 27 |
| **Total** | **15** | **135** |

**15 characters + 135 numbered cards = 150 cards. All covered.**
