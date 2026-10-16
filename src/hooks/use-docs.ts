import { useEffect, useState } from "react";
import { listDocs, subscribe, type DocRecord } from "@/lib/db";

export function useDocs() {
  const [docs, setDocs] = useState<DocRecord[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => listDocs().then((d) => alive && setDocs(d));
    load();
    const un = subscribe(load);
    return () => {
      alive = false;
      un();
    };
  }, []);
  return docs;
}
