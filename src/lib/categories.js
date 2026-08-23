export const SECTIONS = [
  { slug: 'coffee-tea',       label: 'Coffee & Tea',          sectionName: 'Coffee & Tea',          title: 'Worker Owned Coffee & Tea Online | Worker Owned Marketplace',                          description: 'Shop worker owned coffee roasters and tea brands online. Cooperatively owned coffee roasted and shipped direct to your door.',              image: 'https://cdn.shopify.com/s/files/1/0262/2413/files/StampedeFairTradeOrganicCoffee.png' },
  { slug: 'media-publishing', label: 'Media & Publishing',    sectionName: 'Media & Publishing',    title: 'Worker Owned Media, News & Publishers Online | Worker Owned Marketplace',              description: 'Read and support worker owned journalism, newsletters, podcasts, and book publishers. Independent media owned by the people who make it.',  image: 'https://cdn.shopify.com/s/files/1/0569/3869/2669/files/getimage_d5cc5bf7-652d-4f27-9f0a-6600b7443adb.jpg' },
  { slug: 'food-pantry',      label: 'Food & Pantry',         sectionName: 'Food & Pantry',         title: 'Worker Owned Food & Pantry Online | Worker Owned Marketplace',                         description: 'Shop worker owned food brands online. Cooperatively owned nut butters, pickles, chocolate, olive oil, and pantry staples.',                image: 'https://cdn.shopify.com/s/files/1/0251/4242/7745/files/once-again-protein-sunflower-butter-packets-10-count-1250973263.jpg' },
  { slug: 'apparel',          label: 'Apparel',               sectionName: 'Apparel',               title: 'Worker Owned Clothing & Apparel Online | Worker Owned Marketplace',                    description: 'Shop worker owned clothing and apparel brands online. Cooperatively owned, USA-made, fair labor fashion.',                                 image: 'https://cdn.shopify.com/s/files/1/0277/0239/4940/files/Sauron_2x-8.png' },
  { slug: 'art-prints',       label: 'Art & Prints',          sectionName: 'Art & Prints',          title: 'Worker Owned Art Prints & Posters Online | Worker Owned Marketplace',                  description: 'Buy art prints and posters from worker owned artist cooperatives. Political, social movement, and activist art ships worldwide.' },
  { slug: 'books',            label: 'Books',                 sectionName: 'Books',                 title: 'Worker Owned Books & Publishers Online | Worker Owned Marketplace',                    description: 'Shop books from worker owned publishers and cooperatives. Fiction, nonfiction, graphic novels, and more from independent presses.' },
  { slug: 'movies-tv',        label: 'Movies & TV',           sectionName: 'Movies & TV',           title: 'Worker Owned Movies & TV Online | Worker Owned Marketplace',                          description: 'Shop DVDs, Blu-rays, and 4K UHD from worker and employee owned companies. Movies, TV series, documentaries, anime, and more.' },
  { slug: 'music',            label: 'Music',                 sectionName: 'Music',                 title: 'Worker Owned Music Platforms | Worker Owned Marketplace',                              description: 'Stream and buy music on cooperatively owned platforms. Worker owned Bandcamp alternatives where artists keep more.' },
  { slug: 'home-goods',       label: 'Home Goods & Services', sectionName: 'Home Goods & Services', title: 'Worker Owned Home Goods & Services | Worker Owned Marketplace',                        description: 'Shop worker owned home goods and services. Cooperatively made ceramics, textiles, candles, and worker owned home services.',               image: 'https://cdn.shopify.com/s/files/1/0762/3806/1868/files/Wncgwdg3K3.jpg' },
  { slug: 'personal-care',    label: 'Personal Care',         sectionName: 'Personal Care',         title: 'Worker Owned Soap & Personal Care Online | Worker Owned Marketplace',                  description: 'Shop worker owned soaps and personal care products online. Cooperatively made with natural ingredients.',                                  image: 'https://cdn.shopify.com/s/files/1/0579/2369/8848/files/IMG_2523_2.jpg' },
  { slug: 'games',            label: 'Games',                 sectionName: 'Games',                 title: 'Worker Owned Games & Video Games Online | Worker Owned Marketplace',                   description: 'Shop video games, board games, and trading cards from worker owned companies. PS5, Switch, Xbox, and tabletop games.',                     image: 'https://cdn.shopify.com/s/files/1/0465/1991/0550/files/4055FF5688575AF11091603CAB995EBF_1.jpg' },
  { slug: 'beer-brewing',     label: 'Beer & Brewing',        sectionName: 'Beer & Brewing',        title: 'Worker Owned Breweries & Craft Beer | Worker Owned Marketplace',                       description: 'Find worker owned and cooperatively owned breweries. Craft beer made by and for the workers who brew it.',                                 image: 'https://cdn.shopify.com/s/files/1/0696/0712/9224/files/Spigleau_SQ.png' },
  { slug: 'tech-software',    label: 'Tech & Software',       sectionName: 'Tech & Software',       title: 'Worker Owned Tech & Software | Worker Owned Marketplace',                             description: 'Worker owned technology companies, software co-ops, and platform cooperatives. Tech built by the people who make it.' },
  { slug: 'sporting-goods',   label: 'Sporting Goods',        sectionName: 'Sporting Goods & Outdoors', title: 'Worker Owned Sporting Goods & Outdoors | Worker Owned Marketplace',               description: 'Shop sporting goods and outdoor gear from worker and employee owned companies. Bikes, cycling components, and outdoor equipment.' },
]

