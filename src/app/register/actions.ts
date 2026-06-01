"use server";

import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function registerUser(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const validated = registerSchema.safeParse({ name, email, password });

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0].message,
    };
  }

  try {
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "A user with this email already exists.",
      };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and provision organization/workspace
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      // Create a default organization and workspace for the user
      await tx.organization.create({
        data: {
          name: `${name}'s Org`,
          slug: `org-${user.id.substring(0, 8)}`,
          workspaces: {
            create: {
              name: "Default Workspace",
              slug: "default",
            },
          },
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
    });

    return {
      success: true,
      error: null,
    };
  } catch (error: any) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during registration. Please try again.",
    };
  }
}
