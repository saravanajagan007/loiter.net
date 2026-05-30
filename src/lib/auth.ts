import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import db from "@/lib/db";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      // Create a default organization and workspace for the new user
      await db.organization.create({
        data: {
          name: `${user.name || "User"}'s Org`,
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
    },
  },
  callbacks: {
    async session({ session, user }) {
      // Find the user's primary organization/workspace if needed
      const membership = await db.orgMembership.findFirst({
        where: { userId: user.id },
        include: { organization: { include: { workspaces: true } } },
      });

      if (membership) {
        session.user.orgId = membership.orgId;
        session.user.workspaceId = membership.organization.workspaces[0]?.id;
        session.user.role = membership.role;
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      orgId?: string;
      workspaceId?: string;
      role?: string;
    };
  }
}