export const SECTION_SLUGS = Object.fromEntries(
  SECTIONS.map(s => [s.sectionName, s.slug])
)

export const SECTION_NAMES = Object.fromEntries(
  SECTIONS.map(s => [s.slug, s.sectionName])
)

export const SUBCATEGORIES = {
  music: [
    { slug: 'vinyl', label: 'Vinyl Records', keywords: ['vinyl lp', 'vinyl 7"', 'vinyl 12"', 'vinyl 10"', 'vinyl 3"', 'record'] },
    { slug: 'cds', label: 'CDs', keywords: ['audio cd', 'cd'] },
    { slug: 'cassettes', label: 'Cassettes', keywords: ['audio cassette', 'cassette', 'tape'] },
  ],
  apparel: [
    { slug: 'shoes', label: 'Shoes & Footwear', keywords: ['shoe', 'boot', 'sandal', 'sneaker', 'clog', 'slipper', 'slide', 'mule', 'loafer', 'flat ', 'heel', 'wedge'] },
    { slug: 'shirts', label: 'Shirts & Tops', keywords: ['shirt', 't-shirt', 'tee ', 'top', 'blouse', 'tank ', 'tank top', 'polo', 'henley', 'camisole'] },
    { slug: 'pants', label: 'Pants & Bottoms', keywords: ['pant', 'jean', 'short', 'skirt', 'bottom', 'legging'] },
    { slug: 'accessories', label: 'Hats & Accessories', keywords: ['hat ', 'beanie', 'cap ', 'scarf', 'glove', 'belt', 'sock', 'bag', 'backpack', 'wallet', 'pouch', 'purse', 'crossbody', 'tote', 'wristlet'] },
    { slug: 'outerwear', label: 'Jackets & Outerwear', keywords: ['jacket', 'coat', 'hoodie', 'vest', 'pullover', 'sweater', 'fleece', 'parka', 'cardigan', 'shacket'] },
  ],
  'home-goods': [
    { slug: 'jewelry', label: 'Jewelry', keywords: ['jewelry', 'earring', 'necklace', 'bracelet', 'ring', 'pendant', 'body jewelry'] },
    { slug: 'art', label: 'Art & Prints', keywords: ['art', 'print', 'poster', 'painting', 'wall art', 'canvas', 'illustration'] },
    { slug: 'woodworking', label: 'Woodworking', keywords: ['wood', 'cutting board', 'furniture', 'shelf', 'table', 'chair'] },
    { slug: 'ceramics', label: 'Ceramics & Pottery', keywords: ['ceramic', 'pottery', 'mug', 'bowl', 'plate', 'vase'] },
    { slug: 'decor', label: 'Candles & Decor', keywords: ['candle', 'decor', 'lamp', 'pillow', 'blanket'] },
    { slug: 'paper', label: 'Paper Goods', keywords: ['paper', 'card', 'stationery', 'notebook', 'sticker'] },
  ],
  'food-pantry': [
    { slug: 'seeds', label: 'Seeds & Garden', keywords: ['seed', 'garden', 'plant', 'flower', 'herb', 'vegetable'] },
    { slug: 'cheese', label: 'Cheese & Dairy', keywords: ['cheese', 'butter', 'dairy', 'yogurt', 'cream'] },
    { slug: 'meat', label: 'Meat & Butcher', keywords: ['beef', 'chicken', 'pork', 'meat', 'sausage', 'bacon', 'steak', 'butcher'] },
    { slug: 'chocolate', label: 'Chocolate & Sweets', keywords: ['chocolate', 'candy', 'sweet', 'cocoa', 'truffle', 'toffee', 'fudge', 'caramel'] },
    { slug: 'pantry', label: 'Pantry Staples', keywords: ['olive oil', 'nut butter', 'jam', 'honey', 'spice', 'seasoning', 'sauce', 'vinegar', 'flour', 'grain', 'seaweed', 'kelp'] },
  ],
  'personal-care': [
    { slug: 'skin-care', label: 'Skin Care', keywords: ['lotion', 'moisturizer', 'cream', 'sunscreen', 'face wash', 'cleanser', 'serum', 'body butter', 'body wash', 'exfoliat', 'toner', 'skin'] },
    { slug: 'hair-care', label: 'Hair Care', keywords: ['shampoo', 'conditioner', 'hair', 'styling'] },
    { slug: 'soap', label: 'Soap & Bath', keywords: ['soap', 'bar soap', 'bath', 'body bar', 'hand wash', 'bubble'] },
    { slug: 'deodorant', label: 'Deodorant', keywords: ['deodorant', 'antiperspirant'] },
    { slug: 'vitamins', label: 'Vitamins & Supplements', keywords: ['vitamin', 'supplement', 'mineral', 'probiotic', 'calcium', 'magnesium', 'iron ', 'zinc ', 'omega', 'fish oil', 'multivitamin', 'gummies'] },
    { slug: 'medicine', label: 'Medicine & First Aid', keywords: ['medicine', 'tylenol', 'advil', 'ibuprofen', 'acetaminophen', 'allergy', 'cold ', 'cough', 'bandage', 'first aid', 'thermometer', 'antibiotic', 'pain relief', 'aspirin'] },
  ],
  'coffee-tea': [
    { slug: 'coffee', label: 'Coffee', keywords: ['coffee', 'espresso', 'roast', 'blend', 'decaf', 'ground', 'whole bean'] },
    { slug: 'tea', label: 'Tea', keywords: ['tea', 'herbal', 'chai', 'matcha', 'rooibos', 'green tea', 'black tea'] },
    { slug: 'chocolate', label: 'Chocolate & Cocoa', keywords: ['chocolate', 'cocoa', 'cacao', 'hot chocolate'] },
  ],
  'games': [
    { slug: 'ps5', label: 'PlayStation 5', keywords: ['playstation 5 game'] },
    { slug: 'ps4', label: 'PlayStation 4', keywords: ['playstation 4 game'] },
    { slug: 'switch', label: 'Nintendo Switch', keywords: ['nintendo switch game', 'nintendo switch 2'] },
    { slug: 'xbox', label: 'Xbox Series', keywords: ['xbox series x game'] },
    { slug: 'retro-playstation', label: 'Retro PlayStation', keywords: ['playstation 3', 'playstation 2', 'playstation 1', 'playstation portable', 'playstation vita'] },
    { slug: 'retro-nintendo', label: 'Retro Nintendo', keywords: ['nintendo wii', 'nintendo ds', 'nintendo 3ds', 'gamecube', 'game boy advance', 'nintendo 64', 'snes', 'nes ', 'game boy'] },
    { slug: 'retro-xbox', label: 'Retro Xbox', keywords: ['xbox 360', 'xbox one', 'xbox accessories'] },
    { slug: 'retro-sega', label: 'Retro Sega', keywords: ['sega', 'dreamcast', 'genesis', 'saturn', 'gamegear'] },
    { slug: 'trading-cards', label: 'Trading Cards', keywords: ['trading cards', 'tcg', 'mtg', 'card game', 'booster', 'yugioh', 'lorcana', 'digimon', 'pokemon'] },
    { slug: 'board-games', label: 'Board Games', keywords: ['board game', 'dice', 'strategy', 'party game', 'family game', 'munchkin'] },
    { slug: 'puzzles', label: 'Puzzles', keywords: ['puzzle', 'jigsaw'] },
    { slug: 'toys', label: 'Toys & Kids', keywords: ['toy', 'plush', 'stuffed', 'figure', 'doll', 'kid', 'children', 'building'] },
  ],
  'sporting-goods': [
    { slug: 'bikes', label: 'Bikes & Cycling', keywords: ['bike', 'bicycle', 'cycling', 'cycle', 'pedal', 'handlebar', 'headset', 'crankset', 'derailleur', 'chainring', 'seatpost', 'bottom bracket'] },
    { slug: 'shoes', label: 'Shoes & Footwear', keywords: ['shoe', 'boot', 'sandal', 'sneaker', 'cleat', 'hiking boot', 'trail runner', 'wading boot'] },
    { slug: 'shirts', label: 'Shirts & Tops', keywords: ['shirt', 't-shirt', 'tee ', 'jersey', 'tank ', 'polo', 'base layer', 'athletic top'] },
    { slug: 'outerwear', label: 'Jackets & Outerwear', keywords: ['jacket', 'coat', 'hoodie', 'vest', 'pullover', 'fleece', 'parka', 'windbreaker', 'rain jacket'] },
    { slug: 'camping', label: 'Camping & Outdoors', keywords: ['tent', 'sleeping bag', 'camp', 'backpack', 'hiking', 'trail', 'cooler', 'lantern', 'compass', 'knife', 'hammock'] },
    { slug: 'fishing', label: 'Fishing & Hunting', keywords: ['fishing', 'rod', 'reel', 'lure', 'tackle', 'hunting', 'ammo', 'scope', 'decoy'] },
    { slug: 'fitness', label: 'Fitness & Training', keywords: ['fitness', 'weight', 'dumbbell', 'kettlebell', 'resistance', 'yoga', 'exercise', 'training', 'gym'] },
  ],
  'books': [
    { slug: 'fiction', label: 'Fiction', keywords: ['subject-fiction', 'novel', 'fiction', 'romance', 'fantasy', 'sci-fi', 'mystery', 'thriller', 'horror', 'historical-fiction', 'poetry'] },
    { slug: 'nonfiction', label: 'Nonfiction', keywords: ['subject-history', 'subject-philosophy', 'subject-political', 'subject-economics', 'subject-anthropology', 'subject-biography', 'nonfiction', 'self-help', 'true-crime', 'science', 'cookbooks', 'health', 'nature'] },
    { slug: 'graphic-novels', label: 'Graphic Novels', keywords: ['graphic novel', 'comic'] },
    { slug: 'manga', label: 'Manga', keywords: ['manga'] },
    { slug: 'childrens', label: "Children's", keywords: ['children', 'kids', 'picture book'] },
    { slug: 'young-adult', label: 'Young Adult', keywords: ['young adult', 'ya '] },
  ],
  'movies-tv': [
    { slug: 'dvd', label: 'DVD', keywords: ['dvd'] },
    { slug: 'blu-ray', label: 'Blu-ray', keywords: ['blu-ray'] },
    { slug: '4k', label: '4K UHD', keywords: ['4k ultra hd', '4k uhd'] },
    { slug: 'anime', label: 'Anime', keywords: ['anime'] },
    { slug: 'horror', label: 'Horror', keywords: ['horror'] },
    { slug: 'comedy', label: 'Comedy', keywords: ['comedy'] },
    { slug: 'documentary', label: 'Documentary', keywords: ['documentary'] },
    { slug: 'tv-series', label: 'TV Series', keywords: ['television', 'season', 'complete series'] },
  ],
  'media-publishing': [
    { slug: 'news-journalism', label: 'News & Journalism', keywords: ['news-subscription'] },
    { slug: 'maps-prints', label: 'Maps & Prints', keywords: ['map', 'poster', 'print', 'wall map', 'sticker', 'patch', 'button'] },
  ],
}

// Format/tag filters that appear as a secondary filter row on category pages.
// These work independently from subcategories — users can combine them.
export const FILTERS = {
  music: [
    { label: 'Vinyl', tag: 'vinyl lp' },
    { label: 'CD', tag: 'audio cd' },
    { label: 'Cassette', tag: 'audio cassette' },
  ],
  books: [
    { label: 'Paperback', tag: 'book - paperback' },
    { label: 'Hardcover', tag: 'book - hardcover' },
  ],
  'movies-tv': [
    { label: 'DVD', tag: 'dvd' },
    { label: 'Blu-ray', tag: 'blu-ray' },
    { label: '4K UHD', tag: '4k ultra hd' },
  ],
  games: [
    { label: 'PS5', tag: 'playstation 5 game' },
    { label: 'PS4', tag: 'playstation 4 game' },
    { label: 'Switch', tag: 'nintendo switch game' },
    { label: 'Xbox Series', tag: 'xbox series x game' },
  ],
}
