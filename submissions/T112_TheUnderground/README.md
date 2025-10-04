# Smart Attender

## Team

- **Team Name:** The Underground
- **Team ID:** T-112

| Member | Role |
| --- | --- |
| Hemanth | Backend architect and developer |
| Vishwaharthaj | Idea and Presentation |
| Akhil reddy | Frontend |
| Satwik | Data analysis on student records |
| Vishnu Prabhas | Designing and presentation |

## Problem Statement

Many educational institutions still depend on manual attendance systems, which are time-consuming and error-prone. Teachers spend a significant portion of class time marking attendance, reducing valuable instructional hours. Additionally, students often wa`ste free periods with unproductive activities due to a lack of structured guidance. This leads to poor time management and reduced alignment with long-term academic or career goals. There is also a gap in personalized learning support during idle classroom hours. Institutions currently lack tools that integrate daily schedules with individual student planning and automated tracking.

## Solution Overview

1. **Session setup:** The teacher portal generates a QR code bound to subject, schedule, and location.
2. **Student check-in:** The mobile app scans the QR code, verifies the trusted device, and gathers GPS coordinates.
3. **Proximity validation:** We calculate the distance between the student and session coordinates and adjust for GPS accuracy.
4. **Attendance logging:** Firestore transactions record the result in both the teacher’s session document and the student’s personal log.
5. **Enrichment:** Students receive short, AI-generated tasks to use their free period productively.

## Tech Stack

- **Mobile:** Expo React Native (TypeScript), Expo SecureStore, geolocation APIs
- **Web:** Next.js 14, Tailwind CSS, React Server Components
- **Backend & Data:** Firebase Auth, Firestore, Firestore security rules, Gemini 2.5 Flash API
- **Tooling:** Bun package manager, Node.js ≥ 18, ESLint & TypeScript

## How to Run the Project

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.2
- Node.js ≥ 18
- Expo CLI (installed globally via `npm install -g expo-cli`)
- Firebase project with Web and Native app credentials

### Environment Variables

1. Copy the provided examples:

	```bash
	cp frontend/.env.example frontend/.env.local
	cp smart-attender-student/.env.example smart-attender-student/.env.local
	```

2. Populate both `.env.local` files with your Firebase keys. Required fields:

	- Frontend: `NEXT_PUBLIC_FIREBASE_*` plus `GEMINI_API_KEY`
	- Student app: `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_TEACHER_API_BASE_URL`, optional `EXPO_PUBLIC_STUDENT_TASKS_ENDPOINT`

3. Create a Gemini API key in Google AI Studio for live task generation (falls back to static ideas if omitted).

### Teacher Web Portal (Next.js)

```bash
cd frontend
bun install
bun run dev
```

Visit `http://localhost:3000` to authenticate and manage sessions. Without Firebase credentials the portal runs in mock mode.

### Student Mobile App (Expo)

```bash
cd smart-attender-student
bun install
bun run android
```

Scan the QR code with an Expo Go client or run on a connected device/emulator. Device registration, proximity checks, and attendance logging require the same Firebase project configured above.

## Special Notes

- Device trust sticks to the first student who registers; anyone else on that hardware is blocked with a clear message.
- We subtract the combined GPS accuracy margin from the distance check so noisy signals don’t trigger false flags.
- Seed scripts depend on Firestore rules being deployed with `firebase deploy --only firestore:rules`.
- Gemini task calls consume your Google Cloud quota—cache or throttle them in production.
- Update the team name, ID, and member table with your final submission details.