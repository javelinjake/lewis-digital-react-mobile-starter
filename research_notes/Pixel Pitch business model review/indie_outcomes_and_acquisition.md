# Indie mobile game outcomes and user-acquisition routes (Pixel Pitch, 2026-2027 launch)

Research date: 25 November 2026. All figures are dated and sourced inline. "Vendor claim" marks a figure published by a company with a commercial interest in it; "anecdote" marks a single self-reported case. Third-party store-intelligence estimates (AppMagic, Sensor Tower, AppGoblin) are modelled estimates, not disclosed accounts.

## 1. Base rates: how many installs and how much revenue do new mobile games and apps actually get?

### Takeaway
The realistic default for a new mobile game is near-zero: about 1.3% of 2025's roughly 190,000 new mobile games passed 500k downloads in year one, and among subscription apps (the best public revenue-distribution dataset) the middle 50% earn $16-$429 a month one year after launch, with only about 17% of new apps ever reaching $1,000 MRR within two years. Roughly 16,000-17,000 new games launch every month across both stores.

### Cited Findings
- 190,000 new mobile games were released in 2025; only 2,500 passed 500,000 downloads in their first year (about 1.3%, my division). Source is Moloco's "Inside mobile games' first year" report, reported 26 Aug 2026. Vendor report (ad-tech), and the deeper analysis covers only 55 launches — [PocketGamer.biz](https://www.pocketgamer.biz/report-only-2500-of-190000-mobile-games-released-in-2025-surpassed-500000-downloads/)
- Sensor Tower (via 9to5Mac, Feb 2026): 55,300 new games on the App Store in 2025 (+11.4%) versus 150,000 on Google Play (+45.9%). That is about 4,600/month on iOS and 12,500/month on Google Play (my division) — [9to5Mac](https://9to5mac.com/2026/02/25/app-store-gaming-revenue-hit-52-5b-in-2025-topping-google-play-and-steam-combined-report/)
- Appfigures reported a fall in new game releases in 2024 (a search summary gave 222,000 to 126,000, -43.2%; I did not open the page, and the summary was unclear whether this counts games or all apps) — [9to5Mac, May 2025](https://9to5mac.com/2025/05/14/mobile-gaming-in-2024-saw-fewer-hits/)
- RevenueCat State of Subscription Apps 2026 (115,000+ apps, $16bn+ revenue, published March 2026), as reported by PPC Land: one year after launch the middle 50% of apps earn $16-$429/month; top quartile is $429+/month; top 10% is $2,500+/month; "average" monthly revenue one year after launch is about $72 — [PPC Land, 6 Mar 2026](https://ppc.land/the-app-middle-class-is-dying-and-revenuecats-data-shows-exactly-how-fast/)
- Same report: share of new apps reaching $1,000 MRR within two years fell from 19% to 17%; share reaching $10,000 MRR fell from 5.3% to 4.6%. Gaming was the only category that improved at the $10k milestone, at 9% — [PPC Land](https://ppc.land/the-app-middle-class-is-dying-and-revenuecats-data-shows-exactly-how-fast/)
- Same report: Gaming's top-quartile (75th percentile) monthly revenue at one year is $552, far below Business ($4,554) or Education ($3,614). Freemium apps earn $0.27 per install in the first two weeks versus $2.32 for hard-paywall apps — [PPC Land](https://ppc.land/the-app-middle-class-is-dying-and-revenuecats-data-shows-exactly-how-fast/)
- RevenueCat says the revenue gap between the top 5% and bottom 25% of apps reached 400x in 2025 data, up from 200x in 2024 (search summary of RevenueCat's blog; not opened) — [RevenueCat blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- GameAnalytics 2026 benchmarks (16,262 mobile games with 1,000+ MAU, mostly 2025 data, summarised 4 Jun 2026): D1 retention top 25% just above 30%, top 10% about 40%; D7 median just under 4%, top 25% 6-7%, top 10% 11-12%; D30 median 0.69-0.79%, top 25% about 1.6-1.8%. Median D1 is about 22% per the search summary of the same report — [GameDev Reports](https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game)
- Same GameAnalytics dataset: top-25% daily playtime 22-24 min, session length about 5.2 min, 5.3-5.7 sessions/day — [GameDev Reports](https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game)
- ARPDAU ranges (vendor blogs, weak): casual ads-only $0.01-0.05; hybrid-casual (ads + IAP) $0.15-0.50; one source cautions that the commonly quoted $0.03-0.08 band is really a hypercasual figure — [Playio blog](https://blog.playio.co/arpdau-benchmarks-mobile-games)
- Rewarded video eCPM is typically $10-30 per 1,000 impressions in top-tier markets (US, UK, Japan, South Korea), 2024-2025 averages; tier-2 about 30-60% lower. Vendor claim — [Yodo1, 3 Sep 2025](https://www.yodo1.com/blog/mobile-game-ecpm-benchmarks-2025)
- Idle games serve an average of 73.2 rewarded videos per user (Appodeal Mobile Casual Benchmarks Report 2025; vendor data, search summary only) — [App Developer Magazine](https://appdevelopermagazine.com/mobile-casual-benchmarks-report-2025/)

### Inferences
- RevenueCat's data is for subscription apps on its SDK, not F2P games with consumable IAP, so it is a proxy. Its gaming slice suggests a game is more likely than other categories to reach $10k MRR (9%) but has a low typical outcome (75th percentile $552/month). The selection also skews upward: apps that integrate RevenueCat and survive a year are not the whole store.
- A defensible base-rate ladder for scenario-building: bottom half of launches under about $100/month; "base" (50th-75th percentile) roughly $100-$550/month; top 10% roughly $2,500+/month; top 5% or better $10k+/month. Only the last tier pays a UK solo developer a living wage.
- The GameAnalytics sample only includes games with 1,000+ MAU, so its medians already exclude the long tail of games nobody found. A median D7 of under 4% means that even among games with an audience, most cannot support a 28-day season pass: under 1% of installers are still present at D30.
- Rough lifetime-days estimate from the GameAnalytics curve (my calculation, power-law interpolation): a top-25% game gets about 2.7 active days per install in the first 30 days; a top-10% game about 4. At ARPDAU $0.03-$0.10 that is a D30 LTV of roughly $0.08-$0.27 (top quartile) or $0.12-$0.40 (top decile) per install.

### Gaps
- No public dataset gives the revenue distribution of new F2P mobile games specifically (share under $1k/month, median, top 1%). Sensor Tower, AppMagic and Appfigures hold this but do not publish it free.
- I could not find a median first-year download count for new games; only the 500k threshold (1.3%) is published.
- RevenueCat's top 1% and top 5% absolute thresholds were not in the secondary coverage; the full PDF would need checking.
- No reliable published benchmark for season-pass / battle-pass payer conversion in casual games was found.
- GameAnalytics does not break its 2026 retention figures out by genre (idle, sports, card) in the public summary.

## 2. Postmortems and organic breakouts: Retro Bowl and comparable solo/indie cases

### Takeaway
Retro Bowl is the best comparable and also the best warning: it sat modestly for about 20 months, then took 7M+ downloads with zero UA spend after an App Store feature timed to the NFL season plus school/TikTok word of mouth, while the same studio's football (soccer) version, Retro Goal, earned an estimated $67k from 431k downloads in its first five months. Solo breakouts exist but every one found is an anecdote and most are premium or Steam-led rather than F2P mobile.

### Cited Findings
- Retro Bowl (New Star Games, UK) launched January 2020. By 29 Oct 2021 it had over 7 million downloads, "more than a third of those coming in the last month", with no user-acquisition spend. It hit #1 free iOS app in the US, #1 free iOS game in Canada, #1 free sports game on US Android, with a 4.8 rating from nearly a million reviews. It was featured on the App Store in September 2021 ahead of the NFL season — [PocketGamer.biz, 29 Oct 2021](http://www.pocketgamer.biz/uk-based-new-star-games-takes-us-by-storm-with-retro-bowl/)
- The TikTok link is described by PocketGamer as possible, not confirmed: the studio heard the game was played heavily in US schools, which "could be correlated" with popular TikTok videos. Founder Simon Read: "The recent success has taken us completely by surprise" — [PocketGamer.biz](http://www.pocketgamer.biz/uk-based-new-star-games-takes-us-by-storm-with-retro-bowl/)
- AppMagic estimate (19 Nov 2021): Retro Bowl $3M total revenue on 3.4M downloads; Retro Goal (soccer, released June 2021) $67K total revenue on 431K downloads. AppMagic notes retention for both is "rather low" and revenue falls when downloads fall. Note AppMagic's 3.4M downloads conflicts with the studio's 7M+ three weeks earlier, so treat estimates as rough — [AppMagic](https://appmagic.rocks/blog/retro-bowl-retro-goal)
- Sensor Tower's Q4 2025 US iOS pixel-games post reportedly shows Retro Bowl still earning about $28K-$47K per week on US iOS (search summary; not opened) — [Sensor Tower](https://sensortower.com/blog/2025-q4-ios-top-5-pixel-games-units-us-600dd070241bc16eb82f45be)
- MADFUT (football pack-opening/draft app; closest thematic comparable). AppGoblin estimates, Android only: MADFUT 23 14.2M installs and $100K+/month at peak; MADFUT 24 $10K+/month; MADFUT 25 under $10K/month; MADFUT 26 2.5M installs, 209K MAU, $10K+/month, ads the only detected monetisation. Low-confidence third-party estimates — [AppGoblin MADFUT 23](https://appgoblin.info/apps/com.madfut.madfut23); [AppGoblin MADFUT 25](https://appgoblin.info/apps/com.madfut.madfut25)
- Anecdote: Magic Research (solo dev, premium idle game on Steam, iOS, Android) reportedly earned over $400,000 in 12 months with no paid promotion, "only two posts on Reddit on /r/incremental_games" (secondary write-up) — [dev.to](https://dev.to/anulagarwal12/a-solo-game-developer-generated-over-400000-in-12-months-from-his-game-with-only-2-reddit-posts-5ahn)
- Anecdote: Tiny Terraces (solo, idle farming, Steam + mobile) reported $26,799 gross / $17,363 net in its first month — [Gamepressure](https://www.gamepressure.com/newsroom/how-much-can-you-earn-as-an-indie-dev-tiny-terraces-creator-share/zb889b)
- Anecdote: Harpagia (solo dev) reports 40,000+ downloads and roughly $10k/month; timing unclear, self-reported — [Starter Story](https://www.starterstory.com/stories/kayelleapps-com)
- Anecdote: Idle Slayer (solo dev) reached 1M Google Play downloads by June 2021 (publisher-partner write-up, vendor source) — [Yodo1](https://www.yodo1.com/?p=32587)
- TikTok-driven breakouts tracked by Appfigures include a "screaming at chickens" game sent to #1 by TikTokers (Nov 2024) and a July 2025 piece titled "If You Build It (for TikTok), They Will Come" (titles only; not opened) — [Appfigures, Nov 2024](https://appfigures.com/resources/insights/20241122?f=2); [Appfigures, Jul 2025](https://appfigures.com/resources/insights/20250711)

### Inferences
- Revenue per download from AppMagic's figures (my division): Retro Bowl about $0.88, Retro Goal about $0.16. The soccer variant monetised at under a fifth of the American-football one, probably because of audience geography (US iOS versus global Android-heavy football audience). $0.15-$0.20 per install is a sensible central RPD assumption for a football game with a global audience; $0.50+ needs a US/UK iOS-heavy mix.
- MADFUT shows the football pack-opening audience is large (tens of millions of installs across annual editions) but monetises almost entirely by ads at low value per user, and each annual edition appears to restart. A season pass plus gems with no rewarded ads leaves the main proven revenue stream in this niche unused.
- Retro Bowl's breakout had three ingredients Pixel Pitch can only partly copy: a real-world sporting calendar hook (NFL kickoff), an Apple feature, and a session shape that suits school/short-break play and is watchable in short video. A World Cup / season-start launch window and a pitch to Apple are the controllable parts.
- Every solo success with real numbers found here was premium, Steam-first, or ad-heavy. None was a solo F2P mobile game living on a pass plus IAP.

### Gaps
- No verified download or revenue curve for Retro Bowl's TikTok period beyond the PocketGamer article; New Star Games has not published revenue.
- No postmortem with real numbers was found for a solo-developed football card-collection or football idle mobile game 2022-2026.
- I did not find r/gamedev or r/incremental_games mobile F2P postmortems from 2024-2026 with full install/DAU/revenue tables in the searches run; a manual Reddit search would be needed.
- MADFUT's developer size, iOS revenue and TikTok role were not confirmed.

## 3. Organic discovery: ASO, keywords, featuring and platform indie programmes

### Takeaway
Store search is still the largest install source and a feature can multiply a week's downloads several-fold, but the published uplift studies are from 2017-2018 and Apple gives no criteria. Google's Indie Games Fund found in the search is Latin America only, so a UK developer should not plan around it.

### Cited Findings
- Apple: featuring is requested through Featuring Nominations in App Store Connect; give a minimum of two weeks' notice and ideally up to three months; "there's no checklist of requirements for getting featured" — [Apple Developer](https://developer.apple.com/app-store/getting-featured)
- Apple ran an "App Store Indie Games Week" in October 2026 (newsroom headline only; not opened) — [Apple Newsroom](https://apple.com/newsroom/2026/10/app-store-indie-games-week-kicks-off-today/)
- Sensor Tower (2018): median US iPhone downloads rose about 802% in the week after a Game of the Day feature; Stories and Lists placements gave about 200%; 29% of featured apps came from publishers with under 10,000 downloads at the time. Old data — [TechCrunch, 20 Apr 2018](https://techcrunch.com/2018/04/20/ios-11s-new-app-store-boosts-downloads-by-800-for-featured-apps)
- Apptopia (2017): Game of the Day gave games an average 792% day-on-day US download boost — [TechCrunch, 24 Oct 2017](https://techcrunch.com/2017/10/24/apples-app-of-the-day-featuring-boosts-downloads-by-1747-games-by-792/?ncid=rss)
- Anecdote: an indie featured as Game of the Day in 34 countries reported 4,508 UK downloads and 199 in Ireland on the feature day, not enough for a #1 category spot — [Medium / jaysquared](https://medium.com/jaysquared-com/my-experience-getting-featured-as-game-of-the-day-in-the-apple-app-store-d7e8e7992656)
- A secondary compilation says 65-70% of App Store downloads begin with a search and roughly 60% of Google Play installs are search-driven (attributed to Apple and Sensor Tower; not primary) — [Webtonic](https://www.webtonic.io/blog/app-store-optimization-statistics-86c8f)
- AppTweak: the share of games using in-app events rose from 38% (2023) to 46% (2024) to 51% (2025) — [AppTweak](https://www.apptweak.com/en/aso-blog/aso-app-store-trends-benchmarks-report)
- Google Play Indie Games Fund 2025 was Latin America only: $2M across 10 studios, $150k-$200k each, for developers who have already launched a game — [Android Developers Blog, Jul 2025](https://android-developers.googleblog.com/2025/07/google-plays-indie-games-fund-latin-america-returns-2025.html)

### Inferences
- A single-country Game of the Day is worth low thousands of installs for an indie (anecdote: about 4,500 UK on the day). Valuable for reviews and ranking momentum, not a business on its own.
- Because Retro Bowl's breakout coincided with a seasonal Apple feature, the most rational featuring pitch for Pixel Pitch is tied to a football calendar moment (season start in August, a major tournament), submitted about three months ahead with in-app events ready.
- In-app events are now table stakes for games (51% use them) and are free; a 28-day season cadence maps directly onto them.

### Gaps
- No keyword volume or difficulty data for "football manager", "soccer cards", "pack opener" or "football idle" was obtained; this needs a paid ASO tool (AppTweak, Appfigures, MobileAction) or Apple Search Ads popularity scores.
- No 2024-2026 study of featuring uplift was found; all quantified uplift data is 2017-2018.
- Google Play Indie Games Festival / Accelerator eligibility for UK developers in 2026-2027 was not confirmed.
- Google Play featuring nomination process and uplift not researched.

## 4. Low-cost channels: short video, communities, creators, cross-promo, and web portals

### Takeaway
Short-form video is the only zero-budget channel with documented step-change outcomes, but the evidence is survivor anecdotes with no base rate. Web portals are a real distribution business (Poki has 90M+ monthly players) with a 50/50 split on portal-sourced traffic, though published per-play earnings are absent.

### Cited Findings
- Poki's official developer deal: the developer keeps 100% of the game's earnings when the developer brings the player and 50% when Poki brings the player (search summary of Poki's page) — [Poki SDK deals](https://sdk.poki.com/deals)
- Poki has over 90 million players per month. Emolingo Games (started with two founders, now five full-time) has eight Poki games each over 10M plays, two over 75M, one at 100M, about 800,000 gameplays/day, about three months per game, exclusive to Poki. Revenue not disclosed. Platform-published case study (vendor source) — [Poki blog, 17 Jul 2025](https://poki.com/blog/how-emolingo-games-built-business-html5-web-games-poki)
- Poki blog (5 Sep 2023): indie developer Blumgi describes reaching 100M players in two years on the web (title only; not opened) — [Poki blog](https://poki.com/blog/blumgi-my-journey-on-the-web-how-i-reached-100m-players-in-2-years-as-an-indie-game-developer)
- CrazyGames does not publish a standard split. A secondary guide reports jam-specific terms of 60% of ad revenue and 70% of IAP revenue to developers; rates are otherwise negotiated per title. Source is a competing platform's blog — [Playgama blog](https://playgama.com/blog/business-faqs/poki-vs-crazygames-vs-gamedistribution-revenue-share/)
- Unsourced guide claim: a well-performing casual web game earns $200-$2,000/month on a major portal. Treat as unverified — [Cinevva guide](https://app.cinevva.com/guides/web-game-monetization)
- Stacky Dash reported over 100,000 downloads a day with TikTok as a driver (publisher-backed hypercasual; date not confirmed) — [PocketGamer.biz](https://www.pocketgamer.biz/how-tiktok-helped-stacky-dash-achieve-100000-downloads-a-day)
- Trivia Royale (2020) reached 2.5M downloads in three weeks; about 15% of downloads were paid and most paid traffic came from TikTok influencers, which the developer said were cheaper per user than traditional UA — [TechCrunch, 10 Jul 2020](https://techcrunch.com/2020/07/10/how-thor-fridrikssons-trivia-royale-earned-2-5m-downloads-in-3-weeks/)
- A PC indie used TikTok to get 120M views and 60k Steam wishlists (headline only; PC, not mobile) — [Game Developer](https://www.gamedeveloper.com/game-platforms/this-game-used-tiktok-to-get-120m-views-60k-steam-wishlists-)
- Anecdote: Magic Research's entire marketing was two posts on r/incremental_games (see section 2) — [dev.to](https://dev.to/anulagarwal12/a-solo-game-developer-generated-over-400000-in-12-months-from-his-game-with-only-2-reddit-posts-5ahn)

### Inferences
- Pixel Pitch already ships as an offline-capable PWA, so a web build on Poki/CrazyGames is a low-effort second storefront. On Poki's stated terms, portal-sourced players pay 50% of ad revenue to the developer, so the web build needs rewarded/interstitial ads to earn anything; portals do not reward a pass-plus-IAP model.
- Poki is curated and, on the evidence above, favours exclusivity and short-cycle games. A persistent account-based idle club with a custom backend is a less natural fit than a self-contained mini-game (for example a standalone pack-opener or penalty game) that links out to the app.
- Pack opening is inherently short-video-shaped (reveal, rarity, reaction), which is why MADFUT-style apps have a creator ecosystem. The cheap test is to post the game's own pack-reveal clips daily for several weeks before spending anything; the base rate of a breakout is unknown but low.
- r/incremental_games is a proven channel for idle games specifically, but it rewards depth and fair monetisation and is one or two launches' worth of traffic, not a recurring source.

### Gaps
- No benchmark was found for views-to-install conversion on TikTok/Reels/Shorts for mobile games, nor data on football pack-opening content performance or MADFUT/FUT creator rates.
- No verified per-play or RPM figures for Poki or CrazyGames; no itch.io mobile-funnel data.
- Football micro-influencer pricing, cross-promotion networks for indies, Discord community conversion, and web-to-app conversion rates were not researched to a citable standard.
- Whether Poki/CrazyGames allow outbound links to app-store listings, and on what terms, was not confirmed.

## 5. Paid UA economics on a small budget

### Takeaway
At ARPDAU of $0.03-$0.10 and realistic retention, a D30 LTV of roughly $0.08-$0.40 per install cannot cover tier-1 sports CPIs of about $2.87 (UK Android) to $7.27 (US iOS). Paid UA is useful only as a small measurement spend, not as a growth engine, unless LTV rises by an order of magnitude.

### Cited Findings
- AppsFlyer gaming benchmarks (Q3 2026) for the sports genre: iOS US about $7.27. Android: US $3.71, Germany $3.13, Australia $3.08, UK $2.87, Canada $2.49, France $1.75, Malaysia $0.60, Thailand $0.30, Mexico $0.18, Indonesia $0.18, Brazil $0.17. Genre alone creates roughly a 12x CPI spread within one market (search summary of AppsFlyer table; methodology not checked) — [AppsFlyer](https://www.appsflyer.com/?p=549948)
- Liftoff and Singular 2025 Casual Gaming Apps Report (Feb 2024-Feb 2025): casual-game CPI averaged about $1.41 on iOS and $0.14 on Android (as reported by a trade site) — [European Gaming](https://europeangaming.eu/portal/?p=181499)
- Liftoff: sports games showed D30 ROAS of 80% on iOS versus 21% on Android. Vendor data — [Liftoff](https://liftoff.ai/?p=35032)
- Conflicting casual CPI averages: $0.98 overall, iOS $2.23, Android $0.63 (Business of Apps-derived) — [Click-Vision](https://click-vision.com/mobile-game-marketing-statistics); and $2.17 casual average in the 2024 Liftoff/GameRefinery report — [GameDev Reports](https://gamedevreports.substack.com/p/liftoff-and-gamerefinery-casual-games)
- Adjust (cited by PPC Land): gaming cost per install $0.56, up 30% year over year — [PPC Land, Mar 2026](https://ppc.land/the-app-middle-class-is-dying-and-revenuecats-data-shows-exactly-how-fast/)
- Apple Search Ads (AppTweak 2026 benchmarks, 2025 data): US median cost per tap for games about $2.03; games CPI $4.63; Sports category CPI $26.70 (highest category); competitor campaigns $3.34 CPT for games, discovery campaigns $0.64. UK all-category median CPT $1.35 versus US $1.91 — [AppTweak](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- Mobile Action 2026 report: US CPT $1.93; games CPT rose from $2.44 to $4.02 in its dataset — [Mobile Action](https://www.mobileaction.co/report/apple-ads-2026-benchmark-report/cpt-search-results-ads/)
- Moloco: IAP revenue per install for US users rose 126% from 2021 to 2025; in "breakout" launches 94% of launch-month UA spend used ROAS objectives and averaged 93 creatives. Describes well-funded launches, not indies — [PocketGamer.biz](https://www.pocketgamer.biz/report-only-2500-of-190000-mobile-games-released-in-2025-surpassed-500000-downloads/)

### Inferences
- Worked example (my arithmetic): top-quartile retention gives about 2.7 active days in 30; at ARPDAU $0.10 that is $0.27 D30 LTV, before store fees. Against UK Android sports CPI $2.87 that is roughly 9% D30 ROAS; against US iOS $7.27, under 4%. Even a top-decile game (about 4 active days) at $0.10 reaches $0.40.
- Tier-3 CPIs ($0.17-$0.30 in Brazil, Indonesia, Mexico, Thailand) look closer to break-even, but ARPDAU in those markets is far lower (rewarded eCPM 30-60%+ below tier 1, low IAP propensity), so the ratio does not obviously improve. They are useful for cheap retention measurement, not profit.
- To buy tier-1 users profitably at CPI $2-$3, blended LTV needs to be $2.50-$4, which implies ARPDAU of roughly $0.25-$0.50 with top-decile retention: hybrid-casual territory with rewarded ads and a deep IAP economy.
- Apple Search Ads on brand and narrow discovery keywords ($0.64 CPT discovery benchmark) is the one paid channel that can make sense at tens of pounds a month, mainly to protect the brand term and seed keyword rank. Bidding on sports competitor terms is uneconomic at the benchmarks above.
- The "sports" genre benchmark is dominated by licensed and mid-core titles; a casual pixel football game may see CPIs nearer casual averages than sports averages, which is an uncertainty only a small test can resolve.

### Gaps
- No source states a minimum budget "to learn" for a paid test; ad-network learning-phase requirements (for example Meta's roughly 50 conversions per ad set per week) were not verified in this research.
- No source gives required D7/D30 ROAS targets by genre for casual sports specifically; the Lancaric soft-launch guide that covers this is paywalled.
- iOS CPIs by country other than the US were not available in the AppsFlyer summary.
- TikTok and Meta CPI benchmarks for small spenders were not found.

## 6. Publishers and funding

### Takeaway
Mobile publishers gate on marketability tests (CPI under roughly $0.20-$0.40 for hypercasual, under $1.00 for hybrid-casual, plus D1 of 35-45% and deep early playtime) and then typically pay a share of net revenue after UA recoup. UK public money is real: UK Games Fund prototype grants (up to £100k per one notice, match-funded at 50% of remaining budget) and a 34% Video Games Expenditure Credit, but the fund excludes fully launched games and VGEC needs a company and BFI certification.

### Cited Findings
- Homa targets for hypercasual: CPI under $0.40, D1 retention over 35%, D3 retention over 15%. For hybrid-casual: CPI under $1.00, 5,000 seconds cumulative playtime by D3, 20% game completion — [Homa knowledge base](https://support.homagames.com/knowledge/how-to-read-the-results-of-a-test)
- Voodoo says its older rules (55% D1, 22% D7, CPI under $0.25) are now seen as too narrow; reference points are now about 45% D1, 13% D7 and $0.20 CPI — [GameAnalytics blog](https://www.gameanalytics.com/blog/how-voodoo-diversified-and-lowered-game-product-kpis)
- Unity/Supersonic guidance: aim for CPI under $0.30 and D1 of 38%+ on Android for hypercasual prototypes — [Unity](https://unity.com/resources/growing-hyper-casual-games)
- Azur Games: good hypercasual playtime is 10+ minutes on day 0 and day 1 — [Azur Games](https://azurgames.com/blog/why-cpi-is-not-that-important-for-hyper-casual-or-what-metrics-were-looking-at)
- Typical deal shape: studio splits revenue with the publisher, generally 50% of net revenues, in exchange for a UA budget; in some versions 80% goes to the publisher until UA spend is recouped — [Gamezebo](https://www.gamezebo.com/news/the-economics-of-mobile-game-publishing/)
- Developer-side warning: contracts almost always pay a share of NET revenue after the publisher deducts marketing costs, and a publisher may rationally reinvest all revenue in UA, leaving the developer little — [GameAnalytics blog](https://gameanalytics.com/?p=258)
- Voodoo has shifted its whole organisation from hypercasual to hybrid since 2022 (search summary) — [SayGames blog](https://blog.say.games/posts/why-saygames-believes-hybrid-games-need-a-different-publishing-model)
- UK Games Fund Prototype Fund: the grant is no more than 50% of the remaining budget for the prototype project; one grant per financial year across UKGF programmes; projects that have already fully launched are not supported — [UK Games Fund](https://www.ukgamesfund.com/prototype-fund/)
- A council funding notice describes Prototype Fund grants of up to £100,000 with a round closing 5 May 2026; an earlier EOI round offered up to £30,000. Amounts conflict across rounds, so check the live round — [Devon County Council funding news](https://www.devon.gov.uk/fundingnews/?p=5589); [NI Business Info](https://nibusinessinfo.co.uk/content/uk-games-fund-eois-open-prototype-fund-grants)
- PocketGamer reported UK Games Fund reopening two funds with grants of up to £150,000 (headline only) — [PocketGamer.biz](https://www.pocketgamer.biz/uk-games-fund-re-opens-applications-for-two-funds-offering-grants-of-up-to-150000)
- VGEC: 34% credit on qualifying expenditure (HMRC example: £20,000 x 34% = £6,800). It is taxable, giving an effective net benefit of up to 25.5% at the main corporation tax rate — [HMRC CREC manual](https://www.gov.uk/hmrc-internal-manuals/creative-industries-expenditure-credit-manual/crec084000); [RSM UK](https://www.rsmuk.com/insights/tax-voice/video-games-expenditure-credit-same-benefit-more-scrutiny)
- VGEC requires at least 10% of core expenditure to be UK expenditure and the game must pass the BFI video games cultural test — [BFI](https://www.bfi.org.uk/apply-british-certification-expenditure-credits/about-uk-creative-industry-expenditure-credits)
- New games from 1 April 2025 must use VGEC; the old Video Games Tax Relief closes 1 April 2027 — [GOV.UK](https://www.gov.uk/guidance/claiming-video-games-tax-relief-for-corporation-tax)

### Inferences
- Pixel Pitch is a meta-heavy collection/idle game, not a hypercasual prototype, so the relevant bar is the hybrid one: CPI under about $1.00 with strong early playtime. A football theme helps marketability, but section 5's sports CPIs suggest clearing $1.00 in tier 1 is not a given.
- A publisher deal converts the developer's problem from "no UA budget" to "share of net after recoup"; with thin LTV there may be no net. It is worth running a publisher-style CPI test independently first (a few hundred pounds) so any conversation starts from data.
- VGEC is a corporation-tax credit on development spend, so a sole trader cannot claim it; a limited company paying the developer a salary or contractors can. For a solo developer with small cash costs the absolute value is small (34% of qualifying spend) and certification has an admin cost.
- The UK Games Fund's "not fully launched" rule and 50% match requirement make it more relevant before global launch (for example during soft launch) than after, and the match requirement is hard for a zero-budget solo developer unless own time can be costed, which I did not confirm.

### Gaps
- No published revenue-share terms or test thresholds were found specifically for Kwalee, Miniclip, Playstack, Crazy Labs or Supersonic's current hybrid programmes.
- Whether an 80% cap on qualifying core expenditure applies under VGEC (as it did under VGTR) was not confirmed; nor whether a director-only company's own salary counts as core expenditure.
- UK Games Fund round dates and maximum amounts for 2027, and whether F2P mobile games with live IAP are in practice funded, were not confirmed.
- Whether in-kind founder time counts toward UK Games Fund match funding was not confirmed.

## 7. Running costs for a solo-run live game with a custom backend

### Takeaway
Fixed platform costs are small (Vercel Pro $20/month, Neon from about $0.106 per compute-unit hour, RevenueCat free under $2.5k monthly tracked revenue then 1%), and stores take 15% under the small-business programmes. The binding cost is the developer's time for live-ops, for which I found no citable benchmark.

### Cited Findings
- Vercel Pro: $20/month platform fee including $20 of usage credit and one seat; 10M edge requests/month included then from $2 per 1M; 1 TB fast data transfer included then from $0.15/GB — [Vercel docs](https://vercel.com/docs/plans/pro-plan)
- Vercel Active CPU on Pro is billed at about $0.128 per hour (third-party blog, March 2026; check live pricing) — [Schematic](https://schematichq.com/blog/vercel-pricing)
- Neon Postgres: $0.106 per CU-hour on Launch and $0.222 on Scale (one CU is about 4 GB RAM); storage billed separately; free plan includes 100 CU-hours/month per project — [Neon pricing](https://neon.com/pricing)
- RevenueCat: free for months under $2.5K monthly tracked revenue; 1% of MTR once at or above $2.5K (for example $25 at $2.5K) — [RevenueCat pricing](https://www.revenuecat.com/pricing/)
- Apple's App Store Small Business Program cuts commission from 30% to 15% for developers earning under $1M a year; enrolment is required — [Apple Developer](https://developer.apple.com/app-store/small-business-program/?page=2)
- Google Play charges 15% on the first $1M of annual earnings. A single vendor blog reports Google restructured fees for the UK, EEA and US on 30 June 2026; unverified, check Play Console help — [Magora Systems, 7 Oct 2026](https://magora-systems.com/app-store-small-business-program/)

### Inferences
- Illustrative backend sizing (my arithmetic, assumptions stated): if an idle game makes about 50 API requests per DAU per day at about 20 ms active CPU each, 1k DAU is about 1.5M requests and under 10 CPU-hours a month (inside the $20 credit); 10k DAU is about 15M requests and about 83 CPU-hours (roughly $10-$25 of usage plus the base fee); 100k DAU is about 150M requests and about 830 CPU-hours (roughly $110 CPU plus about $280 in requests, so $400-$500/month before database). A Neon instance running one CU continuously is about $77/month on Launch; 100k DAU likely needs several CU plus pooling. These are order-of-magnitude estimates, not quotes.
- At ARPDAU $0.03, 10k DAU grosses about $9,000/month, so infrastructure at that scale is in the low single-digit percent of revenue. Infrastructure is not the constraint; store fees (15%) and UK VAT handling by the stores are larger.
- The season pass imposes a hard 28-day content cadence. Combined with GameAnalytics' D30 medians (under 1%), most of the pass's buyers must come from the small retained core, so each season needs enough new content to re-engage them: a recurring obligation of solo developer time every four weeks.

### Gaps
- No citable benchmark was found for solo-developer support load (tickets per 1k DAU) or for the live-ops hours needed per season in a pass-driven casual game.
- Analytics and crash-reporting costs (PostHog, Sentry) at 1k/10k/100k DAU were not priced.
- Neon per-GB storage rate, connection-pooling limits and Payload-specific database load were not verified.
- Apple Developer Program (£79/year) and Google Play ($25 one-off) fees were not re-verified in this research.

## 8. Soft-launch practice and go/no-go thresholds

### Takeaway
The commonly quoted go thresholds (D1 35-40%+, D7 12-15%+) correspond to the top 10% of all tracked games, so they are a high bar, not a typical result. 2026 practitioner advice has moved from "Canada/Australia" towards matching test geography to the monetisation model, with the Philippines or Indonesia for ad-tolerance tests and English-speaking markets for early feedback.

### Cited Findings
- GameAnalytics 2026: top-10% D1 is about 40% and top-10% D7 is 11-12%; top-25% D1 just above 30% and D7 6-7% — [GameDev Reports](https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game)
- Soft-launch guides set F2P targets of D1 35-50%+, D7 15-25%+, D30 5-15%+, and casual D1 of 40%+ (consultant blog, search summary) — [Game Growth Advisor](https://gamegrowthadvisor.com/blog/2025-12-16-mobile-soft-launch-complete-guide/)
- Voodoo's current reference points: about 45% D1, 13% D7 — [GameAnalytics blog](https://www.gameanalytics.com/blog/how-voodoo-diversified-and-lowered-game-product-kpis)
- Matej Lancaric (Jan 2026): start with English-speaking countries for early feedback, no one-size-fits-all; consider Android penetration; Poland for male-skewed midcore; avoid global launch in Q4 — [PocketGamer.biz, 6 Jan 2026](http://www.pocketgamer.biz/soft-launch-is-changing-in-2026-how-and-where-should-you-release-your-game/)
- Claire Rozain (Jan 2026): "Forget Canada and Australia. Match your game's core monetisation to a region's user behaviour"; Philippines or Indonesia for hypercasual/ad-monetised games to test ad tolerance; Türkiye or Brazil for midcore; go global once unit economics are "predictable, repeatable" in at least one high-value region. She adds that success "will not just be a 40% Day 1 retention or target Day 7 ROAS" — [PocketGamer.biz](http://www.pocketgamer.biz/soft-launch-is-changing-in-2026-how-and-where-should-you-release-your-game/)
- Lancaric's 2025 soft-launch guide says launching in the US first is "probably a bad idea" (visible intro only; the detail is paywalled) — [Brutally Honest](https://lancaric.substack.com/p/the-soft-launch-bible-full-2025-blueprint)
- GameAnalytics notes retention is lowest in Africa and Asia, which depresses numbers from cheap Asian test markets (search summary) — [GameDev Reports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)

### Inferences
- Suggested reading of thresholds for Pixel Pitch: D1 under 30% or D7 under 6% (below top quartile) means fix the core loop before any marketing; D1 30-40% / D7 6-11% is a viable hobby-scale game; D1 40%+ / D7 12%+ is top-decile and the level at which publishers or paid UA become worth discussing. For a 28-day pass, D30 is the decisive metric and top-quartile is only about 1.7%.
- A UK developer can soft-launch at near-zero cost in the UK or Ireland using organic and community traffic, but organic early adopters retain better than paid cohorts, so numbers from a Reddit/Discord cohort will flatter the game.
- Statistical note (general statistics, not from a source above): with 500 installs a measured D7 of 10% has a 95% interval of roughly 7.5-12.9%; with 1,000 installs roughly 8.2-12.0%. A few hundred installs per cohort is enough to tell "top decile" from "median" but not to tune.
- At tier-3 CPIs of about $0.17-$0.30 (section 5), 1,000 Android installs for a retention read costs roughly $170-$300; in the UK at $2.87 it would be about $2,900. This is the practical argument for a cheap-market retention test despite lower regional retention.

### Gaps
- No citable source gave soft-launch sample sizes, budgets or phase lengths; the most detailed practitioner guide is paywalled.
- No casual-idle or card-collection-specific D30/D60 thresholds or pass-conversion go/no-go levels were found.
- No evidence was found on how organic-cohort retention compares numerically with paid-cohort retention.
