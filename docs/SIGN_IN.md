# Setting up Sign in with Google and Apple

The code is complete and tested against a simulated provider. To turn it on
you need credentials from Google and Apple. Only the account owner can
create these. Each button appears automatically once its variables are set.

Callback URLs (replace with your public origin):

- Google: `https://YOUR_HOST/api/auth/oauth/google/callback`
- Apple:  `https://YOUR_HOST/api/auth/oauth/apple/callback`

For local development with Google, use `http://localhost:5174/api/auth/oauth/google/callback`.
Apple does not accept `localhost` or plain `http`; test Apple on a deployed
HTTPS host, or through a tunnel such as `cloudflared` or `ngrok`, and set
`OAUTH_REDIRECT_BASE` to the tunnel URL.

## Google (about 10 minutes, free)

1. Go to <https://console.cloud.google.com/> and create or select a project.
2. Open **APIs & Services → OAuth consent screen**. Choose **External**, fill
   in the app name (SealChain), support email and logo, and add the scopes
   `openid`, `email` and `profile`. While testing, add your own Google
   accounts as test users.
3. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   Choose type **Web application**. Under **Authorised redirect URIs**, add the
   Google callback URL above.
4. Put the client ID and secret in the environment:
   ```
   GOOGLE_CLIENT_ID=….apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=…
   ```
5. Restart the API. "Continue with Google" appears on the sign-in page.

## Apple (needs an Apple Developer account, USD 99/year)

1. Go to <https://developer.apple.com/account/resources/identifiers>.
2. Create an **App ID** with **Sign in with Apple** enabled. This is the
   primary app ID.
3. Create a **Services ID**, e.g. `com.yourcompany.sealchain.web`. Enable
   **Sign in with Apple**, click **Configure**, choose the App ID from step 2,
   add your domain, and add the Apple callback URL above as a **Return URL**.
   Apple verifies the domain.
4. Under **Keys**, create a key with **Sign in with Apple** enabled, linked to
   the same App ID. Download the `.p8` file; it can only be downloaded once.
   Note the **Key ID**.
5. Your **Team ID** is shown at the top right of the developer portal.
6. Put these in the environment. The private key can be pasted with `\n` for
   line breaks.
   ```
   APPLE_CLIENT_ID=com.yourcompany.sealchain.web   # the Services ID, not the App ID
   APPLE_TEAM_ID=ABCDE12345
   APPLE_KEY_ID=XYZ987654A
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT…\n-----END PRIVATE KEY-----"
   ```
7. Restart the API.

Apple may hide the user's email behind a private relay address
(`…@privaterelay.appleid.com`). To email those users (invites, password
resets), register your sending domain under **Services → Sign in with Apple
for Email Communication**.

## How accounts are matched

| Situation | What happens |
|---|---|
| This Google or Apple account signed in before | Signed in |
| Accepting an invitation | Joins the team, but only if the verified email equals the invited email |
| A SealChain account with the same **verified** email exists | The provider is linked to that account, then the user is signed in |
| New person | Asked for their business name, then an organisation is created with them as owner |
| Signed in and clicking **Connect** under Team → Sign-in methods | Linked to the current account, even if the email differs |

Unverified provider emails are never used to link accounts. An account can
always sign in some way: the last sign-in method cannot be disconnected
without first setting a password.
