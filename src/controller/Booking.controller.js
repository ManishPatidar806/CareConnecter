import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { Booking } from "../models/booking.model.js";
import { JobPost } from "../models/JobPost.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { createAndSendNotification } from "../utils/socket.js";

// Helper to assert role quickly
const requireRole = (req, role) => {
  if (req.role !== role) {
    throw new ApiError(403, `Only ${role} can perform this action`);
  }
};

// Create booking (family -> caregiver; may optionally reference jobPostId)
export const createBooking = asyncHandler(async (req, res) => {
  requireRole(req, "family");
  const family = req.user;
  const {
    careId,
    jobPostId,
    elderName,
    location,
    skills = [],
  schedule,
    hourlyRate,
    notes,
  } = req.body;

  if (!careId || !elderName || !location || !schedule || !hourlyRate) {
    throw new ApiError(400, "Missing required fields");
  }
  if (!schedule.date || !schedule.startTime || !schedule.durationHours) {
    throw new ApiError(400, "Incomplete schedule information");
  }

  // If tied to job post ensure caregiver applied (future enhancement: ensure still active)
  if (jobPostId) {
    const job = await JobPost.findById(jobPostId);
    if (!job) throw new ApiError(404, "Job post not found");
  }

  const booking = await Booking.create({
    familyId: family._id,
    careId,
    jobPostId: jobPostId || undefined,
    elderName,
    location,
    skills,
    schedule: {
      date: new Date(schedule.date),
      startTime: schedule.startTime,
      durationHours: schedule.durationHours,
    },
    hourlyRate,
    notes,
  });

  await AuditLog.create({
    actorId: family._id,
    actorTable: "Family",
    action: "Created booking",
    targetId: booking._id,
    targetTable: "Booking",
  });

  // Notify caregiver
  await createAndSendNotification({
    type: 'NEW_BOOKING_REQUEST',
    message: `New booking request for ${elderName} on ${schedule.date}`,
    caregiverId: careId,
    bookingId: booking._id,
    recipientType: 'caregiver'
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Booking created successfully", booking));
});

// Get bookings for family
export const getFamilyBookings = asyncHandler(async (req, res) => {
  requireRole(req, "family");
  const { page = 1, limit = 10, status } = req.query;
  const filter = { familyId: req.user._id };
  if (status) filter.status = status;
  const bookings = await Booking.find(filter)
    .populate("careId", "name email phoneNo skills")
    .populate("jobPostId", "elderName date location")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });
  const total = await Booking.countDocuments(filter);
  return res.status(200).json(
    new ApiResponse(200, "Family bookings retrieved", {
      bookings,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});

// Get bookings for caregiver
export const getCaregiverBookings = asyncHandler(async (req, res) => {
  requireRole(req, "care");
  const { page = 1, limit = 10, status } = req.query;
  const filter = { careId: req.user._id };
  if (status) filter.status = status;
  const bookings = await Booking.find(filter)
    .populate("familyId", "name email phoneNo address")
    .populate("jobPostId", "elderName date location")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });
  const total = await Booking.countDocuments(filter);
  return res.status(200).json(
    new ApiResponse(200, "Caregiver bookings retrieved", {
      bookings,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  );
});

// Get single booking (both parties + admin later)
export const getBookingById = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const role = req.role;
  const user = req.user;
  const baseFilter = { _id: bookingId };
  if (role === 'family') baseFilter.familyId = user._id;
  if (role === 'care') baseFilter.careId = user._id;
  const booking = await Booking.findOne(baseFilter)
    .populate("familyId", "name email phoneNo")
    .populate("careId", "name email phoneNo skills")
    .populate("jobPostId", "elderName date location");
  if (!booking) throw new ApiError(404, 'Booking not found or access denied');
  return res.status(200).json(new ApiResponse(200, 'Booking retrieved', booking));
});

// Caregiver accept booking
export const acceptBooking = asyncHandler(async (req, res) => {
  requireRole(req, 'care');
  const { bookingId } = req.params;
  const caregiver = req.user;
  const booking = await Booking.findOne({ _id: bookingId, careId: caregiver._id });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== 'PENDING') throw new ApiError(400, 'Only pending bookings can be accepted');
  booking.status = 'ACCEPTED';
  booking.acceptedAt = new Date();
  await booking.save();
  await AuditLog.create({
    actorId: caregiver._id,
    actorTable: 'Care',
    action: 'Accepted booking',
    targetId: booking._id,
    targetTable: 'Booking'
  });
  await createAndSendNotification({
    type: 'BOOKING_ACCEPTED',
    message: `Booking accepted for ${booking.elderName}`,
    familyId: booking.familyId,
    bookingId: booking._id,
    recipientType: 'family'
  });
  return res.status(200).json(new ApiResponse(200, 'Booking accepted', booking));
});

