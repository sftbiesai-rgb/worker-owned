# Reply to Mark Hand - purposeowned questions (SENT 2026-09-25)

**To:** mark.c.hand@gmail.com
**Subject:** Re: purpose-owned shop page

---

Hey Mark,

Thanks, glad to hear folks are psyched on it. Like I said, I lean heavily on Claude. I'm always curious how that lands because I think the folks who would be supportive of this kind of project also tend to be skeptical of AI (for good reasons). I like to SHOW our side can and should use these tools for our goals. And that can tip the balance at least little. It IS crazy that it is now possible two non-coders with couch money can put together something that can plausibly compete against a VC-backed profit monster.

Anyway, got the CSV, 83 trust-owned businesses, 78 of which were new to the site. They're integrated now, all showing up in the directory with a "Steward-Owned" tag. Five of them (Biohabitats, Craftsman Technology Group, Heath Ceramics, Natural Investments, GeoShip) were already in the directory as B Corps or Benefit Corps, so those now show both types.

I also scraped products from the five trust companies that had Shopify stores: Berrett-Koehler (2,991 books), Heath Ceramics (2,413 products), Home Again Wilmington (943), HMS Motorsport (735), and Hummingbird Wholesale (262). So we went from 63,000 to 76,000 products on the site.

The Harvard Dataverse link is also useful as a canonical source I can check back on periodically.

On L3Cs and democratically managed, no rush. We can add those categories when the data is ready.

Your questions:

1. Companies in two categories: 141 companies show up in multiple types (e.g., both B Corp and Benefit Corp). Each company just carries all its designations, and you can filter by type in the search sidebar. So King Arthur shows as both B Corp + Benefit Corp, Biohabitats now shows as B Corp + Steward-Owned, etc. No deduplication needed -- they just stack.

2. Purse & Clutch not showing up: Fixed. They were in the directory (5,000+ companies listed), but our automated scraper classified their site as not having ecommerce, so we never pulled their products. The search only looks through scraped products, not the full company list. I fixed the detection and scraped their store -- 215 products now showing up. Searching "purse" works now.

This is honestly the most useful thing we can do right now: just use the site, search for stuff, and log every weird result or missing company. It's whack-a-mole with 5,000 companies but I honestly don't know of a better way to get at the last bits. Even stuff that seems small ("this brand didn't show up," "this result looks wrong") is a real fix every time and I just feed it into Claude and it whirrs.

3. What to call it: I love naming things, heh. The name I keep coming back to is "Good Company." But most of the good real estate is taken
  - goodcompany.org/.co/.shop/.store -- all taken
  - goodco.info -- available, short, pairs with workerowned.info
  - goodcompany.market -- available, marketplace angle
  - goodcompanies.info -- available, literal
  - goodcompany.info -- taken (parked Dutch page, possibly purchasable)

I dunno, we have time, we'll think of something catchy. I also like leaning into the idea that the site means ppl can buy stuff without feeling bad about it, but feel-less-lame-buying-stuff-like-running-shoes.info prolly isn't a winner.

4. Companies on BOTH sites ("common purpose" companies): Found 10 overlaps so far:

- King Arthur Baking Company -- B Corp + Benefit Corp (ESOP on workerowned)
- Cabot Creamery -- B Corp + Benefit Corp (farmer co-op)
- Libro.fm -- B Corp + Benefit Corp (worker co-op)
- Just Coffee Cooperative -- B Corp (worker co-op)
- Dean's Beans Organic Coffee -- B Corp (worker co-op)
- Thread Coffee Roasters -- B Corp (worker co-op)
- Meow Meow Tweet -- B Corp (worker co-op)
- Divine Chocolate -- B Corp (farmer co-op)
- Cafe Campesino -- B Corp (worker co-op)
- The Colorado Sun -- Benefit Corp (journalist co-op)
