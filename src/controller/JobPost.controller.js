import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { JobPost } from "../models/JobPost.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { Care } from "../models/care.model.js";

const createJobPost = asyncHandler(async (req, res) => {
  if (req.role != "family") {
    throw new ApiError(403, "Only Familes Can create Job Post");
  }
  const {
    elderName,
    date,
    startTime,
    durationHours,
    salary,
    location,
    skillRequired,
  } = req.body;
  const id = req.id;
  if (
    [elderName, date, startTime, durationHours, salary, location].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields must be required");
  }
  if (!Array.isArray(skillRequired) || skillRequired.length === 0) {
    throw new ApiError(400, "Skill must be required");
  }
  const createJob = await JobPost.create({
    elderName,
    date: new Date(date),
    startTime,
    durationHours,
    salary,
    location,
    skillRequired,
    familyId: id,
  });

  const auditLog = new AuditLog({
    actorId: id,
    actorTable: "Family",
    action: "Create Job Post",
    targetId: createJob._id,
    targetTable: "JobPost",
  });
  await auditLog.save();

  const matchingCaregivers = await Care.find({
    skills: { $in: skillRequired },
    verifiedStatus: "VERIFIED",
    backgroundCheckStatus: "COMPLETED",
  }).select("_id");

  for (const caregiver of matchingCaregivers) {
    // here we write logic of send notification
  }

  return res
    .status(201)
    .json(new ApiResponse(201, "Job Created Successfully", createJob));
});

// get all info about jobs for admin

const getAllJobPosts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 5,
    status,
    location,
    skills,
    dateFrom,
    dateTo,
  } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (location) filter.location = new RegExp(location, "i");
  if (skills) filter.skillRequired = { $in: skills.split(",") };
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) filter.date.$lte = new Date(dateTo);
  }

  const jobPosts = await JobPost.find(filter)
    .populate("familyId", "name email phoneNo address")
    .populate("applications.careId", "name email phoneNo skills verifiedStatus")
    .polygon()
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });
  const total = await JobPost.countDocuments(filter);
  return res.status(200).json(
    new ApiResponse(200, "Job post Reterived Successfully", {
      jobPosts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});

// Get job posts for specific family to see how many post they create
const getFamilyJobPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const family = req.user;

  if (req.role !== "family") {
    throw new ApiError(403, "Only families can access their job posts");
  }

  const jobPosts = await JobPost.find({ familyId: family._id })
    .populate(
      "applications.careId",
      "name email phoneNo skills verifiedStatus backgroundCheckStatus"
    )
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await JobPost.countDocuments({ familyId: family._id });

  return res.status(200).json(
    new ApiResponse(200, "Family job posts retrieved successfully", {
      jobPosts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});

// care giver apply for job
const applyForJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const caregiver = req.user;

  if (req.role !== "care") {
    throw new ApiError(403, "Only caregivers can apply for jobs");
  }

  if (caregiver.verifiedStatus !== "VERIFIED") {
    throw new ApiError(400, "You must be verified to apply for jobs");
  }

  const jobPost = await JobPost.findById(jobId);
  if (!jobPost) {
    throw new ApiError(404, "Job post not found");
  }

  if (jobPost.status !== "ACTIVE") {
    throw new ApiError(400, "This job post is no longer active");
  }

  // Check if already applied
  const existingApplication = jobPost.applications.find(
    (app) => app.careId.toString() === caregiver._id.toString()
  );

  if (existingApplication) {
    throw new ApiError(400, "You have already applied for this job");
  }

  // Add application
  jobPost.applications.push({
    careId: caregiver._id,
  });

  await jobPost.save();

  // Log audit action
  const auditLog = new AuditLog({
    actorId: caregiver._id,
    actorTable: "Care",
    action: "Applied for job post",
    targetTable: "JobPost",
    targetId: jobPost._id,
  });
  await auditLog.save();

  // Create real-time notification for family

  return res
    .status(200)
    .json(new ApiResponse(200, "Applied for job successfully", jobPost));
});
// job for CareGiver user
const getAvailableJobs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, location, dateFrom, dateTo } = req.query;
  const caregiver = req.user;

  if (req.role !== "care") {
    throw new ApiError(403, "Only caregivers can access available jobs");
  }

  const filter = {
    status: "ACTIVE",
    skillRequired: { $in: caregiver.skills },
    "applications.careId": { $ne: caregiver._id }, // Exclude jobs already applied to
  };

  if (location) filter.location = new RegExp(location, "i");
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) filter.date.$lte = new Date(dateTo);
  }

  const jobPosts = await JobPost.find(filter)
    .populate("familyId", "name email phoneNo address")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await JobPost.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, "Available jobs retrieved successfully", {
      jobPosts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});
