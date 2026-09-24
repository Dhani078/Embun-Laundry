// functions/_activity.js
// Audit trail helper — fire-and-forget insert, never throws.

/**
 * Log an activity to the activity_log table.
 * @param {object} db - database connection
 * @param {object} opts
 * @param {string} opts.actor_name - who performed the action
 * @param {string} opts.actor_role - role (Admin/Staff/Customer)
 * @param {string} opts.action_type - create|update|delete|login|logout|status_change
 * @param {string} opts.entity_type - order|customer|service|delivery|promo|user
 * @param {string|number} opts.entity_id - primary key of affected entity
 * @param {string} opts.entity_label - human-readable label (order_code, customer name, etc.)
 * @param {string} [opts.detail] - extra detail text
 * @param {string} [opts.ip_address] - client IP
 */
export async function logActivity(db, opts) {
  try {
    await db.execute(
      `INSERT INTO activity_log (actor_name, actor_role, action_type, entity_type, entity_id, entity_label, detail, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        (opts.actor_name || 'system').slice(0, 100),
        (opts.actor_role || 'system').slice(0, 30),
        (opts.action_type || 'unknown').slice(0, 30),
        (opts.entity_type || '').slice(0, 30),
        String(opts.entity_id || '').slice(0, 40),
        (opts.entity_label || '').slice(0, 200),
        (opts.detail || '').slice(0, 500),
        (opts.ip_address || '').slice(0, 45)
      ]
    );
  } catch (_) {
    // Fire-and-forget — never block main flow
  }
}
