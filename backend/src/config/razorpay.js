/**
 * Whether THIS restaurant has connected its own Razorpay account. This
 * is per-restaurant (columns on the Restaurant row), unlike Stripe
 * which is one platform-wide key shared by every tenant — restaurants
 * on Razorpay want payments settling directly to their own account,
 * not the platform's.
 */
function isRazorpayConfigured(restaurant) {
  return Boolean(
    restaurant?.razorpayKeyId &&
      restaurant?.razorpayKeySecret &&
      restaurant.razorpayKeyId.startsWith('rzp_') &&
      !restaurant.razorpayKeyId.includes('xxxx')
  );
}

module.exports = { isRazorpayConfigured };
