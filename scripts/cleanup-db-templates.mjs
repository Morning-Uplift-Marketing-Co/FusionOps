/**
 * Cleanup DB-only templates that don't have physical directories
 * Removes templates from D1 Database that were created via Bolt.new but are no longer needed
 */
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const API_BASE = 'https://lp-factory-api.misty-feather-556e.workers.dev';
const MCP_SECRET = '9f6a3c1d4e8b7a2f5c0d9e1b3a6f4c7d2e8a1b5c9d3f7a4e6b0c2d8f1a3e5b7c';

async function listTemplates() {
  const url = `${API_BASE}/api/mcp/templates`;
  const response = await fetch(url, {
    headers: { 'x-mcp-secret': MCP_SECRET },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function deleteTemplate(templateId) {
  // Note: API Worker doesn't have DELETE endpoint yet
  // This is a placeholder - actual deletion needs to be done via UI or SQL
  console.log(`⚠️  Cannot delete via API - delete manually: ${templateId}`);
  console.log(`   SQL: DELETE FROM templates WHERE template_id = '${templateId}';`);
}

console.log('Fetching templates from D1 Database...');
const templates = await listTemplates();

console.log(`Found ${templates.length} templates`);

const toDelete = [];

for (const template of templates) {
  const templateId = template.template_id;
  const physicalDir = path.join(root, 'templates', templateId);
  const hasPhysicalDir = existsSync(physicalDir);

  if (!hasPhysicalDir && template.source === 'bolt') {
    console.log(`❌ ${templateId} - No physical directory (source: ${template.source})`);
    toDelete.push(templateId);
  } else if (hasPhysicalDir) {
    console.log(`✅ ${templateId} - Has physical directory`);
  } else {
    console.log(`⚠️  ${templateId} - No physical directory but source is not 'bolt' (source: ${template.source || 'unknown'})`);
  }
}

if (toDelete.length === 0) {
  console.log('\n✅ No templates to delete');
  process.exit(0);
}

console.log(`\n📋 Templates to delete (${toDelete.length}):`);
toDelete.forEach((id) => console.log(`   - ${id}`));

console.log('\n⚠️  To delete these templates, run the following SQL in Cloudflare D1 Console:');
console.log('\n```sql');
toDelete.forEach((id) => {
  console.log(`DELETE FROM templates WHERE template_id = '${id}';`);
});
console.log('```');

console.log('\nOr delete via FusionOps UI → Template Manager');