// Update job post status
const updateJobStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { status } = req.body;
  const family = req.user;

  if (req.role !== "family") {
    throw new ApiError(403, "Only families can update job status");
  }

  const jobPost = await JobPost.findOneAndUpdate(
    { _id: jobId, familyId: family._id },
    { status },
    { new: true, runValidators: true }
  ).populate("applications.careId", "name email phoneNo");

  if (!jobPost) {
    throw new ApiError(404, "Job post not found or you don't have permission");
  }

  // Log audit action
  const auditLog = new AuditLog({
    actorId: family._id,
    actorTable: "Family",
    action: `Updated job post status to ${status}`,
    targetTable: "JobPost",
    targetId: jobPost._id,
  });
  await auditLog.save();

  return res
    .status(200)
    .json(new ApiResponse(200, "Job status updated successfully", jobPost));
});

// Delete job post
const deleteJobPost = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const family = req.user;

  if (req.role !== "family") {
    throw new ApiError(403, "Only families can delete job posts");
  }

  const jobPost = await JobPost.findOneAndDelete({
    _id: jobId,
    familyId: family._id,
  });

  if (!jobPost) {
    throw new ApiError(404, "Job post not found or you don't have permission");
  }

  // Log audit action
  const auditLog = new AuditLog({
    actorId: family._id,
    actorTable: "Family",
    action: "Deleted job post",
    targetTable: "JobPost",
    targetId: jobPost._id,
  });
  await auditLog.save();

  return res
    .status(200)
    .json(new ApiResponse(200, "Job post deleted successfully"));
});

// Get matching caregivers for a job post
const getMatchingCaregivers = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const family = req.user;

  if (req.role !== "family") {
    throw new ApiError(403, "Only families can view matching caregivers");
  }

  const jobPost = await JobPost.findOne({ _id: jobId, familyId: family._id });
  if (!jobPost) {
    throw new ApiError(404, "Job post not found or you don't have permission");
  }

  // Find caregivers with matching skills
  const matchingCaregivers = await Care.find({
    skills: { $in: jobPost.skillRequired },
    verifiedStatus: "VERIFIED",
    backgroundCheckStatus: "COMPLETED",
  }).select("-password -refreshToken -document");

  // Calculate match scores (simple scoring based on skill overlap)
  const caregiversWithScores = matchingCaregivers.map((caregiver) => {
    const skillOverlap = caregiver.skills.filter((skill) =>
      jobPost.skillRequired.includes(skill)
    ).length;
    const matchScore = Math.round(
      (skillOverlap / jobPost.skillRequired.length) * 100
    );

    return {
      ...caregiver.toObject(),
      matchScore,
    };
  });

  // Sort by match score descending
  caregiversWithScores.sort((a, b) => b.matchScore - a.matchScore);

  return res.status(200).json(
    new ApiResponse(
      200,
      "Matching caregivers retrieved successfully",
      caregiversWithScores.slice(0, 5) // Top 5 matches
    )
  );
});
export {
  createJobPost,
  getAllJobPosts,
  getFamilyJobPosts,
  applyForJob,
  getAvailableJobs,
  updateJobStatus,
  deleteJobPost,
  getMatchingCaregivers,
};
