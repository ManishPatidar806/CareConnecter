import { Care } from "../models/care.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { issueAuthTokens, rotateRefreshToken } from "../utils/authTokens.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

const signup = asyncHandler(async (req, res) => {
  const { name, email, username, password, phoneNo, address } = req.body;
  if (
    [name, email, username, password, phoneNo, address].some(
      (field) => field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields must be required");
  }

  const existedEmail = await Care.findOne({ email });
  const existedusername = await Care.findOne({ username });
  if (existedEmail) {
    throw new ApiError(409, "Email already existed");
  }
  if (existedusername) {
    throw new ApiError(409, "username already existed");
  }
  const care = await Care.create({
    name,
    email,
    username,
    password,
    phoneNo,
    address,
  });
  const createdUser = await Care.findById(care._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Internal Server error");
  }
  return issueAuthTokens({ user: care, role: 'care', res, message: 'Care register successfully' });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  if ([email, password, role].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All field must be in valid format");
  }
  if (!["care"].includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  const care = await Care.findOne({ email });
  if (!care) {
    throw new ApiError(404, "User not Found");
  }
  if (!(await care.comparePassword(password))) {
    throw new ApiError(400, "Incorrect Password");
  }

  return issueAuthTokens({ user: care, role: 'care', res, message: 'Login successfully' });
});
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshtoken;

  if (!refreshToken) {
    res.status(204).json(new ApiResponse(204, "User is already LoggedOut"));
  }

  const care = await Care.findOne({ refreshToken });

  if (care) {
    care.refreshToken = null;
    await care.save();
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

const getProfile = asyncHandler(async (req, res) => {
  const id = req.user._id;

  const careGiver = await Care.findById(id).select("-refreshToken -password");

  return res
    .status(200)
    .json(new ApiResponse(200, "Profile Retrieved Successfully", careGiver));
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phoneNo, address, skills } = req.body;
  const careId = req.user._id;
  let updateData = {};
  if (name) updateData.name = name;
  if (phoneNo) updateData.phoneNo = phoneNo;
  if (address) updateData.address = address;
  if (skills) updateData.skills = Array.isArray(skills) ? skills : [skills];

  const care = await Care.findByIdAndUpdate(careId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, "Profile Update Successfully", care));
});

const addAvailability = asyncHandler(async (req, res) => {
  const { date, startTime, duration } = req.body;
  const care = req.user;
  const availability = {
    date: new Date(date),
    startTime: startTime,
    duration: duration,
  };

  const updatedCare = await Care.findByIdAndUpdate(
    care._id,
    { $push: { availability: availability } },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");
  return res
    .status(201)
    .json(new ApiResponse(201, "Availabity Updated Successfully", updatedCare));
});

const updateAvailability = asyncHandler(async (req, res) => {
  const { availabilityId } = req.params;
  const { date, startTime, duration } = req.body;
  const care = req.user;
  const updateData = {};
  if (date) updateData["availability.$.date"] = new Date(date);
  if (startTime) updateData["availability.$.startTime"] = startTime;
  if (duration) updateData["availability.$.duration"] = duration;
  const updatedCare = await Care.findOneAndUpdate(
    { _id: care._id, "availability._id": availabilityId },
    { $set: updateData },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");
  if (!updatedCare) {
    throw new ApiError(404, "Availability slot not found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, "Availability updated successfully", updatedCare)
    );
});

const removeAvailability = asyncHandler(async (req, res) => {
  const { availabilityId } = req.params;
  const care = req.user;
  const updatedCare = await Care.findOneAndUpdate(
    { _id: care._id },
    { $pull: { availability: { _id: availabilityId } } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Availability removed successfully", updatedCare)
    );
});

/**
 *
 * here the logic is incomplete to upload the docs and remove the docs form cloud
 *
 *
 */

const addDocument = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const caregiver = req.user;

  if (!req.file) {
    throw new ApiError(400, "Document file is required");
  }

  try {
    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.path, 'careconnect/documents');
    
    const document = {
      name,
      documentUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id
    };

    const updatedCaregiver = await Care.findByIdAndUpdate(
      caregiver._id,
      { $push: { document: document } },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    return res
      .status(201)
      .json(
        new ApiResponse(201, "Document added successfully", updatedCaregiver)
      );
  } catch (error) {
    throw new ApiError(500, "Failed to upload document: " + error.message);
  }
});

// Remove document
const removeDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const caregiver = req.user;

  // Find the document to get its publicId before removal
  const document = caregiver.document.find(doc => doc._id.toString() === documentId);
  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  try {
    // Delete from Cloudinary if publicId exists
    if (document.publicId) {
      await deleteFromCloudinary(document.publicId);
    }

    const updatedCaregiver = await Care.findByIdAndUpdate(
      caregiver._id,
      { $pull: { document: { _id: documentId } } },
      { new: true }
    ).select("-password -refreshToken");

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Document removed successfully", updatedCaregiver)
      );
  } catch (error) {
    throw new ApiError(500, "Failed to remove document: " + error.message);
  }
});

// Get all caregivers (for families to browse)
const getAllCaregivers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, skills, verifiedStatus } = req.query;

  const filter = {};
  if (skills) {
    filter.skills = { $in: skills.split(",") };
  }
  if (verifiedStatus) {
    filter.verifiedStatus = verifiedStatus;
  }

  const caregivers = await Care.find(filter)
    .select("-password -refreshToken -document")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Care.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, "Caregivers retrieved successfully", {
      caregivers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});

export {
  login,
  signup,
  logout,
  getProfile,
  updateProfile,
  addAvailability,
  updateAvailability,
  removeAvailability,
  addDocument,
  removeDocument,
  getAllCaregivers,
};

export const refreshCareSession = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshtoken;
  if (!token) throw new ApiError(401, 'Refresh token missing');
  const rotated = await rotateRefreshToken({ model: Care, token, res });
  if (!rotated) throw new ApiError(401, 'Invalid refresh token');
  return res.status(200).json(new ApiResponse(200, 'Session refreshed', rotated));
});
