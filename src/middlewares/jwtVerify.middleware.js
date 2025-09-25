import jwt from "jsonwebtoken";
import { Admin } from "../models/admin.model.js";
import { Care } from "../models/care.model.js";
import { Family } from "../models/family.model.js";
import ApiError from "../utils/ApiError.js";
const jwtVerify = async (req, res, next) => {
  try {
    const accesstoken = req.cookies?.accesstoken;
    if (!accesstoken) {
      return res
        .status(401)
        .json(new ApiResponse(401, "Access token not found"));
    }
    const decode = jwt.verify(accesstoken, process.env.ACCESS_TOKEN_SECRET);
    const { id, name, role } = decode;
    let user;
    if (role == "admin") user = await Admin.findById(id);
    if (role == "care") user = await Care.findById(id);
    if (role == "family") user = await Family.findById(id);
    if (!user) {
      return res.status(401).json(new ApiError(401, "Invalid User"));
    }
    req.user = user;
    req.role = role;
    next();
  } catch (error) {
    return res.status(401).json(new ApiError(401, "Invalid or expired Token"));
  }
};

export default jwtVerify;
