const data = [
  { code: 'anthropic', name: 'Anthropic Claude', base_url: 'https://api.anthropic.com', model: 'claude-3-haiku-20240307', is_active: true, is_default: false, input_price_per_mtok: 3.00, output_price_per_mtok: 15.00 },
  { code: 'deepseek', name: 'DeepSeek V3', base_url: 'https://api.deepseek.com', model: 'deepseek-chat', is_active: true, is_default: false, input_price_per_mtok: 0.27, output_price_per_mtok: 1.10 },
  { code: 'xai_grok', name: 'xAI Grok', base_url: 'https://api.x.ai/v1', model: 'grok-4-1-fast-reasoning', is_active: true, is_default: true, input_price_per_mtok: 0.20, output_price_per_mtok: 0.50 },
  { code: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', is_active: true, is_default: true, input_price_per_mtok: 2.50, output_price_per_mtok: 10.00 },
];

async function seed(prisma) {
  for (const item of data) {
    await prisma.llm_providers.upsert({
      where: { code: item.code },
      update: { name: item.name, base_url: item.base_url, model: item.model, is_active: item.is_active, is_default: item.is_default, input_price_per_mtok: item.input_price_per_mtok, output_price_per_mtok: item.output_price_per_mtok },
      create: item,
    });
  }
  console.log(`  llm_providers: ${data.length} registros (upsert, sin API keys)`);
}

module.exports = seed;
