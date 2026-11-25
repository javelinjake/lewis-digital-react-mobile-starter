# Mobile F2P spending and monetisation benchmarks for a casual sports / card-collection / idle game (as of Nov 2026)

Reading notes for the report writer:

- Research date: 25 Nov 2026. Around 20 search/fetch calls were made. Most figures were read from secondary summaries (GameDev Reports substack, vendor blogs, trade press) of the primary reports, not from the primary PDFs. Where that is the case it is marked "(via summary)".
- "Vendor" marks a figure published by a company that sells ad-tech / UA / analytics services. "Low-authority" marks SEO-style pages whose numbers I could not trace to a primary source.
- All currency is USD unless marked GBP.
- Arithmetic I did myself is in the Inferences sub-sections, never in Cited Findings.

## 1. ARPDAU benchmarks by genre, platform and geography

### Takeaway
There is no trustworthy, public, 2025-2026 median/top-quartile ARPDAU table by genre; the published ranges are undated vendor ranges that run from roughly $0.01-0.05 (ads-only casual) to $0.15-0.50 (hybrid casual with IAP), and nothing sports-, card- or idle-specific was found. The best dated substitutes are AppsFlyer's cumulative D90 revenue per install (casual: $1.34 IAP + $0.55 ads) and Sensor Tower's revenue per download ($1.62 blended; iOS roughly 9x Android).

