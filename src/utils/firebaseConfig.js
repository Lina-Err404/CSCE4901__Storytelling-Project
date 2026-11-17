import { getApp, getApps, initializeApp } from "firebase/app"
import config from "../app/Login_Signup_Backend/firebase-config"

// Share the authenticated application; never initialize a second default project.
const app = getApps().length ? getApp() : initializeApp({ ...config, projectId: config.projectId || "demo-storytelling" })
export default app
