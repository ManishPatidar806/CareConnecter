import { Router } from "express";
import {
  login,
  signup,
  logout,
  getAllUser,
  getPendingCareGiver,
  approveCareGiver,
  getAuditLog,
  getDashboardStats,
} from "../controller/Admin.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";

const adminRouter = Router();

// Public Routes
adminRouter.route("/login").post(login);
adminRouter.route("/signup").post(signup);

// Protected Routes
adminRouter.route("/logout").get(jwtVerify, logout);
adminRouter.route("/users").get(jwtVerify, getAllUser);
adminRouter.route("/caregivers/pending").get(jwtVerify, getPendingCareGiver);
adminRouter.route("/caregivers/:caregiverId/approve").put(jwtVerify, approveCareGiver);
adminRouter.route("/audit-logs").get(jwtVerify, getAuditLog);
adminRouter.route("/dashboard/stats").get(jwtVerify, getDashboardStats);

export default adminRouter;
