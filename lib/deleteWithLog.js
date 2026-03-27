/**
 * Logs a record snapshot to deleted_items then permanently deletes it from its table.
 * Returns the delete error (or null on success).
 */
export async function deleteWithLog(supabase, {
  table,
  id,
  entityType,   // 'inventory' | 'sale' | 'offer' | 'expense' | 'liability' | 'purchase'
  modelName,    // human-readable label for the log
  price,        // numeric snapshot
  deletedBy,    // user email
  entityData,   // full row object (JSONB snapshot)
}) {
  // Insert audit log entry (fire-and-forget; non-blocking)
  await supabase.from('deleted_items').insert([{
    entity_type: entityType,
    entity_id:   id,
    model_name:  modelName,
    price,
    deleted_by:  deletedBy,
    deleted_at:  new Date().toISOString(),
    entity_data: entityData,
  }])

  const { error } = await supabase.from(table).delete().eq('id', id)
  return error || null
}
