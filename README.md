# CSCE4901
Storytelling project

## Local development

Run `npm run dev` to start the Next.js app, Express API with Socket.IO, and the Firestore emulator. The app is available at `http://localhost:3000`; the API health endpoint is `http://localhost:4000/health`. The Firestore emulator requires Java and listens on port 8080.

The teacher dashboard creates a default class when needed. Import a roster CSV with the header `studentId,name`, then create a lobby to generate a join code. The local server currently uses the `x-teacher-id` development stub; it is not authentication and must be replaced before deployment. Production API startup requires a `JWT_SECRET` of at least 32 characters and Firebase Application Default Credentials.
