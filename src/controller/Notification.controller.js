import { Notification } from "../models/notification.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";

// Get notifications for current user
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, isRead } = req.query;
  const user = req.user;
  const userRole = req.role;

  const filter = {};
  
  if (userRole === 'family') {
    filter.familyId = user._id;
    filter.recipientType = 'family';
  } else if (userRole === 'care') {
    filter.careId = user._id;
    filter.recipientType = 'caregiver';
  } else {
    throw new ApiError(403, "Invalid user type for notifications");
  }

  if (isRead !== undefined) {
    filter.isRead = isRead === 'true';
  }

  const notifications = await Notification.find(filter)
    .populate('familyId', 'name email')
    .populate('careId', 'name email')
    .populate('jobPostId', 'elderName location salary')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Notification.countDocuments(filter);
  const unreadCount = await Notification.countDocuments({
    ...filter,
    isRead: false
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Notifications retrieved successfully", {
      notifications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      unreadCount
    }));
});

// Mark notification as read
const markAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const user = req.user;
  const userRole = req.role;

  const filter = { _id: notificationId };
  
  if (userRole === 'family') {
    filter.familyId = user._id;
  } else if (userRole === 'care') {
    filter.careId = user._id;
  }

  const notification = await Notification.findOneAndUpdate(
    filter,
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found or access denied");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Notification marked as read", notification));
});

// Mark all notifications as read
const markAllAsRead = asyncHandler(async (req, res) => {
  const user = req.user;
  const userRole = req.role;

  const filter = { isRead: false };
  
  if (userRole === 'family') {
    filter.familyId = user._id;
  } else if (userRole === 'care') {
    filter.careId = user._id;
  }

  const result = await Notification.updateMany(
    filter,
    { isRead: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, `${result.modifiedCount} notifications marked as read`));
});

// Delete notification
const deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const user = req.user;
  const userRole = req.role;

  const filter = { _id: notificationId };
  
  if (userRole === 'family') {
    filter.familyId = user._id;
  } else if (userRole === 'care') {
    filter.careId = user._id;
  }

  const notification = await Notification.findOneAndDelete(filter);

  if (!notification) {
    throw new ApiError(404, "Notification not found or access denied");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Notification deleted successfully"));
});

// Get notification counts
const getNotificationCounts = asyncHandler(async (req, res) => {
  const user = req.user;
  const userRole = req.role;

  const filter = {};
  
  if (userRole === 'family') {
    filter.familyId = user._id;
  } else if (userRole === 'care') {
    filter.careId = user._id;
  }

  const [total, unread] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false })
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, "Notification counts retrieved successfully", {
      total,
      unread,
      read: total - unread
    }));
});

export {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationCounts
};