// Caregiver reject booking
export const rejectBooking = asyncHandler(async (req, res) => {
  requireRole(req, 'care');
  const { bookingId } = req.params;
  const { reason } = req.body;
  const caregiver = req.user;
  const booking = await Booking.findOne({ _id: bookingId, careId: caregiver._id });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== 'PENDING') throw new ApiError(400, 'Only pending bookings can be rejected');
  booking.status = 'REJECTED';
  booking.rejectionReason = reason || 'No reason provided';
  await booking.save();
  await AuditLog.create({
    actorId: caregiver._id,
    actorTable: 'Care',
    action: 'Rejected booking',
    targetId: booking._id,
    targetTable: 'Booking'
  });
  await createAndSendNotification({
    type: 'BOOKING_REJECTED',
    message: `Booking rejected for ${booking.elderName}`,
    familyId: booking.familyId,
    bookingId: booking._id,
    recipientType: 'family'
  });
  return res.status(200).json(new ApiResponse(200, 'Booking rejected', booking));
});

// Family cancel booking (before start)
export const cancelBooking = asyncHandler(async (req, res) => {
  requireRole(req, 'family');
  const { bookingId } = req.params;
  const family = req.user;
  const booking = await Booking.findOne({ _id: bookingId, familyId: family._id });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if ([ 'COMPLETED', 'CANCELED'].includes(booking.status)) throw new ApiError(400, 'Cannot cancel this booking');
  booking.status = 'CANCELED';
  booking.canceledAt = new Date();
  booking.canceledByRole = 'family';
  await booking.save();
  await AuditLog.create({
    actorId: family._id,
    actorTable: 'Family',
    action: 'Canceled booking',
    targetId: booking._id,
    targetTable: 'Booking'
  });
  await createAndSendNotification({
    type: 'BOOKING_CANCELED',
    message: `Booking canceled for ${booking.elderName}`,
    caregiverId: booking.careId,
    bookingId: booking._id,
    recipientType: 'caregiver'
  });
  return res.status(200).json(new ApiResponse(200, 'Booking canceled', booking));
});

// Mark in-progress (system or caregiver) - optional endpoint
export const startBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const role = req.role;
  const user = req.user;
  const filter = { _id: bookingId };
  if (role === 'family') filter.familyId = user._id; else if (role === 'care') filter.careId = user._id; else throw new ApiError(403, 'Unauthorized');
  const booking = await Booking.findOne(filter);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== 'ACCEPTED') throw new ApiError(400, 'Only accepted bookings can start');
  booking.status = 'IN_PROGRESS';
  booking.startedAt = new Date();
  await booking.save();
  return res.status(200).json(new ApiResponse(200, 'Booking started', booking));
});

// Complete booking (caregiver or family acknowledges completion)
export const completeBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const role = req.role;
  const user = req.user;
  const filter = { _id: bookingId };
  if (role === 'family') filter.familyId = user._id; else if (role === 'care') filter.careId = user._id; else throw new ApiError(403, 'Unauthorized');
  const booking = await Booking.findOne(filter);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!['IN_PROGRESS','ACCEPTED'].includes(booking.status)) throw new ApiError(400, 'Cannot complete this booking');
  booking.status = 'COMPLETED';
  booking.completedAt = new Date();
  booking.paymentStatus = booking.paymentStatus === 'UNPAID' ? 'UNPAID' : booking.paymentStatus;
  await booking.save();
  await createAndSendNotification({
    type: 'BOOKING_COMPLETED',
    message: `Booking completed for ${booking.elderName}`,
    caregiverId: booking.careId,
    familyId: booking.familyId,
    bookingId: booking._id,
    recipientType: 'caregiver'
  });
  return res.status(200).json(new ApiResponse(200, 'Booking completed', booking));
});

// Update generic fields (notes) - family only for now
export const updateBookingNotes = asyncHandler(async (req, res) => {
  requireRole(req, 'family');
  const { bookingId } = req.params;
  const { notes } = req.body;
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, familyId: req.user._id },
    { notes },
    { new: true, runValidators: true }
  );
  if (!booking) throw new ApiError(404, 'Booking not found');
  return res.status(200).json(new ApiResponse(200, 'Booking updated', booking));
});

// Simple stats endpoint (aggregate for dashboards)
export const getBookingStats = asyncHandler(async (req, res) => {
  const role = req.role;
  const match = {};
  if (role === 'family') match.familyId = req.user._id; else if (role === 'care') match.careId = req.user._id; else throw new ApiError(403, 'Unauthorized');
  const pipeline = [
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 }, hours: { $sum: '$schedule.durationHours' }, total: { $sum: '$totalAmount' } } }
  ];
  const agg = await Booking.aggregate(pipeline);
  const byStatus = agg.reduce((acc, cur) => { acc[cur._id] = { count: cur.count, hours: cur.hours, total: cur.total }; return acc; }, {});
  return res.status(200).json(new ApiResponse(200, 'Booking stats', { byStatus }));
});

export default {
  createBooking,
  getFamilyBookings,
  getCaregiverBookings,
  getBookingById,
  acceptBooking,
  rejectBooking,
  cancelBooking,
  startBooking,
  completeBooking,
  updateBookingNotes,
  getBookingStats,
};
