import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationCounts,
} from "../controller/Notification.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";
import { param } from "express-validator";
import validate from "../utils/validators.js";

const notificationRouter = Router();

notificationRouter.use(jwtVerify);

notificationRouter.route("/").get(getNotifications);

notificationRouter.route("/counts").get(getNotificationCounts);

notificationRouter.route("/mark-all-read").put(markAllAsRead);

notificationRouter.route("/:notificationId/read").put(validate([
  param('notificationId').isMongoId().withMessage('Valid notification ID is required')
]), markAsRead);

notificationRouter.route("/:notificationId").delete(validate([
  param('notificationId').isMongoId().withMessage('Valid notification ID is required')
]), deleteNotification);

export default notificationRouter;
