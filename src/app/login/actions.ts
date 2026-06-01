"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginUser(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return {
      success: false,
      error: "Please enter both email and password.",
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
    
    return {
      success: true,
      error: null,
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return {
        success: false,
        error: "Invalid email or password.",
      };
    }
    
    // Check if it's a Next.js redirect error and rethrow it
    if (error.message === "NEXT_REDIRECT" || error.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    console.error("Login error:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
