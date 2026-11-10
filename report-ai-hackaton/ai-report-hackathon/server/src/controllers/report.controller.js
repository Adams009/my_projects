import { prisma } from "../lib/prisma.js";
import {
  createReportSchema,
  updateReportStatusSchema,
  assignReportSchema,
  createTeamSchema,
  completeAssignmentSchema,
  reviewAssignmentSchema,
} from "../schemas/report.schema.js";
import { analyzeReportWithAI } from "../services/ai.service.js";
import {
  deleteReportImage,
  uploadReportImage,
} from "../services/cloudinary.service.js";
import { calculateReportStatus } from "../services/report-status.service.js";

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

const assignmentManagedStatuses = [
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "AWAITING_REVIEW",
  "RESOLVED",
];

async function deleteUploadedReportImages(images) {
  const deletionResults = await Promise.allSettled(
    images.map((image) => deleteReportImage(image.publicId)),
  );
  const failedDeletions = deletionResults.filter(
    (result) => result.status === "rejected",
  ).length;

  if (failedDeletions > 0) {
    console.error("Unable to clean up uploaded report images", {
      failedDeletions,
    });
  }
}

function isTransactionConflict(error) {
  return error?.code === "P2034";
}

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

export async function listReportTeams(req, res) {
  const organizationId = req.user.organizationId;

  if (!organizationId) {
    return res.status(403).json({
      status: "error",
      message: "An active organization is required",
    });
  }

  try {
    const teams = await prisma.team.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: "asc" },
    });

    return res.json({ status: "success", teams });
  } catch (error) {
    console.error("List organization teams error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to fetch teams",
    });
  }
}

