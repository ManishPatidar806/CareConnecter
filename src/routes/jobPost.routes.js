import { application, Router } from "express";
import {
  applyForJob,
  createJobPost,
  deleteJobPost,
  getAllJobPosts,
  getAvailableJobs,
  getFamilyJobPosts,
  getMatchingCaregivers,
  updateJobStatus,
} from "../controller/JobPost.controller.js";
import { body } from "express-validator";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";
import validate, { jobPostValidation } from "../utils/validators.js";

const jobPostRouter = Router();
jobPostRouter.use(jwtVerify);

jobPostRouter.route("/create").post(validate(jobPostValidation), createJobPost);
jobPostRouter.route("/all").get(getAllJobPosts);
jobPostRouter.route("/family").get(getFamilyJobPosts);
jobPostRouter.route("/:jobId/apply").post(applyForJob);
jobPostRouter.route("/available").get(getAvailableJobs);
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
jobPostRouter.route("/deletejobPost").get(deleteJobPost);
jobPostRouter.route("/getMatchingCaregivers").get(getMatchingCaregivers);

export default jobPostRouter;
