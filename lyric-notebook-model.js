/* Private notebook data helpers. No poems or credentials are bundled here. */
(function (root) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const body = item => item?.result?.final || item?.result?.draft || item?.seed || "";
  function checkpoint(previous, edited, now) {
    const next = clone(edited);
    const result = next.result ||= {};
    const before = previous ? body(previous) : body(next);
    result.original ??= { text: previous?.result?.draft || before, createdAt: previous?.createdAt || now };
    result.revisions ||= [];
    if (previous && before !== body(next)) {
      result.revisions.push({ text: before, title: previous.title, createdAt: previous.updatedAt || now });
      result.status = "working";
    }
    next.createdAt = previous?.createdAt || next.createdAt || now;
    next.updatedAt = now;
    return next;
  }
  function mergeCloud(local, incoming, pending) {
    const byId = new Map(local.map(item => [item.id, clone(item)]));
    for (const item of incoming) {
      if (!pending[item.id]) byId.set(item.id, clone(item));
    }
    return [...byId.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  function fork(item, id, now) {
    const copy = clone(item);
    copy.id = id;
    copy.title = `${item.title || "無題"}（別案）`;
    copy.createdAt = now;
    copy.updatedAt = now;
    copy.settings = { ...copy.settings, forkedFrom: item.id };
    return copy;
  }
  root.LyricNotebook = { clone, body, checkpoint, mergeCloud, fork };
})(globalThis);
