import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The demo seed is disabled in production");
  }

  const seedPassword = process.env.SEED_DEMO_PASSWORD;
  if (!seedPassword || seedPassword.length < 8) {
    throw new Error("Set SEED_DEMO_PASSWORD to a password of at least 8 characters");
  }

  const demoPasswordHash = await argon2.hash(seedPassword);

  const organization = await prisma.organization.upsert({
    where: {
      slug: "civicfix-campus",
    },
    update: {},
    create: {
      name: "CivicFix Campus",
      slug: "civicfix-campus",
    },
  });

  const ictTeam = await prisma.team.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000001",
    },
    update: {
      organizationId: organization.id,
      name: "ICT Support",
      description:
        "Handles computers, projectors, Wi-Fi, and network equipment.",
      isActive: true,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: organization.id,
      name: "ICT Support",
      description:
        "Handles computers, projectors, Wi-Fi, and network equipment.",
    },
  });

  const maintenanceTeam = await prisma.team.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000002",
    },
    update: {
      organizationId: organization.id,
      name: "Works and Maintenance",
      description: "Handles buildings, furniture, roads, and walkways.",
      isActive: true,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      organizationId: organization.id,
      name: "Works and Maintenance",
      description: "Handles buildings, furniture, roads, and walkways.",
    },
  });

  const classroom = await prisma.location.upsert({
    where: {
      id: "11111111-1111-4111-8111-111111111111",
    },
    update: {
      organizationId: organization.id,
      name: "Main Lecture Hall",
      description: "Main campus lecture and presentation building.",
    },
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      organizationId: organization.id,
      name: "Main Lecture Hall",
      description: "Main campus lecture and presentation building.",
    },
  });

  const library = await prisma.location.upsert({
    where: {
      id: "22222222-2222-4222-8222-222222222222",
    },
    update: {
      organizationId: organization.id,
      name: "Campus Library",
      description: "Central student library.",
    },
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      organizationId: organization.id,
      name: "Campus Library",
      description: "Central student library.",
    },
  });

  const reporter = await prisma.user.upsert({
    where: {
      email: "reporter@civicfix.local",
    },
    update: {
      organizationId: organization.id,
      passwordHash: demoPasswordHash,
      firstName: "Ada",
      lastName: "Reporter",
      role: "REPORTER",
    },
    create: {
      organizationId: organization.id,
      firstName: "Ada",
      lastName: "Reporter",
      email: "reporter@civicfix.local",
      passwordHash: demoPasswordHash,
      role: "REPORTER",
    },
  });

  const triageOfficer = await prisma.user.upsert({
    where: {
      email: "triage@civicfix.local",
    },
    update: {
      organizationId: organization.id,
      passwordHash: demoPasswordHash,
      firstName: "Tola",
      lastName: "Triage",
      role: "TRIAGE_OFFICER",
    },
    create: {
      organizationId: organization.id,
      firstName: "Tola",
      lastName: "Triage",
      email: "triage@civicfix.local",
      passwordHash: demoPasswordHash,
      role: "TRIAGE_OFFICER",
    },
  });

  const supervisor = await prisma.user.upsert({
    where: {
      email: "supervisor@civicfix.local",
    },
    update: {
      organizationId: organization.id,
      passwordHash: demoPasswordHash,
      firstName: "Mina",
      lastName: "Supervisor",
      role: "SUPERVISOR",
    },
    create: {
      organizationId: organization.id,
      firstName: "Mina",
      lastName: "Supervisor",
      email: "supervisor@civicfix.local",
      passwordHash: demoPasswordHash,
      role: "SUPERVISOR",
    },
  });

  const ictMember = await prisma.user.upsert({
    where: {
      email: "ict@civicfix.local",
    },
    update: {
      organizationId: organization.id,
      passwordHash: demoPasswordHash,
      firstName: "Sam",
      lastName: "ICT",
      role: "TEAM_MEMBER",
    },
    create: {
      organizationId: organization.id,
      firstName: "Sam",
      lastName: "ICT",
      email: "ict@civicfix.local",
      passwordHash: demoPasswordHash,
      role: "TEAM_MEMBER",
    },
  });

  const maintenanceMember = await prisma.user.upsert({
    where: {
      email: "maintenance@civicfix.local",
    },
    update: {
      organizationId: organization.id,
      passwordHash: demoPasswordHash,
      firstName: "Musa",
      lastName: "Maintenance",
      role: "TEAM_MEMBER",
    },
    create: {
      organizationId: organization.id,
      firstName: "Musa",
      lastName: "Maintenance",
      email: "maintenance@civicfix.local",
      passwordHash: demoPasswordHash,
      role: "TEAM_MEMBER",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: reporter.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: "REPORTER",
      teamId: null,
    },
    create: {
      userId: reporter.id,
      organizationId: organization.id,
      role: "REPORTER",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: supervisor.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: "SUPERVISOR",
      teamId: null,
    },
    create: {
      userId: supervisor.id,
      organizationId: organization.id,
      role: "SUPERVISOR",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: triageOfficer.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: "TRIAGE_OFFICER",
      teamId: null,
    },
    create: {
      userId: triageOfficer.id,
      organizationId: organization.id,
      role: "TRIAGE_OFFICER",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: ictMember.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: "TEAM_MEMBER",
      teamId: ictTeam.id,
    },
    create: {
      userId: ictMember.id,
      organizationId: organization.id,
      role: "TEAM_MEMBER",
      teamId: ictTeam.id,
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: maintenanceMember.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: "TEAM_MEMBER",
      teamId: maintenanceTeam.id,
    },
    create: {
      userId: maintenanceMember.id,
      organizationId: organization.id,
      role: "TEAM_MEMBER",
      teamId: maintenanceTeam.id,
    },
  });

  console.log("Seed completed successfully");
  console.log({
    organization: organization.name,
    teams: [ictTeam.name, maintenanceTeam.name],
    locations: [classroom.name, library.name],
    users: [
      reporter.email,
      triageOfficer.email,
      supervisor.email,
      ictMember.email,
      maintenanceMember.email,
    ],
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  