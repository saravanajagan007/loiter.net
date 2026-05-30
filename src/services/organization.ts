import db from "@/lib/db";
import { OrgRole, PlanTier } from "@prisma/client";

export class OrganizationService {
  static async createOrganization(userId: string, name: string) {
    const slug = name.toLowerCase().replace(/ /g, "-").replace(/[^\w-]/g, "");
    
    return await db.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          planTier: PlanTier.FREE,
        },
      });

      // 2. Create Default Workspace
      const workspace = await tx.workspace.create({
        data: {
          orgId: org.id,
          name: "Default Workspace",
          slug: "default",
        },
      });

      // 3. Add User as Owner
      await tx.orgMembership.create({
        data: {
          orgId: org.id,
          userId: userId,
          role: OrgRole.OWNER,
        },
      });

      return { org, workspace };
    });
  }

  static async getOrganizationMembers(orgId: string) {
    return await db.orgMembership.findMany({
      where: { orgId },
      include: { user: true },
    });
  }

  static async addMember(orgId: string, email: string, role: OrgRole = OrgRole.MEMBER) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw new Error("User not found");

    return await db.orgMembership.create({
      data: {
        orgId,
        userId: user.id,
        role,
      },
    });
  }
}
