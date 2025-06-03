export const jwtConfig = () => {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET é obrigatório no arquivo .env');
  }

  if (!refreshSecret) {
    throw new Error('REFRESH_TOKEN_SECRET é obrigatório no arquivo .env');
  }

  return {
    jwt: {
      secret: jwtSecret,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshSecret: refreshSecret,
      refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    },
  };
};
