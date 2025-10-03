import { Family } from "../models/family.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { issueAuthTokens, rotateRefreshToken } from "../utils/authTokens.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const signup = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    username,
    password,
    phoneNo,
    alternatePhoneNo,
    address,
  } = req.body;
  
  // Check required fields only
  if (
    [name, email, username, password, phoneNo, address].some(
      (field) => field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All required fields must be provided");
  }
  
  // Validate alternatePhoneNo separately if provided
  if (alternatePhoneNo && alternatePhoneNo.trim() === "") {
    throw new ApiError(400, "Alternate phone number cannot be empty if provided");
  }

  const existedEmail = await Family.findOne({ email });
  const existedusername = await Family.findOne({ username });
  if (existedEmail) {
    throw new ApiError(409, "Email already existed");
  }
  if (existedusername) {
    throw new ApiError(409, "username already existed");
  }
  const family = await Family.create({
    name,
    email,
    username,
    password,
    phoneNo,
    alternatePhoneNo,
    address,
  });
  const createdUser = await Family.findById(family._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Internal Server error");
  }
  return issueAuthTokens({ user: family, role: 'family', res, message: 'Family register successfully' });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  if ([email, password, role].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All field must be in valid format");
  }
  if (!["family"].includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  const family = await Family.findOne({ email });
  if (!family) {
    throw new ApiError(404, "User not Found");
  }
  if (!(await family.comparePassword(password))) {
    throw new ApiError(400, "Incorrect Password");
  }

  return issueAuthTokens({ user: family, role: 'family', res, message: 'Login successfully' });
});
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshtoken;

  if (!refreshToken) {
    res.status(204).json(new ApiResponse(204, "User is already LoggedOut"));
  }

  const family = await Family.findOne({ refreshToken });

  if (family) {
    family.refreshToken = null;
    await family.save();
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
  const family = req.user;

  const profile = await Family.findById(family._id)
    .select("-password -refreshToken")
    .populate("elderInfo");

  return res
    .status(200)
    .json(new ApiResponse(200, "Profile retrieved successfully", profile));
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phoneNo, alternatePhoneNo, address } = req.body;
  const family = req.user;

  const updateData = {};
  if (name) updateData.name = name;
  if (phoneNo) updateData.phoneNo = phoneNo;
  if (alternatePhoneNo) updateData.alternatePhoneNo = alternatePhoneNo;
  if (address) updateData.address = address;

  const updatedFamily = await Family.findByIdAndUpdate(family._id, updateData, {
    new: true,
    runValidators: true,
  }).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, "Profile updated successfully", updatedFamily));
});
const addElder = asyncHandler(async (req, res) => {
  const { name, age, address, phoneNo } = req.body;
  const family = req.user;

  let imageUrl = "https://via.placeholder.com/150"; // Default placeholder

  try {
    // Upload image to Cloudinary if provided
    if (req.file) {
      const cloudinaryResult = await uploadToCloudinary(req.file.path, 'careconnect/elders');
      imageUrl = cloudinaryResult.secure_url;
    }

    const elderInfo = {
      name,
      age,
      address,
      phoneNo,
      imageUrl: imageUrl,
    };

    const updatedFamily = await Family.findByIdAndUpdate(
      family._id,
      { $push: { elderInfo: elderInfo } },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          "Elder information added successfully",
          updatedFamily
        )
      );
  } catch (error) {
    throw new ApiError(500, "Failed to add elder information: " + error.message);
  }
});

const updateElder = asyncHandler(async (req, res) => {
  const { elderId } = req.params;
  const { name, age, address, phoneNo } = req.body;
  const family = req.user;

  const updateData = {};
  if (name) updateData["elderInfo.$.name"] = name;
  if (age) updateData["elderInfo.$.age"] = age;
  if (address) updateData["elderInfo.$.address"] = address;
  if (phoneNo) updateData["elderInfo.$.phoneNo"] = phoneNo;

  const updatedFamily = await Family.findOneAndUpdate(
    { _id: family._id, "elderInfo._id": elderId },
    { $set: updateData },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  if (!updatedFamily) {
    throw new ApiError(404, "Elder not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Elder information updated successfully",
        updatedFamily
      )
    );
});
// !Here we have to remove image url as well
const removeElder = asyncHandler(async (req, res) => {
  const { elderId } = req.params;
  const family = req.user;

  const updatedFamily = await Family.findByIdAndUpdate(
    family._id,
    { $pull: { elderInfo: { _id: elderId } } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Elder information removed successfully",
        updatedFamily
      )
    );
});

export {
  login,
  signup,
  logout,
  getProfile,
  updateProfile,
  addElder,
  updateElder,
  removeElder,
};

// Refresh token endpoint handler (export separately to reduce breaking existing exports usage)
export const refreshSession = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshtoken;
  if (!token) throw new ApiError(401, 'Refresh token missing');
  const rotated = await rotateRefreshToken({ model: Family, token, res });
  if (!rotated) throw new ApiError(401, 'Invalid refresh token');
  return res.status(200).json(new ApiResponse(200, 'Session refreshed', rotated));
});
