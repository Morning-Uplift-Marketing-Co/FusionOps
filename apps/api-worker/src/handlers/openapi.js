// ============================================================
// OpenAPI 3.0 spec for FusionOps Automation API
// ============================================================
// Static document served at GET /api/openapi.json (public — no auth).
// Used by external automation tools and the SPA's API Explorer.
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../lib/http.js';

const OPENAPI_SPEC = {
        openapi: '3.0.3',
        info: {
          title: 'FusionOps Automation API',
          version: '2.1.0',
          description: 'Automation endpoints for FusionOps V2',
        },
        servers: [{ url: 'https://lp-factory-api.misty-feather-556e.workers.dev', description: 'Production' }],
        tags: [
          { name: 'Registrar', description: 'Domain registrar operations (Internet.bs)' },
          { name: 'Cloudflare', description: 'Cloudflare DNS and zone management' },
          { name: 'Deploy', description: 'Deployment platform linking' },
          { name: 'LeadingCards', description: 'Virtual card management' },
          { name: 'Multilogin', description: 'Browser profile automation' },
        ],
        paths: {
          '/api/automation/registrar/check': {
            post: {
              tags: ['Registrar'],
              summary: 'Check domain availability',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'provider'],
                      properties: {
                        domain: { type: 'string', example: 'example.com' },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/register': {
            post: {
              tags: ['Registrar'],
              summary: 'Register a domain',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'provider'],
                      properties: {
                        domain: { type: 'string' },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                        period: { type: 'string', default: '1Y' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/nameservers': {
            put: {
              tags: ['Registrar'],
              summary: 'Update domain nameservers',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'nameservers', 'provider'],
                      properties: {
                        domain: { type: 'string' },
                        nameservers: { type: 'array', items: { type: 'string' } },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/import': {
            post: {
              tags: ['Registrar'],
              summary: 'Import all domains',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['provider'],
                      properties: {
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/ping': {
            post: {
              tags: ['Registrar'],
              summary: 'Test registrar connection',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['provider'],
                      properties: {
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/cf-validate': {
            post: {
              tags: ['Cloudflare'],
              summary: 'Validate Cloudflare API token and account ID',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['accountId', 'apiToken'],
                      properties: {
                        accountId: { type: 'string' },
                        apiToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Valid credentials' },
                '400': { description: 'Invalid credentials' },
              },
            },
          },
          '/api/automation/cf/zone': {
            post: {
              tags: ['Cloudflare'],
              summary: 'Create or get zone',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'cfAccountId'],
                      properties: {
                        domain: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/cf/dns': {
            get: {
              tags: ['Cloudflare'],
              summary: 'List DNS records',
              parameters: [
                { name: 'zoneId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'cfAccountId', in: 'query', required: true, schema: { type: 'string' } },
              ],
              responses: { '200': { description: 'Success' } },
            },
            post: {
              tags: ['Cloudflare'],
              summary: 'Create DNS record',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['zoneId', 'cfAccountId', 'type', 'name', 'content'],
                      properties: {
                        zoneId: { type: 'string' },
                        cfAccountId: { type: 'string' },
                        type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'TXT', 'NS', 'MX', 'SRV'] },
                        name: { type: 'string' },
                        content: { type: 'string' },
                        ttl: { type: 'integer', default: 3600 },
                        proxied: { type: 'boolean', default: false },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
            put: {
              tags: ['Cloudflare'],
              summary: 'Update DNS record',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['dnsRecordId', 'zoneId', 'cfAccountId'],
                      properties: {
                        dnsRecordId: { type: 'string' },
                        zoneId: { type: 'string' },
                        cfAccountId: { type: 'string' },
                        type: { type: 'string' },
                        name: { type: 'string' },
                        content: { type: 'string' },
                        ttl: { type: 'integer' },
                        proxied: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
            delete: {
              tags: ['Cloudflare'],
              summary: 'Delete DNS record',
              parameters: [
                { name: 'dnsRecordId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'zoneId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'cfAccountId', in: 'query', required: true, schema: { type: 'string' } },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/vercel': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Vercel project',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['projectName', 'accessToken'],
                      properties: {
                        projectName: { type: 'string' },
                        accessToken: { type: 'string' },
                        teamId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/netlify': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Netlify site',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['siteName', 'accessToken'],
                      properties: {
                        siteName: { type: 'string' },
                        accessToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/cf-pages': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Cloudflare Pages project',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['projectName', 'cfAccountId'],
                      properties: {
                        projectName: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/cf-workers': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Cloudflare Workers script',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['scriptName', 'cfAccountId'],
                      properties: {
                        scriptName: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/create': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Create virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        limit: { type: 'number' },
                        currency: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/block': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Block virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid'],
                      properties: {
                        cardUuid: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/activate': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Activate virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid'],
                      properties: {
                        cardUuid: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/change_limit': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Change card limit',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid', 'limit'],
                      properties: {
                        cardUuid: { type: 'string' },
                        limit: { type: 'number' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/d1/query': {
            post: {
              tags: ['D1 Database'],
              summary: 'Execute SQL query on D1 database',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['sql', 'accountId', 'databaseId'],
                      properties: {
                        sql: { type: 'string', description: 'SQL query with ? placeholders' },
                        params: { type: 'array', description: 'Parameters for prepared statement' },
                        accountId: { type: 'string', description: 'Cloudflare Account ID' },
                        databaseId: { type: 'string', description: 'D1 Database UUID' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Query results' },
                '400': { description: 'Bad request' },
              },
            },
          },
          '/api/automation/d1/execute': {
            post: {
              tags: ['D1 Database'],
              summary: 'Execute SQL command (INSERT, UPDATE, DELETE)',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['sql', 'accountId', 'databaseId'],
                      properties: {
                        sql: { type: 'string', description: 'SQL command' },
                        params: { type: 'array', description: 'Parameters for prepared statement' },
                        accountId: { type: 'string', description: 'Cloudflare Account ID' },
                        databaseId: { type: 'string', description: 'D1 Database UUID' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Command executed' },
                '400': { description: 'Bad request' },
              },
            },
          },
          '/api/automation/ml/signin': {
            post: {
              tags: ['Multilogin'],
              summary: 'Sign in to Multilogin',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/refresh_token': {
            post: {
              tags: ['Multilogin'],
              summary: 'Refresh Multilogin token',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles': {
            get: {
              tags: ['Multilogin'],
              summary: 'List Multilogin profiles',
              responses: { '200': { description: 'Success' } },
            },
            post: {
              tags: ['Multilogin'],
              summary: 'Create Multilogin profile',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/start': {
            post: {
              tags: ['Multilogin'],
              summary: 'Start Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/stop': {
            post: {
              tags: ['Multilogin'],
              summary: 'Stop Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/clone': {
            post: {
              tags: ['Multilogin'],
              summary: 'Clone Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
        },
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'API_SECRET',
            },
          },
        },
};

/**
 * Route entry. Returns Response if path matches; null otherwise.
 */
export function handleOpenApiRoute({ path, method }) {
  if (path === '/api/openapi.json' && method === 'GET') {
    return json(OPENAPI_SPEC);
  }
  return null;
}
