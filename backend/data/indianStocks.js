const INDIAN_STOCKS = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", sector: "Energy" },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd.", sector: "IT" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", sector: "Banking" },
  { symbol: "INFY", name: "Infosys Ltd.", sector: "IT" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", sector: "Banking" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd.", sector: "FMCG" },
  { symbol: "ITC", name: "ITC Ltd.", sector: "FMCG" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd.", sector: "Telecom" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd.", sector: "Banking" },
  { symbol: "LT", name: "Larsen & Toubro Ltd.", sector: "Infrastructure" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd.", sector: "Banking" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd.", sector: "Chemicals" },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd.", sector: "Automobile" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd.", sector: "Pharma" },
  { symbol: "TITAN", name: "Titan Company Ltd.", sector: "Consumer" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd.", sector: "Finance" },
  { symbol: "BAJFINSV", name: "Bajaj Finserv Ltd.", sector: "Finance" },
  { symbol: "WIPRO", name: "Wipro Ltd.", sector: "IT" },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd.", sector: "IT" },
  { symbol: "NTPC", name: "NTPC Ltd.", sector: "Power" },
  { symbol: "POWERGRID", name: "Power Grid Corporation of India Ltd.", sector: "Power" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd.", sector: "Automobile" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd.", sector: "Cement" },
  { symbol: "ONGC", name: "Oil & Natural Gas Corporation Ltd.", sector: "Energy" },
  { symbol: "M&M", name: "Mahindra & Mahindra Ltd.", sector: "Automobile" },
  { symbol: "NESTLEIND", name: "Nestle India Ltd.", sector: "FMCG" },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd.", sector: "Metals" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd.", sector: "Metals" },
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd.", sector: "Diversified" },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ Ltd.", sector: "Infrastructure" },
  { symbol: "TECHM", name: "Tech Mahindra Ltd.", sector: "IT" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd.", sector: "Banking" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories Ltd.", sector: "Pharma" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories Ltd.", sector: "Pharma" },
  { symbol: "CIPLA", name: "Cipla Ltd.", sector: "Pharma" },
  { symbol: "GRASIM", name: "Grasim Industries Ltd.", sector: "Cement" },
  { symbol: "BRITANNIA", name: "Britannia Industries Ltd.", sector: "FMCG" },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd.", sector: "Automobile" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd.", sector: "Automobile" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals Enterprise Ltd.", sector: "Healthcare" },
  { symbol: "COALINDIA", name: "Coal India Ltd.", sector: "Mining" },
  { symbol: "BPCL", name: "Bharat Petroleum Corporation Ltd.", sector: "Energy" },
  { symbol: "SBILIFE", name: "SBI Life Insurance Company Ltd.", sector: "Insurance" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance Company Ltd.", sector: "Insurance" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd.", sector: "Automobile" },
  { symbol: "HINDALCO", name: "Hindalco Industries Ltd.", sector: "Metals" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products Ltd.", sector: "FMCG" },
  { symbol: "WIPRO", name: "Wipro Ltd.", sector: "IT" },
  { symbol: "UPL", name: "UPL Ltd.", sector: "Chemicals" },

  // ── NIFTY NEXT 50 / Popular mid-caps ──
  { symbol: "ADANIGREEN", name: "Adani Green Energy Ltd.", sector: "Energy" },
  { symbol: "ADANIPOWER", name: "Adani Power Ltd.", sector: "Power" },
  { symbol: "AMBUJACEM", name: "Ambuja Cements Ltd.", sector: "Cement" },
  { symbol: "AUROPHARMA", name: "Aurobindo Pharma Ltd.", sector: "Pharma" },
  { symbol: "BANKBARODA", name: "Bank of Baroda", sector: "Banking" },
  { symbol: "BEL", name: "Bharat Electronics Ltd.", sector: "Defence" },
  { symbol: "BERGEPAINT", name: "Berger Paints India Ltd.", sector: "Chemicals" },
  { symbol: "BIOCON", name: "Biocon Ltd.", sector: "Pharma" },
  { symbol: "CANBK", name: "Canara Bank", sector: "Banking" },
  { symbol: "CHOLAFIN", name: "Cholamandalam Investment & Finance Co.", sector: "Finance" },
  { symbol: "COLPAL", name: "Colgate-Palmolive (India) Ltd.", sector: "FMCG" },
  { symbol: "CONCOR", name: "Container Corporation of India Ltd.", sector: "Logistics" },
  { symbol: "DABUR", name: "Dabur India Ltd.", sector: "FMCG" },
  { symbol: "DLF", name: "DLF Ltd.", sector: "Real Estate" },
  { symbol: "FEDERALBNK", name: "Federal Bank Ltd.", sector: "Banking" },
  { symbol: "GAIL", name: "GAIL (India) Ltd.", sector: "Energy" },
  { symbol: "GODREJCP", name: "Godrej Consumer Products Ltd.", sector: "FMCG" },
  { symbol: "GODREJPROP", name: "Godrej Properties Ltd.", sector: "Real Estate" },
  { symbol: "HAL", name: "Hindustan Aeronautics Ltd.", sector: "Defence" },
  { symbol: "HAVELLS", name: "Havells India Ltd.", sector: "Electricals" },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank Ltd.", sector: "Banking" },
  { symbol: "INDIANB", name: "Indian Bank", sector: "Banking" },
  { symbol: "INDIGO", name: "InterGlobe Aviation Ltd.", sector: "Aviation" },
  { symbol: "IOC", name: "Indian Oil Corporation Ltd.", sector: "Energy" },
  { symbol: "IRCTC", name: "Indian Railway Catering & Tourism Corp.", sector: "Tourism" },
  { symbol: "IRFC", name: "Indian Railway Finance Corporation Ltd.", sector: "Finance" },
  { symbol: "JINDALSTEL", name: "Jindal Steel & Power Ltd.", sector: "Metals" },
  { symbol: "JUBLFOOD", name: "Jubilant FoodWorks Ltd.", sector: "Consumer" },
  { symbol: "LICHSGFIN", name: "LIC Housing Finance Ltd.", sector: "Finance" },
  { symbol: "LICI", name: "Life Insurance Corporation of India", sector: "Insurance" },
  { symbol: "LTIM", name: "LTIMindtree Ltd.", sector: "IT" },
  { symbol: "LTTS", name: "L&T Technology Services Ltd.", sector: "IT" },
  { symbol: "LUPIN", name: "Lupin Ltd.", sector: "Pharma" },
  { symbol: "MARICO", name: "Marico Ltd.", sector: "FMCG" },
  { symbol: "MAXHEALTH", name: "Max Healthcare Institute Ltd.", sector: "Healthcare" },
  { symbol: "MCX", name: "Multi Commodity Exchange of India Ltd.", sector: "Exchange" },
  { symbol: "MFSL", name: "Max Financial Services Ltd.", sector: "Finance" },
  { symbol: "MOTHERSON", name: "Motherson Sumi Wiring India Ltd.", sector: "Auto Ancillary" },
  { symbol: "MPHASIS", name: "MphasiS Ltd.", sector: "IT" },
  { symbol: "MRF", name: "MRF Ltd.", sector: "Tyres" },
  { symbol: "MUTHOOTFIN", name: "Muthoot Finance Ltd.", sector: "Finance" },
  { symbol: "NAUKRI", name: "Info Edge (India) Ltd.", sector: "IT" },
  { symbol: "NHPC", name: "NHPC Ltd.", sector: "Power" },
  { symbol: "NMDC", name: "NMDC Ltd.", sector: "Mining" },
  { symbol: "OBEROIRLTY", name: "Oberoi Realty Ltd.", sector: "Real Estate" },
  { symbol: "OFSS", name: "Oracle Financial Services Software Ltd.", sector: "IT" },
  { symbol: "PAYTM", name: "One 97 Communications Ltd.", sector: "Fintech" },
  { symbol: "PEL", name: "Piramal Enterprises Ltd.", sector: "Diversified" },
  { symbol: "PERSISTENT", name: "Persistent Systems Ltd.", sector: "IT" },
  { symbol: "PETRONET", name: "Petronet LNG Ltd.", sector: "Energy" },
  { symbol: "PFC", name: "Power Finance Corporation Ltd.", sector: "Finance" },
  { symbol: "PIDILITIND", name: "Pidilite Industries Ltd.", sector: "Chemicals" },
  { symbol: "PIIND", name: "PI Industries Ltd.", sector: "Chemicals" },
  { symbol: "PNB", name: "Punjab National Bank", sector: "Banking" },
  { symbol: "POLYCAB", name: "Polycab India Ltd.", sector: "Electricals" },
  { symbol: "RECLTD", name: "REC Ltd.", sector: "Finance" },
  { symbol: "SAIL", name: "Steel Authority of India Ltd.", sector: "Metals" },
  { symbol: "SHREECEM", name: "Shree Cement Ltd.", sector: "Cement" },
  { symbol: "SHRIRAMFIN", name: "Shriram Finance Ltd.", sector: "Finance" },
  { symbol: "SIEMENS", name: "Siemens Ltd.", sector: "Industrials" },
  { symbol: "SRF", name: "SRF Ltd.", sector: "Chemicals" },
  { symbol: "SYNGENE", name: "Syngene International Ltd.", sector: "Pharma" },
  { symbol: "TATACOMM", name: "Tata Communications Ltd.", sector: "Telecom" },
  { symbol: "TATAELXSI", name: "Tata Elxsi Ltd.", sector: "IT" },
  { symbol: "TATAPOWER", name: "Tata Power Company Ltd.", sector: "Power" },
  { symbol: "TORNTPHARM", name: "Torrent Pharmaceuticals Ltd.", sector: "Pharma" },
  { symbol: "TRENT", name: "Trent Ltd.", sector: "Retail" },
  { symbol: "UNIONBANK", name: "Union Bank of India", sector: "Banking" },
  { symbol: "VEDL", name: "Vedanta Ltd.", sector: "Metals" },
  { symbol: "VOLTAS", name: "Voltas Ltd.", sector: "Consumer Durables" },
  { symbol: "ZOMATO", name: "Zomato Ltd.", sector: "Consumer" },
  { symbol: "ZYDUSLIFE", name: "Zydus Lifesciences Ltd.", sector: "Pharma" },

  // ── More popular stocks ──
  { symbol: "ABCAPITAL", name: "Aditya Birla Capital Ltd.", sector: "Finance" },
  { symbol: "ACC", name: "ACC Ltd.", sector: "Cement" },
  { symbol: "ALOKINDS", name: "Alok Industries Ltd.", sector: "Textiles" },
  { symbol: "ATUL", name: "Atul Ltd.", sector: "Chemicals" },
  { symbol: "BANDHANBNK", name: "Bandhan Bank Ltd.", sector: "Banking" },
  { symbol: "BATAINDIA", name: "Bata India Ltd.", sector: "Consumer" },
  { symbol: "BHEL", name: "Bharat Heavy Electricals Ltd.", sector: "Capital Goods" },
  { symbol: "BOSCHLTD", name: "Bosch Ltd.", sector: "Auto Ancillary" },
  { symbol: "CANFINHOME", name: "Can Fin Homes Ltd.", sector: "Finance" },
  { symbol: "CDSL", name: "Central Depository Services (India) Ltd.", sector: "Exchange" },
  { symbol: "CESC", name: "CESC Ltd.", sector: "Power" },
  { symbol: "COFORGE", name: "Coforge Ltd.", sector: "IT" },
  { symbol: "CROMPTON", name: "Crompton Greaves Consumer Electricals", sector: "Electricals" },
  { symbol: "CUB", name: "City Union Bank Ltd.", sector: "Banking" },
  { symbol: "CUMMINSIND", name: "Cummins India Ltd.", sector: "Industrials" },
  { symbol: "DEEPAKNTR", name: "Deepak Nitrite Ltd.", sector: "Chemicals" },
  { symbol: "DELHIVERY", name: "Delhivery Ltd.", sector: "Logistics" },
  { symbol: "DIXON", name: "Dixon Technologies (India) Ltd.", sector: "Electronics" },
  { symbol: "ESCORTS", name: "Escorts Kubota Ltd.", sector: "Automobile" },
  { symbol: "EXIDEIND", name: "Exide Industries Ltd.", sector: "Auto Ancillary" },
  { symbol: "FORTIS", name: "Fortis Healthcare Ltd.", sector: "Healthcare" },
  { symbol: "GMRINFRA", name: "GMR Airports Infrastructure Ltd.", sector: "Infrastructure" },
  { symbol: "GNFC", name: "Gujarat Narmada Valley Fertilizers & Chemicals", sector: "Chemicals" },
  { symbol: "GRANULES", name: "Granules India Ltd.", sector: "Pharma" },
  { symbol: "HAPPSTMNDS", name: "Happiest Minds Technologies Ltd.", sector: "IT" },
  { symbol: "HDFCAMC", name: "HDFC Asset Management Company Ltd.", sector: "Finance" },
  { symbol: "HINDPETRO", name: "Hindustan Petroleum Corporation Ltd.", sector: "Energy" },
  { symbol: "HONAUT", name: "Honeywell Automation India Ltd.", sector: "Industrials" },
  { symbol: "ICICIPRULI", name: "ICICI Prudential Life Insurance Co.", sector: "Insurance" },
  { symbol: "IDEA", name: "Vodafone Idea Ltd.", sector: "Telecom" },
  { symbol: "IEX", name: "Indian Energy Exchange Ltd.", sector: "Exchange" },
  { symbol: "IPCALAB", name: "Ipca Laboratories Ltd.", sector: "Pharma" },
  { symbol: "JKCEMENT", name: "JK Cement Ltd.", sector: "Cement" },
  { symbol: "JSWENERGY", name: "JSW Energy Ltd.", sector: "Power" },
  { symbol: "KALYANKJIL", name: "Kalyan Jewellers India Ltd.", sector: "Consumer" },
  { symbol: "KEI", name: "KEI Industries Ltd.", sector: "Electricals" },
  { symbol: "L&TFH", name: "L&T Finance Ltd.", sector: "Finance" },
  { symbol: "LAURUSLABS", name: "Laurus Labs Ltd.", sector: "Pharma" },
  { symbol: "MANAPPURAM", name: "Manappuram Finance Ltd.", sector: "Finance" },
  { symbol: "METROPOLIS", name: "Metropolis Healthcare Ltd.", sector: "Healthcare" },
  { symbol: "MINDTREE", name: "LTIMindtree Ltd.", sector: "IT" },
  { symbol: "NAM-INDIA", name: "Nippon Life India AMC Ltd.", sector: "Finance" },
  { symbol: "NATIONALUM", name: "National Aluminium Company Ltd.", sector: "Metals" },
  { symbol: "NIACL", name: "New India Assurance Company Ltd.", sector: "Insurance" },
  { symbol: "PAGEIND", name: "Page Industries Ltd.", sector: "Textiles" },
  { symbol: "PATANJALI", name: "Patanjali Foods Ltd.", sector: "FMCG" },
  { symbol: "PVRINOX", name: "PVR INOX Ltd.", sector: "Entertainment" },
  { symbol: "RAJESHEXPO", name: "Rajesh Exports Ltd.", sector: "Consumer" },
  { symbol: "RAMCOCEM", name: "The Ramco Cements Ltd.", sector: "Cement" },
  { symbol: "RBLBANK", name: "RBL Bank Ltd.", sector: "Banking" },
  { symbol: "SBICARD", name: "SBI Cards & Payment Services Ltd.", sector: "Finance" },
  { symbol: "SONACOMS", name: "Sona BLW Precision Forgings Ltd.", sector: "Auto Ancillary" },
  { symbol: "STAR", name: "Star Health & Allied Insurance Co.", sector: "Insurance" },
  { symbol: "SUNTV", name: "Sun TV Network Ltd.", sector: "Media" },
  { symbol: "SUPREMEIND", name: "Supreme Industries Ltd.", sector: "Plastics" },
  { symbol: "SUZLON", name: "Suzlon Energy Ltd.", sector: "Energy" },
  { symbol: "TVSMOTOR", name: "TVS Motor Company Ltd.", sector: "Automobile" },
  { symbol: "YESBANK", name: "Yes Bank Ltd.", sector: "Banking" },
  { symbol: "ZEEL", name: "Zee Entertainment Enterprises Ltd.", sector: "Media" },

  // ── Indices (informational) ──
  { symbol: "^NSEI", name: "NIFTY 50", sector: "Index" },
  { symbol: "^BSESN", name: "SENSEX", sector: "Index" },
  { symbol: "^NSEBANK", name: "NIFTY Bank", sector: "Index" },
  { symbol: "^CNXIT", name: "NIFTY IT", sector: "Index" },
];

// Build a quick-lookup map once at load time
const symbolMap = new Map();
INDIAN_STOCKS.forEach((s) => {
  const key = s.symbol.toUpperCase();
  if (!symbolMap.has(key)) symbolMap.set(key, s);
});

/**
 * Fast local search — matches symbol prefix or name substring.
 * Returns up to `limit` results (default 8).
 */
function searchIndianStocks(query, limit = 8) {
  if (!query || query.length < 1) return [];
  const q = query.toUpperCase().trim();

  const symbolPrefixMatches = [];
  const nameMatches = [];

  for (const stock of INDIAN_STOCKS) {
    if (symbolPrefixMatches.length + nameMatches.length >= limit * 2) break;

    const sym = stock.symbol.toUpperCase();
    const name = stock.name.toUpperCase();

    if (sym.startsWith(q)) {
      symbolPrefixMatches.push(stock);
    } else if (sym.includes(q) || name.includes(q)) {
      nameMatches.push(stock);
    }
  }

  // Prioritize symbol-prefix matches, then name matches
  const combined = [...symbolPrefixMatches, ...nameMatches];
  // Deduplicate by symbol
  const seen = new Set();
  const results = [];
  for (const stock of combined) {
    if (!seen.has(stock.symbol)) {
      seen.add(stock.symbol);
      results.push(stock);
    }
    if (results.length >= limit) break;
  }
  return results;
}

module.exports = { INDIAN_STOCKS, searchIndianStocks, symbolMap };
