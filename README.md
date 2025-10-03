## Booking Feature Endpoints

Base path: `/api/v1/bookings` (all require authentication & JWT middleware)

### Create Booking (Family)
POST `/api/v1/bookings`
Body:
```
{
	"careId": "<caregiver ObjectId>",
	"jobPostId": "<optional job post id>",
	"elderName": "John Doe",
	"location": "123 Main St, City",
	"skills": ["companionship", "meal_preparation"],
	"schedule": { "date": "2025-10-05", "startTime": "09:00", "durationHours": 4 },
	"hourlyRate": 25,
	"notes": "Please arrive 10 minutes early"
}
```

### List Family Bookings
GET `/api/v1/bookings/family?status=ACCEPTED&page=1&limit=10`

### List Caregiver Bookings
GET `/api/v1/bookings/caregiver?status=PENDING&page=1&limit=10`

### Booking Stats (Family or Caregiver)
GET `/api/v1/bookings/stats`
Response groups counts/hours/total by status.

### Get Single Booking
GET `/api/v1/bookings/:bookingId`

### Accept Booking (Caregiver)
POST `/api/v1/bookings/:bookingId/accept`

### Reject Booking (Caregiver)
POST `/api/v1/bookings/:bookingId/reject`
Body: `{ "reason": "Scheduling conflict" }`

### Cancel Booking (Family)
POST `/api/v1/bookings/:bookingId/cancel`

### Start Booking (Family or Caregiver)
POST `/api/v1/bookings/:bookingId/start`

### Complete Booking (Family or Caregiver)
POST `/api/v1/bookings/:bookingId/complete`

### Update Notes (Family)
PUT `/api/v1/bookings/:bookingId/notes`
Body: `{ "notes": "Updated note" }`

## Status Lifecycle
`PENDING -> ACCEPTED -> IN_PROGRESS -> COMPLETED`
`PENDING -> REJECTED`
`ANY (non-terminal) -> CANCELED`
`PENDING (past start auto) -> EXPIRED` (future scheduled job)

Terminal statuses: COMPLETED, CANCELED, REJECTED, EXPIRED

## Payment Status (Future Integration)
UNPAID -> HOLD (escrow) -> PAID -> REFUNDED

## Future Enhancements
- Escrow + automatic transfer after completion
- Calendar conflict detection
- Double-acknowledgement completion flow
- Expiration cron job
- Rate adjustments & revision history

