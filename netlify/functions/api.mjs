import { handleApi } from '../lib/api.mjs';

export default async (request, context) => handleApi(request, context);

export const config = {
  path: '/api/*',
};
