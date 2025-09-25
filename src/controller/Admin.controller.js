import { Admin } from "../models/admin.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/AsyncHandler.js";
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

export { login, signup, logout };
