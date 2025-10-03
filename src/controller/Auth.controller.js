import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Admin } from "../models/admin.model.js";
import { Care } from "../models/care.model.js";
import { Family } from "../models/family.model.js";
import { rotateRefreshToken } from "../utils/authTokens.js";


const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshtoken;
  if (!token) throw new ApiError(401, "Refresh token missing");

  // Try each model sequentially (small user base assumption). For scale, persist token->model mapping.
  const models = [Admin, Care, Family];
  for (const model of models) {
    const rotated = await rotateRefreshToken({ model, token, res });
    if (rotated) {
      return res
        .status(200)
        .json(new ApiResponse(200, "Session refreshed", rotated));
    }
  }
  throw new ApiError(401, "Invalid refresh token");
});

const getMe = asyncHandler(async (req, res) => {
  const token = req.cookies?.accesstoken;
  if (!token) throw new ApiError(401, "Access token missing");
  const user = req.user;
  return res.status(200).json(new ApiResponse(200, "ValidUser Found", user));
});

export { refreshToken, getMe };
