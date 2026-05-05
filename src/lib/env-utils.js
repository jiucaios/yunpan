function isVercel() {
  const vercelEnv = process.env.VERCEL;
  return vercelEnv === "1" || vercelEnv === "true" || !!vercelEnv;
}

module.exports = {
  isVercel
};
