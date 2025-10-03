import { Router } from 'express';
import jwtVerify from '../middlewares/jwtVerify.middleware.js';
import validate from '../utils/validators.js';
import { body } from 'express-validator';
import {
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
} from '../controller/Booking.controller.js';

const bookingRouter = Router();
bookingRouter.use(jwtVerify);

// Creation (family only)
bookingRouter.post(
  '/',
  validate([
    body('careId').isMongoId().withMessage('Valid caregiver id required'),
    body('elderName').isLength({ min: 2 }).withMessage('Elder name required'),
    body('location').isLength({ min: 2 }).withMessage('Location required'),
    body('hourlyRate').isFloat({ min: 0 }).withMessage('Hourly rate must be positive'),
    body('schedule.date').isISO8601().withMessage('Valid date required'),
  body('schedule.startTime').matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/).withMessage('Valid startTime HH:MM required'),
    body('schedule.durationHours').isFloat({ min: 0.5, max: 24 }).withMessage('Duration must be between 0.5 and 24 hours'),
  ]),
  createBooking
);

// Listing endpoints
bookingRouter.get('/family', getFamilyBookings);
bookingRouter.get('/caregiver', getCaregiverBookings);
bookingRouter.get('/stats', getBookingStats);

// Single booking
bookingRouter.get('/:bookingId', getBookingById);
bookingRouter.put('/:bookingId/notes', updateBookingNotes);

// Actions
bookingRouter.post('/:bookingId/accept', acceptBooking);
bookingRouter.post('/:bookingId/reject', rejectBooking);
bookingRouter.post('/:bookingId/cancel', cancelBooking);
bookingRouter.post('/:bookingId/start', startBooking);
bookingRouter.post('/:bookingId/complete', completeBooking);

export default bookingRouter;
