import jwt from "jsonwebtoken";
import { Admin } from "../models/admin.model.js";
import { Care } from "../models/care.model.js";
import { Family } from "../models/family.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
const jwtVerify = async (req, res, next) => {
  try {
    const accesstoken = req.cookies?.accesstoken;
    if (!accesstoken) {
      return res
        .status(401)
        .json(new ApiResponse(401, "Access token not found"));
    }
    const decode = jwt.verify(accesstoken, process.env.ACCESS_TOKEN_SECRET);
    const { _id, role } = decode;
    let user;
    if (role === "admin") user = await Admin.findById(_id).select('-refreshToken -password');
    if (role === "care") user = await Care.findById(_id).select('-refreshToken -password');
    if (role === "family") user = await Family.findById(_id).select('-refreshToken -password');
    if (!user) {
      return res.status(401).json(new ApiError(401, "Invalid User"));
    }
    req.user = user;
    req.role = role;
    req.id = _id;
    next();
  } catch (error) {
    return res.status(401).json(new ApiError(401, "Invalid or expired Token"));
  }
};

export default jwtVerify;
