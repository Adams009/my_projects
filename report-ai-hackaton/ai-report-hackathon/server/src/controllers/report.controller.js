import { prisma } from "../lib/prisma.js";
import {
  createReportSchema,
  updateReportStatusSchema,
  assignReportSchema,
} from "../schemas/report.schema.js";
import { analyzeReportWithAI } from "../services/ai.service.js";

const staffRoles = [
  "TRIAGE_OFFICER",
  "TEAM_MEMBER",
  "SUPERVISOR",
  "ORGANIZATION_ADMIN",
];

const assignmentRoles = [
  "TRIAGE_OFFICER",
  "SUPERVISOR",
  "ORGANIZATION_ADMIN",
];

const teamByCategory = {
  ROAD_INFRASTRUCTURE: "Works and Maintenance",
  DRAINAGE_FLOODING: "Works and Maintenance",
  WASTE_SANITATION: "Works and Maintenance",
  WATER_PLUMBING: "Works and Maintenance",
  ELECTRICAL_LIGHTING: "Works and Maintenance",
  BUILDING_MAINTENANCE: "Works and Maintenance",
  ICT_EQUIPMENT: "ICT Support",
  OTHER_FACILITY_ISSUE: "Works and Maintenance",
};

export async function listReportOrganizations(req, res) {
  try {
    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.json({
      status: "success",
      organizations,
    });
  } catch (error) {
    console.error("List report organizations error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to fetch organizations",
    });
  }
}

export async function listReportLocations(req, res) {
  const { organizationId } = req.params;

  try {
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      return res.status(404).json({
        status: "error",
        message: "Organization not found",
      });
    }

    const locations = await prisma.location.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.json({
      status: "success",
      locations,
    });
  } catch (error) {
    console.error("List report locations error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to fetch locations",
    });
  }
}

export async function createReport(req, res) {
  const validationResult = createReportSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid report data",
      errors: validationResult.error.flatten(),
    });
  }

  const {
    organizationId: requestedOrganizationId,
    locationId,
    title,
    description,
    category,
    priority,
  } = validationResult.data;

  const organizationId = requestedOrganizationId || req.user.organizationId;
  const reporterId = req.user.id;

  if (!organizationId) {
    return res.status(400).json({
      status: "error",
      message: "Choose an organization for this report",
    });
  }

  try {
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        isActive: true,
      },
    });

    if (!organization) {
      return res.status(404).json({
        status: "error",
        message: "Organization not found",
      });
    }

    if (locationId) {
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
          organizationId,
        },
      });

      if (!location) {
        return res.status(404).json({
          status: "error",
          message: "Location not found in this organization",
        });
      }
    }

    let aiAnalysis = null;

    try {
      aiAnalysis = await analyzeReportWithAI({
        title,
        description,
      });
    } catch (error) {
      console.error("AI report analysis failed:", error.message);
    }

    const report = await prisma.report.create({
      data: {
        organizationId,
        reporterId,
        locationId,
        title,
        description,
        category,
        priority,
        aiSummary: aiAnalysis?.summary ?? null,
        aiCategory: aiAnalysis?.category ?? null,
        aiConfidence: aiAnalysis?.confidence ?? null,
        aiRationale: aiAnalysis?.rationale ?? null,
      },
    });

    await prisma.reportHistory.create({
      data: {
        reportId: report.id,
        actorId: reporterId,
        newStatus: "SUBMITTED",
        action: "REPORT_SUBMITTED",
        notes: "Report submitted by reporter",
      },
    });

    return res.status(201).json({
      status: "success",
      message: "Report created successfully",
      report,
      aiAnalysis: aiAnalysis
        ? {
            summary: aiAnalysis.summary,
            category: aiAnalysis.category,
            confidence: aiAnalysis.confidence,
            rationale: aiAnalysis.rationale,
          }
        : null,
    });
  } catch (error) {
    console.error("Create report error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to create report",
    });
  }
}

