# Prove Up! Farming the Great Plains

A 30-minute multiplayer class game for US History. Each student group is a homesteading
family trying to "prove up" a claim under the Homestead Act by surviving 5 years
(1884 to 1888) on the Great Plains.

**Play it:** https://ethomasclass.github.io/plainsfarmer/

Nothing to install, no accounts, no student logins. It runs entirely in the browser.

---

## For teachers: running a class game

1. On the projector computer, open the site and click **Run a Class Game**.
   That tab becomes **The Prairie Herald**, the class board. **Keep it open for the whole game**,
   because it *is* the game.
2. The board shows a **5-letter code** and a QR code. Each group opens the site on its own
   computer, clicks **Join a Game**, and types the code (or scans the QR).
3. Pick **Teacher-Paced** or **Self-Paced**, then press **Start**.

| | Teacher-paced | Self-paced |
|---|---|---|
| Chance cards | You draw one card for the whole class | Each group draws its own |
| Seasons | You press the button to move every group forward | Groups click through at their own speed |
| Best for | Whole-class reveals and discussion after each card | Mixed-speed classes, absent-day makeup |

**If something goes wrong**
* A student reloads or their laptop restarts: they open the same link, and they're back in.
  On the join screen, they can also click their group under "Already joined?"
* You reload the board: the game picks up where it left off, and students reconnect on their own.
* **The code won't connect on your school network?** On the board, click
  **Use No-Connection Mode**. Each group plays on its own computer with a 4-digit class code.
  You still reveal each year's chance card on the board, and groups type the **unlock word**
  to see what happened to their farm. Everyone gets the same cards in the same order.
* Students can also click **Practice on My Own** for a solo game.

Test the live code once on your school Wi-Fi before class. Live games connect computers
directly to each other using the free PeerJS service, and some school filters block that.

## The game

* **Families**: the Freemans (Exodusters headed to Nicodemus, Kansas), the Larsens
  (Norwegian immigrants), the O'Briens (Union Army veteran), and Hattie Moore (widow
  homesteader). Each family has a trait.
* **Setup**: free claim out west or railroad land, sod house or lumber house, plus dry farming
  tools, a windmill, or barbed wire. The money only stretches so far.
* **Each year**: plant in spring, face a chance card in summer, sell in the fall, pay the
  bank in winter. Families who come up short can sell bison bones, mortgage their animals,
  or give up.
* **Chance cards** (13) are based on real events: the locust years, the winter of 1886-87,
  the Children's Blizzard, drought, prairie fires, railroad rates, wheat prices, barbed wire,
  and the Dawes Act land openings. How hard a card hits depends on each family's choices.
* **Endings**: Proved Up and Debt-Free, Proved Up but Still in Debt, The Bank Took the Farm,
  or Went Back East. Across thousands of simulated games, roughly 15% / 55% / 30% of families
  land in the first three.

## Editing the game

All rules, numbers, families, and cards live in `engine.js` (`CONFIG`, `CROPS`, `FAMILIES`,
`SETUP`, `CARDS`). The art is placeholder (CSS shapes and emoji) and lives in `style.css`.

| File | What it is |
|---|---|
| `index.html` | Landing page |
| `board.html`, `board.js` | The Prairie Herald class board (hosts the game) |
| `play.html`, `play.js` | Family console for each group |
| `engine.js` | Game rules and content |
| `host.js` | Runs a game inside a browser tab |
| `common.js` | Connections (PeerJS) and shared drawing code |
| `vendor/` | PeerJS (MIT) and qrcode-generator (MIT) |
