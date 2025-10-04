# Smart Attender — student app

The student companion app powers QR + face-assisted attendance for Smart Attender deployments. It uses Expo Router, Firebase Authentication, and Firestore-backed data with a local face embedding cache.

## Prerequisites

- Node.js 20+
- `npm` (recommended) or `bun`
- Expo CLI (`npm install -g expo-cli`) for local development
- A Firebase project with Email/Password auth enabled (optional in demo mode)

## Getting started

1. Install dependencies

   ```fish
   cd smart-attender-student
   npm install
   ```

2. Configure environment variables by copying `.env.example` to `.env` and setting the Firebase keys (`EXPO_PUBLIC_FIREBASE_*`). Leaving them blank keeps the app in demo mode with mocked data/auth.

3. Start the development server

   ```fish
   npm run start
   ```

   Use the Expo Dev Tools UI or CLI prompts to open the iOS simulator, Android emulator, or Expo Go.

## Connecting the app to your Firebase project

The app ships in demo mode by default. Follow these steps to persist auth and profile data in your own Firebase project:

1. **Create a Firebase project** — Visit the [Firebase console](https://console.firebase.google.com/), create a new project (or reuse an existing one), and enable the Email/Password sign-in method under **Build → Authentication → Sign-in method**.
2. **Register the Expo app** — Add a new **Web** app in the project settings and copy the config snippet. Paste the values into `.env` (or `.env.local`) so the `EXPO_PUBLIC_FIREBASE_*` keys match your project credentials.
3. **Provision Firestore** — From **Build → Firestore**, create a Cloud Firestore database. Production mode is recommended; the repository includes security rules that restrict students to their own document.
4. **Deploy the provided rules** — Install the Firebase CLI if needed (`npm install -g firebase-tools`), authenticate, and deploy the rules from the repo root:

   ```fish
   cd ..  # jump to the repo root where firebase.json lives
   firebase login
   firebase use --add <your-project-id>
   firebase deploy --only firestore:rules
   ```

   The CLI reads `firebase/firestore.rules`, which now grants each authenticated student read/write access to `students/{uid}` while keeping other collections locked down.
5. **Restart Expo** — Stop the development server so the updated environment variables take effect, then relaunch with `npm run start`.

## Authentication flow

- When Firebase credentials are supplied, the app boots the real authentication provider. Users are prompted to sign in before accessing the tab navigator. Sign-in, sign-out, and password reset actions proxy the Firebase Auth SDK.
- In demo mode (no Firebase config), the app now shows a “Demo mode active” landing card. Continue to explore the mock experience, or add Firebase keys and restart to unlock real sign-in.

Every successful sign-in also calls `ensureStudentProfile`, which creates or updates the Firestore document at `students/{uid}` with the latest display name, email, and photo. This profile acts as the identity anchor for attendance logs and face samples.

### First-time onboarding

Immediately after a successful sign-in (real or demo), students complete a quick onboarding flow before the tab navigator unlocks:

1. **Profile details** — Students confirm their preferred name and student number. These values populate the `students/{uid}` document.
2. **Face enrolment** — A guided front-camera capture stores a baseline of face samples (defaults to 3) under the shared `__profile__` collection in AsyncStorage. Metadata (name, email, student number) travels with the embeddings for future syncs, and students see real-time progress as they capture each sample.

Once both steps are complete, `faceEnrollmentComplete` is stamped on the profile and the check-in tab can reuse the saved embedding as a fallback for new classes. Clearing local samples or resetting the profile triggers the onboarding flow again on the next launch.

## Face embeddings and identity persistence

- Face captures are analysed in `services/face-recognition.ts` using a TensorFlow.js MediaPipe FaceMesh model (via `@tensorflow/tfjs-react-native`). Each capture stores the derived embedding, a base64 thumbnail preview, and the associated student metadata in AsyncStorage (`smart-attender-face-model/v2`).
- The dataset keeps up to 10 samples per student/class pairing and maintains a local `students` map so profile updates (display name, email, student number) travel with the embeddings.
- The check-in flow surfaces how many samples are on file before capturing, reinforces the active account, and records the verification result alongside the attendance log. If no class-specific samples exist yet, the system seeds the class with the profile enrolment samples to keep verification frictionless.

### Pre-seeding the local dataset with demo students

If you need ready-made identities for a demo or test lab, you can bundle up to four sample faces in `assets/seed-faces/` and let the app preload them into the on-device dataset.

1. Replace the placeholder PNGs (`student-01.png` … `student-04.png`) with real portrait photos. Aim for bright, front-facing images cropped roughly to the head and shoulders. Keep the filenames intact so Metro can resolve them.
2. Update `constants/seed-students.ts` with the real student metadata (IDs, names, student numbers, email addresses). You can add multiple images per student by appending to the `samples` array.
3. Opt in to seeding by setting `EXPO_PUBLIC_ENABLE_FACE_SEEDS=true` (or `1`) in your `.env`/`.env.local` file.
4. Relaunch the Expo app. On the first run, the seeder stores the embeddings and profile metadata for each configured student. Subsequent launches skip any student that already has enough samples, so you can safely leave the toggle on.

> **Note:** The bundled assets are only used to populate the local AsyncStorage dataset. To mirror the same students in Firestore, run a server-side import or call the existing student-profile helpers with your chosen IDs.

> ℹ️ **Native modules:** The TensorFlow integration requires `expo-gl`, `expo-file-system`, `@tensorflow/tfjs`, `@tensorflow/tfjs-react-native`, and `@tensorflow-models/face-landmarks-detection`. These are already listed in `package.json`; if you clone the repo fresh, run

```fish
cd smart-attender-student
npx expo install expo-gl expo-file-system @tensorflow-models/face-landmarks-detection @tensorflow/tfjs @tensorflow/tfjs-react-native
```

to ensure compatible native binaries are installed.

## Backend sync strategy

Local storage keeps face data available offline, but production deployments should mirror it to the backend for auditability and cross-device verification. The recommended approach:

1. **Trigger points** — On every successful `analyzeAndStoreFaceSample` run, enqueue a sync job containing the student ID, class ID, embedding, and thumbnail. AsyncStorage can hold a `pendingSync` array alongside the dataset.
2. **Sync worker** — A background task (e.g., on app launch, check-in completion, or periodic timer) uploads pending jobs to Firestore/Cloud Storage:
   - Store embeddings in `students/{uid}/faceSamples/{classId}` with metadata and capture timestamps.
   - Upload thumbnail previews to Cloud Storage if you need richer moderation/auditing.
   - Mark jobs complete locally to avoid replays.
3. **Server-side review** — Back-office tooling can compare vectors server-side, approve/reject samples, or propagate them to more advanced ML services.
4. **Privacy controls** — Respect platform policies by encrypting sensitive payloads, offering a “clear my face data” option (the app already exposes `clearSamplesForStudent`), and retaining the minimum number of samples needed for verification.

Until the sync worker is implemented, all embeddings remain on-device and scoped per authenticated student ID.

## Useful scripts

- `npm run start` — launch Expo
- `npm run lint` — run ESLint via `expo lint`
- `npm run android` / `npm run ios` / `npm run web` — platform-specific Expo entry points

## Troubleshooting

- **Missing Firebase config**: The app will fall back to mock mode and skip sign-in. An in-app banner now lists the missing keys and reminds you that auth, profiles, and attendance are not persisted. Add the `EXPO_PUBLIC_FIREBASE_*` values and restart to enable real auth.
- **Face capture issues**: Ensure camera and location permissions are granted; re-enrol under better lighting to improve verification scores.
- **Clearing local data**: Use the debug menu or call `clearSamplesForStudent` during development to reset cached embeddings.
