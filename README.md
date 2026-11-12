# Grimoire

A browser-based chess application for local two-player games and opening
practice using your own saved games.

Built with Angular, TypeScript, SCSS, [chess.js](https://github.com/jhlywa/chess.js),
Firebase Authentication, and Firebase Realtime Database.

## Features

- Email/password registration, login, restored sessions, and logout.
- Guest access without an account, limited to games against Stockfish without
  saving games or accessing the library.
- Responsive chessboard with coordinates on all four sides and classic Unicode
  pieces rendered by the system's symbol font.
- Click-to-move controls, legal destination highlights, and SAN move notation.
- Castling, en passant, promotion, check, checkmate, and draw detection.
- Animated piece movement and a reversible board perspective.
- Opening names and ECO codes beneath the board, using a local snapshot of
  [Lichess chess-openings](https://github.com/lichess-org/chess-openings).
  Names are in English. The latest known opening is retained as play continues;
  replay and training only use positions already reached. No positions are sent
  to Lichess. The data is dedicated to the public domain under CC0.
- Local Stockfish analysis with up to three candidate lines and games against
  the engine as White or Black.
- Personal folders containing games saved as PGN text in Firebase.
- Step-by-step replay and randomized folder training for either color.
- Individual game deletion with confirmation.

## Local setup

Use a Node.js release supported by Angular 21 and npm. The package manager
declared in [package.json](./package.json) is npm 11.9.0.

```bash
npm ci
npm start
```

The development server opens at `http://localhost:4200/`. Configure Firebase
before registering an account or using saved games.

### Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the development server and open the browser |
| `npm run build` | Create the production build in `dist/grimoire/` |
| `npm run watch` | Rebuild the development configuration on changes |
| `npm test` | Run unit tests in watch mode |
| `npm test -- --watch=false` | Run unit tests once |

Tests use Vitest through the Angular unit-test builder. To test the chessboard
and its supporting logic only:

```bash
npx ng test --watch=false --include "src/app/shared/components/play-ground/*.spec.ts"
```

No end-to-end test runner is configured. Mocked Firebase tests do not verify
deployed database permissions or live connectivity.

To regenerate the opening data, update the pinned revision in
`scripts/update-openings.mjs` and run `node scripts/update-openings.mjs`.

## Firebase setup

### Authentication and project configuration

The login and registration fields accept at most 42 characters. After trimming
leading and trailing whitespace, a registration name must be 4–42 ASCII letters,
digits, or underscores. Names preserve their spelling but are unique without
regard to ASCII letter case. Existing accounts with longer email addresses or
passwords cannot sign in through this form.

The Firebase web configuration is in
[auth.ts](./src/app/shared/services/auth.ts). When using your own Firebase
project, replace it with that project's web app configuration.

1. In Firebase Console, enable **Authentication > Sign-in method >
   Email/Password**.
2. Under **Authentication > Settings > Authorized domains**, add your deployment
   domain and `localhost` if needed.
3. Create or select a **Realtime Database** and ensure its URL matches
   `databaseURL` in the web configuration.
4. Review and publish the database rules described below.
5. Before public launch, configure password policy, email enumeration
   protection, appropriate quotas, and any applicable App Check protection.

Registration creates the Firebase Auth account, sets its display name, and
atomically creates both the profile and a lowercase username reservation in
Realtime Database. Firebase rules enforce the reservation and its ownership.
The database profile, not Firebase Auth's separately editable display name, is
the authoritative name displayed by the app. If profile creation fails, the
app attempts to remove the new Auth account and any committed profile; rollback
failures are explicitly reported.
After successful account/profile creation, the app requests an English-language
verification email using Firebase's configured template and hosted action handler.
Check the English template in Firebase Authentication before deployment.
Authorize `grimoire.julian-hergert.de` in Firebase Authentication for the return
URL. If sending fails, the account remains available and an explicit error is
shown. Unverified users can resend the email from the main menu. Verification
is required for signed-in gameplay and library access. **I have verified**
reloads the user and forces an ID token refresh before unlocking these features.
Unverified users can still resend mail, sign out, or delete their account in
Settings; guest access is unchanged. Once published, the supplied database rules
also require verified email for reading or saving library data. Existing accounts
with unverified email must verify as well.
Passwords are sent to Firebase Authentication, never stored in the application's
Realtime Database. Firebase Analytics is not initialized.

### Database rules

The complete rules for profiles and saved games are in
[database.rules.json](./database.rules.json).

**These rules are not deployed automatically.** In Firebase Console, open
**Realtime Database > Rules**, merge them with any existing application rules,
and publish. Do not retain public read/write grants at the root or other
ancestors: parent grants cannot be restricted by child rules.

The supplied rules:

- Allow signed-in users to access only their own profile.
- Enforce immutable profiles and case-insensitive username reservations created
  and removed together. Authenticated users can read an individual reservation
  to distinguish an occupied name from another registration failure; they
  cannot list all reservations. This permits guessing individual names.
- Require the owner's `auth.token.email_verified === true` for reading or
  creating/updating game-library data.
- Allow owners to delete their library data even before email verification,
  so account deletion remains possible. Profile creation and deletion also
  remain possible before verification.
- Validate folder names, game names, and PGN field sizes.
- Reject unexpected fields in the documented records.

After publishing, verify with two accounts that one cannot access the other's
data, and that unauthenticated access is denied. Also test an unverified account:
profile creation must succeed, library reads and writes must fail, and deleting
its own profile and library together must succeed. After email verification and
**I have verified** (forced token refresh), library reads and writes must succeed.
Do not grant broader read/write access at parent paths to work around failures.
A `PERMISSION_DENIED` error
when opening the library or creating a folder commonly means the `gameLibrary`
rules have not been published or do not match the signed-in user.

### Migrating existing usernames

**Do not publish the new app or rules against existing accounts before this
migration.** Existing profiles are not automatically reserved. The new rules
require each profile to have a matching reservation, including for account
deletion. Old clients cannot create or delete profiles under the new rules.

1. Schedule maintenance and prevent registration and profile/account changes
   for the entire migration. Back up the database and existing rules securely.
   Ensure no old clients can write while the export and import are in progress.
2. With the Firebase CLI authenticated to the correct project, export the
   `/users` node to a private local file:

   ```powershell
   firebase database:get /users --project grimoire-base --output C:\private\users-export.json
   ```

3. Generate an index in a new file:

   ```powershell
   node scripts\prepare-username-index.mjs C:\private\users-export.json C:\private\username-index.json
   ```

   The script refuses invalid names and duplicates, including names differing
   only in case. Resolve each reported conflict with the affected users, update
   their profiles, export again, and rerun. Names with spaces, non-ASCII
   characters, or other unsupported characters must also be changed. Do not
   discard or merge accounts. The output contains user IDs; keep both files
   private and remove them securely when no longer needed. Replace `C:\private`
   with an existing private directory outside the repository.
4. Confirm `/usernames` is empty and that the export still matches the live
   `/users` data. Import the generated object **only at `/usernames`**, never at
   the database root. `database:set` replaces the selected node:

   ```powershell
   firebase database:set /usernames C:\private\username-index.json --project grimoire-base
   ```

5. Publish the new database rules and deploy the new app while maintenance is
   still active. Verify the reservations against the current profiles, then
   test registration, duplicate rejection, sign-in and deletion with disposable
   accounts before reopening. Do not allow old clients to continue registering.
   The migration and deployment are administrative steps; the app does not
   perform them automatically.

To test the checked-in rules locally, install Firebase CLI and a Java version
supported by that CLI, then run:

```powershell
firebase emulators:exec --only database --project demo-grimoire "node scripts\test-username-rules.mjs"
```

### Data layout

```text
users/
  {uid}/
    username

usernames/
  {lowercase-username}: {uid}

gameLibrary/
  {uid}/
    folders/
      {folderId}/
        name
        games/
          {gameId}/
            name
            pgn
```

Folders are logical database records, not Firebase Storage directories. PGNs
are stored as text, not uploaded `.pgn` files. Names accept 1 to 100 characters;
PGN text is limited to 100,000 characters.

### Public API key

Firebase web API keys identify the project; they are not Admin SDK credentials
or a replacement for authorization. They are necessarily visible in client
code, including when supplied through build-time environment variables.

In Google Cloud Console under **APIs & Services > Credentials**, verify that the
Firebase browser key allows only the required Firebase-related APIs. Do not
allow Gemini Developer API / Generative Language API or unrelated services on
this public key; use separate, appropriately protected keys for those services.

Only after verifying the key's purpose and restrictions should a GitHub
secret-scanning alert for the public Firebase web key be closed as a false
positive. Private keys and service-account credentials must never be shipped to
the browser or committed.

See [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys).
Data access is enforced by Firebase Security Rules, not by hiding the web key.

## Playing chess

After signing in, select **Play**. White moves first.

1. Click a piece to select it and show its legal destinations.
2. Click a destination to move or capture.
3. Click the selected piece again to deselect it.

Moves appear below the board in standard algebraic notation (SAN), grouped by
move number with White and Black columns.

| Control | Behavior |
| --- | --- |
| **Flip board** | Switch perspective, coordinates, and animation direction without changing the game |
| **New game** | Immediately reset the position and move list |
| **Save game** | Open the library to name the game and choose a folder |
| **Menu** | Leave the board; unsaved progress is discarded |
| **Log Out** | Sign out and return to the login form |

Promotion offers queen, rook, bishop, and knight. Cancel returns to the board
without making the promotion move. Piece movement is animated, including both
pieces during castling. Reduced-motion preferences disable animations.

`chess.js` validates legal moves and king safety. The status reports check,
checkmate, stalemate, insufficient material, threefold repetition, and the
fifty-move rule. In this casual mode, threefold repetition and fifty moves end
the game automatically rather than requiring a draw claim.

## Saving, replaying, and deleting games

Open **Saved games** from the menu to create named folders and browse their
games. You can also create a folder from the **Save game** screen.

To save a game:

1. Make at least one move and select **Save game**.
2. Enter a game name and select a folder.
3. Select **Save PGN** and wait for confirmation.

Opening the save screen preserves the current board while you choose a folder.
Saving creates a new entry; it does not overwrite an existing game.

Expand a folder and select a game's **Replay** button. Use **Start**,
**Previous**, **Next**, and **End** to navigate the saved positions. Replay does
not modify the PGN.

The trash button beside each game asks for confirmation before permanently
deleting that game's record from Firebase. The folder and other games remain.
If deletion fails, the game stays listed and an error is displayed.

## Folder training

Expand a folder, select **Practise folder**, then choose **Train White** or
**Train Black**.

- Games are shuffled, with each game practised once per round.
- You play the chosen color; opponent moves follow the PGN automatically.
- Only the exact recorded move is accepted. A different move leaves the
  position unchanged and counts as a mistake, not a judgement of chess quality.
- Game names, notation, and legal destination dots remain hidden.
- **Hint** highlights the piece to move.
- **Show move** reveals the expected SAN; **Play shown move** executes it.
- Progress, mistakes, hints, and revealed moves are counted for the round.
- **Next game** advances after completion; **Restart round** reshuffles and
  clears scores.

Each PGN must contain at least one move for the chosen color. Invalid or
untrainable games are reported explicitly, not silently skipped.

Training never changes saved PGNs. Scores are held only in memory.

## Stockfish analysis and opponent

Choose **Create** in the main menu for manual two-player play and analysis.
Analysis starts automatically in Create and stays enabled, including after
moves and restarts. Its toggle is disabled in this mode.
Computer play is available only through the separate **Play against Stockfish**
menu button. A modal overlay asks you to choose **Play as White** or
**Play as Black** before the board accepts moves. **Back** or Escape returns to
the menu. Stockfish makes the opening move when you choose Black.
Returning to the menu and choosing Create removes the computer-play controls.

The separate Stockfish panel below the board offers:

- **Analyse position** (magnifying-glass PNG button, below the board): evaluation from White's perspective, search depth, and
  the best line in SAN, displayed to the right of the button. Replay positions can also be analysed. During an engine
  game, this button toggles analysis without leaving opponent mode, including
  analysis on your own turn.
- **Play as White / Play as Black** (in the initial overlay): starts a game against Stockfish and
  orients the board towards your side. The board is locked during engine turns.
  An already enabled analysis remains enabled.

To leave a computer game, return to the menu. Restarting an engine game keeps
the chosen side. There is no separate Engine off button.

The side-selection dialog offers strength levels 1–10 (default 5), mapped to
Stockfish Skill Level 0–20 using `round((level - 1) * 20 / 9)`.
Restarting keeps the selected strength. These levels are not calibrated Elo ratings.
Analysis and engine moves use a one-second search. Analysis always uses Skill Level 20;
when analysing during an opponent turn, a separate local worker keeps the analysis
independent of the opponent's selected strength.
Analysis never plays moves automatically and is unavailable during folder training.
Loading/search errors are displayed with a retry option.

Stockfish.js 19.0.1 runs locally in a lazily created Web Worker. No chess
positions are sent to an engine server. The lite, single-threaded WebAssembly
build is used; cross-origin isolation headers are not required.
Angular copies only its JavaScript, WebAssembly, and GPL license from the
installed package to `stockfish/`. Serve `.js` as JavaScript and `.wasm` as
`application/wasm`, including when deploying under a base path.
After installing Stockfish or changing the Angular asset configuration, restart
the development server. An already running server may return a HTML 404 page
for the worker, which browsers report as a blocked `text/html` MIME type.

Stockfish is GPL-3.0 software. The panel links to the distributed license and
the [corresponding Stockfish.js source](https://github.com/nmrugg/stockfish.js/tree/v19.0.1).
Preserve these notices and comply with the GPL distribution/source requirements
when deploying or redistributing the engine.

## Current limitations

- No online multiplayer or chess clock.
- Unsaved games and training rounds reset on reload or logout.
- No PGN file import/export interface, folder deletion, or folder renaming.
- No alternative-move evaluation in training; only the saved line is accepted.
- Board symbols can look different across operating systems.

## Deployment and legal notices

The login, sign-up and signed-in menu provide links to the legal pages. There
is no shared legal footer in the game or guest views.

Build with `npm run build` and serve the generated browser assets from
`dist/grimoire/browser/`. Configure the web host to return Angular's
`index.html` for client routes, including direct visits to `/impressum` and
`/datenschutz`.

The public legal pages in [legal.html](./src/app/pages/legal/legal.html) are
**unfinished, legally unreviewed English translations**, not a guarantee of legal compliance.
Do not publish them as final notices.

Before public operation:

- Replace all bracketed placeholders and verify operator/contact information.
- Confirm hosting arrangements, logs, retention, Google contractual entities,
  international transfers, processing agreements, legal bases, and browser storage.
- Obtain appropriate legal review.
- Complete and verify the Firebase security configuration and deployed rules.

Account data is retained until account deletion, without automatic inactivity
deletion. In the signed-in main menu, **Settings > Delete account** requires confirmation
using the current password. After Firebase reauthentication, a single database
update removes `/users/{uid}`, its `/usernames/{lowercase-username}` reservation,
and `/gameLibrary/{uid}`, then the Firebase Auth
account is deleted. These operations are not atomic across services: if Auth
deletion fails, the already deleted games cannot be restored; an explicit error
asks the user to retry or contact support. Database deletion failures leave the
Auth account intact. Signing out deletes none of these records. Provider logs
and backup retention require separate verification. Test the flow against
deployed Firebase rules with a disposable account before launch.

## Project map

HTML templates use the Angular parser and formatting rules in `.prettierrc`.
Repeated view conditions use local `@let` bindings; gameplay and engine logic
remain in their components and sessions. The library uses `[hidden]` on the
mounted playground to preserve the current game while saving. The custom button
uses its external template to project content into the existing native button.

| Location | Responsibility |
| --- | --- |
| [play-ground/](./src/app/shared/components/play-ground/) | Playground coordinator, chessboard and controls, local game/replay/training sessions, and board animations |
| [game-library/](./src/app/shared/components/game-library/) | Folder browser, save forms, and deletion confirmation |
| [login-overlay/](./src/app/shared/components/login-overlay/) | Authentication forms and navigation between menu, library, and board |
| [menu-overlay/](./src/app/shared/components/menu-overlay/) | Signed-in menu |
| [services/](./src/app/shared/services/) | Firebase authentication and game-library access |
| [legal/](./src/app/pages/legal/) | Public legal page drafts |
| [database.rules.json](./database.rules.json) | Realtime Database access and validation rules |
