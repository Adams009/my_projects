const activeAssignmentFilter = {
  status: {
    notIn: ["CANCELLED", "DECLINED"],
  },
};

export async function calculateReportStatus(prismaClient, reportId) {
  const assignments = await prismaClient.reportAssignment.findMany({
    where: {
      reportId,
      ...activeAssignmentFilter,
    },
    select: {
      status: true,
      reviewStatus: true,
    },
  });

  if (assignments.length === 0) {
    return null;
  }

  if (assignments.every((assignment) => assignment.reviewStatus === "APPROVED")) {
    return "RESOLVED";
  }

  if (assignments.some((assignment) => assignment.status === "IN_PROGRESS")) {
    return "IN_PROGRESS";
  }

  if (assignments.some((assignment) => assignment.status === "ACKNOWLEDGED")) {
    return "ACKNOWLEDGED";
  }

  if (assignments.some((assignment) => assignment.status === "PENDING")) {
    return "ASSIGNED";
  }

  return "AWAITING_REVIEW";
}
