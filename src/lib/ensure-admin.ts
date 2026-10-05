import { auth } from "@/lib/auth";

const MEDIQUE_ADMIN_ROLE = "medique admin";

const mediqueAdmins = [
  {
    email: "nixonnova@outlook.com",
    name: "Nixon Nova",
    password: process.env.ADMIN_INITIAL_PASSWORD,
  },
  {
    email: "admin@medique.com",
    name: "Medique Admin",
    password: "M3d1qu31!",
  },
] as const;

export async function ensureAdmin() {
  const context = await auth.$context;
  await context.runMigrations();

  const tenantAdmins = await context.adapter.findMany<{ id: string; role?: string | null; adminId?: string | null }>({
    model: "user",
    where: [{ field: "role", value: "admin" }],
  });

  for (const tenantAdmin of tenantAdmins) {
    if (!tenantAdmin.adminId) {
      await context.adapter.update({
        model: "user",
        where: [{ field: "id", value: tenantAdmin.id }],
        update: { adminId: tenantAdmin.id },
      });
    }
  }

  for (const account of mediqueAdmins) {
    const existing = await context.adapter.findOne<{ id: string; role?: string | null }>({
      model: "user",
      where: [{ field: "email", value: account.email }],
    });

    if (existing) {
      if (existing.role !== MEDIQUE_ADMIN_ROLE) {
        await context.adapter.update({
          model: "user",
          where: [{ field: "id", value: existing.id }],
          update: { role: MEDIQUE_ADMIN_ROLE },
        });
        console.info(`Set ${account.email} to ${MEDIQUE_ADMIN_ROLE}.`);
      }
      continue;
    }

    if (!account.password) {
      console.error(
        `${account.email} is missing. Set ADMIN_INITIAL_PASSWORD and restart to create this Medique admin.`,
      );
      continue;
    }

    await auth.api.createUser({
      body: {
        email: account.email,
        password: account.password,
        name: account.name,
        role: MEDIQUE_ADMIN_ROLE,
      },
    });
    console.info(`Created Medique admin ${account.email}.`);
  }
}
