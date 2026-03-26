/**
 * station-facts.ts — Interesting facts about London station names
 *
 * A curated collection of origin stories and trivia for tube station
 * names. Shown as a subtle one-liner below the station name on the
 * departure board.
 *
 * Key = station name (cleaned, lowercase) for easy matching.
 * Not every station needs a fact — only the interesting ones.
 */

export const STATION_FACTS: Record<string, string> = {
  /* ---- A ---- */
  "angel": "Named after the Angel Inn, a 17th-century coaching inn that stood on the corner.",
  "arsenal": "The only tube station named after a football club. Renamed from Gillespie Road in 1932.",
  "baker street": "Named after William Baker, an 18th-century property developer. Also home to the fictional Sherlock Holmes.",
  "bank": "Named after the Bank of England, whose fortress-like walls face the station entrance.",
  "barbican": "From the Latin 'barbecana' meaning a fortified outpost of a city wall.",
  "barons court": "Named after Sir William Palliser, who developed the area and styled himself a baron.",
  "bayswater": "Named after Baynard's Water, a stream that once flowed through the area.",
  "bermondsey": "Named after Beormund, a Saxon chief who owned the marshy island here.",
  "bethnal green": "From 'Blithehale'. A happy corner of land recorded in the 13th century.",
  "blackfriars": "Named after a Dominican friary that stood here. The friars wore black robes.",
  "bond street": "Named after Sir Thomas Bond who developed the street in the 1680s.",
  "borough": "One of London's oldest areas. 'Borough' meaning a self-governing town.",
  "bow road": "Named after a bow-shaped bridge over the River Lea built in the 12th century.",
  "brixton": "From 'Brixistane'. The stone of a Saxon lord named Brixi.",
  "burnt oak": "Named after a boundary oak tree that was burned to mark parish limits.",

  /* ---- C ---- */
  "canada water": "Named after the former Canada Dock, which handled timber imports from Canada.",
  "canary wharf": "Named after Canary Islands fruit trade. Bananas were unloaded at this wharf.",
  "cannon street": "Corruption of 'Candlewick Street' where candle makers once worked.",
  "chalk farm": "Nothing to do with chalk. Corrupted from 'Chalcot Farm' meaning cold cottages.",
  "chancery lane": "Named after the Court of Chancery, England's equity court that sat nearby.",
  "charing cross": "Named after the 'Eleanor Cross'. 'Chere reine' meaning dear queen in French.",
  "covent garden": "Corrupted from 'Convent Garden'. It was the garden of Westminster Abbey's monks.",
  "cockfosters": "Named after the chief forester (cock forester) of Enfield Chase.",

  /* ---- D ---- */
  "dagenham heathway": "Named after the heathland path that crossed this area before housing was built.",

  /* ---- E ---- */
  "earl's court": "Named after the manor court of the Earls of Warwick and Holland.",
  "edgware": "From 'Ecgi's weir'. A Saxon fishing weir on the Silk Stream.",
  "elephant & castle": "Named after a coaching inn whose sign showed an elephant with a castle on its back.",
  "elm park": "Named after the elm trees that once lined the area.",
  "embankment": "Named after the Victoria Embankment, built in the 1860s to contain the Thames.",
  "epping": "From 'Ypping'. A Saxon term meaning a lookout place on high ground.",
  "euston": "Named after Euston Hall in Suffolk, seat of the Duke of Grafton who owned the land.",

  /* ---- F ---- */
  "finsbury park": "Named after the ancient Manor of Finsbury. 'Fensbury' meaning marshy town.",

  /* ---- G ---- */
  "gloucester road": "Named after Maria, Duchess of Gloucester, who lived nearby in the 1820s.",
  "goodge street": "Named after John Goodge, a carpenter who built houses here in the 1740s.",
  "green park": "Named because it has no flowerbeds. Charles II's wife had them removed in jealousy.",
  "greenwich": "From 'Grenewic'. A green port or trading settlement.",

  /* ---- H ---- */
  "hammersmith": "From 'Hamersmyth'. Where a hammer smithy (forge) once stood by the river.",
  "highgate": "Named after a toll gate at the top of the hill on the Great North Road.",
  "holborn": "From 'Holebourne'. The stream in the hollow, referring to the River Fleet.",
  "holland park": "Named after Holland House, the Jacobean mansion at its centre.",
  "hornchurch": "Named after a medieval church with horn-shaped gables, or possibly bull horn relics.",

  /* ---- K ---- */
  "kennington": "From 'Cyningatun'. The estate of a king, possibly a Saxon royal manor.",
  "kentish town": "Named after the le Ken family who held the manor in the 14th century.",
  "kilburn": "From 'Cuneburna'. The royal stream where cattle were watered.",
  "king's cross st. pancras": "King's Cross named after a monument to George IV. St Pancras after a 14th-century Roman martyr.",
  "knightsbridge": "Named after a bridge where two knights fought to the death, according to legend.",

  /* ---- L ---- */
  "lambeth north": "From 'Lambhythe'. A landing place for lambs on the Thames.",
  "lancaster gate": "Named to honour the House of Lancaster. The gate was a grand entrance to Hyde Park.",
  "leicester square": "Named after Leicester House, home of the Earls of Leicester in the 1630s.",
  "liverpool street": "Named after Lord Liverpool, the Prime Minister from 1812 to 1827.",
  "london bridge": "The oldest river crossing in London. A bridge has stood here since Roman times.",

  /* ---- M ---- */
  "maida vale": "Named after the Battle of Maida in 1806. A British victory in southern Italy.",
  "manor house": "Named after a manor house that stood here since medieval times.",
  "mansion house": "Named after the official residence of the Lord Mayor of London next door.",
  "marble arch": "Named after John Nash's marble triumphal arch, originally the entrance to Buckingham Palace.",
  "marylebone": "From 'Mary-le-bone'. St Mary's church by the Tyburn stream (bone = brook).",
  "mile end": "Exactly one mile from Aldgate. The eastern boundary of medieval London.",
  "monument": "Named after the Monument to the Great Fire of London which stands above the station.",
  "moorgate": "Named after a gate in the London Wall that led to the marshy moorland beyond.",
  "morden": "From 'Mordune' meaning marsh hill. The area was built on drained marshland.",
  "mornington crescent": "Named after the Earl of Mornington, father of the Duke of Wellington.",

  /* ---- N ---- */
  "notting hill gate": "Named after a toll gate on the road from London to Uxbridge.",
  "nine elms": "Named after a row of nine elm trees that once lined the road here.",

  /* ---- O ---- */
  "old street": "One of the oldest roads in London, dating back to Saxon times.",
  "oval": "Named after the oval-shaped road layout around the cricket ground.",
  "oxford circus": "Named after Edward Harley, Earl of Oxford, who developed the area in the 1710s.",

  /* ---- P ---- */
  "paddington": "From 'Padda's farm'. A Saxon farmer who cultivated this land.",
  "pimlico": "Possibly named after Ben Pimlico, a local publican famous for his nut-brown ale.",
  "piccadilly circus": "Named after 'piccadills'. Stiff collars sold by a tailor on this street in the 1600s.",
  "putney bridge": "Named after 'Putta's landing place'. A Saxon river crossing point.",

  /* ---- Q ---- */
  "queensway": "Originally 'Queen's Road'. Renamed after Queen Victoria who grew up in Kensington Palace nearby.",

  /* ---- R ---- */
  "regent's park": "Named after the Prince Regent (later George IV) for whom John Nash designed the park.",
  "richmond": "Named after Henry VII who built a palace here and named it after his earldom in Yorkshire.",
  "royal oak": "Named after the oak tree where Charles II hid from Cromwell's soldiers in 1651.",

  /* ---- S ---- */
  "seven sisters": "Named after seven elm trees planted in a circle on Page Green in the 1600s.",
  "shepherd's bush": "Named after the shepherds who rested their flocks on the village green.",
  "sloane square": "Named after Sir Hans Sloane, whose collection founded the British Museum.",
  "southwark": "From 'Sudwerca'. The southern defensive work, a fort guarding London Bridge.",
  "st. paul's": "Named after St Paul's Cathedral, Sir Christopher Wren's masterpiece that dominates the skyline.",
  "stepney green": "From 'Stybba's landing place'. A Saxon mooring point on the Thames.",
  "stockwell": "Named after a stump well (tree-stump lined well) that stood at the crossroads.",
  "stratford": "From 'straet ford'. A Roman road crossing the River Lea.",
  "swiss cottage": "Named after a pub built in the style of a Swiss chalet in the 1840s.",

  /* ---- T ---- */
  "temple": "Named after the Knights Templar who established their English headquarters here in 1185.",
  "tottenham court road": "Named after Tottenham Manor. 'Totta's hamlet' in Saxon times.",
  "tower hill": "Named after the Tower of London, William the Conqueror's fortress built in 1066.",
  "turnpike lane": "Named after a turnpike (toll gate) on the road to Enfield.",

  /* ---- U ---- */
  "upminster": "From 'Upminster'. The upper church on the hill above the marshes.",
  "uxbridge": "From 'Wixan's bridge'. A Saxon bridge over the River Colne.",

  /* ---- V ---- */
  "vauxhall": "Named after Falkes de Breaut, a 13th-century mercenary who had a hall here. 'Falke's Hall'.",
  "victoria": "Named after Queen Victoria. The station opened in 1860 during her reign.",

  /* ---- W ---- */
  "wapping": "From 'Waeppa's people'. A Saxon settlement by the Thames.",
  "warren street": "Named after Anne Warren, wife of the landowner Charles Fitzroy.",
  "waterloo": "Named after the 1815 Battle of Waterloo. Wellington's victory over Napoleon.",
  "westminster": "From 'West Minster'. The western monastery, referring to Westminster Abbey.",
  "whitechapel": "Named after the white-painted St Mary's chapel that stood here in the 13th century.",
  "wimbledon": "From 'Wynnman's hill'. A Saxon personal name combined with 'dun' meaning hill.",
};

/**
 * Get a fact for a station by its display name.
 * Returns undefined if no fact is available.
 */
export function getStationFact(name: string): string | undefined {
  const clean = name
    .toLowerCase()
    .replace(/\s*underground station$/i, "")
    .replace(/\s*dlr station$/i, "")
    .replace(/\s*rail station$/i, "")
    .replace(/\s*station$/i, "")
    .replace(/\s*\(london\)/i, "")
    .trim();

  return STATION_FACTS[clean];
}
