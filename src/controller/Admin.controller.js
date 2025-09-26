import { Admin } from "../models/admin.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/AsyncHandler.js";
import Family from "../models/family.model.js";
import Care from "../models/care.model.js";
import AuditLog from "../models/auditLog.model.js";
import {
  accessTokenGenerator,
  refreshTokenGenerator,
} from "../utils/JwtGenerator.js";

const signup = asyncHandler(async (req, res) => {
  const { name, email, password, phoneNo } = req.body;
  if (
    [name, email, password, phoneNo, address].some(
      (field) => field.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields must be required");
  }

  const existedEmail = await Admin.findOne({ email });
  if (existedEmail) {
    throw new ApiError(409, "Email already existed");
  }

  const admin = await Admin.create({
    name,
    email,
    password,
    phoneNo,
    address,
  });
  const createdUser = await Admin.findById(admin._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Internal Server error");
  }
  const accessToken = accessTokenGenerator(admin._id, "admin", admin.name);
  const refreshToken = refreshTokenGenerator(admin._id, "admin", admin.name);
  admin.refreshToken = refreshToken;
  await admin.save();
  res
    .cookie("accesstoken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .cookie("refreshtoken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

  return res
    .status(201)
    .json(new ApiResponse(201, "Admin  Register Successfully", createdUser));
});

const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  if ([email, password, role].some((field) => field.trim() === "")) {
    throw new ApiError(400, "All field must be in valid format");
  }
  if (!["admin"].includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  const admin = await Admin.findOne({ email });
  if (!admin) {
    throw new ApiError(404, "User not Found");
  }
  if (!(await admin.comparePassword(password))) {
    throw new ApiError(400, "Incorrect Password");
  }

  const accessToken = accessTokenGenerator(admin._id, "admin", admin.name);
  const refreshToken = refreshTokenGenerator(admin._id, "admin", admin.name);
  admin.refreshToken = refreshToken;
  await admin.save();

  res
    .cookie("accesstoken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .cookie("refreshtoken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

  return res.status(200).json(new ApiResponse(200, "Login Successfully"));
});
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshtoken;

  if (!refreshToken) {
    res.status(204).json(new ApiResponse(204, "User is already LoggedOut"));
  }

  const admin = await Admin.findOne({ refreshToken });

  if (admin) {
    admin.refreshToken = null;
    await admin.save();
  }

  return res
    .clearCookie("accesstoken", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    })
    .clearCookie("refreshtoken", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    })
    .status(200)
    .json(new ApiResponse(200, "Logout Successfully "));
});

const getAllUser = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, userType } = req.query;
  let users = [];
  let total = 0;
  if (!userType || userType == "all") {
    const families = await Family.find()
      .select(" -password -refreshToken")
      .limit(limit * 0.5)
      .skip((page - 1) * limit * 0.5)
      .sort({ createdAt: -1 });
    const care = await Care.find()
      .select("-refreshToken -password")
      .limit(limit * 0.5)
      .skip((page - 1) * limit * 0.5)
      .sort({ createdAt: -1 });
    users = [
      ...families.map((f) => ({ ...f.toObject(), usertype: "family" })),
      ...care.map((c) => ({ ...c.toObject(), userType: "care" })),
    ];
    total = (await Family.countDocuments()) + (await Care.countDocuments());
  } else if (userType == "family") {
    const families = await Family.find()
      .select("-refreshToken -password")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    users = [...families.map((f) => ({ ...f.toObject(), userType: "family" }))];
    total = await Family.countDocuments();
  } else if (userType == "care") {
    const care = await Care.find()
      .select("-refreshToken -password")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    users = [...care.map((c) => ({ ...c.toObject(), userType: "care" }))];
    total = await Care.countDocuments();
  }
  return res.status(200).json(
    new ApiResponse(200, "Users retrieved successfully", {
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});

const getPendingCareGiver = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const role = req.role;
  if (role !== "admin") {
    throw new ApiError(401, "Only Admin Can allow to see care");
  }
  const cares = await Care.find({
    $or: [
      { backgroundCheckStatus: "PENDING" },
      { verifiedStatus: "UN-VERIFIED" },
    ],
  })
    .select("-password -refreshToken")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: 1 });
  const total = await Care.countDocuments({
    $or: [{ backgroundCheckStatus: "PENDING" }, { verifiedStatus: "PENDING" }],
  });
  return res.status(200).json(
    new ApiResponse(200, "Pending caregivers retrieved successfully", {
      cares,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});

const approveCareGiver = asyncHandler(async (req, res) => {
  const { careId } = req.param;
  const { backgroundCheckStatus, verifiedStatus } = req.body;
  const role = req.role;
  if (role !== "admin") {
    throw new ApiError(401, "Only Admin Can approve the care");
  }
  const updateData = {};
  if (backgroundCheckStatus)
    updateData.backgroundCheckStatus = backgroundCheckStatus;
  if (verifiedStatus) updateData.verifiedStatus = verifiedStatus;

  const approveCare = await Care.findByIdAndUpdate(careId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password -refreshToken");
  if (!approveCare) {
    throw new ApiError(404, "Care not found");
  }
  const auditLog = new AuditLog({
    actorId: req.user._id,
    actorTable: "Admin",
    action: `Caregiver ${
      backgroundCheckStatus
        ? "background check " + backgroundCheckStatus.toLowerCase()
        : ""
    }${verifiedStatus ? "verification " + verifiedStatus.toLowerCase() : ""}`,
    targetTable: "Care",
    targetId: careId,
  });
  await auditLog.save();
  return res
    .status(200)
    .json(
      new ApiResponse(200, "Caregiver status updated successfully", approveCare)
    );
});

const getAuditLog = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, actorTable, targetTable } = req.param;
  const filter = {};

  if (actorTable) filter.actorTable = actorTable;
  if (targetTable) filter.targetTable = targetTable;

  const auditLogs = await AuditLog.find(filter)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await AuditLog.countDocuments(filter);
  return res.status(200).json(
    new ApiResponse(200, "Audit Logs Retrived Successfully", {
      auditLogs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalFamilies,
    totalCaregivers,
    pendingCaregivers,
    verifiedCaregivers,
    totalJobPosts,
    activeJobPosts,
  ] = await Promise.all([
    Family.countDocuments(),
    Care.countDocuments(),
    Care.countDocuments({ backgroundCheckStatus: "PENDING" }),
    Care.countDocuments({ verifiedStatus: "VERIFIED" }),
    JobPost.countDocuments(),
    JobPost.countDocuments({ status: "ACTIVE" }),
  ]);

  const stats = {
    totalFamilies,
    totalCaregivers,
    pendingCaregivers,
    verifiedCaregivers,
    totalJobPosts,
    activeJobPosts,
    totalUsers: totalFamilies + totalCaregivers,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Dashboard statistics retrieved successfully", stats)
    );
});

export {
  login,
  signup,
  logout,
  getAllUser,
  getPendingCareGiver,
  approveCareGiver,
  getAuditLog,
  getDashboardStats,
};
