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
  'personal-care': [
    '^alaffia authentic african black soap', '^whipped shea butter & coconut oil', '^deodorant stick$', '^vegan lip balm$',
    '^awaida roots 1880 olive', '^extra strength soap drops', '^dr\\. squatch .*bar soap', '^duke cannon .*soap',
    "burt'?s bees .*lip balm", '^cerave .*(cream|lotion)', '^vanicream .*(cream|lotion)', "tom'?s of maine .*toothpaste",
    "dr\\.? bronner", '^aveeno .*lotion', '^everyday shea body wash', '^good soap body wash',
  ],
  'home-goods': [
    '^cutting boards$', '^royal blue classic wool blanket', '^spalted maple wood turned bowl', 'mountain mohair',
    '^the empress$', "^medium gardener'?s supply cart", '^lifetime dandelion weeder', '^yeti rambler 20 oz',
    'lodge .*cast iron skillet', "^zwilling four star 7-inch chef", "^designer'?s choice", 'sunflower .chocolate cherry',
    '^small fork salad set', '^bamboo salt box', '^stainless steel bottle stoppers', 'loose knit scarf',
  ],
  'beer-brewing': [
    '^black butte porter$', '^mirror pond pale ale$', '^fresh squeezed ipa$', '^obsidian stout$', '^jubelale$', '^king crispy pilsner$',
    '^non-alcoholic fresh squeezed ipa$', '^patagonia provisions organic lager$', '^speigelau ipa glass', '^16oz nitro pub glass', '^64oz insulated growler', '^harpoon ipa willi glass',
    '^oktoberfest stein', '^winter warmer knit beanie', '^odell western flannel', '^tap handle$',
  ],
  'sporting-goods': [
    '^trek marlin [4-8] ', '^trek fx', '^stock 52 steel gravel royale', '^eebrakes gecko', '^invert enduro$', '^osprey talon 22',
    '^yeti roadie 15 cooler', "^men's brooks ghost", '^eno doublenest hammock$', '^opinel no\\.08 walnut', '^big agnes sidewinder', '^black diamond spot 400',
    '^jetboil micromo', '^msr hubba hubba', '^swiss army cadet', '^neelum 40l duffel',
  ],
  // Alternates co-op services with popular gadgets.
  'tech-software': [
    '^jmp\\.chat — ', '^garmin instinct e adventure', '^loomio — ', '^gopro hero12 black camera$', '^revision energy — ', '^jbl charge 5$',
    '^agaric — ', '^garmin forerunner 170', '^sassafras tech collective — ', '^garmin edge explore 2', '^508\\.dev — ', '^whoop one',
    '^colab cooperative — ', '^jbl tune 520', '^hypha worker co-operative — ', '^garrett ace apex metal detector',
  ],
}

// Titles that match a pick but aren't the thing (stationery, tributes,
// made-to-order discs, foreign-region imports).
export const EXCLUDE = /made on demand|import|sticky note|masking tape|tribute|lullaby|large print|workbook|telugu|proyecto|sacd/i
