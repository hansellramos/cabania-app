const data = [
  { code: 'anthropic', name: 'Anthropic Claude', base_url: 'https://api.anthropic.com', model: 'claude-3-haiku-20240307', is_active: true, is_default: false },
  { code: 'deepseek', name: 'DeepSeek V3', base_url: 'https://api.deepseek.com', model: 'deepseek-chat', is_active: true, is_default: false },
  { code: 'xai_grok', name: 'Groq', base_url: 'https://api.x.ai/v1', model: 'grok-3-fast', is_active: true, is_default: true },
  { code: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', is_active: true, is_default: true },
];

async function seed(prisma) {
  for (const item of data) {
    await prisma.llm_providers.upsert({
      where: { code: item.code },
      update: { name: item.name, base_url: item.base_url, model: item.model, is_active: item.is_active, is_default: item.is_default },
      create: item,
    });
  }
  console.log(`  llm_providers: ${data.length} registros (upsert, sin API keys)`);
}

module.exports = seed;
