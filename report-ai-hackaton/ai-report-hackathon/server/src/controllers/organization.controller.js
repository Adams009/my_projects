import { prisma } from "../lib/prisma.js";
import {
  createOrganizationLocationSchema,
  updateOrganizationLocationSchema,
  updateOrganizationMemberSchema,
} from "../schemas/organization.schema.js";

const locationSelection = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const memberSelection = {
  id: true,
  userId: true,
  role: true,
  teamId: true,
  createdAt: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  team: {
    select: {
      id: true,
      name: true,
    },
  },
};

async function hasOtherOrganizationAdmins(transaction, organizationId) {
  return (
    (await transaction.organizationMembership.count({
      where: {
        organizationId,
        role: "ORGANIZATION_ADMIN",
      },
    })) > 1
  );
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

async function findActiveLocationName(
  transaction,
  organizationId,
  name,
  excludeId,
) {
  return transaction.location.findFirst({
    where: {
      organizationId,
      isActive: true,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
}

export async function listOrganizationMembers(req, res) {
  try {
    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: req.user.organizationId },
      select: memberSelection,
      orderBy: { createdAt: "asc" },
    });

    return res.json({
      status: "success",
      members,
    });
  } catch (error) {
    console.error("List organization members error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to load organization members",
    });
  }
}

export async function listOrganizationLocations(req, res) {
  try {
    const locations = await prisma.location.findMany({
      where: { organizationId: req.user.organizationId },
      select: locationSelection,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return res.json({
      status: "success",
      locations,
    });
  } catch (error) {
    console.error("List organization locations error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to load organization locations",
    });
  }
}

export async function createOrganizationLocation(req, res) {
  const validationResult = createOrganizationLocationSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid location data",
      errors: validationResult.error.flatten(),
    });
  }

  const { name, description } = validationResult.data;

  try {
    const location = await prisma.$transaction(
      async (transaction) => {
        const existingLocation = await findActiveLocationName(
          transaction,
          req.user.organizationId,
          name,
        );

        if (existingLocation) {
          return null;
        }

        return transaction.location.create({
          data: {
            organizationId: req.user.organizationId,
            name,
            description,
          },
          select: locationSelection,
        });
      },
      { isolationLevel: "Serializable" },
    );

    if (!location) {
      return res.status(409).json({
        status: "error",
        message: "An active location with this name already exists",
      });
    }

    return res.status(201).json({
      status: "success",
      message: "Location created successfully",
      location,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        status: "error",
        message: "An active location with this name already exists",
      });
    }

    if (error?.code === "P2034") {
      return res.status(409).json({
        status: "error",
        message: "Location data changed concurrently. Please retry.",
      });
    }

    console.error("Create organization location error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to create location",
    });
  }
}

export async function updateOrganizationLocation(req, res) {
  if (!isValidUuid(req.params.locationId)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid location ID",
    });
  }

  const validationResult = updateOrganizationLocationSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid location data",
      errors: validationResult.error.flatten(),
    });
  }

  const { name, description, isActive } = validationResult.data;

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const existingLocation = await transaction.location.findFirst({
          where: {
            id: req.params.locationId,
            organizationId: req.user.organizationId,
          },
          select: { id: true, isActive: true },
        });

        if (!existingLocation) {
          return { error: "NOT_FOUND" };
        }

        const willBeActive = isActive ?? existingLocation.isActive;
        if (willBeActive) {
          const duplicate = await findActiveLocationName(
            transaction,
            req.user.organizationId,
            name,
            req.params.locationId,
          );

          if (duplicate) {
            return { error: "DUPLICATE" };
          }
        }

        const location = await transaction.location.update({
          where: { id: existingLocation.id },
          data: {
            name,
            description,
            ...(isActive === undefined ? {} : { isActive }),
          },
          select: locationSelection,
        });

        return { location };
      },
      { isolationLevel: "Serializable" },
    );

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        status: "error",
        message: "Location not found in this organization",
      });
    }

    if (result.error === "DUPLICATE") {
      return res.status(409).json({
        status: "error",
        message: "An active location with this name already exists",
      });
    }

    return res.json({
      status: "success",
      message: "Location updated successfully",
      location: result.location,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        status: "error",
        message: "An active location with this name already exists",
      });
    }

    if (error?.code === "P2034") {
      return res.status(409).json({
        status: "error",
        message: "Location data changed concurrently. Please retry.",
      });
    }

    console.error("Update organization location error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to update location",
    });
  }
}

