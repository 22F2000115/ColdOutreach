export function getFriendlyError(err, fallback) {
  if (err?.response?.status === 403) {
    // If the backend returned a custom detailed error (like check_quota message), prefer it!
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    return "You've reached the limit for your current plan. Contact us to upgrade to Pro.";
  }
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback || "Something went wrong. Please try again.";

  if (typeof detail === 'string') {
    if (detail.includes("SMTP Authentication failed") || detail.includes("Authentication failed")) {
      return "Login failed. Double-check your email address and make sure you're using an App Password, not your regular account password.";
    }
    if (detail.includes("SMTP Connection failed") || detail.includes("Connection failed")) {
      return "Couldn't connect to the mail server. Verify the host and port in Advanced Settings are correct.";
    }
    const map = {
      "You do not have permission to perform this action.": "You've reached the limit for your current plan. Contact us to upgrade to Pro.",
      "trial_expired": "Your trial has expired. Contact us to upgrade your account.",
    };
    return map[detail] || detail;
  }
  if (Array.isArray(detail)) return detail.map(d => d.msg).join(', ');
  return fallback || "Something went wrong.";
}
