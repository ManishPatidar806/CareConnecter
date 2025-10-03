export const BOOKING_STATUSES = Object.freeze([
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELED',
  'REJECTED',
  'EXPIRED'
]);

export const BOOKING_PAYMENT_STATUSES = Object.freeze([
  'UNPAID',
  'HOLD',
  'PAID',
  'REFUNDED'
]);

export const isTerminalStatus = (status) => ['COMPLETED','CANCELED','REJECTED','EXPIRED'].includes(status);
