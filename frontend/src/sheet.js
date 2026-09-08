export function getSheetValue(sheet, path, fallback = null) {
  return path.split('.').reduce((value, segment) => {
    if (value === null || typeof value !== 'object' || !(segment in value)) return fallback;
    return value[segment];
  }, sheet);
}

export function setSheetValue(sheet, path, value) {
  const nextSheet = { ...sheet };
  const segments = path.split('.');
  let target = nextSheet;

  segments.slice(0, -1).forEach((segment) => {
    target[segment] = { ...(target[segment] || {}) };
    target = target[segment];
  });
  target[segments[segments.length - 1]] = value;
  return nextSheet;
}

export function createDefaultSheet(actorSheet) {
  return (actorSheet?.fields || []).reduce(
    (sheet, field) => setSheetValue(sheet, field.key, field.default ?? null),
    {}
  );
}

export function defaultSheetForActor(actorSheet) {
  const sheet = createDefaultSheet(actorSheet);
  // Collection fields hold shared default arrays in the definition; deep-copy
  // so two actors never mutate the same list.
  (actorSheet?.fields || []).forEach((field) => {
    if (field.type === 'collection' && Array.isArray(field.default)) {
      const segments = field.key.split('.');
      const leaf = segments[segments.length - 1];
      let bucket = sheet;
      segments.slice(0, -1).forEach((segment) => {
        bucket[segment] = bucket[segment] || {};
        bucket = bucket[segment];
      });
      bucket[leaf] = JSON.parse(JSON.stringify(field.default));
    }
  });
  return sheet;
}