/** Limit a query to one account. A null id leaves the query unscoped for system jobs and legacy callers. */
export function ownerClause(userId, column = 'user_id') {
  if (userId == null) return { sql: '', args: [] };
  return { sql: ` AND ${column} = ?`, args: [userId] };
}

export function requestUserId(req) {
  const id = Number(req.auth?.userId);
  return Number.isInteger(id) && id > 0 ? id : null;
}