export async function deactivateOrganizationLocation(req, res) {
  if (!isValidUuid(req.params.locationId)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid location ID",
    });
  }

  try {
    const updated = await prisma.location.updateMany({
      where: {
        id: req.params.locationId,
        organizationId: req.user.organizationId,
        isActive: true,
      },
      data: { isActive: false },
    });

    if (updated.count !== 1) {
      return res.status(404).json({
        status: "error",
        message: "Active location not found in this organization",
      });
    }

    return res.json({
      status: "success",
      message: "Location deactivated. Existing reports retain their location.",
    });
  } catch (error) {
    console.error("Deactivate organization location error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to deactivate location",
    });
  }
}

export async function updateOrganizationMember(req, res) {
  const validationResult = updateOrganizationMemberSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid organization member data",
      errors: validationResult.error.flatten(),
    });
  }

  if (
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
      req.params.membershipId,
    )
  ) {
    return res.status(400).json({
      status: "error",
      message: "Invalid membership ID",
    });
  }

  const { role, teamId } = validationResult.data;

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const membership =
          await transaction.organizationMembership.findFirst({
            where: {
              id: req.params.membershipId,
              organizationId: req.user.organizationId,
            },
            select: {
              id: true,
              userId: true,
              role: true,
            },
          });

        if (!membership) {
          return { error: "NOT_FOUND" };
        }

        if (membership.userId === req.user.id) {
          return { error: "SELF_UPDATE" };
        }

        if (
          membership.role === "ORGANIZATION_ADMIN" &&
          role !== "ORGANIZATION_ADMIN" &&
          !(await hasOtherOrganizationAdmins(
            transaction,
            req.user.organizationId,
          ))
        ) {
          return { error: "LAST_ADMIN" };
        }

        if (teamId) {
          const team = await transaction.team.findFirst({
            where: {
              id: teamId,
              organizationId: req.user.organizationId,
              isActive: true,
            },
            select: { id: true },
          });

          if (!team) {
            return { error: "TEAM_NOT_FOUND" };
          }
        }

        const updatedMembership =
          await transaction.organizationMembership.update({
            where: { id: membership.id },
            data: { role, teamId },
            select: memberSelection,
          });

        return { membership: updatedMembership };
      },
      { isolationLevel: "Serializable" },
    );

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        status: "error",
        message: "Organization member not found",
      });
    }

    if (result.error === "SELF_UPDATE") {
      return res.status(400).json({
        status: "error",
        message: "You cannot change your own organization role or team",
      });
    }

    if (result.error === "LAST_ADMIN") {
      return res.status(409).json({
        status: "error",
        message: "The organization must have at least one administrator",
      });
    }

    if (result.error === "TEAM_NOT_FOUND") {
      return res.status(404).json({
        status: "error",
        message: "Team not found in this organization",
      });
    }

    return res.json({
      status: "success",
      message: "Organization member updated",
      member: result.membership,
    });
  } catch (error) {
    if (error?.code === "P2034") {
      return res.status(409).json({
        status: "error",
        message: "Organization membership changed concurrently. Please retry.",
      });
    }

    console.error("Update organization member error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to update organization member",
    });
  }
}

export async function removeOrganizationMember(req, res) {
  if (
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
      req.params.membershipId,
    )
  ) {
    return res.status(400).json({
      status: "error",
      message: "Invalid membership ID",
    });
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const membership =
          await transaction.organizationMembership.findFirst({
            where: {
              id: req.params.membershipId,
              organizationId: req.user.organizationId,
            },
            select: {
              id: true,
              userId: true,
              role: true,
            },
          });

        if (!membership) {
          return { error: "NOT_FOUND" };
        }

        if (membership.userId === req.user.id) {
          return { error: "SELF_REMOVE" };
        }

        if (
          membership.role === "ORGANIZATION_ADMIN" &&
          !(await hasOtherOrganizationAdmins(
            transaction,
            req.user.organizationId,
          ))
        ) {
          return { error: "LAST_ADMIN" };
        }

        await transaction.organizationMembership.delete({
          where: { id: membership.id },
        });

        return { removed: true };
      },
      { isolationLevel: "Serializable" },
    );

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        status: "error",
        message: "Organization member not found",
      });
    }

    if (result.error === "SELF_REMOVE") {
      return res.status(400).json({
        status: "error",
        message: "You cannot remove your own organization membership",
      });
    }

    if (result.error === "LAST_ADMIN") {
      return res.status(409).json({
        status: "error",
        message: "The organization must have at least one administrator",
      });
    }

    return res.json({
      status: "success",
      message: "Member removed from the organization",
    });
  } catch (error) {
    if (error?.code === "P2034") {
      return res.status(409).json({
        status: "error",
        message: "Organization membership changed concurrently. Please retry.",
      });
    }

    console.error("Remove organization member error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to remove organization member",
    });
  }
}
