# Reply to Mark Hand - purposeowned questions

**To:** mark.c.hand@gmail.com
**Subject:** Re: purpose-owned shop page

---

Hey Mark,

Thanks, glad to hear it! And "cool as shit" is a great review from the Skoll Centre.

Got the CSV -- 83 trust-owned businesses, 78 of which were new to the site. They're integrated now, all showing up in the directory with a "Steward-Owned" tag. Five of them (Biohabitats, Craftsman Technology Group, Heath Ceramics, Natural Investments, GeoShip) were already in the directory as B Corps, so those now show both types.

I also scraped products from the five trust companies that had Shopify stores: Berrett-Koehler (2,991 books), Heath Ceramics (2,413 products), Home Again Wilmington (943), HMS Motorsport (735), and Hummingbird Wholesale (262). So we went from 63,000 to 76,000 products on the site.

The Harvard Dataverse link is also useful as a canonical source I can check back on periodically.

On L3Cs and democratically managed, no rush. We can add those categories when the data is ready.

Your questions:

**1. Companies in two categories:** 132 companies show up in multiple types (e.g., both B Corp and Benefit Corp). Each company just carries all its designations, and you can filter by type in the search sidebar. So King Arthur shows as both B Corp + Benefit Corp, Biohabitats now shows as B Corp + Steward-Owned, etc. No deduplication needed -- they just stack.

**2. Purse & Clutch not showing up:** This is exactly the kind of bug-finding that's most useful right now. They were in the directory (5,000+ companies listed), but our automated scraper classified their site as not having ecommerce, so we never pulled their products. The search only looks through scraped products, not the full company list. I fixed the detection and scraped their store -- 215 products now showing up. Searching "purse" works now. It's a little like whack-a-mole with 5,000 companies, so don't hesitate to send stuff like this even if it seems small. Every one of those is a real fix.

**3. What to call it:** I think this is the most interesting question. "Purpose Owned" is aspirational and memorable, but you're right that B Corps specifically are committed, not owned. A few options:

- **Purpose Owned** -- clean, aspirational, pairs well with workerowned.info
- **Purpose Driven** -- more accurate but very generic (Rick Warren, etc.)
- **Purpose Committed** -- accurate but clunky

I lean toward keeping "Purpose Owned" because it's the strongest brand name and the "owned" framing creates a clear parallel with worker-owned. The FAQ can explain the nuance. But open to whatever you think works best, especially since you'll be writing about it.

**4. Companies on BOTH sites ("common purpose" companies):** Found 10 overlaps:

- **King Arthur Baking Company** -- B Corp + Benefit Corp (ESOP on workerowned)
- **Cabot Creamery** -- B Corp + Benefit Corp (farmer co-op)
- **Libro.fm** -- B Corp + Benefit Corp (worker co-op)
- **Just Coffee Cooperative** -- B Corp (worker co-op)
- **Dean's Beans Organic Coffee** -- B Corp (worker co-op)
- **Thread Coffee Roasters** -- B Corp (worker co-op)
- **Meow Meow Tweet** -- B Corp (worker co-op)
- **Divine Chocolate** -- B Corp (farmer co-op)
- **Cafe Campesino** -- B Corp (worker co-op)
- **The Colorado Sun** -- Benefit Corp (journalist co-op)

Coffee roasters are heavily represented. Could be a fun Stakehold angle: "the companies that checked every box."

Excited about the November 13 launch. Let me know if there's anything I should build toward for that timeline.

Will
