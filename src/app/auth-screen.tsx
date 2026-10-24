"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { CoverBook, CoverFrame } from "@/components/auth/CoverArtwork";
import { logIn, signUp } from "../app/Login_Signup_Backend/authServiceFB";
import { authConfigurationMissing } from "./firebase-client";

type AuthView =
  | "roleSelection"
  | "teacherLogin"
  | "teacherSignup"
  | "studentLogin";

type AuthScreenProps = {
  onAuthenticated?: (user: User, role: "teacher" | "student") => void;
};

function updateFormValidity(form: HTMLFormElement) {
  // Keep native required/email checks and reject blank names or usernames.
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type="text"]')) {
    input.setCustomValidity(
      input.value.length > 0 && !input.value.trim()
        ? "Please enter a value other than spaces."
        : "",
    );
  }

  const password = form.elements.namedItem("password") as HTMLInputElement | null;
  const confirmation = form.elements.namedItem("confirmPassword") as HTMLInputElement | null;
  if (password && confirmation) {
    // Compare exactly; never trim or otherwise modify passwords.
    confirmation.setCustomValidity(
      confirmation.value && confirmation.value !== password.value
        ? "Passwords do not match."
        : "",
    );
  }
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [view, setView] = useState<AuthView>("roleSelection");
  const [creatingStudentAccount, setCreatingStudentAccount] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);

  const isInterior = view !== "roleSelection";

  function changeView(nextView: AuthView) {
    hasNavigated.current = true;
    setSubmissionNotice("");
    setCreatingStudentAccount(false);
    setView(nextView);
  }

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    setSubmissionNotice("");
    updateFormValidity(event.currentTarget);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionNotice("");
    const form = event.currentTarget;
    // Recheck on submit too, including values supplied by autofill.
    updateFormValidity(form);
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();

    try {
      if (view === "teacherSignup") {
        const user = await signUp(email, password, firstName, lastName);
        setSubmissionNotice("Account created.");
        onAuthenticated?.(user, "teacher");
      } else if (view === "teacherLogin") {
        const user = await logIn(email, password);
        setSubmissionNotice("Logged in.");
        onAuthenticated?.(user, "teacher");
      } else if (view === "studentLogin") {
        const user = creatingStudentAccount
          ? await signUp(email, password, firstName, lastName)
          : await logIn(email, password);
        setSubmissionNotice(creatingStudentAccount ? "Account created." : "Logged in.");
        onAuthenticated?.(user, "student");
      }
    } catch (err) {
      setSubmissionNotice(err instanceof Error ? err.message : "Authentication failed.");
    }
  }

  useEffect(() => {
    if (hasNavigated.current) {
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [view]);

  return (
    <main className={`auth-page ${isInterior ? "auth-page-interior" : "storybook-cover"}`}>
      {!isInterior && <CoverFrame />}
      {isInterior && (
        <div className="auth-garden" aria-hidden="true">
          <span className="garden-decoration garden-top-left" />
          <span className="garden-decoration garden-top-right" />
          <span className="garden-decoration garden-bottom-left" />
          <span className="garden-decoration garden-bottom-right" />
          <span className="garden-decoration garden-leaf garden-leaf-left" />
          <span className="garden-decoration garden-leaf garden-leaf-right" />
          <span className="garden-decoration garden-petal garden-petal-left" />
          <span className="garden-decoration garden-petal garden-petal-right" />
          <span className="garden-decoration garden-butterfly" />
          {/* Optional breeze: remove this group to disable the extra effect. */}
          <div className="garden-breeze">
            <span className="breeze-particle breeze-leaf" />
            <span className="breeze-particle breeze-petal" />
          </div>
        </div>
      )}

      <div
        className={`auth-content ${
          isInterior ? "auth-content-interior" : ""
        }`}
      >
        <header className="auth-header">
          {!isInterior && <CoverBook />}
          <h1 className="app-title">
            <span>COLLAB</span>
            <span>STORYTELLING</span>
          </h1>

          <div className="title-divider" aria-hidden="true">
            <span className="divider-line" />
            <span className="divider-symbol">◇</span>
            <span className="divider-line" />
          </div>
        </header>

        {view === "roleSelection" && (
          <section
            className="auth-view role-selection"
            aria-labelledby="role-heading"
          >
            <h2
              id="role-heading"
              className="sr-only"
              ref={headingRef}
              tabIndex={-1}
            >
              Choose your role
            </h2>

            <div className="role-options">
              <button
                type="button"
                className="role-button teacher-button"
                onClick={() => changeView("teacherLogin")}
              >
                Teacher
              </button>

              <button
                type="button"
                className="role-button student-button"
                onClick={() => changeView("studentLogin")}
              >
                Student
              </button>
            </div>
          </section>
        )}

        {view === "teacherLogin" && (
          <section
            className="auth-view form-view login-view"
            aria-labelledby="login-heading"
          >
            <div className="view-heading">
              <h2 id="login-heading" ref={headingRef} tabIndex={-1}>
                Teacher Login
              </h2>
              <p>Welcome back to your storytelling classroom.</p>
            </div>

            <form
              className="auth-form"
              aria-describedby="login-note"
              noValidate
              onInput={handleFormInput}
              onSubmit={handleSubmit}
            >
              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </label>

              <label className="form-field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </label>

              <button
                type="button"
                className="text-button recovery-link"
                disabled
              >
                Forgot password?
                <span className="availability-note">Coming soon</span>
              </button>

              <button
                type="submit"
                className="primary-button"
                aria-describedby="login-note"
              >
                Log In
              </button>
              <p id="login-note" className="form-note" role="status">
                {submissionNotice ||
                  (authConfigurationMissing
                    ? "Set the public Firebase configuration before signing in."
                    : "Sign in with your teacher account to open the host lobby.")}
              </p>
            </form>

            <div className="auth-links">
              <p>
                New here?{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => changeView("teacherSignup")}
                >
                  Create an account
                </button>
              </p>
            </div>

            <button
              type="button"
              className="back-button"
              onClick={() => changeView("roleSelection")}
            >
              ← Choose another role
            </button>
          </section>
        )}

        {view === "teacherSignup" && (
          <section
            className="auth-view form-view signup-view"
            aria-labelledby="signup-heading"
          >
            <div className="view-heading">
              <h2 id="signup-heading" ref={headingRef} tabIndex={-1}>
                Create an Account
              </h2>
              <p>Sign up as a teacher</p>
            </div>

            <form
              className="auth-form signup-form"
              aria-describedby="signup-note"
              noValidate
              onInput={handleFormInput}
              onSubmit={handleSubmit}
            >
              <div className="name-fields">
                <label className="form-field">
                  <span>First Name</span>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="First name"
                    autoComplete="given-name"
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Last Name</span>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last name"
                    autoComplete="family-name"
                    required
                  />
                </label>
              </div>

              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </label>

              <label className="form-field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  placeholder="Create a password"
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="form-field">
                <span>Confirm Password</span>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  required
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                aria-describedby="signup-note"
              >
                Create Account
              </button>
              <p id="signup-note" className="form-note" role="status">
                {submissionNotice ||
                  (authConfigurationMissing
                    ? "Set the public Firebase configuration before creating an account."
                    : "Create your teacher account to host classroom lobbies.")}
              </p>
            </form>

            <div className="auth-links">
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => changeView("teacherLogin")}
                >
                  Log in
                </button>
              </p>
            </div>

            <button
              type="button"
              className="back-button"
              onClick={() => changeView("roleSelection")}
            >
              ← Choose another role
            </button>
          </section>
        )}

        {view === "studentLogin" && (
          <section
            className="auth-view form-view student-view"
            aria-labelledby="student-heading"
          >
            <div className="view-heading">
              <h2 id="student-heading" ref={headingRef} tabIndex={-1}>
                {creatingStudentAccount ? "Create Student Account" : "Student Sign In"}
              </h2>
              <p>Sign in with your student account to join a live class lobby.</p>
            </div>

            <form
              className="auth-form"
              aria-describedby="student-note"
              noValidate
              onInput={handleFormInput}
              onSubmit={handleSubmit}
            >
              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </label>

              <label className="form-field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  placeholder={creatingStudentAccount ? "Create a password" : "Enter your password"}
                  autoComplete={creatingStudentAccount ? "new-password" : "current-password"}
                  minLength={6}
                  required
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                aria-describedby="student-note"
              >
                {creatingStudentAccount ? "Create Student Account" : "Sign In"}
              </button>
              <p id="student-note" className="form-note" role="status">
                {submissionNotice || "Enter your student credentials to join your teacher's lobby."}
              </p>
            </form>

            <div className="auth-links">
              <p>
                {creatingStudentAccount ? "Already have an account? " : "Need a student account? "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setCreatingStudentAccount(!creatingStudentAccount);
                    setSubmissionNotice("");
                  }}
                >
                  {creatingStudentAccount ? "Sign in" : "Register as a student"}
                </button>
              </p>
            </div>

            <button
              type="button"
              className="back-button"
              onClick={() => changeView("roleSelection")}
            >
              ← Choose another role
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
