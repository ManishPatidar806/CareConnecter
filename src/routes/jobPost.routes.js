import { Router } from "express";
import {
  applyForJob,
  createJobPost,
  getAllJobPosts,
  getAvailableJobs,
  getFamilyJobPosts,
  getMatchingCaregivers,
  updateJobStatus,
  getJobById,
  deleteJob,
  getCaregiverHistory,
} from "../controller/JobPost.controller.js";
import { body } from "express-validator";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";
import validate, { jobPostValidation } from "../utils/validators.js";

const jobPostRouter = Router();
jobPostRouter.use(jwtVerify);

// RESTful single resource routes
jobPostRouter.route("/:jobId").get(getJobById);
jobPostRouter.route("/:jobId").delete(deleteJob);
jobPostRouter.route("/create").post(validate(jobPostValidation), createJobPost);
jobPostRouter.route("/all").get(getAllJobPosts);
jobPostRouter.route("/family").get(getFamilyJobPosts);
jobPostRouter.route("/:jobId/apply").post(applyForJob);
jobPostRouter.route("/available").get(getAvailableJobs);
jobPostRouter.route("/caregiver/history").get(getCaregiverHistory);
jobPostRouter
  .route("/:jobId/status")
  .put(
    validate([
      body("status")
        .isIn(["ACTIVE", "EXPIRE"])
        .withMessage("Status must be Active or Expire"),
    ]),
    updateJobStatus
  );
// Legacy endpoint deprecated
jobPostRouter.route("/deletejobPost").get((req, res) => {
  return res.status(410).json({ message: "Deprecated. Use DELETE /api/v1/jobs/:jobId" });
});
jobPostRouter.route("/getMatchingCaregivers").get(getMatchingCaregivers);

export default jobPostRouter;
