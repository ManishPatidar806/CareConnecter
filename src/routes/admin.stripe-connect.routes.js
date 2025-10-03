import { Router } from "express";
import {
  getOverviewStats,
  getAllConnectAccounts,
  getTransactions,
  refreshAccountStatus,
  approveAccount,
  restrictAccount,
  exportData
} from "../controller/StripeConnect.Admin.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/AsyncHandler.js";

const adminStripeRouter = Router();

// Middleware to check if user is admin
const adminOnly = asyncHandler(async (req, res, next) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Access denied. Admin only.");
  }
  next();
});

// Routes
adminStripeRouter.route("/overview").get(jwtVerify, adminOnly, getOverviewStats);
adminStripeRouter.route("/accounts").get(jwtVerify, adminOnly, getAllConnectAccounts);
adminStripeRouter.route("/transactions").get(jwtVerify, adminOnly, getTransactions);
adminStripeRouter.route("/accounts/:accountId/refresh").post(jwtVerify, adminOnly, refreshAccountStatus);
adminStripeRouter.route("/accounts/:accountId/approve").post(jwtVerify, adminOnly, approveAccount);
adminStripeRouter.route("/accounts/:accountId/restrict").post(jwtVerify, adminOnly, restrictAccount);
adminStripeRouter.route("/export/:type").get(jwtVerify, adminOnly, exportData);

export default adminStripeRouter;
export { adminStripeRouter as stripeConnectAdminRoutes };