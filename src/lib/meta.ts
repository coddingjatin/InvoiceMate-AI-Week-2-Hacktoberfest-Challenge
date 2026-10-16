export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · InvoiceMate AI` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · InvoiceMate AI` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
