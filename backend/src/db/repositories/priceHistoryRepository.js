

const supabase = require('../supabaseClient');

async function recordPoint(productId, { price, stock }) {
  const { error } = await supabase.from('price_history').insert({
    product_id: productId,
    price,
    stock_status: stock,
  });
  if (error) throw error;
}

async function findByProduct(productId) {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('product_id', productId)
    .order('scraped_at', { ascending: true });
  if (error) throw error;
  return data;
}

module.exports = { recordPoint, findByProduct };
