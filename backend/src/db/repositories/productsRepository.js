

const supabase = require('../supabaseClient');

async function findAllActive() {
  const { data, error } = await supabase.from('products').select('*').eq('is_active', true);
  if (error) throw error;
  return data;
}

async function findAll() {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}


async function upsertTracked({ name, productUrl, imageUrl, storeProductId, scrapeFrequencyHours }) {
  const { data, error } = await supabase
    .from('products')
    .upsert(
      {
        name,
        product_url: productUrl,
        image_url: imageUrl || null,
        store_product_id: storeProductId,
        scrape_frequency_hours: scrapeFrequencyHours,
        is_active: true,
      },
      { onConflict: 'store_product_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}


async function updatePatch(id, patch) {
  const { data, error } = await supabase.from('products').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}


async function recordSuccessfulScrape(id, { price, stock, structureHash }) {
  const { error } = await supabase
    .from('products')
    .update({
      last_price: price,
      last_stock: stock,
      last_scraped_at: new Date().toISOString(),
      dom_structure_hash: structureHash,
    })
    .eq('id', id);
  if (error) throw error;
}


async function findReliabilityByProductId() {
  const { data, error } = await supabase.from('product_reliability').select('*');
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.product_id, r]));
}

module.exports = {
  findAllActive,
  findAll,
  findById,
  upsertTracked,
  updatePatch,
  recordSuccessfulScrape,
  findReliabilityByProductId,
};
