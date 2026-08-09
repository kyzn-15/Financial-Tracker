# Financial Tracker mobile

Financial Tracker mobile is a standalone Expo React Native app for quickly recording expenses and receipt photos. It uses the **same API and login** as the existing Financial Tracker website, but it intentionally contains only:

- Sign in / sign out
- Add an expense in MYR or IDR
- Take or choose a receipt image
- Offline saving and automatic sync

It does not change, replace, or depend on changes to the web frontend or backend.

## How it works

When the app can reach the API, an expense or receipt is sent to the existing server immediately.

When it cannot, the app keeps the expense data in device storage and copies the receipt image into the app's private documents folder. A connection listener retries the saved items when the connection returns while the app is open, and also when the app is opened again.

```text
Add expense / receipt
        |
        +-- API available --> existing Financial Tracker API
        |
        +-- offline / request fails --> phone storage --> automatic retry when online
```

Expense conversions are still performed by the existing backend when an item syncs. Receipt uploads follow the server's existing 10 MB image limit and seven-day retention policy.

## Requirements

- Node.js 20 or newer
- An Android phone/emulator, or macOS with an iPhone simulator/device
- A reachable, running Financial Tracker API
- Expo Go on a physical device, or the Android/iOS simulator tooling

## Setup

From the repository root:

```bash
cd mobile
npm install
```

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env
```

Set the two public values in `.env`:

```env
# The existing API origin. Including /api is also supported.
EXPO_PUBLIC_API_URL=https://api.example.com

# An origin that is already allowed by the existing server's CLIENT_ORIGIN.
EXPO_PUBLIC_ALLOWED_ORIGIN=https://app.example.com
```

`EXPO_PUBLIC_ALLOWED_ORIGIN` is not a secret. The mobile app sends it with login, expense, and receipt write requests because the existing server protects those requests with its origin allowlist. It must exactly match one of the existing `CLIENT_ORIGIN` values.

Do not put usernames, PINs, API tokens, or server secrets in this file. Any `EXPO_PUBLIC_` value is bundled into the app.

### Local-device example

For a phone on the same Wi-Fi as the development computer, use the computer's LAN address for the API, not `localhost`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.25:4000
EXPO_PUBLIC_ALLOWED_ORIGIN=http://localhost:5173
```

The allowed origin must already be accepted by the server. Use HTTPS for deployed builds.

## Run the app

Start Expo:

```bash
npm start
```

Then scan the QR code with Expo Go, or use one of these shortcuts:

```bash
npm run android
npm run ios
```

`npm run ios` requires macOS. `npm run web` is available for a browser preview, but the Android or iOS app is the intended experience.

## Using the app

1. Connect to the internet and sign in with the same username and PIN used by the website.
2. Add an expense: choose a category, MYR or IDR, and enter the amount.
3. Take a receipt photo or choose an existing supported image.
4. If the device is offline, the status banner confirms that the item was saved on the phone.
5. Reconnect and keep the app open, or open it again later. Saved items sync automatically.

The first sign-in requires internet access. After a successful sign-in, the app can accept offline entries until the session expires or the user signs out.

## Offline data and limits

- Supported receipts: JPEG, PNG, WebP, HEIC, and HEIF
- Maximum receipt size: 10 MB
- Saved items remain on the device until the API accepts them
- The app retries one queued item at a time, preserving entry order
- Sync runs while the app is open or when it next starts; it does not run while the app is fully closed

The existing API has no idempotency key. In the rare case where the network fails after the server has accepted a request but before the app receives the response, a retry can create a duplicate. Eliminating that edge case requires a server API change, which this mobile app deliberately does not make.

## Verify the project

```bash
npm test
npx expo-doctor
```

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Login or save returns "Request origin is not allowed." | Make `EXPO_PUBLIC_ALLOWED_ORIGIN` exactly match an existing `CLIENT_ORIGIN` value on the server. Restart Expo after editing `.env`. |
| The phone cannot reach the API | Do not use `localhost` for a physical phone. Use the computer's LAN IP or a deployed HTTPS API. |
| Items stay queued | Sign in again if the server session expired, then reopen the app with an internet connection. |
| A receipt cannot be selected | Use a supported image format under 10 MB and grant the requested camera/photo permission. |
