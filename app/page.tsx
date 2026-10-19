"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CoverBook, CoverFrame } from "@/components/auth/CoverArtwork";

type AuthView =
  | "roleSelection"
  | "teacherLogin"
  | "teacherSignup"
  | "studentLogin";

function updateFormValidity(form: HTMLFormElement) {
  // Keep native required/email checks and reject blank names or usernames.
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type="text"]')) {
    input.setCustomValidity(
      input.value.length > 0 && !input.value.trim()
        ? "Please enter a value other than spaces."
        : "",
    );
  }

  const password = form.elements.namedItem("password") as HTMLInputElement;
  const confirmation = form.elements.namedItem("confirmPassword") as HTMLInputElement | null;
  if (confirmation) {
    // Compare exactly; never trim or otherwise modify passwords.
    confirmation.setCustomValidity(
      confirmation.value && confirmation.value !== password.value
        ? "Passwords do not match."
        : "",
    );
  }
}

export default function Home() {
  const [view, setView] = useState<AuthView>("roleSelection");
  const [submissionNotice, setSubmissionNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);

  const isInterior = view !== "roleSelection";

  function changeView(nextView: AuthView) {
    hasNavigated.current = true;
    setSubmissionNotice("");
    setView(nextView);
  }

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    setSubmissionNotice("");
    updateFormValidity(event.currentTarget);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionNotice("");
    const form = event.currentTarget;
    // Recheck on submit too, including values supplied by autofill.
    updateFormValidity(form);
    if (!form.reportValidity()) return;

    // Backend integration belongs here after validation. No credentials are sent
    // or stored, and passing frontend validation does not authenticate anyone.
    setSubmissionNotice(
      view === "teacherSignup"
        ? "Account creation is not connected yet. No account was created."
        : "Sign-in is not connected yet. You have not been logged in.",
    );
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
                <span>Email or Username</span>
                <input
                  type="text"
                  name="username"
                  placeholder="Enter your email or username"
                  autoComplete="username"
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
                {submissionNotice || "Frontend preview only. Sign-in is not connected yet."}
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
                {submissionNotice || "Frontend preview only. Account creation is not connected yet."}
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
            className="auth-view student-view"
            aria-labelledby="student-heading"
          >
            <div className="view-heading">
              <h2 id="student-heading" ref={headingRef} tabIndex={-1}>
                Student
              </h2>
              <p>Student sign-in is coming soon.</p>
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
