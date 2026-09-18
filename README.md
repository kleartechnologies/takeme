# TAKEME — Phase 2.5

TAKEME is a mobile-first peer-to-peer marketplace for Malaysia. Phase 2.5 keeps the verified Firebase marketplace architecture and integrates the supplied official app icon, mascot system, green color palette, Poppins typography, and brand messaging.

Payments, checkout, auctions, bidding, messaging, reviews, and paid placements are intentionally not implemented.

## Brand system

- Primary statement: **Same Stuff. A Brighter Tomorrow.**
- Supporting message: **Buy. Sell. Give. Reuse.**
- Primary Green: `#00C853`
- Dark Green: `#006233`
- Light Green: `#E8F5E9`
- Charcoal: `#1F2937`
- Gray: `#6B7280`
- Off White: `#FAFAFA`
- Typography: Poppins, self-hosted by `next/font`

Supplied brand files are copied into `public/brand/`. The 2D mascots are used for normal product states; only the 3D Happy mascot is used in the homepage hero. Unused mascots are not loaded by the application.

The supplied source folders did not include a standalone TAKEME logo/wordmark file. Until that asset is provided, navigation and authentication use the unmodified official app icon as the brand mark rather than recreating a wordmark in text.

## Included

- Email/password and optional Google authentication
- Real Firestore `listings/{listingId}` records
- User-scoped Cloud Storage uploads
- Client-side image validation and WebP resizing to a maximum 1600 px edge
- Automatic cleanup of newly uploaded files if create/update fails
- Paginated public marketplace queries with filters and sorting
- Firestore-native title prefix/word search
- Listing galleries and public seller profiles
- My Listings dashboard, owner-only editing, and safe `status = removed` deactivation
- Loading, empty, setup, not-found, error, and unauthorized states
- Firestore and Storage rules plus composite indexes

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Firebase configuration, TAKEME displays an explicit setup state and never substitutes demo inventory.

## Firebase configuration

1. Create a Firebase project and Web app.
2. Enable Email/Password in Authentication → Sign-in method.
3. Optionally enable Google and set its support email.
4. Create Cloud Firestore and Cloud Storage.
5. Add the Firebase web values to `.env.local`:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

6. Select the project and deploy the rules and indexes:

```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,storage
```

7. Add `localhost` and the deployed Vercel domain to Authentication → Settings → Authorized domains.

Firebase web configuration is public client configuration. Authorization is enforced by the supplied rules; never add Admin SDK or service-account credentials to the browser.

## Public profile migration

Seller pages read `users/{uid}` publicly, so those documents contain only:

- `uid`
- `displayName`
- `photoURL`
- `location`
- `createdAt`
- `updatedAt`

Phase 1 profiles may contain `email` or `role`. Before making an existing database public, remove those fields or have each user log in once with the Phase 2 build, which rewrites their profile to the safe public shape. Admin authorization uses only a trusted `admin: true` custom claim, never a client-editable role field.

## Search behavior

Firestore does not provide full-text search. Phase 2 stores bounded prefixes for the title and supports one title word/prefix query at a time. Category, condition, exact-location, price, and sorting queries are paginated and do not fetch the whole collection. While title search is active, category, condition, and location facets are paused; price and sorting remain available.

This is an intentional Phase 2 limitation. A dedicated search service can be introduced later when requirements justify it.

## Local Firebase emulators

The client supports Auth, Firestore, and Storage emulators. Install Java and Firebase CLI, set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, then run:

```bash
firebase emulators:start --project demo-takeme
npm run dev
```

Configured ports are Auth `9099`, Firestore `8080`, Storage `9199`, and Emulator UI `4000`.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Project structure

```text
src/app/                     Routes and route-level states
src/components/forms/        Publish and edit flows
src/components/listings/     Marketplace, cards, and detail UI
src/components/profile/      Seller and My Listings views
src/lib/firebase/            Firebase client and authentication
src/lib/services/            Firestore and Storage repositories
src/lib/listing-validation.ts Shared validation and query metadata
src/types/                   Marketplace domain models
public/brand/                Official app icon and mascot artwork
firestore.rules              Field validation and owner authorization
storage.rules                User/listing-scoped image authorization
firestore.indexes.json       Marketplace query indexes
```

## Vercel

Import the repository into Vercel and add the six `NEXT_PUBLIC_FIREBASE_*` variables. Keep `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` in deployed environments. `NEXT_PUBLIC_SITE_URL` is optional on Vercel because `VERCEL_PROJECT_PRODUCTION_URL` is used automatically; set it explicitly for custom domains when needed.
