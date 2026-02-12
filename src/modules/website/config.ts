export const WEBSITE_CACHE_TTL = Number(process.env.WEBSITE_CACHE_TTL || '300');
export const WEBSITE_HTTP_CACHE_TTL = Number(
  process.env.WEBSITE_HTTP_CACHE_TTL || process.env.WEBSITE_CACHE_TTL || '120',
);
export const WEBSITE_AGGREGATE_CACHE_TTL = Number(
  process.env.WEBSITE_AGGREGATE_CACHE_TTL || process.env.WEBSITE_CACHE_TTL || '300',
);