export async function listReports(req, res) {
  const organizationId = req.user.organizationId;
  const isReporter = req.user.role === "REPORTER";
  const reportVisibility = organizationId
    ? {
        OR: [
          { organizationId },
          { reporterId: req.user.id },
        ],
      }
    : { reporterId: req.user.id };

  try {
    const reports = await prisma.report.findMany({
      where: {
        ...reportVisibility,
        ...(isReporter && organizationId
          ? { reporterId: req.user.id }
          : {}),
      },
      include: {
        location: true,
        assignedTeam: true,
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      status: "success",
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error("List reports error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to fetch reports",
    });
  }
}

export async function getReportHistory(req, res) {
  const { reportId } = req.params;
  const organizationId = req.user.organizationId;
  const isReporter = req.user.role === "REPORTER";
  const reportVisibility = organizationId
    ? {
        OR: [
          { organizationId },
          { reporterId: req.user.id },
        ],
      }
    : { reporterId: req.user.id };

  try {
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        ...reportVisibility,
        ...(isReporter && organizationId ? { reporterId: req.user.id } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!report) {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    const history = await prisma.reportHistory.findMany({
      where: {
        reportId,
      },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.json({
      status: "success",
      count: history.length,
      history,
    });
  } catch (error) {
    console.error("Get report history error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to fetch report history",
    });
  }
}

export async function updateReportStatus(req, res) {
  const validationResult = updateReportStatusSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid status update data",
      errors: validationResult.error.flatten(),
    });
  }

  const { status, notes } = validationResult.data;
  const actorId = req.user.id;
  const { reportId } = req.params;

  if (!staffRoles.includes(req.user.role)) {
    return res.status(403).json({
      status: "error",
      message: "You are not allowed to update report status",
    });
  }

  try {
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        organizationId: req.user.organizationId,
      },
    });

    if (!report) {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    const updatedReport = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: {
          id: reportId,
        },
        data: {
          status,
        },
      });

      await transaction.reportHistory.create({
        data: {
          reportId,
          actorId,
          previousStatus: report.status,
          newStatus: status,
          action: "STATUS_UPDATED",
          notes,
        },
      });

      return updated;
    });

    return res.json({
      status: "success",
      message: "Report status updated successfully",
      report: updatedReport,
    });
  } catch (error) {
    console.error("Update report status error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to update report status",
    });
  }
}

export async function assignReport(req, res) {
  const validationResult = assignReportSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid assignment data",
      errors: validationResult.error.flatten(),
    });
  }

  const { teamId } = validationResult.data;
  const actorId = req.user.id;
  const { reportId } = req.params;

  try {
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        organizationId: req.user.organizationId,
      },
    });

    if (!report) {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    let team;

    if (teamId) {
      team = await prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId: report.organizationId,
          isActive: true,
        },
      });

      if (!team) {
        return res.status(422).json({
          status: "error",
          message: "Selected team was not found in this organization",
        });
      }
    } else {
      const teamName = teamByCategory[report.category];

      if (!teamName) {
        return res.status(422).json({
          status: "error",
          message: "No routing rule exists for this category",
        });
      }

      team = await prisma.team.findFirst({
        where: {
          organizationId: report.organizationId,
          name: teamName,
          isActive: true,
        },
      });

      if (!team) {
        return res.status(422).json({
          status: "error",
          message: "Configured routing team was not found",
        });
      }
    }

    const existingAssignment = await prisma.reportAssignment.findFirst({
      where: {
        reportId,
        teamId: team.id,
        status: {
          notIn: ["CANCELLED", "DECLINED"],
        },
      },
    });

    if (existingAssignment) {
      return res.status(409).json({
        status: "error",
        message: "This team is already assigned to the report",
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const assignment = await transaction.reportAssignment.create({
        data: {
          reportId,
          teamId: team.id,
          assignedById: actorId,
          status: "PENDING",
          reviewStatus: "NOT_REVIEWED",
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      const updatedReport = await transaction.report.update({
        where: {
          id: reportId,
        },
        data: {
          assignedTeamId: team.id,
          status: "ASSIGNED",
        },
      });

      await transaction.reportHistory.create({
        data: {
          reportId,
          actorId,
          previousStatus: report.status,
          newStatus: "ASSIGNED",
          action: "REPORT_ASSIGNED",
          notes: teamId
            ? `Assigned to ${team.name} by staff`
            : `Assigned to ${team.name} using category routing`,
        },
      });

      return {
        assignment,
        report: updatedReport,
      };
    });

    return res.status(201).json({
      status: "success",
      message: "Report assigned successfully",
      report: result.report,
      assignment: result.assignment,
    });
  } catch (error) {
    console.error("Assign report error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to assign report",
    });
  }
}