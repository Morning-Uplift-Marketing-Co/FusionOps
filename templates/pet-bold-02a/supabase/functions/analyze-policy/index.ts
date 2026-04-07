import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PolicyAnalysisRequest {
  title: string;
  category: string;
  content: string;
  userId: string;
}

interface RiskPattern {
  pattern: RegExp;
  category: string;
  replacements: string[];
}

const riskPatterns: RiskPattern[] = [
  {
    pattern: /\bzero risk\b/gi,
    category: 'zero_risk',
    replacements: ['minimal risk', 'substantially reduced risk', 'low probability of occurrence']
  },
  {
    pattern: /\bno risk\b/gi,
    category: 'no_risk',
    replacements: ['minimal risk', 'reduced risk', 'low risk profile']
  },
  {
    pattern: /\brisk-free\b/gi,
    category: 'risk_free',
    replacements: ['low-risk', 'minimal risk exposure', 'within acceptable risk parameters']
  },
  {
    pattern: /\bcompletely safe\b/gi,
    category: 'absolute_safety',
    replacements: ['robust security measures in place', 'comprehensive safety protocols', 'designed with safety as a priority']
  },
  {
    pattern: /\babsolutely secure\b/gi,
    category: 'absolute_security',
    replacements: ['highly secure', 'comprehensive security measures', 'advanced security protocols']
  },
  {
    pattern: /\bguaranteed\s+(?:safe|secure|risk-free|protection)\b/gi,
    category: 'guaranteed_safety',
    replacements: ['robust protection measures', 'comprehensive safeguards', 'strong protective measures']
  },
  {
    pattern: /\b100%\s+(?:safe|secure|protected)\b/gi,
    category: 'percentage_guarantee',
    replacements: ['highly secure', 'substantially protected', 'comprehensive protection measures']
  },
  {
    pattern: /\bwill never\s+(?:fail|breach|lose|compromise)\b/gi,
    category: 'absolute_promise',
    replacements: ['designed to prevent', 'robust measures to avoid', 'multiple safeguards against']
  },
  {
    pattern: /\bimpossible\s+to\s+(?:breach|hack|compromise|fail)\b/gi,
    category: 'impossibility_claim',
    replacements: ['highly resistant to', 'protected against', 'designed to prevent']
  },
  {
    pattern: /\bno\s+possibility\s+of\b/gi,
    category: 'no_possibility',
    replacements: ['minimal likelihood of', 'low probability of', 'substantially reduced chance of']
  },
  {
    pattern: /\bcannot\s+(?:fail|be\s+breached|be\s+compromised)\b/gi,
    category: 'cannot_fail',
    replacements: ['designed with redundancy to avoid', 'robust measures to prevent', 'multiple layers of protection against']
  },
  {
    pattern: /\bwithout\s+any\s+risk\b/gi,
    category: 'without_risk',
    replacements: ['with minimal risk', 'with substantially reduced risk', 'with appropriate risk mitigation']
  }
];

function analyzeText(content: string): { revisedContent: string; changes: any[] } {
  let revisedContent = content;
  const changes: any[] = [];
  let changeIndex = 0;

  for (const riskPattern of riskPatterns) {
    const matches = content.matchAll(riskPattern.pattern);

    for (const match of matches) {
      const originalText = match[0];
      const replacement = riskPattern.replacements[changeIndex % riskPattern.replacements.length];

      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      // Get context (surrounding text)
      const contextStart = Math.max(0, (match.index || 0) - 50);
      const contextEnd = Math.min(content.length, (match.index || 0) + originalText.length + 50);
      const context = content.substring(contextStart, contextEnd);

      changes.push({
        original_text: originalText,
        revised_text: replacement,
        risk_category: riskPattern.category,
        line_number: lineNumber,
        context: context.trim()
      });

      revisedContent = revisedContent.replace(originalText, replacement);
      changeIndex++;
    }
  }

  return { revisedContent, changes };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: PolicyAnalysisRequest = await req.json();
    const { title, category, content, userId } = requestData;

    if (!title || !content || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Analyze the content
    const { revisedContent, changes } = analyzeText(content);

    // Save the original document
    const { data: document, error: docError } = await supabase
      .from('policy_documents')
      .insert({
        user_id: userId,
        title,
        category,
        original_content: content,
        status: 'under_review'
      })
      .select()
      .maybeSingle();

    if (docError) {
      console.error('Document insert error:', docError);
      throw new Error('Failed to save document');
    }

    // Save the revision
    const { data: revision, error: revisionError } = await supabase
      .from('policy_revisions')
      .insert({
        document_id: document.id,
        revised_content: revisedContent,
        changes_summary: {
          total_changes: changes.length,
          categories: [...new Set(changes.map(c => c.risk_category))]
        },
        risk_issues_found: changes.length,
        revision_type: 'automatic',
        created_by: userId
      })
      .select()
      .maybeSingle();

    if (revisionError) {
      console.error('Revision insert error:', revisionError);
      throw new Error('Failed to save revision');
    }

    // Save individual changes
    if (changes.length > 0) {
      const changeRecords = changes.map(change => ({
        revision_id: revision.id,
        ...change
      }));

      const { error: changesError } = await supabase
        .from('change_tracking')
        .insert(changeRecords);

      if (changesError) {
        console.error('Changes insert error:', changesError);
      }
    }

    return new Response(
      JSON.stringify({
        document_id: document.id,
        revision_id: revision.id,
        revised_content: revisedContent,
        changes,
        risk_issues_found: changes.length,
        message: changes.length > 0
          ? `Found and revised ${changes.length} instance${changes.length !== 1 ? 's' : ''} of absolute risk language`
          : 'No absolute risk language detected'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
