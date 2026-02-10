const data = [
  { setting_key: 'customer_chat', provider_code: 'xai_grok', model: 'grok-3-mini' },
  { setting_key: 'message_suggestions', provider_code: 'xai_grok', model: 'grok-3-mini' },
  { setting_key: 'receipt_extraction', provider_code: 'xai_grok', model: 'grok-4-fast-reasoning' },
];

async function seed(prisma) {
  for (const item of data) {
    await prisma.ai_settings.upsert({
      where: { setting_key: item.setting_key },
      update: { provider_code: item.provider_code, model: item.model },
      create: item,
    });
  }
  console.log(`  ai_settings: ${data.length} registros (upsert)`);
}

module.exports = seed;
