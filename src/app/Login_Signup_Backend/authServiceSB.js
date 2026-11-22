"use client";

import { supabase } from "./supabase-client";

// Use Supabase to sign up the user
// Accepts email, password, first name, last name, and preferences from user input and returns the user data
export async function signUp(emailInput, passwordInput, firstName = "", lastName = "", preferences = {}) {
  const { data, error } = await supabase.auth.signUp({
    email: emailInput,
    password: passwordInput,
    first_name: firstName,
    last_name: lastName,
    preferences: preferences, // Add preferences to the sign-up data
    // Need to verify extra metadata fields are supported by Supabase. 
    // If not, consider storing them in a separate table after sign-up.
  })
  return data;
} // End of signUp function

// User sign in to Supabase
// Accepts email and password from user input and returns the user data
export async function logIn(emailInput, passwordInput) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput,
    password: passwordInput,
  })
  return data;
} // End of logIn function


// reset password in Supabase, CURRENTLY NOT USED BUT HERE FOR FUTURE IMPLEMENTATION
// Accepts a new password from user input and updates old Supabase password
export async function resetPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  return data;
} // End of resetPassword function
