// Curated "popular picks" shown at the top of category pages. Each pick is a
// case-insensitive regex tested against product titles (Bull Moose and Zia
// titles look like "Artist/Album@Format"). build-category-featured.mjs picks
// the best in-stock match for each one. Edit these lists to change the picks.
export const PICKS = {
  music: [
    '^fleetwood mac/rumours( \\(|$|@)', '^miles davis/kind of blue', '^radiohead/ok computer(@|$)', '^pink floyd/(the )?dark side of the moon( \\(50th|$|@)',
    '^the beatles/abbey road', '^taylor swift/folklore', '^kendrick lamar/to pimp a butterfly', '^nirvana/nevermind(@|$)',
    '^lauryn hill/miseducation of lauryn hill', '^prince/purple rain \\(2015', '^michael jackson/thriller(@|$| \\(40th)', '^bob marley & the wailers/legend',
    '^amy winehouse/back to black', '^stevie wonder/songs in the key of life', "^marvin gaye/what's going on", '^joni mitchell/blue(@|$)',
    '^daft punk/random access memories', "^sabrina carpenter/short n' sweet", '^wu-tang clan/enter the wu-tang \\(36 chambers\\)?@', '^rage against the machine/rage against the machine',
    '^beyonce/lemonade', '^david bowie/rise & fall of ziggy stardust', '^outkast/aquemini', '^phoebe bridgers/punisher(@|$)',
    '^johnny cash/at folsom prison', '^john coltrane/a love supreme \\(', '^arctic monkeys/am(@|$)', '^sza/sos@',
  ],
  'movies-tv': [
    '^spirited away/studio ghibli', '^princess mononoke/studio ghibli', '^my neighbor totoro/studio ghibli', '^big lebowski/',
    '^lord of the rings/trilogy', '^star wars/complete saga', '^mandalorian/season 1', '^twin peaks: fire walk with me/criterion',
    '^breaking bad/the complete series', '^seinfeld/the complete series@dvd', '^fargo/mcdormand', '^ghostbusters \\(1984\\)',
    '^dune/maclachlan', '^arrival/', '^get out/', '^blade runner: the final cut',
    '^godfather part 2/', '^beau travail/criterion', '^what about bob\\?/', '^goodfellas/departed',
  ],
  books: [
    '^dune$', "^douglas adams/the hitchhiker's guide to the galaxy 25th", '^andy weir/project hail mary', '^rebecca yarros/fourth wing$',
    '^gabrielle zevin/tomorrow, and tomorrow, and tomorrow', '^barbara kingsolver/demon copperhead', '^percival everett/james$', '^braiding sweetgrass',
    '^yuval noah harari/sapiens', '^tara westover/educated', '^delia owens/where the crawdads sing$', '^kazuo ishiguro/klara and the sun@',
    '^octavia butler/parable of the sower', '^the dispossessed', "^howard zinn/a people's history of the united states", '^the communist manifesto$',
    '^mutual aid: a guide to helping one another', '^vincent bevins/the jakarta method', '^capitalist realism', '^how to blow up a pipeline',
    '^bullshit jobs', '^pierce brown/red rising \\(deluxe', '^frank herbert/dune saga 3-book', '^adrian tchaikovsky/children of ruin',
  ],
  // One flagship coffee or tea per co-op.
  'coffee-tea': [
    '^righteous$', '^stampede$', "^birdwatcher's blend", "^founder's roast", '^fair harvest blend',
    '^arm in arm', '^totality', '^organic bali blue moon', '^organic assam black tea', '^cardigan \\| cold weather blend', '^electric monkey espresso',
    '^organic vanilla chai tea', '^organic extreme earl grey', '^rishi lavender mint', '^about coffee - leftist',
  ],
  'food-pantry': [
    '^creamy organic peanut butter', '^dill pickles$', '^award-winning butter', '^chocolate love$', '^all beef hot dogs', '^everything bagels',
    '^cacao fruit chocolate bar', "^dark chocolate lover's gift box", '^sauerkraut$', '^saf red instant yeast', '^vermont maple cream', '^pasture raised chicken broth',
    '^frontier co-op adobo seasoning', '^red pepper hot sauce', '^butter pecan$', '^gluten-free pancake mix',
  ],
  games: [
    '^nintendo switch/mario kart 8 deluxe', '^nintendo switch/the legend of zelda: tears of the kingdom', '^nintendo switch/super mario bros\\.? wonder', '^nintendo switch/animal crossing',
    '^nintendo switch 2/mario kart world', '^nintendo switch 2/donkey kong bananza', '^nintendo switch/pikmin 4', '^nintendo switch/super smash bros',
    '^ps5/astro bot', '^ps5/elden ring', '^nintendo switch/pokemon (scarlet|violet|legends)', '^ps5/marvel.s spider-man 2',
    '^(asmodee )?catan( the game|$| - base game)', 'ticket to ride', 'wingspan', 'codenames', '^class war: the jacobin', 'pandemic',
  ],
}

// Titles that match a pick but aren't the thing (stationery, tributes,
// made-to-order discs, foreign-region imports).
export const EXCLUDE = /made on demand|import|sticky note|masking tape|tribute|lullaby|large print|workbook|telugu|proyecto|sacd/i
