
const supabase = require('../supabaseClient');

async function recordAlert(productId, { alertType, oldValue, newValue }) {
  const { error } = await supabase.from('alerts_sent').insert({
    product_id: productId,
    alert_type: alertType,
    old_value: oldValue,
    new_value: newValue,
  });
  if (error) throw error;
}

module.exports = { recordAlert };
