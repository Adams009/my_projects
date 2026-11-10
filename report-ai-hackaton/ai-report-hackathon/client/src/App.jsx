import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "/api")
).replace(/\/+$/, "");
let accessTokenInMemory = null;
let refreshSessionPromise;
const STAFF_ROLES = [
  "TRIAGE_OFFICER",
  "TEAM_MEMBER",
  "SUPERVISOR",
  "ORGANIZATION_ADMIN",
];

const categories = [
  ["ICT_EQUIPMENT", "ICT and equipment"],
  ["BUILDING_MAINTENANCE", "Building maintenance"],
  ["ELECTRICAL_LIGHTING", "Electrical and lighting"],
  ["WATER_PLUMBING", "Water and plumbing"],
  ["DRAINAGE_FLOODING", "Drainage and flooding"],
  ["WASTE_SANITATION", "Waste and sanitation"],
  ["ROAD_INFRASTRUCTURE", "Road infrastructure"],
  ["OTHER_FACILITY_ISSUE", "Other facility issue"],
];

const initialForm = {
  title: "",
  description: "",
  locationId: "",
  category: "ICT_EQUIPMENT",
  priority: "MEDIUM",
  organizationId: "",
};

const initialLoginForm = {
  email: "",
  password: "",
};

const initialRegisterForm = {
  organizationName: "",
  organizationType: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
};

const initialRegisterAccountType = "organization";

const organizationTypes = [
  ["GOVERNMENT", "Government"],
  ["COMPANY", "Company"],
  ["SCHOOL", "School"],
  ["HOSPITAL", "Hospital"],
  ["NGO", "NGO"],
  ["COMMUNITY", "Community organization"],
  ["OTHER", "Other"],
];

function refreshSession() {
  if (!refreshSessionPromise) {
    refreshSessionPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => ({
        ok: response.ok,
        data: await response.json().catch(() => ({})),
      }))
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
}

function getAuthenticatedUser(user) {
  const memberships = user.memberships || [];
  const storedOrganizationId = localStorage.getItem(
    "civicfixActiveOrganizationId",
  );
  const activeMembership =
    memberships.find(
      (membership) => membership.organizationId === storedOrganizationId,
    ) || memberships[0];
  const authenticatedUser = {
    ...user,
    organizationId: activeMembership?.organizationId || null,
    role: activeMembership?.role || user.role,
    teamId: activeMembership?.teamId || null,
  };

  if (authenticatedUser.organizationId) {
    localStorage.setItem(
      "civicfixActiveOrganizationId",
      authenticatedUser.organizationId,
    );
  } else {
    localStorage.removeItem("civicfixActiveOrganizationId");
  }

  return authenticatedUser;
}

function clearStoredSession() {
  accessTokenInMemory = null;
  localStorage.removeItem("civicfixToken");
  localStorage.removeItem("civicfixUser");
  localStorage.removeItem("civicfixActiveOrganizationId");
}

async function apiRequest(path, options = {}) {
  const activeOrganizationId = localStorage.getItem("civicfixActiveOrganizationId");
  const makeRequest = (accessToken) => {
    const headers = {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    };

    if (activeOrganizationId) {
      headers["X-Organization-Id"] = activeOrganizationId;
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers,
    });
  };

  const token = accessTokenInMemory;
  const response = await makeRequest(token);
  const isPublicAuthRoute =
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/forgot-password") ||
    path.startsWith("/auth/reset-password");

  if (response.status !== 401 || !token || isPublicAuthRoute) {
    return response;
  }

  const refreshedSessionResponse = await refreshSession();
  if (!refreshedSessionResponse.ok) {
    clearStoredSession();
    window.location.assign("/login");
    return response;
  }

  const refreshedSession = refreshedSessionResponse.data;
  const refreshedToken = refreshedSession.accessToken || refreshedSession.token;
  if (!refreshedToken) {
    return response;
  }

  accessTokenInMemory = refreshedToken;
  return makeRequest(refreshedToken);
}

