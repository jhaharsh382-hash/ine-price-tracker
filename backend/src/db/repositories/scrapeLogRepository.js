
const supabase = require('../supabaseClient');

async function recordAttempt(productId, { status, attemptNumber, durationMs, errorMessage }) {
  const { error } = await supabase.from('scrape_logs').insert({
    product_id: productId,
    status,
    attempt_number: attemptNumber,
    duration_ms: durationMs,
    error_message: errorMessage || null,
  });
  if (error) throw error;
}


async function annotateLatestSuccess(productId, { method, structureChanged }) {
  const { error } = await supabase
    .from('scrape_logs')
    .update({ structure_changed: structureChanged, method })
    .eq('product_id', productId)
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw error;
}

async function findByProduct(productId, limit = 100) {
  const { data, error } = await supabase
    .from('scrape_logs')
    .select('*')
    .eq('product_id', productId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

module.exports = { recordAttempt, annotateLatestSuccess, findByProduct };
