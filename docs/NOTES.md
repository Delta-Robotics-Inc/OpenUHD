
Concepts to ensure are in this:
- Exclusivity between components in the same ecosystem "proprietary connections"


## Supplier links in part metadata

Product URLs stored in part or purchase metadata go stale quickly, and they are often the first thing a user clicks:
- Some distributor detail URLs stop resolving without their query token, and manufacturer slugs in URLs get renamed.
- Distributor page ids are stable, but they are easily mistaken for orderable part numbers.

If UHD ever stores supplier links: (1) prefer canonical product URLs returned by a distributor's API over scraped or hand-built ones; (2) also store a search-fallback URL per row (a search for the manufacturer part number), which does not go stale; (3) a tool that refreshes prices should also check stored links and flag dead ones instead of showing an error page.
