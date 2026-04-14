export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  maxGroupSize: Number(process.env['MAX_GROUP_SIZE'] ?? 6),
  hotelsSimulatorUrl:
    process.env['HOTELS_SIMULATOR_URL'] ??
    'https://gya7b1xubh.execute-api.eu-west-2.amazonaws.com/default/HotelsSimulator',
  bookingUrl: process.env['BOOKING_URL'] ?? 'https://api.booking.example/hotels',
}
