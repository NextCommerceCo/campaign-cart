/**
 * Campaign Cart SDK Configuration
 * Central configuration for SDK URLs and settings used across documentation
 */

export const SDK_CONFIG = {
  // Current SDK version
  version: 'v0.3.1',
  
  // CDN URLs
  cdn: {
    latest: 'https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.3.1/dist/loader.js',
    specific: (version: string) => `https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@${version}/dist/loader.js`,
  },
  
  // Demo API key for interactive examples
  demoApiKey: 'kLGpgEfCX3iUZG16hpI5zrCH9qxcOdahDY1im6ud',
  
  // Dashboard URL
  dashboardUrl: 'https://dashboard.campaigncart.com',
  
  // Support URL
  supportUrl: 'https://support.campaigncart.com',
  
  // Script tag generator
  getScriptTag: (options?: { version?: string; integrity?: string }) => {
    const url = options?.version 
      ? SDK_CONFIG.cdn.specific(options.version)
      : SDK_CONFIG.cdn.latest;
    
    const attrs = ['type="module"'];
    if (options?.integrity) {
      attrs.push(`integrity="${options.integrity}"`);
      attrs.push('crossorigin="anonymous"');
    }
    
    return `<script src="${url}" ${attrs.join(' ')}></script>`;
  },
  
  // Full HTML setup generator
  getSetupCode: (apiKey: string = 'your-api-key-here') => {
    return `<!-- Campaign Cart Configuration -->
<script>
  window.nextConfig = {
    apiKey: "${apiKey}"
  };
</script>

<!-- Campaign Cart SDK -->
${SDK_CONFIG.getScriptTag()}`;
  }
};

// Export for use in MDX files
export default SDK_CONFIG;