function formatStatus(status) {
  return status.replaceAll("_", " ");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getAuthPath() {
  if (window.location.pathname === "/accept-invitation") {
    return "/accept-invitation";
  }

  if (window.location.pathname === "/login") {
    return "/login";
  }

  if (window.location.pathname === "/register") {
    return "/register";
  }

  if (
    window.location.pathname === "/forgot-password" ||
    window.location.pathname === "/reset-password"
  ) {
    return window.location.pathname;
  }

  return "/";
}

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [selectedReportImages, setSelectedReportImages] = useState([]);
  const [reportImageError, setReportImageError] = useState("");
  const reportImageInputRef = useRef(null);
  const [view, setView] = useState("reporter");
  const [reportAudience, setReportAudience] = useState("own");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState("");
  const [assignmentSelections, setAssignmentSelections] = useState({});
  const [selectedReport, setSelectedReport] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState("");
  const [teamAssignments, setTeamAssignments] = useState([]);
  const [teamAssignmentsLoading, setTeamAssignmentsLoading] = useState(false);
  const [teamAssignmentsError, setTeamAssignmentsError] = useState("");
  const [completionNotes, setCompletionNotes] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastAiAnalysis, setLastAiAnalysis] = useState(null);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authPath, setAuthPath] = useState(getAuthPath);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [registerAccountType, setRegisterAccountType] = useState(initialRegisterAccountType);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [invitationAcceptForm, setInvitationAcceptForm] = useState({
    firstName: "",
    lastName: "",
    password: "",
  });
  const [invitationAccountType, setInvitationAccountType] = useState("new");
  const [invitationAcceptLoading, setInvitationAcceptLoading] = useState(false);
  const [invitationAcceptError, setInvitationAcceptError] = useState("");
  const [invitationAcceptSuccess, setInvitationAcceptSuccess] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState("");
  const [appInitializing, setAppInitializing] = useState(true);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "REPORTER",
    teamId: "",
  });
  const [teamForm, setTeamForm] = useState({ name: "", description: "" });
  const [teamCreating, setTeamCreating] = useState(false);
  const [inviteResult, setInviteResult] = useState("");
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [memberEdits, setMemberEdits] = useState({});
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberActionId, setMemberActionId] = useState("");
  const [managedLocations, setManagedLocations] = useState([]);
  const [managedLocationsLoading, setManagedLocationsLoading] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name: "",
    description: "",
  });
  const [editingLocationId, setEditingLocationId] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationActionId, setLocationActionId] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locationSuccess, setLocationSuccess] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileReturnView, setProfileReturnView] = useState("reporter");
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    currentPassword: "",
    newPassword: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const profileMenuRef = useRef(null);

  useEffect(
    () => () => {
      selectedReportImages.forEach(({ previewUrl }) =>
        URL.revokeObjectURL(previewUrl),
      );
    },
    [selectedReportImages],
  );

  const canManageReports = STAFF_ROLES.includes(user?.role);
  const canViewTeamAssignments = [
    "TEAM_MEMBER",
    "SUPERVISOR",
    "ORGANIZATION_ADMIN",
  ].includes(user?.role);
  const reportOrganizations = organizations;
  const authMode =
    authPath === "/login"
      ? "login"
      : authPath === "/register"
        ? "register"
        : authPath === "/accept-invitation"
          ? "accept-invitation"
          : authPath === "/forgot-password"
            ? "forgot-password"
            : authPath === "/reset-password"
              ? "reset-password"
          : "landing";
  const invitationToken =
    new URLSearchParams(window.location.search).get("token") || "";

  useEffect(() => {
    function handlePopState() {
      setAuthPath(getAuthPath());
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let active = true;
    localStorage.removeItem("civicfixToken");

    async function restoreSession() {
      try {
        const sessionResponse = await refreshSession();

        if (!sessionResponse.ok) {
          clearStoredSession();
          return;
        }

        const refreshedToken =
          sessionResponse.data.accessToken || sessionResponse.data.token;
        if (!refreshedToken || !sessionResponse.data.user) {
          throw new Error("The server returned an invalid session.");
        }

        const authenticatedUser = getAuthenticatedUser(
          sessionResponse.data.user,
        );
        accessTokenInMemory = refreshedToken;
        localStorage.removeItem("civicfixUser");

        if (active) {
          setToken(refreshedToken);
          setUser(authenticatedUser);
          setView(
            STAFF_ROLES.includes(authenticatedUser.role) ? "staff" : "reporter",
          );
          setReportAudience(
            authenticatedUser.organizationId ? "own" : "external",
          );
        }
      } catch (sessionError) {
        console.error("Session restoration failed:", sessionError);
        clearStoredSession();
        if (active) {
          setLoginError(
            "Unable to verify your session. Check your connection and sign in again.",
          );
          navigateTo("/login");
        }
      } finally {
        if (active) {
          setAppInitializing(false);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccess("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [success]);

  async function loadReports() {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/reports");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load reports.");
      }

      setReports(data.reports);
    } catch (requestError) {
      setError(
        `${requestError.message} Check the API connection and configuration.`,
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingInvitations() {
    if (!token) {
      setPendingInvitations([]);
      return;
    }

    setInvitationsLoading(true);

    try {
      const response = await apiRequest("/auth/invitations/mine");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load invitations.");
      }

      setPendingInvitations(data.invitations);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setInvitationsLoading(false);
    }
  }

  async function loadOrganizations() {
    if (!token) {
      return;
    }

    setOrganizationsLoading(true);
    setError("");

    try {
      const response = await apiRequest("/reports/organizations");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load organizations.");
      }

      setOrganizations(data.organizations);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOrganizationsLoading(false);
    }
  }

  async function loadTeams() {
    if (!token || !user?.organizationId) {
      setTeams([]);
      return;
    }

    setTeamsLoading(true);
    try {
      const response = await apiRequest("/reports/teams");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load teams.");
      }

      setTeams(data.teams);
    } catch (requestError) {
      setError(requestError.message);
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  }

  const loadOrganizationMembers = useCallback(async () => {
    const organizationId = user?.organizationId;
    if (!token || !organizationId || user?.role !== "ORGANIZATION_ADMIN") {
      return;
    }

    setMembersLoading(true);
    try {
      const response = await apiRequest("/organizations/members");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load organization members.");
      }

      if (
        localStorage.getItem("civicfixActiveOrganizationId") !== organizationId
      ) {
        return;
      }

      setOrganizationMembers(data.members);
      setMemberEdits(
        Object.fromEntries(
          data.members.map((member) => [
            member.id,
            { role: member.role, teamId: member.teamId || "" },
          ]),
        ),
      );
    } catch (requestError) {
      if (
        localStorage.getItem("civicfixActiveOrganizationId") !== organizationId
      ) {
        return;
      }

      setError(requestError.message);
      setOrganizationMembers([]);
      setMemberEdits({});
    } finally {
      if (
        localStorage.getItem("civicfixActiveOrganizationId") === organizationId
      ) {
        setMembersLoading(false);
      }
    }
  }, [token, user?.organizationId, user?.role]);

  const loadOrganizationLocations = useCallback(async () => {
    const organizationId = user?.organizationId;
    if (!token || !organizationId || user?.role !== "ORGANIZATION_ADMIN") {
      setManagedLocations([]);
      setManagedLocationsLoading(false);
      return;
    }

    setManagedLocationsLoading(true);
    setLocationError("");
    try {
      const response = await apiRequest("/organizations/locations");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load organization locations.");
      }

      if (
        localStorage.getItem("civicfixActiveOrganizationId") !== organizationId
      ) {
        return;
      }

      setManagedLocations(data.locations);
    } catch (requestError) {
      if (
        localStorage.getItem("civicfixActiveOrganizationId") !== organizationId
      ) {
        return;
      }

      setLocationError(requestError.message);
      setManagedLocations([]);
    } finally {
      if (
        localStorage.getItem("civicfixActiveOrganizationId") === organizationId
      ) {
        setManagedLocationsLoading(false);
      }
    }
  }, [token, user?.organizationId, user?.role]);

  async function loadTeamAssignments() {
    if (!token || !user?.organizationId || !canViewTeamAssignments) {
      setTeamAssignments([]);
      setTeamAssignmentsError("");
      return;
    }

    setTeamAssignments([]);
    if (user.role === "TEAM_MEMBER" && !user.teamId) {
      setTeamAssignmentsLoading(false);
      setTeamAssignmentsError(
        "Your account is not assigned to a team. Ask an organization administrator to update your invitation.",
      );
      return;
    }

    setTeamAssignmentsLoading(true);
    setTeamAssignmentsError("");

    try {
      const response = await apiRequest("/reports/assignments/my-team");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load team assignments.");
      }

      setTeamAssignments(data.assignments);
    } catch (requestError) {
      setTeamAssignmentsError(requestError.message);
      setTeamAssignments([]);
    } finally {
      setTeamAssignmentsLoading(false);
    }
  }

  async function loadLocations(organizationId) {
    if (!token || !organizationId) {
      setAvailableLocations([]);
      return;
    }

    setLocationsLoading(true);

    try {
      const response = await apiRequest(
        `/reports/organizations/${organizationId}/locations`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load locations.");
      }

      setAvailableLocations(data.locations);
      setForm((currentForm) => ({
        ...currentForm,
        locationId: "",
      }));
    } catch (requestError) {
      setError(requestError.message);
      setAvailableLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadReports();
      loadOrganizations();
      loadPendingInvitations();
      loadTeamAssignments();
    }
  }, [token, user?.organizationId]);

  useEffect(() => {
    if (!token || !user?.organizationId) {
      setTeams([]);
      return;
    }

    loadTeams();
  }, [token, user?.organizationId]);

  useEffect(() => {
    loadOrganizationMembers();
  }, [loadOrganizationMembers]);

  useEffect(() => {
    loadOrganizationLocations();
  }, [loadOrganizationLocations]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const destinationOrganizationId =
      reportAudience === "own" ? user.organizationId : form.organizationId;

    loadLocations(destinationOrganizationId);
  }, [token, user?.organizationId, reportAudience, form.organizationId]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    setError("");
    setSuccess("");
    setLastAiAnalysis(null);
    setInviteResult("");
    setPendingInvitations([]);

    try {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to log in.");
      }

      const accessToken = data.accessToken || data.token;
      if (!accessToken) {
        throw new Error("The server did not return an access token.");
      }

      const authenticatedUser = getAuthenticatedUser(data.user);
      accessTokenInMemory = accessToken;
      localStorage.removeItem("civicfixUser");
      setToken(accessToken);
      setUser(authenticatedUser);
      const isStaff = STAFF_ROLES.includes(authenticatedUser.role);
      setView(isStaff ? "staff" : "reporter");
      setReportAudience(authenticatedUser.organizationId ? "own" : "external");
      setLoginForm(initialLoginForm);
      setTimeout(loadPendingInvitations, 0);
    } catch (loginRequestError) {
      setLoginError(loginRequestError.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLoginChange(event) {
    const { name, value } = event.target;
    setLoginForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleRegisterChange(event) {
    const { name, value } = event.target;
    setRegisterForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleInvitationAcceptChange(event) {
    const { name, value } = event.target;
    setInvitationAcceptForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function decidePendingInvitation(invitationId, decision) {
    setError("");

    try {
      const response = await apiRequest(
        `/auth/invitations/${invitationId}/decision`,
        {
          method: "POST",
          body: JSON.stringify({ decision }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update invitation.");
      }

      setSuccess(
        decision === "accept"
          ? "Invitation accepted. Your organization access is ready."
          : "Invitation declined.",
      );
      await loadPendingInvitations();
      if (decision === "accept") {
        window.location.reload();
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleInvitationAccept(event) {
    event.preventDefault();

    if (invitationAccountType === "existing") {
      sessionStorage.setItem(
        "civicfixPendingInvitationToken",
        invitationToken,
      );
      navigateTo("/login");
      return;
    }

    setInvitationAcceptLoading(true);
    setInvitationAcceptError("");
    setInvitationAcceptSuccess("");

    if (!invitationToken) {
      setInvitationAcceptError(
        "This invitation link is missing its invitation token.",
      );
      setInvitationAcceptLoading(false);
      return;
    }

    try {
      const response = await apiRequest("/auth/invitations/accept", {
        method: "POST",
        body: JSON.stringify({
          token: invitationToken,
          firstName: invitationAcceptForm.firstName,
          lastName: invitationAcceptForm.lastName,
          password: invitationAcceptForm.password,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to accept invitation.");
      }

      setInvitationAcceptSuccess(
        "Invitation accepted. You can now sign in to access your organization workspace.",
      );
      setInvitationAcceptForm({
        firstName: "",
        lastName: "",
        password: "",
      });
    } catch (requestError) {
      setInvitationAcceptError(requestError.message);
    } finally {
      setInvitationAcceptLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setRegisterLoading(true);
    setRegisterError("");
    setRegisterSuccess("");

    try {
      const registrationData = registerAccountType === "reporter"
        ? {
            firstName: registerForm.firstName,
            lastName: registerForm.lastName,
            email: registerForm.email,
            password: registerForm.password,
          }
        : {
            ...registerForm,
            ...(registerForm.organizationType
              ? { organizationType: registerForm.organizationType }
              : {}),
          };

      if (!registrationData.organizationType) {
        delete registrationData.organizationType;
      }

      const response = await apiRequest(
        registerAccountType === "reporter"
          ? "/auth/register/reporter"
          : "/auth/register",
        {
        method: "POST",
        body: JSON.stringify(registrationData),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        const validationMessage = data.errors?.fieldErrors
          ? Object.values(data.errors.fieldErrors).flat().join(" ")
          : data.message;
        throw new Error(validationMessage || "Unable to create organization.");
      }

      setRegisterForm(initialRegisterForm);
      setRegisterSuccess(
        registerAccountType === "reporter"
          ? "Reporter account created. Sign in to continue."
          : "Organization created. Sign in to continue.",
      );
      navigateTo("/login");
      setLoginForm({
        ...initialLoginForm,
        email: registrationData.email,
      });
    } catch (registrationRequestError) {
      setRegisterError(registrationRequestError.message);
    } finally {
      setRegisterLoading(false);
    }
  }

  async function handlePasswordRecovery(event) {
    event.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError("");
    setRecoverySuccess("");

    try {
      if (authMode === "forgot-password") {
        const response = await apiRequest("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: recoveryEmail }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to request a password reset.");
        }

        setRecoverySuccess(data.message);
        setRecoveryEmail("");
      } else {
        const resetToken = new URLSearchParams(window.location.search).get("token");
        if (!resetToken) {
          throw new Error("This password reset link is missing its token.");
        }

        const response = await apiRequest("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({
            token: resetToken,
            password: recoveryPassword,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to reset your password.");
        }

        window.history.replaceState({}, "", "/reset-password");
        setRecoveryPassword("");
        setRecoverySuccess("Password reset successfully. You can now sign in.");
      }
    } catch (requestError) {
      setRecoveryError(requestError.message);
    } finally {
      setRecoveryLoading(false);
    }
  }

  function showLogin() {
    navigateTo("/login");
    setLoginError("");
    setRegisterError("");
    setRegisterSuccess("");
  }

  function showRegister() {
    navigateTo("/register");
    setLoginError("");
    setRegisterError("");
    setRegisterSuccess("");
  }

  function showLanding() {
    navigateTo("/");
    setLoginError("");
    setRegisterError("");
    setRegisterSuccess("");
  }

  function navigateTo(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }

    setAuthPath(path);
  }

  async function handleLogout() {
    try {
      const response = await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.message || "Unable to log out. Please try again.");
        return;
      }
    } catch (logoutError) {
      console.error("Server logout request failed:", logoutError);
      setError("Unable to log out because the server could not be reached.");
      return;
    }

    accessTokenInMemory = null;
    localStorage.removeItem("civicfixToken");
    localStorage.removeItem("civicfixUser");
    localStorage.removeItem("civicfixActiveOrganizationId");
    setToken(null);
    setUser(null);
    setReports([]);
    setView("reporter");
    setReportAudience("own");
    setForm(initialForm);
    setSelectedReportImages([]);
    if (reportImageInputRef.current) {
      reportImageInputRef.current.value = "";
    }
    setReportImageError("");
    setAvailableLocations([]);
    setError("");
    setSuccess("");
    setLastAiAnalysis(null);
    setInviteResult("");
    setSelectedReport(null);
    setHistory([]);
  }

  async function openReportDetails(report) {
    setSelectedReport(report);
    setHistory([]);
    setHistoryError("");
    setAssignments([]);
    setAssignmentsError("");
    setHistoryLoading(true);
    setAssignmentsLoading(true);

    try {
      const [historyResponse, assignmentsResponse] = await Promise.all([
        apiRequest(`/reports/${report.id}/history`),
        apiRequest(`/reports/${report.id}/assignments`),
      ]);
      const data = await historyResponse.json();
      const assignmentsData = await assignmentsResponse.json();

      if (!historyResponse.ok) {
        throw new Error(data.message || "Unable to load report history.");
      }

      if (!assignmentsResponse.ok) {
        throw new Error(
          assignmentsData.message || "Unable to load report assignments.",
        );
      }

      setHistory(data.history);
      setAssignments(assignmentsData.assignments);
    } catch (requestError) {
      setHistoryError(requestError.message);
      setAssignmentsError(requestError.message);
    } finally {
      setHistoryLoading(false);
      setAssignmentsLoading(false);
    }
  }

  function closeReportDetails() {
    setSelectedReport(null);
    setHistory([]);
    setHistoryError("");
    setAssignments([]);
    setAssignmentsError("");
  }

  async function handleAssignmentAction(
    assignmentId,
    action,
    body = {},
    successMessage,
  ) {
    setActionId(assignmentId);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/reports/assignments/${assignmentId}/${action}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update assignment.");
      }

      setSuccess(successMessage);
      await loadReports();
      await loadTeamAssignments();

      if (selectedReport) {
        await openReportDetails(data.report || selectedReport);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionId("");
    }
  }

  function handleCompletionNoteChange(assignmentId, value) {
    setCompletionNotes((currentNotes) => ({
      ...currentNotes,
      [assignmentId]: value,
    }));
  }

  function handleReviewNoteChange(assignmentId, value) {
    setReviewNotes((currentNotes) => ({
      ...currentNotes,
      [assignmentId]: value,
    }));
  }

  function canActOnAssignment(assignment) {
    return (
      Boolean(user?.teamId) &&
      assignment.teamId === user.teamId &&
      ["TEAM_MEMBER", "SUPERVISOR", "ORGANIZATION_ADMIN"].includes(
        user.role,
      )
    );
  }

  function getSelectedTeamId(report) {
    if (assignmentSelections[report.id]) {
      return assignmentSelections[report.id];
    }

    return teams.some((team) => team.id === report.assignedTeamId)
      ? report.assignedTeamId
      : "";
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleReportImagesChange(event) {
    const files = Array.from(event.target.files || []);
    const invalidFile = files.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024,
    );

    if (files.length > 5) {
      setReportImageError("You can attach up to 5 images.");
      event.target.value = "";
      return;
    }

    if (invalidFile) {
      setReportImageError(
        invalidFile.size > 5 * 1024 * 1024
          ? "Each image must be 5 MB or smaller."
          : "Only JPEG, PNG, and WebP images are allowed.",
      );
      event.target.value = "";
      return;
    }

    setReportImageError("");
    setSelectedReportImages(
      files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    setLastAiAnalysis(null);

    try {
      const isExternalReport = reportAudience === "external";
      const reportData = {
        ...form,
        ...(isExternalReport ? { organizationId: form.organizationId } : {}),
      };

      if (!isExternalReport || !reportData.organizationId) {
        delete reportData.organizationId;
      }

      if (!reportData.locationId) {
        delete reportData.locationId;
      }

      const reportBody = new FormData();
      Object.entries(reportData).forEach(([name, value]) => {
        if (value !== undefined && value !== null) {
          reportBody.append(name, String(value));
        }
      });
      selectedReportImages.forEach(({ file }) => {
        reportBody.append("images", file);
      });

      const response = await apiRequest("/reports", {
        method: "POST",
        body: reportBody,
      });
      const data = await response.json();

      if (!response.ok) {
        const validationMessage = data.errors?.fieldErrors
          ? Object.values(data.errors.fieldErrors).flat().join(" ")
          : data.message;
        throw new Error(validationMessage || "Unable to submit report.");
      }

      setReports((currentReports) => [data.report, ...currentReports]);
      setLastAiAnalysis(data.aiAnalysis);
      setForm(initialForm);
      setSelectedReportImages([]);
      setReportImageError("");
      if (reportImageInputRef.current) {
        reportImageInputRef.current.value = "";
      }
      setSuccess("Your report was submitted and is now being reviewed.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function assignReport(reportId, teamId) {
    setActionId(reportId);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(`/reports/${reportId}/assign`, {
        method: "POST",
        body: JSON.stringify(teamId ? { teamId } : {}),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to assign report.");
      }

      setSuccess(`Report assigned to ${data.assignment.team.name}.`);
      await loadReports();
      await loadTeamAssignments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionId("");
    }
  }

  async function updateReportStatus(reportId, status) {
    setActionId(reportId);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(`/reports/${reportId}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          notes: `Status changed to ${formatStatus(status)} by staff.`,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update report status.");
      }

      setSuccess("Report status updated.");
      await loadReports();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionId("");
    }
  }

  async function handleInviteSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setInviteResult("");

    try {
      const response = await apiRequest("/auth/invitations", {
        method: "POST",
        body: JSON.stringify({
          ...inviteForm,
          ...(inviteForm.teamId ? {} : { teamId: undefined }),
          expiresInDays: 7,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to create invitation.");
      }

      setInviteForm({ email: "", role: "REPORTER", teamId: "" });
      setInviteResult(
        data.invitation.token
          ? `Invitation created. Share this link with the invited person: ${window.location.origin}/accept-invitation?token=${data.invitation.token}`
          : "Invitation created and sent by email.",
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSaveOrganizationMember(member) {
    const changes = memberEdits[member.id];
    if (!changes) {
      return;
    }

    setMemberActionId(member.id);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/organizations/members/${member.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            role: changes.role,
            teamId: changes.role === "TEAM_MEMBER" ? changes.teamId : null,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update organization member.");
      }

      setOrganizationMembers((currentMembers) =>
        currentMembers.map((currentMember) =>
          currentMember.id === member.id ? data.member : currentMember,
        ),
      );
      setMemberEdits((currentEdits) => ({
        ...currentEdits,
        [member.id]: {
          role: data.member.role,
          teamId: data.member.teamId || "",
        },
      }));
      setSuccess("Member role and team updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMemberActionId("");
    }
  }

  async function handleRemoveOrganizationMember(member) {
    const memberName =
      [member.user.firstName, member.user.lastName].filter(Boolean).join(" ") ||
      member.user.email;
    if (
      !window.confirm(
        `Remove ${memberName} from this organization? Their account and past reports will remain.`,
      )
    ) {
      return;
    }

    setMemberActionId(member.id);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/organizations/members/${member.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to remove organization member.");
      }

      setOrganizationMembers((currentMembers) =>
        currentMembers.filter((currentMember) => currentMember.id !== member.id),
      );
      setMemberEdits((currentEdits) => {
        const nextEdits = { ...currentEdits };
        delete nextEdits[member.id];
        return nextEdits;
      });
      setSuccess(`${memberName} was removed from this organization.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMemberActionId("");
    }
  }

  function cancelLocationEdit() {
    setEditingLocationId("");
    setLocationForm({ name: "", description: "" });
    setLocationError("");
    setLocationSuccess("");
  }

  async function handleLocationSubmit(event) {
    event.preventDefault();
    setLocationSaving(true);
    setLocationError("");
    setLocationSuccess("");

    try {
      const isEditing = Boolean(editingLocationId);
      const response = await apiRequest(
        isEditing
          ? `/organizations/locations/${editingLocationId}`
          : "/organizations/locations",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(locationForm),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save location.");
      }

      setManagedLocations((currentLocations) => {
        const nextLocations = isEditing
          ? currentLocations.map((location) =>
              location.id === data.location.id ? data.location : location,
            )
          : [...currentLocations, data.location];
        return nextLocations.sort(
          (first, second) =>
            Number(second.isActive) - Number(first.isActive) ||
            first.name.localeCompare(second.name),
        );
      });
      setLocationForm({ name: "", description: "" });
      setEditingLocationId("");
      setLocationSuccess(data.message);
      if (reportAudience === "own" && user?.organizationId) {
        await loadLocations(user.organizationId);
      }
    } catch (requestError) {
      setLocationError(requestError.message);
    } finally {
      setLocationSaving(false);
    }
  }

  async function handleDeactivateLocation(location) {
    if (
      !window.confirm(
        `Deactivate "${location.name}"? It will no longer be selectable for new reports, but existing reports keep this location.`,
      )
    ) {
      return;
    }

    setLocationActionId(location.id);
    setLocationError("");
    setLocationSuccess("");
    try {
      const response = await apiRequest(
        `/organizations/locations/${location.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to deactivate location.");
      }

      setManagedLocations((currentLocations) =>
        currentLocations
          .map((currentLocation) =>
            currentLocation.id === location.id
              ? { ...currentLocation, isActive: false }
              : currentLocation,
          )
          .sort(
            (first, second) =>
              Number(second.isActive) - Number(first.isActive) ||
              first.name.localeCompare(second.name),
          ),
      );
      setLocationSuccess(data.message);
      if (reportAudience === "own" && user?.organizationId) {
        await loadLocations(user.organizationId);
      }
    } catch (requestError) {
      setLocationError(requestError.message);
    } finally {
      setLocationActionId("");
    }
  }

  async function handleReactivateLocation(location) {
    setLocationActionId(location.id);
    setLocationError("");
    setLocationSuccess("");
    try {
      const response = await apiRequest(
        `/organizations/locations/${location.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: location.name,
            description: location.description || "",
            isActive: true,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to reactivate location.");
      }

      setManagedLocations((currentLocations) =>
        currentLocations
          .map((currentLocation) =>
            currentLocation.id === location.id ? data.location : currentLocation,
          )
          .sort(
            (first, second) =>
              Number(second.isActive) - Number(first.isActive) ||
              first.name.localeCompare(second.name),
          ),
      );
      setLocationSuccess(data.message);
      if (reportAudience === "own" && user?.organizationId) {
        await loadLocations(user.organizationId);
      }
    } catch (requestError) {
      setLocationError(requestError.message);
    } finally {
      setLocationActionId("");
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      const response = await apiRequest("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          ...(profileForm.currentPassword
            ? { currentPassword: profileForm.currentPassword }
            : {}),
          ...(profileForm.newPassword
            ? { newPassword: profileForm.newPassword }
            : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update your profile.");
      }

      setUser((currentUser) => ({ ...currentUser, ...data.user }));
      setProfileForm((currentForm) => ({
        ...currentForm,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        currentPassword: "",
        newPassword: "",
      }));
      setProfileSuccess(data.message);
    } catch (requestError) {
      setProfileError(requestError.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleCreateTeam(event) {
    event.preventDefault();
    setTeamCreating(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest("/reports/teams", {
        method: "POST",
        body: JSON.stringify(teamForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to create team.");
      }

      setTeams((currentTeams) =>
        [...currentTeams, data.team].sort((first, second) =>
          first.name.localeCompare(second.name),
        ),
      );
      setTeamForm({ name: "", description: "" });
      setSuccess(`Team "${data.team.name}" created.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTeamCreating(false);
    }
  }

  const scopedReports = view === "staff"
    ? reports.filter((report) => report.organizationId === user?.organizationId)
    : reports;
  const activeReports = scopedReports.filter(
    (report) => !["CLOSED", "VERIFIED"].includes(report.status),
  );
  const unassignedCount = scopedReports.filter(
    (report) => !report.assignedTeamId,
  ).length;
  const resolvedReports = scopedReports.filter((report) =>
    ["RESOLVED", "VERIFIED", "CLOSED"].includes(report.status),
  );

  if (appInitializing) {
    return (
      <div className="app-shell skeleton-screen" role="status" aria-label="Loading CivicFix">
        <header className="topbar skeleton-topbar" aria-hidden="true">
          <div className="skeleton-brand">
            <span className="skeleton-block skeleton-logo" />
            <span className="skeleton-brand-copy">
              <span className="skeleton-block skeleton-brand-name" />
              <span className="skeleton-block skeleton-brand-tagline" />
            </span>
          </div>
          <span className="skeleton-block skeleton-account" />
        </header>
        <main className="dashboard skeleton-dashboard" aria-hidden="true">
          <section className="skeleton-welcome">
            <div className="skeleton-welcome-copy">
              <span className="skeleton-block skeleton-eyebrow" />
              <span className="skeleton-block skeleton-heading" />
              <span className="skeleton-block skeleton-description" />
              <span className="skeleton-block skeleton-action" />
            </div>
            <span className="skeleton-block skeleton-illustration" />
          </section>
          <section className="skeleton-stats">
            {[1, 2, 3].map((item) => (
              <div className="skeleton-stat-card" key={item}>
                <span className="skeleton-block skeleton-stat-label" />
                <span className="skeleton-block skeleton-stat-value" />
              </div>
            ))}
          </section>
          <section className="skeleton-report-panel">
            <div className="skeleton-report-heading">
              <span className="skeleton-block skeleton-heading-short" />
              <span className="skeleton-block skeleton-filter" />
            </div>
            {[1, 2, 3].map((item) => (
              <div className="skeleton-report-row" key={item}>
                <span className="skeleton-block skeleton-report-icon" />
                <span className="skeleton-report-copy">
                  <span className="skeleton-block skeleton-report-title" />
                  <span className="skeleton-block skeleton-report-detail" />
                </span>
                <span className="skeleton-block skeleton-report-status" />
              </div>
            ))}
          </section>
        </main>
      </div>
    );
  }

  if (
    ["accept-invitation", "forgot-password", "reset-password"].includes(authMode) ||
    !token ||
    !user
  ) {
    return (
      <div className="auth-shell">
        {authMode === "landing" ? (
          <section className="auth-landing">
            <a
              className="auth-landing-brand"
              href="/"
              onClick={(event) => {
                event.preventDefault();
                showLanding();
              }}
            >
              <span className="brand-mark">C</span>
              <strong>CivicFix</strong>
            </a>
            <div className="auth-landing-content">
              <p className="eyebrow">Make every issue visible</p>
              <h1>Turn community concerns into coordinated action.</h1>
              <p className="auth-landing-copy">
                CivicFix helps organizations receive, route, and resolve reports
                with clarity—from local services to large operations.
              </p>
              <div className="auth-landing-points">
                <span><b>01</b> Capture issues in one place</span>
                <span><b>02</b> Route them to the right division</span>
                <span><b>03</b> Keep people informed</span>
              </div>
              <div className="auth-landing-actions">
                <button className="landing-primary-button" type="button" onClick={showLogin}>
                  Sign in
                  <span aria-hidden="true">→</span>
                </button>
                <button className="landing-secondary-button" type="button" onClick={showRegister}>
                  Create an organization
                </button>
              </div>
            </div>
            <div className="auth-landing-orbit orbit-one" aria-hidden="true" />
            <div className="auth-landing-orbit orbit-two" aria-hidden="true" />
          </section>
        ) : (
        <div className="auth-layout auth-form-layout">
          <section className="auth-hero">
            <a
              className="auth-hero-brand"
              href="/"
              onClick={(event) => {
                event.preventDefault();
                showLanding();
              }}
            >
              <span className="brand-mark">C</span>
              <strong>CivicFix</strong>
            </a>
            <p className="eyebrow">Make every issue visible</p>
            <h1>Turn community concerns into coordinated action.</h1>
            <p>
              CivicFix helps organizations receive, route, and resolve reports
              with clarity—from local services to large operations.
            </p>
            <div className="auth-hero-points">
              <span><b>01</b> Capture issues in one place</span>
              <span><b>02</b> Route them to the right division</span>
              <span><b>03</b> Keep people informed</span>
            </div>
          </section>

          <section className="auth-card">
            <a
              className="auth-card-brand"
              href="/"
              onClick={(event) => {
                event.preventDefault();
                showLanding();
              }}
            >
              <span className="brand-mark">C</span>
              <span>
                <strong>CivicFix</strong>
                <small>Report. Route. Resolve.</small>
              </span>
            </a>

            {authMode === "login" ? (
              <>
                <p className="eyebrow">Welcome back</p>
                <h2>Sign in to your workspace</h2>
                <p className="auth-copy">
                  Follow reports, coordinate teams, and keep your organization
                  moving forward.
                </p>
                <form onSubmit={handleLogin}>
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      value={loginForm.email}
                      onChange={handleLoginChange}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  {registerSuccess && <p className="alert success">{registerSuccess}</p>}
                  {loginError && <p className="alert error">{loginError}</p>}
                  <button className="primary-button" type="submit" disabled={loginLoading}>
                    {loginLoading ? "Signing in..." : "Sign in"}
                    {!loginLoading && <span aria-hidden="true">→</span>}
                  </button>
                </form>
                <p className="auth-switch">
                  New to CivicFix?{" "}
                  <button type="button" onClick={showRegister}>
                    Create an organization
                  </button>
                </p>
                <button
                  className="auth-back-button"
                  type="button"
                  onClick={() => {
                    setRecoveryError("");
                    setRecoverySuccess("");
                    navigateTo("/forgot-password");
                  }}
                >
                  Forgot your password?
                </button>
                <button className="auth-back-button" type="button" onClick={showLanding}>
                  ← Back to CivicFix
                </button>
              </>
            ) : authMode === "accept-invitation" ? (
              <>
                <p className="eyebrow">You are invited</p>
                <h2>Join an organization workspace</h2>
                <p className="auth-copy">
                  Choose whether to create a new account or join with your
                  existing CivicFix account.
                </p>
                <div className="account-type-switch" role="group" aria-label="Invitation account type">
                  <button
                    type="button"
                    className={invitationAccountType === "new" ? "active" : ""}
                    onClick={() => {
                      setInvitationAccountType("new");
                      setInvitationAcceptError("");
                    }}
                  >
                    New account
                  </button>
                  <button
                    type="button"
                    className={invitationAccountType === "existing" ? "active" : ""}
                    onClick={() => {
                      setInvitationAccountType("existing");
                      setInvitationAcceptError("");
                    }}
                  >
                    Existing account
                  </button>
                </div>
                {invitationAccountType === "existing" && (
                  <p className="field-hint invitation-login-hint">
                    Sign in with your normal CivicFix account first. After
                    signing in, you will see this invitation and can accept or
                    decline it without sharing your password here.
                  </p>
                )}
                <form onSubmit={handleInvitationAccept}>
                  {invitationAccountType === "existing" ? (
                    <>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => {
                          sessionStorage.setItem(
                            "civicfixPendingInvitationToken",
                            invitationToken,
                          );
                          navigateTo("/login");
                        }}
                      >
                        Continue to sign in
                        <span aria-hidden="true">→</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="form-row">
                    <label>
                      First name
                      <input
                        name="firstName"
                        value={invitationAcceptForm.firstName}
                        onChange={handleInvitationAcceptChange}
                        autoComplete="given-name"
                        required
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        name="lastName"
                        value={invitationAcceptForm.lastName}
                        onChange={handleInvitationAcceptChange}
                        autoComplete="family-name"
                        required
                      />
                    </label>
                      </div>
                      <label>
                        Create password
                        <input
                          name="password"
                          type="password"
                          value={invitationAcceptForm.password}
                          onChange={handleInvitationAcceptChange}
                          minLength="8"
                          autoComplete="new-password"
                          required
                        />
                      </label>
                    </>
                  )}
                  {invitationAcceptError && (
                    <p className="alert error">{invitationAcceptError}</p>
                  )}
                  {invitationAcceptSuccess && (
                    <p className="alert success">{invitationAcceptSuccess}</p>
                  )}
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={invitationAcceptLoading || Boolean(invitationAcceptSuccess)}
                  >
                    {invitationAcceptLoading
                      ? "Joining workspace..."
                      : invitationAcceptSuccess
                        ? "Invitation accepted"
                        : "Accept invitation"}
                    {!invitationAcceptLoading && !invitationAcceptSuccess && (
                      <span aria-hidden="true">→</span>
                    )}
                  </button>
                </form>
                {invitationAcceptSuccess && (
                  <button
                    className="auth-back-button"
                    type="button"
                    onClick={() => {
                      navigateTo("/login");
                      setLoginForm(initialLoginForm);
                    }}
                  >
                    Continue to sign in →
                  </button>
                )}
                {!invitationAcceptSuccess && (
                  <button
                    className="auth-back-button"
                    type="button"
                    onClick={showLanding}
                  >
                    ← Back to CivicFix
                  </button>
                )}
              </>
            ) : authMode === "forgot-password" ? (
              <>
                <p className="eyebrow">Account recovery</p>
                <h2>Reset your password</h2>
                <p className="auth-copy">
                  If an account exists for the email you provide, we will send
                  instructions to reset its password.
                </p>
                <form onSubmit={handlePasswordRecovery}>
                  <label>
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      value={recoveryEmail}
                      onChange={(event) => setRecoveryEmail(event.target.value)}
                      required
                    />
                  </label>
                  {recoveryError && <p className="alert error">{recoveryError}</p>}
                  {recoverySuccess && <p className="alert success">{recoverySuccess}</p>}
                  <button className="primary-button" type="submit" disabled={recoveryLoading}>
                    {recoveryLoading ? "Sending..." : "Send reset link"}
                  </button>
                </form>
                <button className="auth-back-button" type="button" onClick={showLogin}>
                  ← Back to sign in
                </button>
              </>
            ) : authMode === "reset-password" ? (
              <>
                <p className="eyebrow">Account recovery</p>
                <h2>Choose a new password</h2>
                <p className="auth-copy">
                  Use at least 8 characters. Reset links expire after 30 minutes.
                </p>
                <form onSubmit={handlePasswordRecovery}>
                  <label>
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength="8"
                      maxLength="128"
                      value={recoveryPassword}
                      onChange={(event) => setRecoveryPassword(event.target.value)}
                      required
                    />
                  </label>
                  {recoveryError && <p className="alert error">{recoveryError}</p>}
                  {recoverySuccess && <p className="alert success">{recoverySuccess}</p>}
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={recoveryLoading || Boolean(recoverySuccess)}
                  >
                    {recoveryLoading ? "Resetting..." : "Reset password"}
                  </button>
                </form>
                {recoverySuccess && (
                  <button
                    className="auth-back-button"
                    type="button"
                    onClick={() => {
                      setRecoveryError("");
                      setRecoverySuccess("");
                      navigateTo("/login");
                    }}
                  >
                    Continue to sign in →
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="eyebrow">Get started</p>
                <h2>Create your organization workspace</h2>
                <p className="auth-copy">
                Choose the account that matches how you will use CivicFix.
                </p>
                <div className="account-type-switch" role="group" aria-label="Account type">
                <button
                  type="button"
                  className={registerAccountType === "organization" ? "active" : ""}
                  onClick={() => setRegisterAccountType("organization")}
                >
                  Organization owner
                </button>
                <button
                  type="button"
                  className={registerAccountType === "reporter" ? "active" : ""}
                  onClick={() => setRegisterAccountType("reporter")}
                >
                  Reporter
                </button>
                </div>
                <form onSubmit={handleRegister}>
                {registerAccountType === "organization" && <div className="form-row">
                    <label>
                      Organization name
                      <input
                        name="organizationName"
                        value={registerForm.organizationName}
                        onChange={handleRegisterChange}
                        placeholder="e.g. Riverside Services"
                        required
                      />
                    </label>
                    <label>
                      Organization type
                      <select
                        name="organizationType"
                        value={registerForm.organizationType}
                        onChange={handleRegisterChange}
                      >
                        <option value="">Select type (optional)</option>
                        {organizationTypes.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </div>}
                  <div className="form-row">
                    <label>
                      First name
                      <input
                        name="firstName"
                        value={registerForm.firstName}
                        onChange={handleRegisterChange}
                        required
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        name="lastName"
                        value={registerForm.lastName}
                        onChange={handleRegisterChange}
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Work email
                    <input
                      name="email"
                      type="email"
                      value={registerForm.email}
                      onChange={handleRegisterChange}
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      value={registerForm.password}
                      onChange={handleRegisterChange}
                      minLength="8"
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  {registerError && <p className="alert error">{registerError}</p>}
                  <button className="primary-button" type="submit" disabled={registerLoading}>
                    {registerLoading
                      ? "Creating account..."
                      : registerAccountType === "reporter"
                        ? "Create reporter account"
                        : "Create workspace"}
                    {!registerLoading && <span aria-hidden="true">→</span>}
                  </button>
                </form>
                <p className="auth-switch">
                  Already have a workspace?{" "}
                  <button type="button" onClick={showLogin}>
                    Sign in
                  </button>
                </p>
                <button className="auth-back-button" type="button" onClick={showLanding}>
                  ← Back to CivicFix
                </button>
              </>
            )}
          </section>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">C</span>
          <span>
            <strong>CivicFix</strong>
            <small>Report. Route. Resolve.</small>
          </span>
        </a>
        <div className="topbar-context">
          {user.memberships?.length > 0 && (
            <select
              className="organization-switcher"
              value={user.organizationId || ""}
              onChange={(event) => {
                const organizationId = event.target.value;
                const membership = user.memberships.find(
                  (item) => item.organizationId === organizationId,
                );
                localStorage.setItem("civicfixActiveOrganizationId", organizationId);
                setUser((currentUser) => ({
                  ...currentUser,
                  organizationId,
                  role: membership.role,
                  teamId: membership.teamId || null,
                }));
                setView(STAFF_ROLES.includes(membership.role) ? "staff" : "reporter");
                setReportAudience("own");
                setForm(initialForm);
                setReports([]);
                setTeamAssignments([]);
                setTeamAssignmentsError("");
                setError("");
                setSuccess("");
                setLastAiAnalysis(null);
                setInviteResult("");
              }}
              aria-label="Active organization"
            >
              {user.memberships.map((membership) => (
                <option key={membership.organizationId} value={membership.organizationId}>
                  {membership.organization.name}
                </option>
              ))}
            </select>
          )}
          <span className="status-dot" />
          <span>{user.role.replaceAll("_", " ")}</span>
          <div className="view-switcher" role="group" aria-label="Choose dashboard">
            <button
              className={view === "reporter" ? "view-button active" : "view-button"}
              type="button"
              onClick={() => {
                setView("reporter");
                setError("");
                setSuccess("");
                setLastAiAnalysis(null);
                setInviteResult("");
              }}
            >
              Reporter
            </button>
            {canManageReports && (
              <button
                className={view === "staff" ? "view-button active" : "view-button"}
                type="button"
                onClick={() => {
                  setView("staff");
                  setError("");
                  setSuccess("");
                  setLastAiAnalysis(null);
                  setInviteResult("");
                }}
              >
                Staff queue
              </button>
            )}
          </div>
          <div className="profile-menu-container" ref={profileMenuRef}>
            <button
              className="profile-button"
              type="button"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((isOpen) => !isOpen)}
            >
              {(user.firstName?.[0] || "") + (user.lastName?.[0] || "")}
            </button>
            {profileMenuOpen && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-identity">
                  <strong>
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                      "CivicFix user"}
                  </strong>
                  <span>{user.email}</span>
                </div>
                <button
                  className="profile-menu-item"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileReturnView(view);
                    setProfileForm({
                      firstName: user.firstName || "",
                      lastName: user.lastName || "",
                      currentPassword: "",
                      newPassword: "",
                    });
                    setProfileError("");
                    setProfileSuccess("");
                    setProfileMenuOpen(false);
                    setView("profile");
                  }}
                >
                  Profile
                </button>
                <button
                  className="profile-menu-logout"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    handleLogout();
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard">
        {pendingInvitations.length > 0 && (
          <section className="panel invitations-panel">
            <div className="panel-heading reports-heading">
              <div>
                <p className="eyebrow">Action needed</p>
                <h2>Organization invitations</h2>
              </div>
              {invitationsLoading && <span className="field-hint">Refreshing...</span>}
            </div>
            <div className="invitation-list">
              {pendingInvitations.map((invitation) => (
                <article className="invitation-card" key={invitation.id}>
                  <div>
                    <strong>{invitation.organization.name}</strong>
                    <p>
                      You are invited as {formatStatus(invitation.role)}
                      {invitation.team?.name
                        ? ` on ${invitation.team.name}`
                        : " without a team assignment"}
                      .
                    </p>
                    <small>Expires {formatDate(invitation.expiresAt)}</small>
                  </div>
                  <div className="invitation-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => decidePendingInvitation(invitation.id, "accept")}
                    >
                      Accept
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => decidePendingInvitation(invitation.id, "decline")}
                    >
                      Decline
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {view === "profile" ? (
          <section className="panel profile-settings-panel">
            <div className="panel-heading reports-heading">
              <div>
                <p className="eyebrow">Account settings</p>
                <h1>Your profile</h1>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setView(profileReturnView)}
              >
                Back to dashboard
              </button>
            </div>
            <p className="profile-email-note">
              Signed in as <strong>{user.email}</strong>. Email changes are
              disabled until email verification is available.
            </p>
            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <div className="form-row">
                <label>
                  First name
                  <input
                    value={profileForm.firstName}
                    onChange={(event) =>
                      setProfileForm((currentForm) => ({
                        ...currentForm,
                        firstName: event.target.value,
                      }))
                    }
                    maxLength="80"
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={profileForm.lastName}
                    onChange={(event) =>
                      setProfileForm((currentForm) => ({
                        ...currentForm,
                        lastName: event.target.value,
                      }))
                    }
                    maxLength="80"
                    required
                  />
                </label>
              </div>
              <div className="profile-password-fields">
                <h2>Change password (optional)</h2>
                <label>
                  Current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={profileForm.currentPassword}
                    onChange={(event) =>
                      setProfileForm((currentForm) => ({
                        ...currentForm,
                        currentPassword: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength="8"
                    maxLength="128"
                    value={profileForm.newPassword}
                    onChange={(event) =>
                      setProfileForm((currentForm) => ({
                        ...currentForm,
                        newPassword: event.target.value,
                      }))
                    }
                  />
                  <span className="field-hint">
                    Leave both password fields blank to update only your name.
                  </span>
                </label>
              </div>
              {profileError && <p className="alert error">{profileError}</p>}
              {profileSuccess && (
                <p className="alert success">{profileSuccess}</p>
              )}
              <button
                className="primary-button"
                type="submit"
                disabled={profileSaving}
              >
                {profileSaving ? "Saving profile..." : "Save profile"}
              </button>
            </form>
          </section>
        ) : view === "reporter" ? (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">Good morning, {user.firstName || "there"}</p>
                <h1>Make your organization better, one report at a time.</h1>
                <p className="welcome-copy">
                  Tell us what needs attention. CivicFix helps the right team
                  understand and resolve it.
                </p>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <span className="art-sun" />
                <span className="art-building building-one" />
                <span className="art-building building-two" />
                <span className="art-tree tree-one" />
                <span className="art-tree tree-two" />
              </div>
            </section>

            <div className="content-grid">
              <section className="panel report-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">New report</p>
                <h2>What needs attention?</h2>
              </div>
              <span className="step-count">01 / 01</span>
            </div>

            <form onSubmit={handleSubmit}>
              {user.organizationId && (
                <div className="report-audience-switch">
                  <span>Reporting as</span>
                  <button
                    type="button"
                    className={reportAudience === "own" ? "active" : ""}
                    onClick={() => {
                      setReportAudience("own");
                      setForm((currentForm) => ({
                        ...currentForm,
                        organizationId: "",
                      }));
                    }}
                  >
                    My organization
                  </button>
                  <button
                    type="button"
                    className={reportAudience === "external" ? "active" : ""}
                    onClick={() => setReportAudience("external")}
                  >
                    Another organization
                  </button>
                </div>
              )}

              {reportAudience === "external" && (
                <label>
                  Organization where the issue happened
                  <select
                    name="organizationId"
                    value={form.organizationId}
                    onChange={handleChange}
                    disabled={organizationsLoading}
                    required
                  >
                    <option value="">
                      {organizationsLoading
                        ? "Loading organizations..."
                        : "Select an organization"}
                    </option>
                    {reportOrganizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                        {organization.type ? ` — ${formatStatus(organization.type)}` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Your report will be sent to this organization for review.
                  </span>
                </label>
              )}

              <label>
                Short title
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Projector not working"
                  required
                />
              </label>

              <label>
                Describe the issue
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Tell us what happened and how it affects people or operations."
                  rows="5"
                  minLength="10"
                  required
                />
                <span className="field-hint">Please include useful details, but do not share private information.</span>
              </label>

              <label className="report-image-upload">
                Images (optional)
                <input
                  ref={reportImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleReportImagesChange}
                  aria-describedby="report-image-help"
                />
                <span id="report-image-help" className="field-hint">
                  Attach up to 5 JPEG, PNG, or WebP images. Each image must be 5 MB or smaller.
                </span>
                {reportImageError && (
                  <span className="alert error" role="alert">
                    {reportImageError}
                  </span>
                )}
                {selectedReportImages.length > 0 && (
                  <span className="report-image-previews">
                    {selectedReportImages.map(({ file, previewUrl }, index) => (
                      <img
                        key={`${file.name}-${file.lastModified}-${index}`}
                        src={previewUrl}
                        alt={`Selected report attachment ${index + 1}`}
                      />
                    ))}
                  </span>
                )}
              </label>

              <div className="form-row">
                <label>
                  Destination location
                  <select
                    name="locationId"
                    value={form.locationId}
                    onChange={handleChange}
                    disabled={locationsLoading || availableLocations.length === 0}
                    required={availableLocations.length > 0}
                  >
                    <option value="">
                      {locationsLoading
                        ? "Loading locations..."
                        : availableLocations.length > 0
                          ? "Select a location"
                          : "No locations listed"}
                    </option>
                    {availableLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Choose where the issue happened. This can be left blank when no destination locations are listed.
                  </span>
                </label>
                <label>
                  Category
                  <select name="category" value={form.category} onChange={handleChange}>
                    {categories.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Priority
                <select name="priority" value={form.priority} onChange={handleChange}>
                  <option value="LOW">Low — minor issue</option>
                  <option value="MEDIUM">Medium — affects normal use</option>
                  <option value="HIGH">High — significant disruption</option>
                  <option value="CRITICAL">Critical — immediate danger</option>
                </select>
              </label>

              {error && <p className="alert error">{error}</p>}
              {success && <p className="alert success">{success}</p>}

              {lastAiAnalysis && (
                <section className="ai-analysis-card" aria-live="polite">
                  <div className="ai-analysis-heading">
                    <div>
                      <p className="eyebrow">AI assistance</p>
                      <h3>Suggested report classification</h3>
                    </div>
                    <span className="ai-confidence">
                      {Math.round(lastAiAnalysis.confidence * 100)}% confident
                    </span>
                  </div>

                  <p className="ai-summary">{lastAiAnalysis.summary}</p>

                  <div className="ai-analysis-facts">
                    <div>
                      <span>Suggested category</span>
                      <strong>{formatStatus(lastAiAnalysis.category)}</strong>
                    </div>
                    <div>
                      <span>Reason</span>
                      <strong>{lastAiAnalysis.rationale}</strong>
                    </div>
                  </div>

                  <small className="ai-disclaimer">
                    AI provides a suggestion. Your organization makes the final decision.
                  </small>
                </section>
              )}

              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Submitting report..." : "Submit report"}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </form>
              </section>

              <section className="panel reports-panel">
            <div className="panel-heading reports-heading">
              <div>
                <p className="eyebrow">Your activity</p>
                <h2>Recent reports</h2>
              </div>
              <button className="text-button" type="button" onClick={loadReports}>
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="empty-state">Loading your reports...</div>
            ) : reports.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">✦</span>
                <strong>No reports yet</strong>
                <span>Your submitted issues will appear here.</span>
              </div>
            ) : (
              <div className="report-list">
                {reports.map((report) => (
                  <button
                    className="report-card report-card-button"
                    key={report.id}
                    type="button"
                    onClick={() => openReportDetails(report)}
                  >
                    <div className="report-card-top">
                      <span className={`status-badge status-${report.status.toLowerCase()}`}>
                        {formatStatus(report.status)}
                      </span>
                      <span className="report-date">{formatDate(report.createdAt)}</span>
                    </div>
                    <h3>{report.title || "Untitled report"}</h3>
                    <p>{report.description}</p>
                    {report.images?.length > 0 && (
                      <span className="report-image-gallery report-card-images">
                        {report.images.map((image, index) => (
                          <img
                            key={image.id}
                            src={image.url}
                            alt={`Report attachment ${index + 1}`}
                            loading="lazy"
                          />
                        ))}
                      </span>
                    )}
                    <div className="report-meta">
                      <span>{report.organization?.name || "Organization"}</span>
                      <span>·</span>
                      <span>{report.location?.name || "Location pending"}</span>
                      <span>·</span>
                      <span>{formatStatus(report.category)}</span>
                    </div>
                    <span className="view-details">View details →</span>
                  </button>
                ))}
              </div>
            )}
              </section>
            </div>
          </>
        ) : (
          <section className="staff-view">
            <section className="staff-hero">
              <div>
                <p className="eyebrow">Operations workspace</p>
                <h1>Keep your organization moving.</h1>
                <p className="welcome-copy">
                  Review incoming issues, assign ownership, and keep reporters
                  informed as work progresses.
                </p>
              </div>
              <div className="staff-hero-icon" aria-hidden="true">✓</div>
            </section>

            <div className="queue-summary">
              <div className="summary-card">
                <span className="summary-label">Active reports</span>
                <strong>{activeReports.length}</strong>
                <span className="summary-note">Needs attention</span>
              </div>
              <div className="summary-card accent-card">
                <span className="summary-label">Unassigned</span>
                <strong>{unassignedCount}</strong>
                <span className="summary-note">Awaiting a team</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">All reports</span>
                <strong>{reports.length}</strong>
                <span className="summary-note">In this organization</span>
              </div>
              <div className="summary-card resolved-summary-card">
                <span className="summary-label">Resolved</span>
                <strong>{resolvedReports.length}</strong>
                <span className="summary-note">Completed reports</span>
              </div>
              <button className="refresh-card" type="button" onClick={loadReports}>
                <span>↻</span>
                Refresh queue
              </button>
            </div>

            {canViewTeamAssignments && (
              <section className="panel team-inbox-panel">
                <div className="panel-heading reports-heading">
                  <div>
                    <p className="eyebrow">Team work</p>
                    <h2>Team assignment inbox</h2>
                  </div>
                  <button
                    className="refresh-card"
                    type="button"
                    onClick={loadTeamAssignments}
                    disabled={teamAssignmentsLoading}
                  >
                    {teamAssignmentsLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {teamAssignmentsLoading ? (
                  <div className="empty-state">Loading team assignments...</div>
                ) : teamAssignmentsError ? (
                  <div className="alert error">{teamAssignmentsError}</div>
                ) : teamAssignments.length === 0 ? (
                  <div className="empty-state">
                    <strong>No team assignments yet</strong>
                    <span>New work assigned to your team will appear here.</span>
                  </div>
                ) : (
                  <div className="team-inbox-list">
                    {teamAssignments.map((assignment) => (
                      <article
                        className="team-inbox-card"
                        key={assignment.id}
                      >
                        <div className="team-inbox-card-content">
                          <div className="report-card-top">
                            <span
                              className={`status-badge status-${assignment.status.toLowerCase()}`}
                            >
                              {formatStatus(assignment.status)}
                            </span>
                            <span
                              className={`priority priority-${assignment.report.priority.toLowerCase()}`}
                            >
                              {assignment.report.priority} priority
                            </span>
                          </div>
                          <h3>{assignment.report.title || "Untitled report"}</h3>
                          <p>{assignment.report.description}</p>
                          <div className="report-meta">
                            <span>{assignment.team.name}</span>
                            <span>·</span>
                            <span>
                              {assignment.report.location?.name || "Location pending"}
                            </span>
                            <span>·</span>
                            <span>{formatDate(assignment.assignedAt)}</span>
                          </div>
                          {assignment.completionNote && (
                            <p className="team-inbox-note">
                              Completion submitted: {assignment.completionNote}
                            </p>
                          )}
                          {assignment.reviewNote && (
                            <p className="team-inbox-note">
                              Review note: {assignment.reviewNote}
                            </p>
                          )}
                        </div>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => openReportDetails(assignment.report)}
                        >
                          View assignment and actions
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {["ORGANIZATION_ADMIN", "SUPERVISOR"].includes(user.role) && (
              <section className="panel invite-panel">
                <div className="panel-heading reports-heading">
                  <div>
                    <p className="eyebrow">Team access</p>
                    <h2>Invite a member</h2>
                  </div>
                </div>
                <form className="invite-form" onSubmit={handleInviteSubmit}>
                  <label>
                    Email
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) =>
                        setInviteForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Role
                    <select
                      value={inviteForm.role}
                      onChange={(event) =>
                        setInviteForm((current) => ({
                          ...current,
                          role: event.target.value,
                          teamId: "",
                        }))
                      }
                    >
                      <option value="REPORTER">Reporter</option>
                      <option value="TEAM_MEMBER">Team member</option>
                      <option value="TRIAGE_OFFICER">Triage officer</option>
                      <option value="SUPERVISOR">Supervisor</option>
                      {user.role === "ORGANIZATION_ADMIN" && (
                        <option value="ORGANIZATION_ADMIN">
                          Organization administrator
                        </option>
                      )}
                    </select>
                  </label>
                  {inviteForm.role === "TEAM_MEMBER" && (
                    <label>
                      Team
                      <select
                        value={inviteForm.teamId}
                        onChange={(event) =>
                          setInviteForm((current) => ({
                            ...current,
                            teamId: event.target.value,
                          }))
                        }
                        required
                        disabled={teamsLoading || teams.length === 0}
                      >
                        <option value="">
                          {teamsLoading
                            ? "Loading teams..."
                            : teams.length
                              ? "Select a team"
                              : "Create a team first"}
                        </option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button className="secondary-button" type="submit">
                    Create invitation
                  </button>
                </form>
                {inviteResult && <p className="alert success">{inviteResult}</p>}

                <div className="team-management">
                  <h3>Organization teams</h3>
                  {teams.length > 0 && (
                    <ul>
                      {teams.map((team) => (
                        <li key={team.id}>{team.name}</li>
                      ))}
                    </ul>
                  )}
                  <form className="invite-form" onSubmit={handleCreateTeam}>
                    <label>
                      Team name
                      <input
                        value={teamForm.name}
                        onChange={(event) =>
                          setTeamForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        minLength="2"
                        maxLength="100"
                        placeholder="e.g. Building maintenance"
                        required
                      />
                    </label>
                    <label>
                      Description (optional)
                      <input
                        value={teamForm.description}
                        onChange={(event) =>
                          setTeamForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        maxLength="500"
                        placeholder="What this team handles"
                      />
                    </label>
                    <button
                      className="secondary-button"
                      type="submit"
                      disabled={teamCreating}
                    >
                      {teamCreating ? "Creating..." : "Create team"}
                    </button>
                  </form>
                </div>
              </section>
            )}

            {user.role === "ORGANIZATION_ADMIN" && (
              <section className="panel member-management-panel">
                <div className="panel-heading reports-heading">
                  <div>
                    <p className="eyebrow">Organization access</p>
                    <h2>Members and positions</h2>
                  </div>
                  <button
                    className="refresh-card member-refresh"
                    type="button"
                    onClick={loadOrganizationMembers}
                    disabled={membersLoading}
                  >
                    {membersLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                <p className="field-hint">
                  Change a member’s role or team, or remove their access to this
                  organization. Their account and existing reports are retained.
                </p>
                {membersLoading ? (
                  <div className="empty-state">Loading organization members...</div>
                ) : organizationMembers.length === 0 ? (
                  <div className="empty-state">
                    <strong>No organization members found</strong>
                    <span>Accepted invitations will appear here.</span>
                  </div>
                ) : (
                  <div className="organization-member-list">
                    {organizationMembers.map((member) => {
                      const changes = memberEdits[member.id] || {
                        role: member.role,
                        teamId: member.teamId || "",
                      };
                      const isSelf = member.userId === user.id;
                      const memberName =
                        [member.user.firstName, member.user.lastName]
                          .filter(Boolean)
                          .join(" ") || "CivicFix member";

                      return (
                        <article
                          className="organization-member-card"
                          key={member.id}
                        >
                          <div className="organization-member-identity">
                            <strong>{memberName}</strong>
                            <span>{member.user.email}</span>
                            {isSelf && (
                              <small>Your current organization membership</small>
                            )}
                          </div>
                          <div className="organization-member-controls">
                            <label>
                              Position
                              <select
                                value={changes.role}
                                disabled={isSelf || memberActionId === member.id}
                                onChange={(event) =>
                                  setMemberEdits((currentEdits) => ({
                                    ...currentEdits,
                                    [member.id]: {
                                      role: event.target.value,
                                      teamId:
                                        event.target.value === "TEAM_MEMBER"
                                          ? changes.teamId
                                          : "",
                                    },
                                  }))
                                }
                              >
                                <option value="REPORTER">Reporter</option>
                                <option value="TRIAGE_OFFICER">Triage officer</option>
                                <option value="TEAM_MEMBER">Team member</option>
                                <option value="SUPERVISOR">Supervisor</option>
                                <option value="ORGANIZATION_ADMIN">
                                  Organization administrator
                                </option>
                              </select>
                            </label>
                            {changes.role === "TEAM_MEMBER" && (
                              <label>
                                Team
                                <select
                                  value={changes.teamId}
                                  disabled={
                                    isSelf ||
                                    memberActionId === member.id ||
                                    teamsLoading ||
                                    teams.length === 0
                                  }
                                  onChange={(event) =>
                                    setMemberEdits((currentEdits) => ({
                                      ...currentEdits,
                                      [member.id]: {
                                        ...changes,
                                        teamId: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Select a team</option>
                                  {teams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                      {team.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <div className="organization-member-actions">
                              <button
                                className="secondary-button"
                                type="button"
                                disabled={
                                  isSelf ||
                                  memberActionId === member.id ||
                                  (changes.role === "TEAM_MEMBER" &&
                                    !changes.teamId)
                                }
                                onClick={() =>
                                  handleSaveOrganizationMember(member)
                                }
                              >
                                {memberActionId === member.id
                                  ? "Saving..."
                                  : "Save changes"}
                              </button>
                              <button
                                className="danger-button"
                                type="button"
                                disabled={isSelf || memberActionId === member.id}
                                onClick={() =>
                                  handleRemoveOrganizationMember(member)
                                }
                              >
                                Remove from organization
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {user.role === "ORGANIZATION_ADMIN" && (
              <section className="panel location-management-panel">
                <div className="panel-heading reports-heading">
                  <div>
                    <p className="eyebrow">Organization setup</p>
                    <h2>Locations</h2>
                  </div>
                  <button
                    className="refresh-card member-refresh"
                    type="button"
                    onClick={loadOrganizationLocations}
                    disabled={managedLocationsLoading}
                  >
                    {managedLocationsLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                <p className="field-hint">
                  Manage the places reporters can select. Deactivating a location
                  preserves it on existing reports and hides it from new reports.
                </p>
                <form className="location-form" onSubmit={handleLocationSubmit}>
                  <label>
                    Location name
                    <input
                      value={locationForm.name}
                      onChange={(event) =>
                        setLocationForm((currentForm) => ({
                          ...currentForm,
                          name: event.target.value,
                        }))
                      }
                      minLength="2"
                      maxLength="150"
                      placeholder="e.g. Main office"
                      required
                    />
                  </label>
                  <label>
                    Description (optional)
                    <input
                      value={locationForm.description}
                      onChange={(event) =>
                        setLocationForm((currentForm) => ({
                          ...currentForm,
                          description: event.target.value,
                        }))
                      }
                      maxLength="500"
                      placeholder="Building, floor, or other helpful details"
                    />
                  </label>
                  <div className="location-form-actions">
                    <button
                      className="secondary-button"
                      type="submit"
                      disabled={locationSaving}
                    >
                      {locationSaving
                        ? "Saving..."
                        : editingLocationId
                          ? "Save location"
                          : "Add location"}
                    </button>
                    {editingLocationId && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={cancelLocationEdit}
                        disabled={locationSaving}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
                {locationError && <p className="alert error">{locationError}</p>}
                {locationSuccess && (
                  <p className="alert success">{locationSuccess}</p>
                )}
                {managedLocationsLoading ? (
                  <div className="empty-state">Loading locations...</div>
                ) : managedLocations.length === 0 ? (
                  <div className="empty-state">
                    <strong>No locations have been added</strong>
                    <span>Create a location for reporters to choose on reports.</span>
                  </div>
                ) : (
                  <div className="organization-location-list">
                    {managedLocations.map((location) => (
                      <article
                        className="organization-location-card"
                        key={location.id}
                      >
                        <div className="organization-location-details">
                          <div>
                            <strong>{location.name}</strong>
                            <span
                              className={
                                location.isActive
                                  ? "location-state active"
                                  : "location-state inactive"
                              }
                            >
                              {location.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          {location.description && <p>{location.description}</p>}
                        </div>
                        <div className="organization-location-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={locationActionId === location.id}
                            onClick={() => {
                              setEditingLocationId(location.id);
                              setLocationForm({
                                name: location.name,
                                description: location.description || "",
                              });
                              setLocationError("");
                              setLocationSuccess("");
                            }}
                          >
                            Edit
                          </button>
                          {location.isActive ? (
                            <button
                              className="danger-button"
                              type="button"
                              disabled={locationActionId === location.id}
                              onClick={() => handleDeactivateLocation(location)}
                            >
                              {locationActionId === location.id
                                ? "Working..."
                                : "Deactivate"}
                            </button>
                          ) : (
                            <button
                              className="secondary-button"
                              type="button"
                              disabled={locationActionId === location.id}
                              onClick={() => handleReactivateLocation(location)}
                            >
                              {locationActionId === location.id
                                ? "Working..."
                                : "Reactivate"}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {(error || success) && (
              <p className={error ? "alert error queue-alert" : "alert success queue-alert"}>
                {error || success}
              </p>
            )}

            <section className="panel queue-panel">
              <div className="panel-heading reports-heading">
                <div>
                  <p className="eyebrow">Live queue</p>
                  <h2>Reports needing attention</h2>
                </div>
                <span className="queue-filter">All active</span>
              </div>

              {loading ? (
                <div className="empty-state">Loading the staff queue...</div>
              ) : activeReports.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">✓</span>
                  <strong>Queue is clear</strong>
                  <span>There are no active reports right now.</span>
                </div>
              ) : (
                <div className="queue-list">
                  {activeReports.map((report) => (
                    <article className="queue-card" key={report.id}>
                      <div className="queue-card-main">
                        <div className="report-card-top">
                          <span className={`status-badge status-${report.status.toLowerCase()}`}>
                            {formatStatus(report.status)}
                          </span>
                          <span className={`priority priority-${report.priority.toLowerCase()}`}>
                            {report.priority} priority
                          </span>
                        </div>
                        <h3>{report.title || "Untitled report"}</h3>
                        <p>{report.description}</p>
                        <div className="report-meta">
                          <span>{report.location?.name || "Location pending"}</span>
                          <span>·</span>
                          <span>{formatStatus(report.category)}</span>
                          <span>·</span>
                          <span>{formatDate(report.createdAt)}</span>
                        </div>
                        <button
                          className="view-details queue-details-button"
                          type="button"
                          onClick={() => openReportDetails(report)}
                        >
                          View details →
                        </button>
                      </div>
                      <div className="queue-card-actions">
                        <div className="assignment-label">
                          <span>Assigned team</span>
                          <strong>{report.assignedTeam?.name || "Not assigned"}</strong>
                        </div>
                        <select
                          aria-label={`Choose team for ${report.title || "report"}`}
                          value={getSelectedTeamId(report)}
                          disabled={
                            actionId === report.id ||
                            teamsLoading ||
                            teams.length === 0
                          }
                          onChange={(event) => {
                            setAssignmentSelections((currentSelections) => ({
                              ...currentSelections,
                              [report.id]: event.target.value,
                            }));
                          }}
                        >
                          <option value="">
                            {teamsLoading
                              ? "Loading teams..."
                              : teams.length
                                ? "Select a team"
                                : "Create a team first"}
                          </option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            actionId === report.id ||
                            !getSelectedTeamId(report) ||
                            getSelectedTeamId(report) === report.assignedTeamId
                          }
                          onClick={() =>
                            assignReport(report.id, getSelectedTeamId(report))
                          }
                        >
                          {actionId === report.id
                            ? "Assigning..."
                            : report.assignedTeamId
                              ? "Change team"
                              : "Assign team"}
                        </button>
                        <select
                          aria-label={`Update status for ${report.title || "report"}`}
                          value={report.status}
                          disabled={actionId === report.id}
                          onChange={(event) =>
                            updateReportStatus(report.id, event.target.value)
                          }
                        >
                          <option value="SUBMITTED">Submitted</option>
                          <option value="UNDER_REVIEW">Under review</option>
                          <option value="ASSIGNED">Assigned</option>
                          <option value="ACKNOWLEDGED">Acknowledged</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="NEEDS_INFORMATION">Needs information</option>
                          <option value="RESOLVED">Resolved</option>
                        </select>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}
      </main>

      {selectedReport && (
        <div className="details-backdrop" role="presentation" onClick={closeReportDetails}>
          <aside
            className="details-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="details-header">
              <div>
                <p className="eyebrow">Report details</p>
                <h2 id="report-details-title">
                  {selectedReport.title || "Untitled report"}
                </h2>
              </div>
              <button
                className="close-button"
                type="button"
                onClick={closeReportDetails}
                aria-label="Close report details"
              >
                ×
              </button>
            </div>

            <div className="details-status-row">
              <span className={`status-badge status-${selectedReport.status.toLowerCase()}`}>
                {formatStatus(selectedReport.status)}
              </span>
              <span className={`priority priority-${selectedReport.priority.toLowerCase()}`}>
                {selectedReport.priority} priority
              </span>
            </div>

            <p className="details-description">{selectedReport.description}</p>
            {selectedReport.images?.length > 0 && (
              <section className="details-images" aria-label="Report images">
                <p className="eyebrow">Attached images</p>
                <div className="report-image-gallery details-image-gallery">
                  {selectedReport.images.map((image, index) => (
                    <a
                      key={image.id}
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={image.url}
                        alt={`Report attachment ${index + 1}`}
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}

            <div className="details-facts">
              <div>
                <span>Organization</span>
                <strong>{selectedReport.organization?.name || "Not specified"}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{selectedReport.location?.name || "Not specified"}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{formatStatus(selectedReport.category)}</strong>
              </div>
              <div>
                <span>Assigned team</span>
                <strong>{selectedReport.assignedTeam?.name || "Not assigned"}</strong>
              </div>
              <div>
                <span>Submitted</span>
                <strong>{formatDate(selectedReport.createdAt)}</strong>
              </div>
            </div>

            {(selectedReport.aiSummary ||
              selectedReport.aiCategory ||
              selectedReport.aiConfidence !== null) && (
              <section className="details-ai-analysis">
                <div className="details-ai-heading">
                  <div>
                    <p className="eyebrow">AI assistance</p>
                    <h3>Suggested classification</h3>
                  </div>
                  {selectedReport.aiConfidence !== null && (
                    <span className="ai-confidence">
                      {Math.round(selectedReport.aiConfidence * 100)}% confident
                    </span>
                  )}
                </div>

                {selectedReport.aiSummary && (
                  <p className="ai-summary">{selectedReport.aiSummary}</p>
                )}

                <div className="details-ai-facts">
                  {selectedReport.aiCategory && (
                    <div>
                      <span>Suggested category</span>
                      <strong>{formatStatus(selectedReport.aiCategory)}</strong>
                    </div>
                  )}
                  {selectedReport.aiRationale && (
                    <div>
                      <span>Reason</span>
                      <strong>{selectedReport.aiRationale}</strong>
                    </div>
                  )}
                </div>

                <small className="ai-disclaimer">
                AI provides a suggestion. Your organization makes the final decision.
                </small>
              </section>
            )}

            <section className="assignment-workflow">
              <div className="history-heading">
                <div>
                  <p className="eyebrow">Work coordination</p>
                  <h3>Team assignments</h3>
                </div>
                <span>{assignments.length} assignments</span>
              </div>

              {assignmentsLoading ? (
                <div className="history-message">Loading assignments...</div>
              ) : assignmentsError ? (
                <div className="alert error">{assignmentsError}</div>
              ) : assignments.length === 0 ? (
                <div className="history-message">
                  No team assignments have been created yet.
                </div>
              ) : (
                <div className="assignment-list">
                  {assignments.map((assignment) => {
                    const isAssignedTeam = canActOnAssignment(assignment);
                    const canReviewAssignment = [
                      "SUPERVISOR",
                      "ORGANIZATION_ADMIN",
                    ].includes(user?.role);
                    const completionNote =
                      completionNotes[assignment.id] || "";
                    const reviewNote = reviewNotes[assignment.id] || "";
                    const assignmentBusy = actionId === assignment.id;

                    return (
                      <article
                        className="assignment-card"
                        key={assignment.id}
                      >
                        <div className="assignment-card-header">
                          <div>
                            <strong>{assignment.team.name}</strong>
                            <span>
                              Assigned {formatDate(assignment.assignedAt)}
                            </span>
                          </div>
                          <div className="assignment-statuses">
                            <span
                              className={`status-badge status-${assignment.status.toLowerCase()}`}
                            >
                              {formatStatus(assignment.status)}
                            </span>
                            <span className="review-status">
                              {formatStatus(assignment.reviewStatus)}
                            </span>
                          </div>
                        </div>

                        {assignment.completionNote && (
                          <div className="assignment-note">
                            <span>Team completion note</span>
                            <p>{assignment.completionNote}</p>
                          </div>
                        )}

                        {assignment.reviewNote && (
                          <div className="assignment-note">
                            <span>Reviewer note</span>
                            <p>{assignment.reviewNote}</p>
                          </div>
                        )}

                        {isAssignedTeam &&
                          assignment.status === "PENDING" && (
                            <button
                              className="secondary-button"
                              type="button"
                              disabled={assignmentBusy}
                              onClick={() =>
                                handleAssignmentAction(
                                  assignment.id,
                                  "acknowledge",
                                  {},
                                  "Assignment acknowledged.",
                                )
                              }
                            >
                              {assignmentBusy
                                ? "Saving..."
                                : "Acknowledge assignment"}
                            </button>
                          )}

                        {isAssignedTeam &&
                          assignment.status === "ACKNOWLEDGED" && (
                            <button
                              className="secondary-button"
                              type="button"
                              disabled={assignmentBusy}
                              onClick={() =>
                                handleAssignmentAction(
                                  assignment.id,
                                  "start",
                                  {},
                                  "Work started on the assignment.",
                                )
                              }
                            >
                              {assignmentBusy ? "Saving..." : "Start work"}
                            </button>
                          )}

                        {isAssignedTeam &&
                          assignment.status === "IN_PROGRESS" && (
                            <div className="assignment-action-form">
                              <label htmlFor={`completion-${assignment.id}`}>
                                Completion note
                              </label>
                              <textarea
                                id={`completion-${assignment.id}`}
                                value={completionNote}
                                onChange={(event) =>
                                  handleCompletionNoteChange(
                                    assignment.id,
                                    event.target.value,
                                  )
                                }
                                placeholder="Describe what the team completed."
                                rows="3"
                              />
                              <button
                                className="primary-button"
                                type="button"
                                disabled={
                                  assignmentBusy ||
                                  completionNote.trim().length < 10
                                }
                                onClick={() =>
                                  handleAssignmentAction(
                                    assignment.id,
                                    "complete",
                                    { completionNote },
                                    "Completion submitted for review.",
                                  )
                                }
                              >
                                {assignmentBusy
                                  ? "Submitting..."
                                  : "Submit completion"}
                              </button>
                            </div>
                          )}

                        {canReviewAssignment &&
                          assignment.status === "COMPLETED" &&
                          assignment.reviewStatus === "NOT_REVIEWED" && (
                            <div className="assignment-action-form">
                              <label htmlFor={`review-${assignment.id}`}>
                                Review note
                              </label>
                              <textarea
                                id={`review-${assignment.id}`}
                                value={reviewNote}
                                onChange={(event) =>
                                  handleReviewNoteChange(
                                    assignment.id,
                                    event.target.value,
                                  )
                                }
                                placeholder="Optional for approval; required for rejection."
                                rows="3"
                              />
                              <div className="assignment-review-actions">
                                <button
                                  className="primary-button"
                                  type="button"
                                  disabled={assignmentBusy}
                                  onClick={() =>
                                    handleAssignmentAction(
                                      assignment.id,
                                      "review",
                                      {
                                        decision: "APPROVE",
                                        ...(reviewNote.trim()
                                          ? { reviewNote }
                                          : {}),
                                      },
                                      "Assignment completion approved.",
                                    )
                                  }
                                >
                                  Approve completion
                                </button>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={
                                    assignmentBusy ||
                                    reviewNote.trim().length < 10
                                  }
                                  onClick={() =>
                                    handleAssignmentAction(
                                      assignment.id,
                                      "review",
                                      {
                                        decision: "REJECT",
                                        reviewNote,
                                      },
                                      "Completion rejected and returned to the team.",
                                    )
                                  }
                                >
                                  Reject completion
                                </button>
                              </div>
                            </div>
                          )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="history-section">
              <div className="history-heading">
                <div>
                  <p className="eyebrow">Audit trail</p>
                  <h3>Status history</h3>
                </div>
                <span>{history.length} events</span>
              </div>

              {historyLoading ? (
                <div className="history-message">Loading activity...</div>
              ) : historyError ? (
                <div className="alert error">{historyError}</div>
              ) : history.length === 0 ? (
                <div className="history-message">No history events yet.</div>
              ) : (
                <div className="timeline">
                  {history.map((event) => (
                    <div className="timeline-event" key={event.id}>
                      <span className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-topline">
                          <strong>{formatStatus(event.action)}</strong>
                          <span>{formatDate(event.createdAt)}</span>
                        </div>
                        <p>
                          {event.action === "REPORT_SUBMITTED" && event.actor
                            ? `Report submitted by ${event.actor.firstName} ${event.actor.lastName}`
                            : `${event.previousStatus
                                ? `${formatStatus(event.previousStatus)} → `
                                : ""}${formatStatus(event.newStatus)}`}
                        </p>
                        {event.action !== "REPORT_SUBMITTED" && event.notes && (
                          <small>{event.notes}</small>
                        )}
                        {event.action !== "REPORT_SUBMITTED" && event.actor && (
                          <small>
                            By {event.actor.firstName} {event.actor.lastName}
                          </small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <footer className="footer">
        <span>© 2026 CivicFix</span>
        <span>AI assists. People decide.</span>
      </footer>
    </div>
  );
}

export default App;
