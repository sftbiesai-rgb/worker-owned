export const SECTIONS = [
  { slug: 'food-pantry',          label: 'Food & Pantry',          sectionName: 'Food & Pantry',          title: 'Worker Owned Food, Coffee & Pantry Online | Worker Owned Marketplace',                      description: 'Shop worker owned food, coffee, tea, and pantry staples online. Cooperatively roasted coffee, fair trade chocolate, nut butters, and more shipped to your door.',  image: 'https://cdn.shopify.com/s/files/1/0262/2413/files/StampedeFairTradeOrganicCoffee.png' },
  { slug: 'clothing-shoes',       label: 'Clothing & Shoes',       sectionName: 'Clothing & Shoes',       title: 'Worker Owned Clothing & Shoes Online | Worker Owned Marketplace',                           description: 'Shop worker owned clothing and shoes online. Cooperatively made, USA-made, fair labor fashion, footwear, and accessories.',                                             image: 'https://cdn.shopify.com/s/files/1/0277/0239/4940/files/Sauron_2x-8.png' },
  { slug: 'jewelry',              label: 'Jewelry',                sectionName: 'Jewelry',                title: 'Worker Owned Jewelry Online | Worker Owned Marketplace',                                    description: 'Shop handmade jewelry from worker owned cooperatives. Earrings, necklaces, bracelets, rings, and pendants made by artisan co-ops.' },
  { slug: 'beauty-personal-care', label: 'Beauty & Personal Care', sectionName: 'Beauty & Personal Care', title: 'Worker Owned Beauty & Personal Care Online | Worker Owned Marketplace',                      description: 'Shop worker owned soaps, skincare, and personal care products online. Cooperatively made with natural ingredients.',                                                  image: 'https://cdn.shopify.com/s/files/1/0579/2369/8848/files/IMG_2523_2.jpg' },
  { slug: 'home-kitchen',         label: 'Home & Kitchen',         sectionName: 'Home & Kitchen',         title: 'Worker Owned Home & Kitchen Goods Online | Worker Owned Marketplace',                       description: 'Shop worker owned home and kitchen goods online. Cooperatively made ceramics, candles, decor, art prints, and paper goods.',                                          image: 'https://cdn.shopify.com/s/files/1/0762/3806/1868/files/Wncgwdg3K3.jpg' },
  { slug: 'furniture',            label: 'Furniture',              sectionName: 'Furniture',              title: 'Worker Owned Furniture Online | Worker Owned Marketplace',                                  description: 'Shop worker owned furniture online. Cooperatively crafted tables, chairs, shelving, and custom pieces made by worker co-ops.' },
  { slug: 'textiles-rugs',        label: 'Textiles & Rugs',        sectionName: 'Textiles & Rugs',        title: 'Worker Owned Textiles & Rugs Online | Worker Owned Marketplace',                            description: 'Shop worker owned textiles and rugs online. Cooperatively woven blankets, towels, yarn, and handmade rugs from artisan co-ops.' },
  { slug: 'sports-outdoors',      label: 'Sports & Outdoors',      sectionName: 'Sports & Outdoors',      title: 'Worker Owned Sports & Outdoors Online | Worker Owned Marketplace',                          description: 'Shop sporting goods and outdoor gear from worker and employee owned companies. Bikes, cycling components, and outdoor equipment.' },
  { slug: 'books',                label: 'Books',                  sectionName: 'Books',                  title: 'Worker Owned Books & Publishers Online | Worker Owned Marketplace',                         description: 'Shop books from worker owned publishers, bookstores, and cooperatives. Fiction, nonfiction, graphic novels, and independent media.' },
  { slug: 'entertainment',        label: 'Music, Movies & Games',  sectionName: 'Music, Movies & Games',  title: 'Worker Owned Music, Movies & Games Online | Worker Owned Marketplace',                      description: 'Shop music, movies, and games from worker and employee owned companies. Vinyl, CDs, DVDs, Blu-rays, video games, board games, and more.',                            image: 'https://cdn.shopify.com/s/files/1/0465/1991/0550/files/4055FF5688575AF11091603CAB995EBF_1.jpg' },
]

