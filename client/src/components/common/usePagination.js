import { useMemo, useState } from "react";

// Splits a list into pages on the client. Goes back to page 1 whenever `resetKey` changes
// (a filter or search), and stays on a valid page when items are removed.
export function usePagination(items, pageSize, resetKey = "") {
  const [state, setState] = useState({ page: 1, key: resetKey });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const requested = state.key === resetKey ? state.page : 1;
  const page = Math.min(requested, pageCount);
  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  return {
    page,
    pageCount,
    pageItems,
    offset: (page - 1) * pageSize,
    setPage: next => setState({ page: next, key: resetKey }),
  };
}