export async function createReportTeam(req, res) {
  const validationResult = createTeamSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid team data",
      errors: validationResult.error.flatten(),
    });
  }

  const organizationId = req.user.organizationId;
  if (!organizationId) {
    return res.status(403).json({
      status: "error",
      message: "An active organization is required",
    });
  }

  try {
    const existingTeam = await prisma.team.findFirst({
      where: {
        organizationId,
        name: { equals: validationResult.data.name, mode: "insensitive" },
        isActive: true,
      },
      select: { id: true },
    });

    if (existingTeam) {
      return res.status(409).json({
        status: "error",
        message: "A team with this name already exists",
      });
    }

    const team = await prisma.team.create({
      data: {
        organizationId,
        name: validationResult.data.name,
        description: validationResult.data.description || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return res.status(201).json({
      status: "success",
      message: "Team created successfully",
      team,
    });
  } catch (error) {
    console.error("Create organization team error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to create team",
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
        isActive: true,
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
  let uploadedImages = [];

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
          isActive: true,
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

    const imageFiles = req.files || [];
    const imageUploadResults = await Promise.allSettled(
      imageFiles.map((file) =>
        Promise.resolve().then(() => uploadReportImage(file.buffer)),
      ),
    );
    imageUploadResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error("Report image upload failed:", {
          image: index + 1,
          message: result.reason?.message,
          name: result.reason?.name,
          code: result.reason?.code,
        });
      }
    });
    uploadedImages = imageUploadResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    if (uploadedImages.length !== imageFiles.length) {
      await deleteUploadedReportImages(uploadedImages);
      uploadedImages = [];
      throw new Error("One or more report images could not be uploaded");
    }

    const report = await prisma.$transaction(async (transaction) => {
      const createdReport = await transaction.report.create({
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
          ...(uploadedImages.length
            ? {
                images: {
                  create: uploadedImages,
                },
              }
            : {}),
        },
      });

      await transaction.reportHistory.create({
        data: {
          reportId: createdReport.id,
          actorId: reporterId,
          newStatus: "SUBMITTED",
          action: "REPORT_SUBMITTED",
          notes: "Report submitted by reporter",
        },
      });

      return transaction.report.findUnique({
        where: { id: createdReport.id },
        include: {
          organization: {
            select: { id: true, name: true },
          },
          images: true,
        },
      });
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
    if (uploadedImages.length > 0) {
      await deleteUploadedReportImages(uploadedImages);
    }

    console.error("Create report error:", {
      code: error?.code,
      httpCode: error?.http_code,
      name: error?.name,
      message: error?.message,
    });

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
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
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
        images: true,
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

export async function listReportAssignments(req, res) {
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
    : {
        reporterId: req.user.id,
      };

  try {
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        ...reportVisibility,
        ...(isReporter && organizationId
          ? { reporterId: req.user.id }
          : {}),
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!report) {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    const assignments = await prisma.reportAssignment.findMany({
      where: {
        reportId,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        reviewedBy: {
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
        assignedAt: "asc",
      },
    });

    return res.json({
      status: "success",
      reportId,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("List report assignments error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to fetch report assignments",
    });
  }
}

export async function listTeamAssignments(req, res) {
  const organizationId = req.user.organizationId;

  if (!organizationId) {
    return res.status(403).json({
      status: "error",
      message: "An active organization is required",
    });
  }

  if (req.user.role === "TEAM_MEMBER" && !req.user.teamId) {
    return res.status(403).json({
      status: "error",
      message: "You must belong to a team to view team assignments",
    });
  }

  try {
    const assignments = await prisma.reportAssignment.findMany({
      where: {
        ...(req.user.teamId ? { teamId: req.user.teamId } : {}),
        report: {
          organizationId,
        },
      },
      include: {
        report: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            priority: true,
            status: true,
            createdAt: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
            location: {
              select: {
                id: true,
                name: true,
              },
            },
            images: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        assignedAt: "desc",
      },
    });

    return res.json({
      status: "success",
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("List team assignments error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to fetch team assignments",
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

  if (assignmentManagedStatuses.includes(status)) {
    return res.status(409).json({
      status: "error",
      message: "Use the assignment workflow to change this report stage",
    });
  }

  if (!staffRoles.includes(req.user.role)) {
    return res.status(403).json({
      status: "error",
      message: "You are not allowed to update report status",
    });
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const report = await transaction.report.findFirst({
          where: {
            id: reportId,
            organizationId: req.user.organizationId,
          },
        });

        if (!report) {
          return { error: "NOT_FOUND" };
        }

        const activeAssignmentCount =
          await transaction.reportAssignment.count({
            where: {
              reportId,
              status: { notIn: ["CANCELLED", "DECLINED"] },
            },
          });

        if (
          activeAssignmentCount > 0 &&
          !["NEEDS_INFORMATION", "REASSIGNMENT_REQUESTED"].includes(status)
        ) {
          return { error: "ASSIGNMENT_WORKFLOW_ACTIVE" };
        }

        const updatedReport = await transaction.report.update({
          where: { id: reportId },
          data: { status },
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

        return { report: updatedReport };
      },
      { isolationLevel: "Serializable" },
    );

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    if (result.error === "ASSIGNMENT_WORKFLOW_ACTIVE") {
      return res.status(409).json({
        status: "error",
        message: "Use the assignment workflow while active assignments exist",
      });
    }

    return res.json({
      status: "success",
      message: "Report status updated successfully",
      report: result.report,
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        status: "error",
        message: "The report changed while this update was being processed",
      });
    }

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

    const team = await prisma.team.findFirst({
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
      const activeAssignment = await transaction.reportAssignment.findFirst({
        where: {
          reportId,
          teamId: team.id,
          status: { notIn: ["CANCELLED", "DECLINED"] },
        },
        select: { id: true },
      });

      if (activeAssignment) {
        return null;
      }

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

      const nextStatus = await calculateReportStatus(transaction, reportId);
      const updatedReport = await transaction.report.update({
        where: {
          id: reportId,
        },
        data: {
          assignedTeamId: team.id,
          ...(nextStatus ? { status: nextStatus } : {}),
        },
      });

      const nextReportStatus = nextStatus || report.status;

      if (nextReportStatus !== report.status) {
        await transaction.reportHistory.create({
          data: {
            reportId,
            actorId,
            previousStatus: report.status,
            newStatus: nextReportStatus,
            action: "REPORT_ASSIGNED",
            notes: `Assigned to ${team.name} by staff`,
          },
        });
      }

      return {
        assignment,
        report: updatedReport,
      };
    }, { isolationLevel: "Serializable" });

    if (!result) {
      return res.status(409).json({
        status: "error",
        message: "This team is already assigned to the report",
      });
    }

    return res.status(201).json({
      status: "success",
      message: "Report assigned successfully",
      report: result.report,
      assignment: result.assignment,
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        status: "error",
        message: "The report assignment changed; reload and try again",
      });
    }

    console.error("Assign report error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to assign report",
    });
  }
}

export async function acknowledgeAssignment(req, res) {
  const { assignmentId } = req.params;

  if (!req.user.organizationId) {
    return res.status(403).json({
      status: "error",
      message: "An active organization is required",
    });
  }

  if (!req.user.teamId) {
    return res.status(403).json({
      status: "error",
      message: "You must belong to a team to acknowledge an assignment",
    });
  }

  try {
    const assignment = await prisma.reportAssignment.findFirst({
      where: {
        id: assignmentId,
        teamId: req.user.teamId,
        report: {
          organizationId: req.user.organizationId,
        },
      },
      include: {
        report: true,
        team: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found for your team",
      });
    }

    if (assignment.status !== "PENDING") {
      return res.status(409).json({
        status: "error",
        message: `This assignment cannot be acknowledged because its current status is ${assignment.status}`,
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const transitioned = await transaction.reportAssignment.updateMany({
        where: {
          id: assignmentId,
          teamId: req.user.teamId,
          status: "PENDING",
        },
        data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
      });

      if (transitioned.count !== 1) {
        return null;
      }

      const updatedAssignment =
        await transaction.reportAssignment.findUnique({
          where: { id: assignmentId },
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

      const nextReportStatus = await calculateReportStatus(
        transaction,
        assignment.reportId,
      );
      let updatedReport = assignment.report;

      if (nextReportStatus && nextReportStatus !== assignment.report.status) {
        updatedReport = await transaction.report.update({
          where: {
            id: assignment.reportId,
          },
          data: {
            status: nextReportStatus,
          },
        });

        await transaction.reportHistory.create({
          data: {
            reportId: assignment.reportId,
            actorId: req.user.id,
            previousStatus: assignment.report.status,
            newStatus: nextReportStatus,
            action: "ASSIGNMENT_ACKNOWLEDGED",
            notes: `Assignment acknowledged by ${assignment.team.name}`,
          },
        });
      }

      return {
        assignment: updatedAssignment,
        report: updatedReport,
      };
    }, { isolationLevel: "Serializable" });

    if (!result) {
      return res.status(409).json({
        status: "error",
        message: "This assignment has already changed",
      });
    }

    return res.json({
      status: "success",
      message: "Assignment acknowledged successfully",
      assignment: result.assignment,
      report: result.report,
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        status: "error",
        message: "The assignment changed; reload and try again",
      });
    }

    console.error("Acknowledge assignment error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to acknowledge assignment",
    });
  }
}

export async function startAssignment(req, res) {
  const { assignmentId } = req.params;

  if (!req.user.organizationId) {
    return res.status(403).json({
      status: "error",
      message: "An active organization is required",
    });
  }

  if (!req.user.teamId) {
    return res.status(403).json({
      status: "error",
      message: "You must belong to a team to start an assignment",
    });
  }

  try {
    const assignment = await prisma.reportAssignment.findFirst({
      where: {
        id: assignmentId,
        teamId: req.user.teamId,
        report: {
          organizationId: req.user.organizationId,
        },
      },
      include: {
        report: true,
        team: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found for your team",
      });
    }

    if (assignment.status !== "ACKNOWLEDGED") {
      return res.status(409).json({
        status: "error",
        message: `This assignment cannot be started because its current status is ${assignment.status}`,
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const transitioned = await transaction.reportAssignment.updateMany({
        where: {
          id: assignmentId,
          teamId: req.user.teamId,
          status: "ACKNOWLEDGED",
        },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });

      if (transitioned.count !== 1) {
        return null;
      }

      const updatedAssignment =
        await transaction.reportAssignment.findUnique({
          where: { id: assignmentId },
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

      const nextReportStatus = await calculateReportStatus(
        transaction,
        assignment.reportId,
      );
      let updatedReport = assignment.report;

      if (nextReportStatus && nextReportStatus !== assignment.report.status) {
        updatedReport = await transaction.report.update({
          where: {
            id: assignment.reportId,
          },
          data: {
            status: nextReportStatus,
          },
        });

        await transaction.reportHistory.create({
          data: {
            reportId: assignment.reportId,
            actorId: req.user.id,
            previousStatus: assignment.report.status,
            newStatus: nextReportStatus,
            action: "ASSIGNMENT_STARTED",
            notes: `${assignment.team.name} started work on the assignment`,
          },
        });
      }

      return {
        assignment: updatedAssignment,
        report: updatedReport,
      };
    }, { isolationLevel: "Serializable" });

    if (!result) {
      return res.status(409).json({
        status: "error",
        message: "This assignment has already changed",
      });
    }

    return res.json({
      status: "success",
      message: "Assignment work started successfully",
      assignment: result.assignment,
      report: result.report,
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        status: "error",
        message: "The assignment changed; reload and try again",
      });
    }

    console.error("Start assignment error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to start assignment",
    });
  }
}

export async function completeAssignment(req, res) {
  const { assignmentId } = req.params;

  if (!req.user.organizationId) {
    return res.status(403).json({
      status: "error",
      message: "An active organization is required",
    });
  }

  if (!req.user.teamId) {
    return res.status(403).json({
      status: "error",
      message: "You must belong to a team to complete an assignment",
    });
  }

  const validationResult = completeAssignmentSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid completion data",
      errors: validationResult.error.flatten(),
    });
  }

  const { completionNote } = validationResult.data;

  try {
    const assignment = await prisma.reportAssignment.findFirst({
      where: {
        id: assignmentId,
        teamId: req.user.teamId,
        report: {
          organizationId: req.user.organizationId,
        },
      },
      include: {
        report: true,
        team: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found for your team",
      });
    }

    if (assignment.status !== "IN_PROGRESS") {
      return res.status(409).json({
        status: "error",
        message: `This assignment cannot be completed because its current status is ${assignment.status}`,
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const transitioned = await transaction.reportAssignment.updateMany({
        where: {
          id: assignmentId,
          teamId: req.user.teamId,
          status: "IN_PROGRESS",
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completionNote,
          reviewStatus: "NOT_REVIEWED",
          reviewedById: null,
          reviewedAt: null,
          reviewNote: null,
        },
      });

      if (transitioned.count !== 1) {
        return null;
      }

      const updatedAssignment =
        await transaction.reportAssignment.findUnique({
          where: { id: assignmentId },
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

      const nextReportStatus = await calculateReportStatus(
        transaction,
        assignment.reportId,
      );
      let updatedReport = assignment.report;

      if (nextReportStatus && nextReportStatus !== assignment.report.status) {
        updatedReport = await transaction.report.update({
          where: {
            id: assignment.reportId,
          },
          data: {
            status: nextReportStatus,
          },
        });

        await transaction.reportHistory.create({
          data: {
            reportId: assignment.reportId,
            actorId: req.user.id,
            previousStatus: assignment.report.status,
            newStatus: nextReportStatus,
            action: "ASSIGNMENT_COMPLETED",
            notes: `${assignment.team.name} submitted completion: ${completionNote}`,
          },
        });
      }

      return {
        assignment: updatedAssignment,
        report: updatedReport,
      };
    }, { isolationLevel: "Serializable" });

    if (!result) {
      return res.status(409).json({
        status: "error",
        message: "This assignment has already changed",
      });
    }

    return res.json({
      status: "success",
      message: "Assignment completion submitted for review",
      assignment: result.assignment,
      report: result.report,
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        status: "error",
        message: "The assignment changed; reload and try again",
      });
    }

    console.error("Complete assignment error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to submit assignment completion",
    });
  }
}

export async function reviewAssignment(req, res) {
  const { assignmentId } = req.params;

  if (!req.user.organizationId) {
    return res.status(403).json({
      status: "error",
      message: "An active organization is required",
    });
  }

  const validationResult = reviewAssignmentSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid review data",
      errors: validationResult.error.flatten(),
    });
  }

  const { decision, reviewNote } = validationResult.data;

  if (decision === "REJECT" && !reviewNote) {
    return res.status(400).json({
      status: "error",
      message: "A review note is required when rejecting completed work",
    });
  }

  try {
    const assignment = await prisma.reportAssignment.findFirst({
      where: {
        id: assignmentId,
        report: {
          organizationId: req.user.organizationId,
        },
      },
      include: {
        report: true,
        team: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found",
      });
    }

    if (assignment.status !== "COMPLETED") {
      return res.status(409).json({
        status: "error",
        message: `Only completed assignments can be reviewed. Current status: ${assignment.status}`,
      });
    }

    if (assignment.reviewStatus !== "NOT_REVIEWED") {
      return res.status(409).json({
        status: "error",
        message: "This assignment has already been reviewed",
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const transitioned = await transaction.reportAssignment.updateMany({
        where: {
          id: assignmentId,
          status: "COMPLETED",
          reviewStatus: "NOT_REVIEWED",
        },
        data:
          decision === "APPROVE"
            ? {
                reviewStatus: "APPROVED",
                reviewedById: req.user.id,
                reviewedAt: new Date(),
                reviewNote: reviewNote || null,
              }
            : {
                status: "IN_PROGRESS",
                reviewStatus: "REJECTED",
                reviewedById: req.user.id,
                reviewedAt: new Date(),
                reviewNote,
              },
      });

      if (transitioned.count !== 1) {
        return null;
      }

      const updatedAssignment =
        await transaction.reportAssignment.findUnique({
          where: { id: assignmentId },
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

      let nextReportStatus = assignment.report.status;
      let historyAction;
      let historyNotes;

      if (decision === "REJECT") {
        nextReportStatus = "IN_PROGRESS";
        historyAction = "ASSIGNMENT_REVIEW_REJECTED";
        historyNotes = `${assignment.team.name} completion was rejected: ${reviewNote}`;
      } else {
        nextReportStatus =
          (await calculateReportStatus(transaction, assignment.reportId)) ||
          assignment.report.status;

        historyAction = "ASSIGNMENT_REVIEW_APPROVED";
        historyNotes =
          reviewNote ||
          `${assignment.team.name} completion was approved`;
      }

      let updatedReport = assignment.report;

      if (nextReportStatus !== assignment.report.status) {
        updatedReport = await transaction.report.update({
          where: {
            id: assignment.reportId,
          },
          data: {
            status: nextReportStatus,
          },
        });
      }

      await transaction.reportHistory.create({
        data: {
          reportId: assignment.reportId,
          actorId: req.user.id,
          previousStatus: assignment.report.status,
          newStatus: nextReportStatus,
          action: historyAction,
          notes: historyNotes,
        },
      });

      return {
        assignment: updatedAssignment,
        report: updatedReport,
      };
    }, { isolationLevel: "Serializable" });

    if (!result) {
      return res.status(409).json({
        status: "error",
        message: "This assignment has already changed",
      });
    }

    return res.json({
      status: "success",
      message:
        decision === "APPROVE"
          ? "Assignment completion approved"
          : "Assignment completion rejected and returned to the team",
      assignment: result.assignment,
      report: result.report,
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        status: "error",
        message: "The assignment changed; reload and try again",
      });
    }

    console.error("Review assignment error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to review assignment",
    });
  }
}