# LP Template Generator

Standalone module for generating Astro landing page templates. Designed for use with LP Factory or as an independent CLI tool.

## Features

- **Multiple Templates**: Classic LP, PDL Loans V1, and more
- **Zero-JS Architecture**: Pure Astro components with minimal inline scripts
- **Standalone CLI**: Generate templates without the full LP Factory
- **Programmatic API**: Use as a library in your own projects

## Installation

```bash
cd packages/lp-template-generator
npm install
```

## CLI Usage

```bash
# List available templates
npm run test

# Generate with CLI
node src/cli.js --list
node src/cli.js --template classic --config '{"brand":"MyLP","amountMax":5000}'
node src/cli.js --template pdl-loans-v1 --config config.json --output ./output
```

## Programmatic Usage

```javascript
import { generateTemplate, getTemplates } from '@lp-factory/template-generator';

// List templates
const templates = getTemplates();
console.log(templates);
// [{ id: 'classic', name: 'Classic LP', ... }, { id: 'pdl-loans-v1', name: 'PDL Loans V1', ... }]

// Generate files
const siteConfig = {
  brand: 'MyLoanSite',
  domain: 'myloansite.com',
  amountMin: 100,
  amountMax: 5000,
  colorId: 'ruby',
  fontId: 'dm-sans',
};

const files = generateTemplate('pdl-loans-v1', siteConfig);
// {
//   'package.json': '{...}',
//   'src/pages/index.astro': '<!doctype html>...',
//   ...
// }
```

## Template Structure

```
packages/lp-template-generator/
├── src/
│   ├── core/                    # Core framework
│   │   ├── generator.js         # Main generator API
│   │   ├── template-registry.js # Template registry
│   │   └── schema.js            # Config schema
│   ├── templates/               # Template implementations
│   │   ├── classic/             # Classic template
│   │   ├── pdl-loans-v1/        # PDL Loans V1 template
│   │   └── index.js             # Template loader
│   ├── cli.js                   # CLI tool
│   └── index.js                 # Main export
├── bin/
│   └── lp-gen.js                # CLI entry point
└── package.json
```

## Adding New Templates

1. Create a new directory in `src/templates/your-template/`
2. Create `index.js` with a `generate(site)` function that returns a files object
3. Register in `src/templates/index.js`:

```javascript
import { registerTemplate } from '../core/template-registry.js';
import { generate as generateYourTemplate } from './your-template/index.js';

registerTemplate('your-template', {
  name: 'Your Template',
  description: 'Description here',
  badge: 'New',
  category: 'general',
  generate: generateYourTemplate,
});
```

## Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `brand` | string | "LoanBridge" | Site/brand name |
| `domain` | string | "example.com" | Site domain |
| `colorId` | string | "ruby" | Color scheme (ruby, blue, green, purple, orange) |
| `fontId` | string | "dm-sans" | Font family (dm-sans, inter, space-grotesk) |
| `radius` | string | "md" | Border radius (sm, md, lg) |
| `loanType` | string | "personal" | Loan type (personal, payday, installment, pdl) |
| `amountMin` | number | 100 | Min loan amount |
| `amountMax` | number | 5000 | Max loan amount |
| `aprMin` | number | 5.99 | Min APR |
| `aprMax` | number | 35.99 | Max APR |
| `h1` | string | - | Main headline |
| `h1span` | string | - | Headline span (PDL template) |
| `sub` | string | - | Subheadline |
| `badge` | string | - | Badge text |
| `cta` | string | "Apply Now" | CTA button text |

## License

MIT