### Cited Findings
- Blended ARPDAU ranges by monetisation model: casual ads-only $0.01-0.05; hypercasual $0.03-0.08; hybrid casual $0.15-0.50; mid-core/RPG "none published". These are described as "published ranges" with no source date. — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- The same page states the last broadly published genre-level breakdown is AppsFlyer Q3 2022, so many genre ARPDAU grids in circulation are reprinted old data. — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- Vendor glossary range (method undisclosed, blended global, IAP + ads): casual/hypercasual $0.10-0.30; mid-core $0.50-2; hardcore RPG/strategy/sim $2-10+. Treat as directional; it conflicts with the ranges above at the casual end. — [MWM glossary, 2026](https://mwm.ai/glossary/arpdau)
- Playio's review concludes that monetisation model, not genre, sets the order of magnitude of ARPDAU, and that no trustworthy primary source exists for IAP-heavy genres. — [Playio, 2026](https://blog.playio.co/arpdau-benchmarks-mobile-games)
- AppsFlyer "App Monetization in 2026" (data Jan 2025-Mar 2026; $900M verified IAP, $7.2B ad revenue; via summary): cumulative D90 IAP ARPU per install is casual $1.34, midcore $2.13, casino $2.43; North America + Europe midcore $2.66, casino $2.55. — [GameDev Reports summary of AppsFlyer](https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026)
- Same report: cumulative D90 ad (IAA) ARPU per install, global: casual $0.55, casino $0.47, midcore $0.40, hypercasual $0.22. — [GameDev Reports summary of AppsFlyer](https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026)
- Same report: North America and Europe ARPU runs about 20-25% above the global figure, narrowing to about 5-10% at the ARPPU level (i.e. the regional gap is mostly conversion, not spend per payer). — [Playio citing AppsFlyer 2026](https://blog.playio.co/arppu-mobile-games)
- Sensor Tower State of Gaming 2026 (2025 data): mobile game IAP revenue $81.75B on 50.41B downloads; reported as $1.62 IAP per download. App Store $52.5B on 7.8B downloads; Google Play $30B on 42.4B downloads. — [GameDev Reports summary of Sensor Tower](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026)
- Q1 2026 game IAP per download (Playio's own calculation from Sensor Tower): App Store about $6.78, Google Play about $0.74. — [Playio, 2026](https://blog.playio.co/arppu-mobile-games)
- Liftoff 2025 Casual Gaming report (2024 data, vendor): casual D30 ROAS 47% on iOS vs 15% on Android. — [Playio citing Liftoff](https://blog.playio.co/arppu-mobile-games)
- Appodeal Mobile Casual Benchmarks 2025 (vendor; US Android installs, 10,000+ casual games, Jun 2024-Jan 2025): lifetime ad ARPU per user is hypercasual $0.86, running $2.34, match $2.99, party $4.90, luck battle $12.23, merge-3 $14.83. No sports, card or idle ARPU published in the article. — [App Developer Magazine, May 2025](https://appdevelopermagazine.com/Mobile-Casual-Benchmarks-Report-2025/)

### Inferences
- A pass + gems game with no ads is closest to "hybrid casual with IAP" at the IAP-only portion: the hybrid-casual $0.15-0.50 range with 40-60% from IAP implies roughly $0.06-0.30 IAP ARPDAU. For a solo-dev title with no gacha, the lower half of that is the defensible base; ads-only-casual levels ($0.01-0.05) are a sensible low case for total ARPDAU.
- Revenue-per-install is a safer modelling unit than ARPDAU given the data: AppsFlyer casual D90 of about $1.34 IAP per install (plus $0.55 if ads are added) is a paid-UA-skewed, mostly-larger-studio figure and should be treated as a high/base ceiling for an indie, not a median.
- Derived from the Sensor Tower 2025 figures: App Store about $6.73 per download, Google Play about $0.71 per download, i.e. iOS earns roughly 9x Android per install in IAP. Platform mix will swing the model more than genre.

### Gaps
- No median vs top-quartile ARPDAU by genre for 2025-2026 found in public sources (GameAnalytics' 2026 summary carries no ARPDAU/ARPPU cut; percentile data sits behind AppMagic / Sensor Tower / GameAnalytics paid tools).
- No ARPDAU specific to sports, sports-manager, card/collection or idle found.
- No UK-specific ARPDAU found; only the "NA + Europe about 20-25% above global" statement.

## 2. Payer conversion, ARPPU, transaction value and spend concentration

### Takeaway
Around 3-5% of sports-game installs in the US/UK make a purchase within 30 days (AppsFlyer Q3 2026), against about 2.6-2.9% for all games; casual D90 ARPPU is about $7 (midcore about $10), and roughly half of first-time payers buy again within 30 days. Whale-concentration data is old or academic: top 10% of payers produced about 64% of revenue (2015), and only about 12% of games show the extreme "1% of players = 40% of revenue" pattern.

### Cited Findings
- AppsFlyer Q3 2026 benchmarks, share of installs that purchase within 30 days (paid-media cohort), iOS / Android: Sports US 4.93% / 3.22%; Sports UK Android 3.73% (no UK iOS value); Simulation US 5.36% / 4.61%, UK 5.12% / 4.55%; Match US 4.93% / 4.80%, UK 5.82% / 5.45%; Puzzle US 2.37% / 1.85%, UK 2.21% / 2.92%; Tabletop US 2.11% / 0.77%; Hypercasual 0.29% / 0.39%; Gaming overall US 2.85% / 2.79%, UK 2.87% / 2.60%. — [AppsFlyer gaming benchmarks Q3 2026](https://www.appsflyer.com/?p=549948)
- AppsFlyer App Monetization 2026 (Jan 2025-Mar 2026, via summary): D90 IAP ARPPU casual $7.26, midcore $9.80, casino $11.40. — [GameDev Reports summary of AppsFlyer](https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026)
- Same report: ratio of one-time to repeat buyers within 30 days is 1.89x for casual and 1.76x for midcore; Playio derives an implied repeat-buyer share of about 53% (casual) and 57% (midcore). — [Playio citing AppsFlyer 2026](https://blog.playio.co/arppu-mobile-games)
- Same report: 38% of D60 IAP revenue arrives on install day and 60% by day 7 (all apps); for ads, 57% on day 1 and 89% by day 7. — [GameDev Reports summary of AppsFlyer](https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026)
- Same report: North America first-purchase conversion within 30 days 11.14% vs LATAM 6.51% (Playio notes it is unclear this is games-only; it appears alongside non-gaming figures). — [GameDev Reports summary of AppsFlyer](https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026)
- Older: GameAnalytics (Jun 2018-May 2019), top 15% of games: daily payer conversion 0.8-1.2% of DAU, ARPPU about $20 (action/RPG leaders $27-31). — [Playio citing GameAnalytics](https://blog.playio.co/arppu-mobile-games)
- Older: Swrve (Jan 2015, 20M+ F2P players): 2.3% of players paid in the month; top 10% of payers produced 64% of revenue. — [Playio citing Swrve](https://blog.playio.co/arppu-mobile-games)
- Academic (University of Southern Denmark, data Aug 2020-Apr 2022): just under 12% of games show a "hyper-Pareto" pattern where about 1% of players generate about 40% of revenue; average spend of the top 1% ranged from $19 to $1,700 across distribution types. — [Playio citing SDU study](https://blog.playio.co/arppu-mobile-games)
- Newzoo 2026 forecast (all platforms, annual, not mobile-only): 44.6% of players pay; annual ARPPU $129.6. — [Playio citing Newzoo](https://blog.playio.co/arppu-mobile-games)
- Low-authority, unsourced: battle pass conversion 8-20% of active players vs 1-5% for individual IAP items. — [MWM glossary](https://mwm.ai/glossary/battle-pass)

### Inferences
- A 30-day install-to-payer rate of about 3-5% for sports in tier-1 is a paid-UA cohort from larger publishers running full economies (gacha, offers). For a pass-and-gems indie title, a low/base/high of roughly 1% / 2.5% / 4.5% of installs paying within 30 days brackets the AppsFlyer all-games (about 2.8%) and sports (3.2-4.9%) values.
- The AppsFlyer D90 ARPU ($1.34) and ARPPU ($7.26) for casual cannot be divided to get a payer rate (it would imply about 18%, inconsistent with the 2-5% conversion tables); the two metrics evidently use different bases. Do not derive conversion from them.
- A $7 casual D90 ARPPU is about one to one-and-a-half season passes at $4.99-$6.99, which is consistent with a pass-led payer buying one pass and sometimes one gem pack in the first three months.
- Front-loading matters for a 28-day pass: with 60% of D60 IAP revenue arriving in the first week, a pass that cannot be bought (or is not attractive) in a player's first week forgoes most of the typical revenue window.

### Gaps
- No sourced average transaction value (ATV) for mobile game IAP in 2025-2026 found.
- No 2025-2026 measurement of revenue share from the top 1% / 10% of payers; the most quoted numbers are from 2015 (Swrve) and an academic 2020-2022 dataset.
- No card/collection- or idle-specific conversion rate (AppsFlyer's table has no card or idle genre; "Simulation" is the nearest for idle).
- No lifetime ("ever pays") conversion figure; all dated numbers are 30-day windows.

## 3. Battle pass / season pass benchmarks

### Takeaway
Hard pass data is thin and mostly from 2020-2022: passes typically cost $5-15 per month with rewards worth 10-20x the price, they convert well but cap ARPPU, and Google found they drive anywhere from 1% to 40% of a game's revenue depending on integration. No reliable public figure exists for the share of active players who buy, and no quantified evidence was found that pass-only monetisation matches gacha revenue; the best-known case (Clash Royale) saw revenue fall after its pass until deeper spending sinks were added.

### Cited Findings
- Most mobile battle passes are priced $5-15 for the basic tier, run one month, and offer rewards worth 10-20x the price (equivalent to about 90% off as a direct offer). — [Deconstructor of Fun, Jun 2022](https://www.deconstructoroffun.com/blog/2022/6/4/battle-passes-analysis)
- Same article: most pass revenue comes from the upfront purchase; tier skips contribute "very little"; passes drive strong conversion but have limited ARPPU potential (qualitative, no rates given). — [Deconstructor of Fun, Jun 2022](https://www.deconstructoroffun.com/blog/2022/6/4/battle-passes-analysis)
- Same article: Clash Royale's revenue per day trended down after its pass launched and recovered only after spending-depth additions; Clash of Clans' revenue per day trended up after its Gold Pass (Sensor Tower charts, no values in text). — [Deconstructor of Fun, Jun 2022](https://www.deconstructoroffun.com/blog/2022/6/4/battle-passes-analysis)
- Deconstructor of Fun's earlier analysis argues the Clash Royale pass was not a revenue driver because collection depth caps out quickly, so the pass substituted for other spend. — [Deconstructor of Fun, Jul 2020](https://www.deconstructoroffun.com/blog/2020/7/16/8jsjtv3v25nfmw9x177ampscr836m0)
- Google Play guidance (about 2020-2021 data): 1-40% of revenue is driven by premium battle pass purchases, with the spread depending on how the pass is integrated. — [Google Play Apps & Games](https://goo.gle/3htI67y)
- GameRefinery (June 2022 snapshot): battle passes are present in about 60% of the top 20% grossing mobile games; this is prevalence, not revenue share. Gacha was in about three-quarters of top-grossing US games and 93% in Japan. — [PocketGamer.biz, Jun 2022](https://www.pocketgamer.biz/news/78958/gamerefinery-battle-pass-implementation-in-top-grossing-mobile-games/)
- Low-authority, unsourced: 8-20% of active players buy a pass. — [MWM glossary](https://mwm.ai/glossary/battle-pass)
- Low-authority and flagged unreliable: 18.4% of MAU buy a pass and 38.5% of buyers finish all tiers, attributed to Sensor Tower / GameAnalytics but not traceable, on a page with internally inconsistent tables. Do not use without the originals. — [Voxbooster, 2026](https://voxbooster.com/blog/battle-pass-statistics-2026/)
- Context on the top of the market: Supercell revenue fell 4% to EUR 2.65bn in 2025, with Clash Royale growth offsetting a Brawl Stars decline. — [PocketGamer.biz, 2026](https://www.pocketgamer.biz/supercell-revenue-declines-4-to-265bn-in-2025/)

### Inferences
- The requester's assumed $4.99-$9.99 band sits at the low end of the $5-15 range cited for mobile passes; it is consistent with casual positioning.
- Because no verified pass take-rate exists, the model should derive pass buyers from payer conversion (section 2) rather than from "X% of actives buy a pass". Treating the pass as the main first purchase, pass buyers per monthly cohort are plausibly bounded by the 1-5% 30-day payer range; the unsourced 8-20%-of-actives claim should be used only as an explicit upside sensitivity, and likely refers to engaged DAU in mature mid-core titles, not installs.
- With paid packs off and collection depth finite, Pixel Pitch resembles the Clash Royale case: the pass converts but ARPPU is capped at about pass price x passes held plus occasional gems. Gems IAP is the only uncapped line, so whale revenue should be assumed small in low/base cases.

### Gaps
- No primary, dated figure for the share of DAU/MAU or of payers who buy a season pass in casual, sports or card games.
- No 2025-2026 figure for passes' share of IAP revenue (the 1-40% Google range is roughly five years old).
- No quantified comparison of pass-only / "fair" monetisation against gacha/loot-box revenue per user was found; evidence is qualitative and case-based.
- Loot-box removal revenue effects (e.g. Brawl Stars removing boxes in 2022) were searched for but no quantified source surfaced.

## 4. Retention benchmarks, player lifetime and LTV

### Takeaway
The median mobile game keeps about 22% of players at D1, under 4% at D7 and about 0.7-0.8% at D30 (GameAnalytics, 16,262 games, 2025 data); top quartile is about 30% / 6-7% / 1.6-1.8%. Paid-UA cohorts in sports are much stronger (US iOS D1 33.5%, D7 13.7%; UK Android 30.2% / 11.9%, AppsFlyer Q3 2026), so the right benchmark depends on whether Pixel Pitch looks like the median indie or a marketed tier-1 title.

### Cited Findings
- GameAnalytics 2026 benchmarks (16,262 mobile games with 1,000+ MAU, 2025 data, all genres aggregated; via summary): D1 top 25% just above 30%, top 10% about 40%, top 1% 64-68%; D7 median just under 4%, top 25% 6-7%, top 10% 11-12%, top 1% 25%+; D30 median 0.69-0.79%, top 25% 1.6-1.8%, top 1% 13-15%. — [GameDev Reports summary of GameAnalytics 2026](https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game)
- Median D1 about 22% and D7 3.4-3.9% (GameAnalytics); top quartile D1 25-27% on Android and 31-33% on iOS, D7 7-8% (GameAnalytics 2025 edition). — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- Same GameAnalytics 2026 dataset, engagement: session length top 25% about 5.2 min, top 10% about 8 min; sessions per day top 25% 5.3-5.7, top 10% about 9.6; daily playtime top 25% 22-24 min, top 10% 40-42 min. — [GameDev Reports summary of GameAnalytics 2026](https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game)
- GameAnalytics reports baseline D1/D7/D30 continued to decline through 2025 and the gap between average and top games widened; it uses classic (not rolling) retention. — [Mixpanel/GameAnalytics benchmarks 2026](https://mixpanel.com/blog/mobile-gaming-benchmarks-2026/); [Gamigion on methodology](https://www.gamigion.com/mobile-gaming-benchmarks-2025/)
- AppsFlyer Q3 2026, paid-media cohorts, iOS / Android: Sports US D1 33.50% / 26.33%, D7 13.67% / 9.77%; Sports UK Android D1 30.15%, D7 11.89%; Simulation US D1 31.95% / 23.19%, D7 9.87% / 5.91%, UK D1 31.71% / 24.73%, D7 9.68% / 6.36%; Puzzle US D1 34.08% / 29.20%, D7 14.06% / 11.12%; Hypercasual US D1 28.22% / 22.67%, D7 6.51% / 5.02%. D30 not reported. — [AppsFlyer gaming benchmarks Q3 2026](https://www.appsflyer.com/?p=549948)
- Adjust Gaming App Insights 2026 (2025 data, paid-acquisition sample): all-genre D1 of 27%. — [Game Growth Advisor citing Adjust](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- Older (AppsFlyer Q3 2022/Q3 2023): casual and puzzle on Android D1 28-32%, D7 9-12%, D30 3.5-5%. — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- Appodeal's 2025 casual report (US Android) says retention is strongest in Sports, Racing and Tabletop categories (no figures in the coverage). — [App Developer Magazine, May 2025](https://appdevelopermagazine.com/Mobile-Casual-Benchmarks-Report-2025/)
- Sensor Tower: D7 retention for the top 25 casual games has been declining since early 2022. — [GameDev Reports summary of Sensor Tower](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026)
- LTV rules of thumb (practitioner convention, not measured): CPI should be 30-70% of projected LTV; 3:1 LTV:CPI as a conservative target. — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)

### Inferences
- The two datasets differ by roughly 3x at D7 (GameAnalytics median under 4% vs AppsFlyer sports 10-14%) because GameAnalytics covers the whole long tail of 1,000+ MAU games while AppsFlyer covers marketed titles from publishers running paid UA. A sensible scenario mapping: low = GameAnalytics median (22% / 4% / 0.8%), base = GameAnalytics top quartile (30% / 6.5% / 1.7%), high = AppsFlyer sports paid cohort (about 30-33% D1, 10-13% D7, with D30 perhaps 4-6% by extrapolation from the older casual D30 of 3.5-5%).
- A 28-day pass depends on D30 retention: at the median 0.7-0.8% D30, almost no one is present to buy a second season, so season-two renewals only matter in base/high cases.
- Mid-ground LTV proxy per install in tier-1 for a casual game is the AppsFlyer D90 ARPU (about $1.34 IAP, about $1.89 with ads); no longer-horizon LTV by genre was found.

### Gaps
- No public 2025-2026 retention by genre from GameAnalytics (the public summary is aggregated across genres); no idle- or card-specific retention found.
- No D30 by genre from AppsFlyer Q3 2026.
- No sourced "typical player lifetime" (days) or LTV by genre for sports/idle/card in 2025-2026.

## 5. Ad eCPMs, impressions per DAU and the IAP/ads split

### Takeaway
US rewarded video eCPM is roughly $13-30 depending on source and period (Appodeal Q4 2024: about $17 iOS / $13 Android; Tenjin: $24 iOS / $30 Android), Europe about $9 iOS / $5 Android, and no UK-specific eCPM is published; tier-1 interstitials run about $5-13. Impressions per DAU has not been measured publicly (3-5 rewarded/day is a design convention), but Appodeal reports about 73 rewarded videos per user over lifetime for idle games in the US.

### Cited Findings
- Appodeal (vendor, Oct-Dec 2024, 100,000+ apps; approximate values read from charts), rewarded iOS / Android: North America about $13.6 / $9.0; Europe about $8.9 / $5.1; APAC about $7.5 / $8.2; Middle East about $8.4 / $2.4; LATAM about $3.4 / $1.8. Interstitial iOS / Android: North America about $10.4 / $9.6; Europe about $5.3 / $3.6. — [Playio eCPM review, Sep 2026](https://blog.playio.co/mobile-game-ecpm-benchmarks-2026)
- Appodeal US, Oct-Dec 2024: rewarded about $17.3 iOS / $13.2 Android; interstitial about $13.1 iOS / $12.3 Android. — [Playio eCPM review, Sep 2026](https://blog.playio.co/mobile-game-ecpm-benchmarks-2026)
- Widely repeated US rewarded figures of $19.63 iOS / $16.49 Android come from Appodeal's Q4 2024 report (2024 baseline, not 2026). — [Playio rewarded benchmarks, May 2026](https://blog.playio.co/rewarded-ad-benchmarks-2026); [Appodeal Q4 2024 eCPM report](https://appodeal.com/the-mobile-ecpm-report-updated-q4-2024-view)
- Tenjin x CAS (game apps excl. kids): US rewarded $24.39 iOS / $30.25 Android; US interstitial $23.17 iOS / $16.15 Android; US banner $0.99 / $1.18. Period conflict: the fetched article labels this Q2 2024, while a search summary of the same page described it as Q2 2026; treat the date as unverified. — [Playio eCPM review, Sep 2026](https://blog.playio.co/mobile-game-ecpm-benchmarks-2026)
- Playwire (vendor, 2025, method undisclosed): rewarded video tier-1 $15-30, global $8-18; interstitial tier-1 $5-8, global $2.5-5; banner tier-1 $0.5-1.5, global $0.2-0.8. — [Playio eCPM review, Sep 2026](https://blog.playio.co/mobile-game-ecpm-benchmarks-2026)
- TopOn (vendor, H1 2025), casual Android rewarded eCPM: EU + North America $8.90; Japan/Korea $6.87; LATAM $2.18; Southeast Asia $1.64; India $0.10. Global casual Android rewarded eCPM fell from $3.60 (H1 2023) to $3.02 (H1 2025). — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- Seasonality: US iOS rewarded about $18 in Dec 2025, falling to $11-12.50 by mid-Jan 2026 (practitioner Felix Braberg, undisclosed dataset). — [Playio eCPM review, Sep 2026](https://blog.playio.co/mobile-game-ecpm-benchmarks-2026)
- UK direction only (Bidlogic, vendor): UK Android rewarded eCPM +23.29% Q3 to Q4 2025; UK iOS interstitial about -14% over the same period; iOS up 8%+ in all formats Q1 to Q2 2026 across US/UK/DE/IN/JP. No UK levels published. — [Playio eCPM review, Sep 2026](https://blog.playio.co/mobile-game-ecpm-benchmarks-2026)
- Impressions per DAU: the "3 to 5 rewarded per day" figure is a design recommendation that nobody has published measurements for. — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- Appodeal Casual Benchmarks 2025 (US Android, Jun 2024-Jan 2025), ad units per user (lifetime; denominator not clearly defined): Idle 73.2 rewarded videos; Merge-3 101.5 rewarded; Match 39.1 rewarded + 36.5 interstitials + 114.3 banners; Puzzle 23.4 rewarded + 72.5 interstitials + 241.5 banners. — [App Developer Magazine, May 2025](https://appdevelopermagazine.com/Mobile-Casual-Benchmarks-Report-2025/)
- Revenue mix: hybrid casual earns 40-60% from IAP (undated); Sensor Tower's hybrid-casual breakdown puts Sports & Racing at about 71% IAP / 29% ads (via secondary analysis). — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/); [Global Games Forum on Sensor Tower 2026](https://www.globalgamesforum.com/news/state-of-gaming-heres-what-the-mobile-data-actually-says)
- AppsFlyer 2026: in mixed-model games ads fell from 63% to 56% of revenue (Jan 2025 to early 2026), IAP about 35%, subscriptions rose from 4% to 7%; midcore about 90% IAP. — [GameDev Reports summary of AppsFlyer](https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026)
- Sensor Tower 2026: rewarded ads were 17.7% of ad impressions, up 53.9% year on year. — [GameDev Reports summary of Sensor Tower](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026)
- Vendor marketing claims (treat with caution; selection effects): ARPDAU rises 30-66% after adding rewarded ads; rewarded-ad engagers are 4x more likely to make an IAP (Unity via MAF); completion rate above 95%. — [Playio rewarded benchmarks, May 2026](https://blog.playio.co/rewarded-ad-benchmarks-2026)
- Counterpoint: AppsFlyer warns ads can cannibalise IAP, especially rewarded ads. — [AppsFlyer State of App Monetization](https://www.appsflyer.com/resources/reports/app-marketing-monetization-report-2024/)

### Inferences
- No UK eCPM exists publicly; a UK rewarded planning range of about $8-15 iOS and $5-10 Android (between Appodeal's Europe and North America values) is an assumption, not a benchmark.
- Illustrative rewarded ad ARPDAU = impressions per DAU x eCPM / 1,000. At 1 / 3 / 5 rewarded views per DAU (averaged over all DAU, including non-watchers) and a blended tier-1 eCPM of $10, that is $0.01 / $0.03 / $0.05; these line up with the "ads-only casual $0.01-0.05" ARPDAU range in section 1.
- Lifetime cross-check for idle: 73.2 rewarded views per user x about $13.2 US Android eCPM is about $0.97 ad revenue per US install; at a European-style $5 eCPM it is about $0.37. This is the same order as AppsFlyer's casual D90 ad ARPU of $0.55.
- Adding rewarded video could plausibly add 30-40% on top of IAP revenue in tier-1 for a casual/idle title (ratio of AppsFlyer casual ad ARPU $0.55 to IAP ARPU $1.34 is about 0.41; Sports & Racing hybrid split 29% ads implies a ratio of about 0.41 as well).
- January eCPMs are 30-40% below December; a monthly model should not apply a flat annual eCPM.

### Gaps
- No published UK-level eCPM by format for 2025-2026.
- No measured rewarded or interstitial impressions per DAU (only lifetime ad units per user from one vendor, US Android only).
- No rewarded opt-in rate (share of DAU who watch at least one) from a dated primary source.
- The Tenjin figures' period is ambiguous (2024 vs 2026).

## 6. Total consumer spend: global, US, UK, sports; spend per paying gamer

### Takeaway
Global mobile game IAP was about $81.75B in 2025 (+1.3%) and fell 2% year on year to $40B in H1 2026, so the market is flat to slightly down; UK mobile game spend was about GBP 2.07bn in 2025 per Ukie (a conflicting GBP 1.88bn figure also exists). No 2025-2026 sports-genre IAP total or dated per-payer monthly spend for the UK or US was found.

### Cited Findings
- Sensor Tower State of Gaming 2026: mobile game IAP $81.75B in 2025 (+1.3% YoY, likely negative in real terms); downloads 50.41B (-7.2%); App Store $52.5B (+0.6%), Google Play $30B (+2.8%); Google Play 81% of installs vs App Store 15%. — [GameDev Reports summary of Sensor Tower](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026); [Sensor Tower press release](https://sensortower.com/press/press-release-sensor-tower-state-of-gaming-gaming-drove-52-billion-downloads-82b-iap-revenue-on-mobile-and-12b-premium-revenue-on-steam)
- H1 2026: worldwide mobile game IAP fell 2% YoY to $40B while gaming digital ad spend rose 8% to $7B. — [PocketGamer.biz on Sensor Tower H1 2026](https://www.pocketgamer.biz/mobile-gaming-iap-dipped-2-as-ad-spend-climbed-in-h1-2026/); [Sensor Tower H1 2026 index](https://sensortower.com/blog/h1-2026-digital-gaming-market-index)
- 2025 by region: Europe drove most mobile revenue gains; US IAP nearly flat; North American publishers' IAP -$1.78B YoY, Europe +$0.36B, Asia +$2.58B. Genres: strategy $20.2B, puzzle $14.4B; hybrid casual IAP +20% (only segment with meaningful IAP growth). — [GameDev Reports summary of Sensor Tower](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026)
- Non-game app IAP ($85.6B, +21%) overtook games ($81.8B) for the first time in 2025. — [GameDev Reports summary of Sensor Tower](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026)
- UK: Ukie values the 2025 UK games market at GBP 8.76bn (+7.4%); software GBP 6.03bn; mobile games GBP 2.07bn (+7.9%). — [GamesMarket.global, 2026](https://www.gamesmarket.global/uk-games-market-grew-by-7-4-to-8-76-billion-in-2025/); [PocketGamer.biz](https://www.pocketgamer.biz/uk-games-market-hit-record-8-8bn-in-2025/)
- UK, conflicting: a separate report puts UK games spending at GBP 5.4bn in 2025 with mobile +8.8% to GBP 1.88bn (different dataset/methodology, not reconciled). — [PocketGamer.biz](https://www.pocketgamer.biz/uk-games-spending-hits-54bn-in-2025-as-mobile-powers-strongest-growth-since-2020)
- UK 2024 (Ukie): GBP 7.6bn total, mobile games software +8.1% to GBP 1.7bn (search-snippet figure; it does not square exactly with 2025's GBP 2.07bn at +7.9%, so one of the two may be rounded or restated). — [PocketGamer.biz](https://www.pocketgamer.biz/report-uk-video-game-consumer-spending-hits-76bn/)
- Sports titles: EA Sports FC Mobile earned about $15M in August 2025, ahead of Golf Clash at about $8M; EA's FY25 mobile revenue was $1.1bn (15% of net revenue). — [PocketGamer.biz](https://www.pocketgamer.biz/the-state-of-eas-mobile-portfolio-following-its-55bn-acquisition); [PocketGamer.biz](https://www.pocketgamer.biz/mobile-accounts-for-15-of-eas-fy25-net-revenue-but-net-income-falls-12-yoy)
- Sports manager scale: Top Eleven averaged about $22K per week on US Android in Q1 2025 and about $29K in a peak week on iOS in Italy in Dec 2025 (Sensor Tower per-country snapshots). — [Sensor Tower](https://sensortower.com/blog/2025-q1-android-top-5-soccer%20games-revenue-us-60129cb7241bc16eb8b7b23c); [Sensor Tower](https://sensortower.com/blog/2025-q4-ios-top-5-sports-games-revenue-it-6058d8b0241bc16eb8555111)
- Football IP: Sensor Tower names FIFPro among the top mobile IPs by revenue. — [Global Games Forum on Sensor Tower 2026](https://www.globalgamesforum.com/news/state-of-gaming-heres-what-the-mobile-data-actually-says)
- Spend per player, old: Deloitte UK Mobile Consumer Survey 2019: UK mobile gamers spent about GBP 3.59/month (GBP 43.08/year) on in-app purchases; only 6% spent more than GBP 10/month. Seven years old. — [Deloitte UK](https://www2.deloitte.com/uk/en/pages/press-releases/articles/mobile-gamers-spending-more-than-40-pounds-a-year-on-in-app-purchases.html)
- Spend per player, all platforms: Newzoo 2026 forecast annual ARPPU $129.6 with 44.6% of players paying (global, all platforms). — [Playio citing Newzoo](https://blog.playio.co/arppu-mobile-games)
- Unverified survey (sponsor and method not confirmed): average UK gamer spends about GBP 105 a year on in-game purchases, with mobile gamers at about GBP 62 a year. — [Attest, 2025-2026](https://www.askattest.com/blog/research/gaming-consumer-insights-2025)

### Inferences
- GBP 2.07bn a year is about GBP 172m a month of UK mobile game spend; any indie football title is competing for a vanishing fraction of this, with EA FC Mobile (about $15M/month globally) as the category ceiling and Top Eleven's five-figure weekly per-country revenue as a more realistic "successful manager game" comparator.
- The market backdrop for 2026-2027 forecasts should be flat: IAP -2% in H1 2026, downloads falling about 7% a year, growth concentrated in strategy/puzzle and hybrid casual.
- A hybrid-casual, pass-led football game sits in the one casual segment showing IAP growth (+20% in 2025).

### Gaps
- No 2025-2026 total for sports-genre (or football/sports-manager sub-genre) mobile IAP found in public summaries.
- No US mobile game IAP dollar total for 2025 in the sources read (only "nearly flat").
- No dated (2025-2026) average spend per paying mobile gamer per month for the UK or US; Ofcom and Ukie primary reports were not opened and the search returned none.
- Ukie's primary valuation page was not read directly; UK figures are from trade-press coverage.

## 7. CPI and organic share

### Takeaway
AppsFlyer's Q3 2026 CPI for sports is $7.27 iOS / $3.71 Android in the US and $2.87 on UK Android (no UK iOS value); simulation is $4.23 / $2.50 in the US and $2.78 / $2.45 in the UK. Paid UA is increasingly dominant (median paid-to-organic install ratio rose from 2.07 to 3.33 in 2025), and no measured organic-share benchmark for indie games exists.

### Cited Findings
- AppsFlyer Q3 2026 CPI (USD), iOS / Android. Sports: US 7.27 / 3.71; UK - / 2.87; Germany Android 3.13; Australia Android 3.08; Canada Android 2.49; France Android 1.75; Brazil Android 0.17. Simulation: US 4.23 / 2.50; UK 2.78 / 2.45. Puzzle: US 9.48 / 4.81; UK 4.71 / 3.45. Hypercasual: US 1.96 / 1.55; UK 1.14 / 1.03. Match: US 21.63 / 10.71; UK 13.54 / 8.18. Strategy: US 18.45 / 11.17. — [AppsFlyer gaming benchmarks Q3 2026](https://www.appsflyer.com/?p=549948)
- Sports took 11.70% of total gaming UA spend in Q3 2026. — [AppsFlyer gaming benchmarks Q3 2026](https://www.appsflyer.com/?p=549948)
- Adjust Gaming App Insights 2026 (2025 data): global average gaming CPI $0.56 (+30% YoY), CPM $4.34 (+20%); by genre, slots $4.47, idle RPG $3.19, strategy $1.03. — [Game Growth Advisor citing Adjust](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/); [GameDev Reports summary of Adjust](https://gamedevreports.substack.com/p/adjust-gaming-app-insights-report)
- Undated ranges for casual/puzzle on Android: US $1.50-3.50; UK/Canada/Australia $1.00-2.50; Western Europe $0.60-1.50; iOS typically 3-4x Android (author's guidance). — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- Adjust 2026: median paid-to-organic install ratio rose 61%, from 2.07 to 3.33, in 2025. — [Game Growth Advisor citing Adjust](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- An organic multiplier of 1.5-2x (total installs per paid install) is a practitioner convention with no measured data behind it; K-factor above 1.0 is rare. — [Game Growth Advisor, Mar 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/)
- AppsFlyer 2026: paid installs generate 59% of gaming IAP revenue; paid share of total revenue is 61% for casual, 79% hypercasual, 49% midcore. — [GameDev Reports summary of AppsFlyer](https://gamedevreports.substack.com/p/appsflyer-app-monetization-in-2026)
- Sensor Tower 2026: paid downloads are 50.6% of hypercasual downloads and 28.8% of midcore. — [GameDev Reports summary of Sensor Tower](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026)
- Discovery context: of about 190,000 mobile games released in 2025, only about 2,500 passed 500,000 downloads. — [PocketGamer.biz](https://www.pocketgamer.biz/report-only-2500-of-190000-mobile-games-released-in-2025-surpassed-500000-downloads/)
- Liftoff (vendor, 2024 data): casual D30 ROAS 47% iOS, 15% Android. — [Playio citing Liftoff](https://blog.playio.co/arppu-mobile-games)

### Inferences
- Paid UA does not pay back on these benchmarks for a pass-led casual game: UK Android sports CPI of $2.87 against a casual D90 IAP ARPU of about $1.34 (about $1.89 with ads) gives a D90 return of roughly 45-65%, and US iOS at $7.27 is worse unless iOS ARPU is several times the blended figure. The revenue model should treat installs as predominantly organic/featuring/community-driven, with paid UA as a test line only.
- A paid-to-organic ratio of 3.33 implies about 23% of installs are organic at the median measured app; this is a sample of apps that buy installs, so it understates the organic share of an indie that spends nothing (near 100% organic, but on a small absolute base).
- UK iOS sports CPI is not published; applying the US iOS/Android ratio (about 2x) to the UK Android value suggests roughly $5-6, and the UK simulation iOS value ($2.78) is a lower cross-check. This is an estimate.
- With only about 1.3% of 2025 releases passing 500,000 downloads, low/base/high install scenarios for a solo developer should be set in the thousands to low hundreds of thousands per year, not millions.

### Gaps
- No UK iOS CPI for sports in AppsFlyer Q3 2026; no "casual" or "idle" or "card" genre row (hypercasual, puzzle, simulation are the nearest).
- No measured organic install share for indie or solo-developer games.
- AppsFlyer and Adjust figures are for apps running paid campaigns on their platforms (vendor data); methodology for the AppsFlyer table was not verified beyond the page.