export const SECTION_SLUGS = Object.fromEntries(
  SECTIONS.map(s => [s.sectionName, s.slug])
)

export const SECTION_NAMES = Object.fromEntries(
  SECTIONS.map(s => [s.slug, s.sectionName])
)

export const SUBCATEGORIES = {
  'food-pantry': [
    { slug: 'coffee', label: 'Coffee', keywords: ['coffee', 'espresso', 'roast', 'blend', 'decaf', 'ground', 'whole bean'] },
    { slug: 'tea', label: 'Tea', keywords: ['tea', 'herbal', 'chai', 'matcha', 'rooibos', 'green tea', 'black tea'] },
    { slug: 'chocolate', label: 'Chocolate & Sweets', keywords: ['chocolate', 'candy', 'sweet', 'cocoa', 'cacao', 'truffle', 'toffee', 'fudge', 'caramel', 'hot chocolate'] },
    { slug: 'pantry', label: 'Pantry Staples', keywords: ['olive oil', 'nut butter', 'jam', 'honey', 'spice', 'seasoning', 'sauce', 'vinegar', 'flour', 'grain', 'seaweed', 'kelp'] },
    { slug: 'cheese', label: 'Cheese & Dairy', keywords: ['cheese', 'butter', 'dairy', 'yogurt', 'cream'] },
    { slug: 'meat', label: 'Meat & Butcher', keywords: ['beef', 'chicken', 'pork', 'meat', 'sausage', 'bacon', 'steak', 'butcher'] },
    { slug: 'seeds', label: 'Seeds & Garden', keywords: ['seed', 'garden', 'plant', 'flower', 'herb', 'vegetable'] },
    { slug: 'beer', label: 'Beer & Brewing', keywords: ['beer', 'brew', 'ale', 'ipa', 'stout', 'lager', 'porter', 'pilsner', 'sour', 'hazy'] },
  ],
  'clothing-shoes': [
    { slug: 'shoes', label: 'Shoes & Footwear', keywords: ['shoe', 'boot', 'sandal', 'sneaker', 'clog', 'slipper', 'slide', 'mule', 'loafer', 'flat ', 'heel', 'wedge'] },
    { slug: 'shirts', label: 'Shirts & Tops', keywords: ['shirt', 't-shirt', 'tee ', 'top', 'blouse', 'tank ', 'tank top', 'polo', 'henley', 'camisole'] },
    { slug: 'pants', label: 'Pants & Bottoms', keywords: ['pant', 'jean', 'short', 'skirt', 'bottom', 'legging'] },
    { slug: 'accessories', label: 'Hats & Accessories', keywords: ['hat ', 'beanie', 'cap ', 'scarf', 'glove', 'belt', 'sock', 'bag', 'backpack', 'wallet', 'pouch', 'purse', 'crossbody', 'tote', 'wristlet'] },
    { slug: 'outerwear', label: 'Jackets & Outerwear', keywords: ['jacket', 'coat', 'hoodie', 'vest', 'pullover', 'sweater', 'fleece', 'parka', 'cardigan', 'shacket'] },
  ],
  jewelry: [
    { slug: 'earrings', label: 'Earrings', keywords: ['earring'] },
    { slug: 'necklaces', label: 'Necklaces', keywords: ['necklace', 'pendant', 'chain'] },
    { slug: 'bracelets', label: 'Bracelets', keywords: ['bracelet', 'bangle', 'cuff'] },
    { slug: 'rings', label: 'Rings', keywords: ['ring'] },
    { slug: 'body-jewelry', label: 'Body Jewelry', keywords: ['body jewelry', 'piercing'] },
  ],
  'beauty-personal-care': [
    { slug: 'skin-care', label: 'Skin Care', keywords: ['lotion', 'moisturizer', 'cream', 'sunscreen', 'face wash', 'cleanser', 'serum', 'body butter', 'body wash', 'exfoliat', 'toner', 'skin'] },
    { slug: 'hair-care', label: 'Hair Care', keywords: ['shampoo', 'conditioner', 'hair', 'styling'] },
    { slug: 'soap', label: 'Soap & Bath', keywords: ['soap', 'bar soap', 'bath', 'body bar', 'hand wash', 'bubble'] },
    { slug: 'deodorant', label: 'Deodorant', keywords: ['deodorant', 'antiperspirant'] },
    { slug: 'vitamins', label: 'Vitamins & Supplements', keywords: ['vitamin', 'supplement', 'mineral', 'probiotic', 'calcium', 'magnesium', 'iron ', 'zinc ', 'omega', 'fish oil', 'multivitamin', 'gummies'] },
    { slug: 'medicine', label: 'Medicine & First Aid', keywords: ['medicine', 'tylenol', 'advil', 'ibuprofen', 'acetaminophen', 'allergy', 'cold ', 'cough', 'bandage', 'first aid', 'thermometer', 'antibiotic', 'pain relief', 'aspirin'] },
  ],
  'home-kitchen': [
    { slug: 'ceramics', label: 'Ceramics & Pottery', keywords: ['ceramic', 'pottery', 'mug', 'bowl', 'plate', 'vase'] },
    { slug: 'decor', label: 'Candles & Decor', keywords: ['candle', 'decor', 'lamp', 'pillow'] },
    { slug: 'paper', label: 'Paper Goods', keywords: ['paper', 'card', 'stationery', 'notebook', 'sticker'] },
    { slug: 'woodworking', label: 'Woodworking', keywords: ['wood', 'cutting board'] },
    { slug: 'art', label: 'Art & Prints', keywords: ['art', 'print', 'poster', 'painting', 'wall art', 'canvas', 'illustration'] },
  ],
  furniture: [
    { slug: 'tables', label: 'Tables & Desks', keywords: ['table', 'desk', 'dining', 'console', 'nightstand', 'end table', 'side table'] },
    { slug: 'chairs', label: 'Chairs & Seating', keywords: ['chair', 'stool', 'bench', 'sofa', 'couch', 'loveseat', 'ottoman', 'seating'] },
    { slug: 'shelving', label: 'Shelving & Storage', keywords: ['shelf', 'shelving', 'bookcase', 'cabinet', 'dresser', 'storage', 'armoire'] },
    { slug: 'custom', label: 'Custom Pieces', keywords: ['custom', 'bespoke', 'handmade', 'commission'] },
  ],
  'textiles-rugs': [
    { slug: 'blankets', label: 'Blankets & Throws', keywords: ['blanket', 'throw', 'quilt', 'afghan'] },
    { slug: 'towels', label: 'Towels & Linens', keywords: ['towel', 'linen', 'napkin', 'tablecloth'] },
    { slug: 'woven', label: 'Woven Goods', keywords: ['woven', 'weaving', 'handwoven', 'textile'] },
    { slug: 'rugs', label: 'Rugs & Mats', keywords: ['rug', 'mat', 'carpet', 'runner'] },
    { slug: 'yarn', label: 'Yarn & Fiber', keywords: ['yarn', 'fiber', 'wool', 'alpaca', 'mohair', 'cotton'] },
  ],
  'sports-outdoors': [
    { slug: 'bikes', label: 'Bikes & Cycling', keywords: ['bike', 'bicycle', 'cycling', 'cycle', 'pedal', 'handlebar', 'headset', 'crankset', 'derailleur', 'chainring', 'seatpost', 'bottom bracket'] },
    { slug: 'shoes', label: 'Shoes & Footwear', keywords: ['shoe', 'boot', 'sandal', 'sneaker', 'cleat', 'hiking boot', 'trail runner', 'wading boot'] },
    { slug: 'shirts', label: 'Shirts & Tops', keywords: ['shirt', 't-shirt', 'tee ', 'jersey', 'tank ', 'polo', 'base layer', 'athletic top'] },
    { slug: 'outerwear', label: 'Jackets & Outerwear', keywords: ['jacket', 'coat', 'hoodie', 'vest', 'pullover', 'fleece', 'parka', 'windbreaker', 'rain jacket'] },
    { slug: 'camping', label: 'Camping & Outdoors', keywords: ['tent', 'sleeping bag', 'camp', 'backpack', 'hiking', 'trail', 'cooler', 'lantern', 'compass', 'knife', 'hammock'] },
    { slug: 'fishing', label: 'Fishing & Hunting', keywords: ['fishing', 'rod', 'reel', 'lure', 'tackle', 'hunting', 'ammo', 'scope', 'decoy'] },
    { slug: 'fitness', label: 'Fitness & Training', keywords: ['fitness', 'weight', 'dumbbell', 'kettlebell', 'resistance', 'yoga', 'exercise', 'training', 'gym'] },
  ],
  books: [
    { slug: 'fiction', label: 'Fiction', keywords: ['subject-fiction', 'novel', 'fiction', 'romance', 'fantasy', 'sci-fi', 'mystery', 'thriller', 'horror', 'historical-fiction', 'poetry'] },
    { slug: 'nonfiction', label: 'Nonfiction', keywords: ['subject-history', 'subject-philosophy', 'subject-political', 'subject-economics', 'subject-anthropology', 'subject-biography', 'nonfiction', 'self-help', 'true-crime', 'science', 'cookbooks', 'health', 'nature'] },
    { slug: 'graphic-novels', label: 'Graphic Novels', keywords: ['graphic novel', 'comic'] },
    { slug: 'manga', label: 'Manga', keywords: ['manga'] },
    { slug: 'childrens', label: "Children's", keywords: ['children', 'kids', 'picture book'] },
    { slug: 'young-adult', label: 'Young Adult', keywords: ['young adult', 'ya '] },
    { slug: 'news-journalism', label: 'News & Journalism', keywords: ['news-subscription'] },
    { slug: 'maps-prints', label: 'Maps & Prints', keywords: ['map', 'poster', 'print', 'wall map', 'sticker', 'patch', 'button'] },
  ],
  entertainment: [
    { slug: 'vinyl', label: 'Vinyl Records', keywords: ['vinyl lp', 'vinyl 7"', 'vinyl 12"', 'vinyl 10"', 'vinyl 3"', 'record'] },
    { slug: 'cds', label: 'CDs', keywords: ['audio cd', 'cd'] },
    { slug: 'cassettes', label: 'Cassettes', keywords: ['audio cassette', 'cassette', 'tape'] },
    { slug: 'dvd', label: 'DVD', keywords: ['dvd'] },
    { slug: 'blu-ray', label: 'Blu-ray', keywords: ['blu-ray'] },
    { slug: '4k', label: '4K UHD', keywords: ['4k ultra hd', '4k uhd'] },
    { slug: 'anime', label: 'Anime', keywords: ['anime'] },
    { slug: 'tv-series', label: 'TV Series', keywords: ['television', 'season', 'complete series'] },
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
}

// Format/tag filters that appear as a secondary filter row on category pages.
// These work independently from subcategories — users can combine them.
export const FILTERS = {
  entertainment: [
    { label: 'Vinyl', tag: 'vinyl lp' },
    { label: 'CD', tag: 'audio cd' },
    { label: 'Cassette', tag: 'audio cassette' },
    { label: 'DVD', tag: 'dvd' },
    { label: 'Blu-ray', tag: 'blu-ray' },
    { label: '4K UHD', tag: '4k ultra hd' },
    { label: 'PS5', tag: 'playstation 5 game' },
    { label: 'PS4', tag: 'playstation 4 game' },
    { label: 'Switch', tag: 'nintendo switch game' },
    { label: 'Xbox Series', tag: 'xbox series x game' },
  ],
  books: [
    { label: 'Paperback', tag: 'book - paperback' },
    { label: 'Hardcover', tag: 'book - hardcover' },
  ],
}
