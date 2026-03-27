const normalizeEmail = value => {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().trim();
};

module.exports = {
  normalizeEmail,
};
