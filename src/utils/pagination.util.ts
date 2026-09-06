const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export const getPaginationParams = (page: unknown, limit: unknown) => {
  const parsedPage = Math.max(Number(page) || 1, 1);
  const parsedLimit = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);

  return { page: parsedPage, limit: parsedLimit };
};