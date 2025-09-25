import { Care } from "../models/care.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/AsyncHandler.js";
import {
  accessTokenGenerator,
  refreshTokenGenerator,
} from "../utils/JwtGenerator.js";

const signup = asyncHandler(async (req, res) => {
  const { name, email, username, password, phoneNo, address } = req.body;
  if (
    [name, email, username, password, phoneNo, address].some(
      (field) => field.trim() === ""
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
  const accessToken = accessTokenGenerator(care._id, "care", care.name);
  const refreshToken = refreshTokenGenerator(care._id, "care", care.name);
  care.refreshToken = refreshToken;
  await care.save();
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
    .json(new ApiResponse(201, "Care  Register Successfully", createdUser));
});

const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  if ([email, password, role].some((field) => field.trim() === "")) {
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

  const accessToken = accessTokenGenerator(care._id, "care", care.name);
  const refreshToken = refreshTokenGenerator(care._id, "care", care.name);
  care.refreshToken = refreshToken;
  await care.save();

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

export { login, signup, logout };
