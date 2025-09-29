import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationCounts,
} from "../controller/Notification.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";

const notificationRouter = Router();

notificationRouter.use(jwtVerify);

notificationRouter.route("/").get(getNotifications);

notificationRouter.route("/counts").get(getNotificationCounts);

notificationRouter.route("/mark-all-read").put(markAllAsRead);

notificationRouter.route("/:notificationId/read").put(markAsRead);

notificationRouter.route("/:notificationId").delete(deleteNotification);

export default notificationRouter;
