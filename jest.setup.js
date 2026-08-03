/* eslint-env node */
// Generating and grading a Master puzzle runs the full technique ladder many
// times over; the default 5s timeout is not enough on a cold cache.
jest.setTimeout(60000);
