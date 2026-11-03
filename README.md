# Grimoire

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.20.

## Firebase authentication

The app uses Firebase Authentication (email/password) for credentials and Realtime
Database for `/users/{uid}/username`. Passwords are never stored in the database.
The public web configuration is in `src/app/shared/services/auth.ts`; it is not an
Admin SDK credential. Analytics is not initialized.

Before using the login:

1. Enable **Authentication > Sign-in method > Email/Password** in the Firebase console.
2. Under **Authentication > Settings > Authorized domains**, add your deployment
   domain and `localhost` for local development if needed.
3. Review existing Realtime Database rules before publishing the following rules.
   Do not leave a public read/write grant at the root or at `/users`, as grants
   cascade to child paths.

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['username'])",
        "username": {
          ".validate": "newData.isString() && newData.val().length > 0"
        },
        "$other": {
          ".validate": false
        }
      }
    }
  }
}
```

Registration creates the Auth account, sets its display name, and saves the username.
If saving the profile fails, the new Auth account is deleted so registration can be
retried; rollback failures are explicitly reported. Successful login displays the
menu overlay with the current user and a logout button. Logout returns to the login
form; no separate post-login application route exists yet.
Firebase restores the session on reload. Enable password policy and email
enumeration protection in Firebase before a public launch.

## Legal pages (unfinished drafts)

The login and registration form link to `/impressum` and `/datenschutz`, accessible
without authentication. These are explicitly incomplete German-language drafts
for a private public project hosted at ALL-INKL using Firebase Auth and Realtime
Database. They are not a guarantee of legal compliance.

Before publication, replace every bracketed placeholder in
`src/app/pages/legal/legal.html`. Complete operator/contact details locally, verify
hosting logs and retention, Google contractual entities and international data
transfers, processing agreements, legal bases and browser storage, and obtain a legal
review. The stated account policy is retention until a deletion request, without
automatic inactivity deletion. Deletion requests are handled by email: verify the
requester's authority, then manually delete both the Firebase Auth account and its
`/users/{uid}` profile; signing out does not delete either. Technical retention for
provider logs/backups still needs verification. Processing agreements have not yet
been confirmed; complete that setup before public operation.
Do not publish the drafts as final notices.
Configure the web host to serve Angular's `index.html` for client routes, including
direct visits to `/impressum` and `/datenschutz`.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
