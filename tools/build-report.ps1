# Builds report.md from test-results.json (run tools\run-tests.ps1 first)
# plus the reviewer notes below.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$r = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'test-results.json') | ConvertFrom-Json
$raw = [IO.File]::ReadAllText((Join-Path $root 'js\cards-data.js'))
$cards = $raw.Substring($raw.IndexOf('['), $raw.LastIndexOf(']') - $raw.IndexOf('[') + 1) | ConvertFrom-Json

$notes = @{
  'R4-phoenix' = 'You always lose the 1 life, even if the opponent has no 0 to discard (readings.md [UNCLEAR] assumption).'
  'R7-flame'   = 'With Flame Uppercut in the same combo, the life "loss" turns into a gain. That follows both readings literally, but it may not be what the designer intended.'
  'R8-phoenix' = 'The kept card becomes the leftmost card next round, and your next play must match it. Only the basic keep is tested.'
  'U2-cyber'   = 'Copied abilities treat Cyber Chop (now face down, value 0) as "this card", so copying a "next to X" ability checks Cyber Chop''s neighbors. This is my own call (see decisions.md).'
  'U8-river'   = 'Only tested flipping and keeping a card. When the flip is blocked (Umbra Roundhouse, Life Jab, Flash Jab), the card is not kept. That path is implemented but untested.'
  'U9-check'   = 'Only tested flipping the opponent''s cards. The option to flip your own cards is implemented but untested.'
  'Y1-flash'   = 'Flash Jab is also offered when your own mandatory effects would flip your cards (Cian Hack, Check Hook), which means extra prompts.'
  'Y4-sun'     = 'Ruling applied. It prompts on every discard of one of your cards while it''s in your combo (engage, reset, mass discards), which gets noisy. I added one rule of my own: it only returns your own cards.'
  'Y9-lion'    = 'Ruling applied: only your own discards count. Cards you discard from the opponent''s combo also count as "you discarded".'
  'G4-mantis'  = '"Can''t be moved" blocks only reordering and swapping (Forest Snap, Umbra Cross, Umbra Uppercut). Flips, discards and returns to hand still work. Unclear in the source.'
  'G5-life'    = 'Uses only the left neighbor. The card is always rightmost when it enters, so this matches readings.md.'
  'G6-mantis'  = 'The wording is garbled (readings.md [UNCLEAR]). It''s implemented as an optional reaction whenever the opponent plays a printed 1-4.'
  'G9-forest'  = 'Same "this card" choice as Cyber Chop. Copy cards can''t copy each other.'
  'K2-ink'     = 'Sabotage cards also constrain the opponent''s placement: their next card must match the planted card''s number or color. That follows the placement rules.'
  'K3-umbra'   = '**Doubtful design:** read literally, this card only ever throws itself away when a bigger card is played after it, with no upside even when planted. The implementation matches readings.md, but the designer probably meant something else.'
  'K8-death'   = 'Tested with 2 picks and "Done". The full 5-color case is not tested.'
  'K9-ink'     = '**Doubtful design:** its combo enter discards it at once, so you pay 9 energy for nothing except discard synergies. The "stay in combo" line only matters if it gets into a combo without its combo enter resolving (planted, Leo Wildheart, Ink Uppercut). That matches readings.md [UNCLEAR], but the card is probably not what the designer meant.'
  'C-evelyn'   = 'Only the clash-total part of the reveal is tested. Revealed cards having their abilities switched off (Style, end-of-clash) is implemented but untested.'
  'C-leo'      = 'The deck card is put in face up with no combo enter, as readings.md says. A player might expect it to be "played".'
  'C-victoria' = 'The clash-win "only 1 damage" applies even when Victoria''s player wins by a lot, so it''s a big drawback. That matches the source.'
  'C-dante'    = '5 colors in one combo is only reachable with the dual-colored Black Hooks. The 5-color branch is tested with a hand-built combo.'
  'C-jack'     = 'A pair is checked only against the card on the left, not the whole combo.'
}

$total = $r.total; $pass = $r.pass
$cardTests = @($r.results | Where-Object { $_.card }).Count
$coreTests = $total - $cardTests
$lines = New-Object System.Collections.Generic.List[string]
$cardsPass = 0; $cardsFail = 0
foreach ($color in 'Red', 'Blue', 'Yellow', 'Green', 'Black') {
  $lines.Add("`n### $color`n")
  $lines.Add('| Card | Test | Notes |')
  $lines.Add('|---|---|---|')
  $group = @($cards | Where-Object { $_.color -eq $color -and $_.kind -eq 'character' }) + @($cards | Where-Object { $_.color -eq $color -and $_.kind -eq 'number' })
  foreach ($c in $group) {
    $ok = [bool]$r.perCard.($c.id)
    if ($ok) { $cardsPass++ } else { $cardsFail++ }
    $name = if ($c.kind -eq 'character') { "$($c.name) (character)" } else { "$color $($c.number) $($c.name)" }
    $lines.Add("| $name | $(if ($ok) { 'PASS' } else { '**FAIL**' }) | $($notes[$c.id]) |")
  }
}

$head = @"
# Solo — Test Report

**Result: $pass/$total automated tests pass. Cards with all tests passing: $cardsPass/150 (135 numbered + 15 characters).**
Run them yourself: open ``tests.html`` in a browser, or run ``powershell -ExecutionPolicy Bypass -File tools\run-tests.ps1`` (headless Chrome/Edge). Regenerate this file with ``tools\build-report.ps1``.

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
"@
$footer = "`n`n**Count:** 150 cards listed: $cardsPass PASS, $cardsFail FAIL. Tests: $cardTests card tests (one per card, many with several checks) + $coreTests core-rule tests = $total.`n"
$out = $head + ($lines -join "`n") + $footer
[IO.File]::WriteAllText((Join-Path $root 'report.md'), $out, (New-Object Text.UTF8Encoding($false)))
"report.md written: $cardsPass pass, $cardsFail fail, $cardTests card tests, $coreTests core tests"
