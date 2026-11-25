# Billing rules and the Capacitor approach for Pixel Pitch (state of play: 25 November 2026)

Reader notes:
- Rules changed a lot between December 2025 and October 2026. Several figures below come from press coverage of primary pages that I could only partly read; each is marked.
- "Background knowledge, not re-verified" means I believe it to be true from before this session but did not confirm it against a live source. Those items sit under Gaps, as instructed.
- Short answer to the developer's question: yes, in-app sales of gems and a season pass still go through Apple's and Google's billing by default (which is what RevenueCat wraps). What is new is that a web shop is now a legitimate second channel, and how loudly the app may point to it depends on platform and country.

## 1. Apple App Store rules for digital goods: is Apple IAP still mandatory? (US, EU, UK, Japan)

### Takeaway
Apple IAP is still the default requirement for gems and passes everywhere, and on the UK storefront the app still may not link or point to outside payment. The US storefront allows external purchase links with no Apple commission for now (under appeal at the Supreme Court), the EU has had a new single fee schedule since 1 October 2026, and Japan has had its own since December 2025.

### Cited Findings
- Global rule (guideline 3.1.1): "If you want to unlock features or functionality within your app, (by way of example: subscriptions, in-game currencies, game levels, access to premium content, or unlocking a full version), you must use in-app purchase." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- US exception and rule everywhere else (3.1.1(a)): link entitlements "are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps", and "In all other storefronts, except for the United States storefront ... apps and their metadata may not include buttons, external links, or other calls to action that direct customers to purchasing mechanisms other than in-app purchase." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Outside the app, anywhere: "Developers can send communications outside of the app to their user base about purchasing methods other than in-app purchase." (3.1.3) — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- US, April 2025: Judge Gonzalez Rogers found Apple in wilful violation of the Epic injunction and barred any commission on external links. US, December 2025: the Ninth Circuit upheld the contempt finding but said a total ban on commission went too far, and sent the case back to the district court to set a rate. — [The Next Web](https://thenextweb.com/news/supreme-court-apple-epic-contempt-app-store-commission); [MacRumors, 11 Dec 2025](https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/)
- The Ninth Circuit standard: Apple may charge a commission "based on the costs that are genuinely and reasonably necessary for its coordination of external links for linked-out purchases", and no more. — [Ninth Circuit opinion via Daring Fireball](https://daringfireball.net/linked/2026/05/22/ninth-circuit-epic-v-apple)
- US, 29 April 2026: the Ninth Circuit reversed its 6 April 2026 stay of the mandate, on Epic's motion. — [MacRumors](https://macrumors.com/2026/04/29/epic-games-wins-reversal-app-store-fee-battle/)
- US, 30 June 2026: the Supreme Court agreed to hear Apple's appeal of the contempt finding (No. 25-1311), but not its challenge to the scope of the injunction. Argument falls in the term starting October 2026, with a ruling expected by June 2027. At the time of that report Apple had collected no commission on US external-link payments for nearly a year, and the Supreme Court had declined in May 2026 to pause the contempt order. — [The Next Web, 30 Jun 2026](https://thenextweb.com/news/supreme-court-apple-epic-contempt-app-store-commission); docket at [supremecourt.gov](https://www.supremecourt.gov/docket/docketfiles/html/public/25-1311.html)
- EU, announced 18 August 2026, effective 1 October 2026 (one set of terms for all EU developers):

| Channel (EU) | Standard | Small Business Program and similar |
|---|---|---|
| Apple In-App Purchase | 26% | 15% (also subscriptions after year one) |
| Alternative payment processing inside an App Store app | 20% | 10% |
| Link-out purchases | 15% | 10% |
| Apps distributed outside the App Store | 5% Core Technology Commission | 5% |

  The per-install Core Technology Fee, the initial acquisition fee and the store services fee are abolished. Developers pick their payment options and must keep them for 12 months. — [Apple Newsroom, Aug 2026](https://apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union)
- EU child protections in the same terms: Kids-category apps cannot link to websites for transactions, apps using alternative payments or link-outs need a parental gate for under-18s, and apps cannot link out for under-13s. — [Apple Newsroom, Aug 2026](https://apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union)
- EU context: the Commission fined Apple EUR 500 million in 2025 over anti-steering rules, welcomed the August 2026 changes and said it would monitor implementation. — [The Next Web, 18 Aug 2026](https://thenextweb.com/news/apple-eu-app-store-fees-dma-core-technology-commission)
- UK, 22 October 2025: the CMA designated Apple and Google with strategic market status for mobile platforms, for five years. — [CMA programme of work](https://www.gov.uk/guidance/the-cmas-programme-of-work-across-mobile-platforms)
- UK, February to 1 April 2026: the CMA accepted voluntary commitments from both firms on app review fairness and interoperability. These do not touch commission rates. — [CMA programme of work](https://www.gov.uk/guidance/the-cmas-programme-of-work-across-mobile-platforms); [TechRepublic](https://www.techrepublic.com/fr/article/news-uk-apple-google-app-store-reforms-cma/)
- UK, 30 June 2026: the CMA consulted on steering conduct requirements that would remove restrictions stopping UK developers steering customers off-platform to pay. Responses closed 28 July 2026 and were published 14 August 2026. The CMA said a decision would come "later this year". I found no final decision as of 25 November 2026. — [CMA press release](https://www.gov.uk/government/news/cma-consults-on-new-requirements-for-apple-and-googles-mobile-platforms); [CMA programme of work](https://www.gov.uk/guidance/the-cmas-programme-of-work-across-mobile-platforms)
- UK fee expectation: the CMA "would expect steering fees to be lower than current app store charges". The Coalition for App Fairness argues the fee should be zero; the US Chamber of Commerce opposes the requirements. — [CMA press release](https://www.gov.uk/government/news/cma-consults-on-new-requirements-for-apple-and-googles-mobile-platforms); [CAF response](https://assets.publishing.service.gov.uk/media/6a7ebda53bd75b81e23299a8/Coalition_for_App_Fairness.pdf); [US Chamber response](https://assets.publishing.service.gov.uk/media/6a7ec3580ad4bc475be7de4c/US_Chamber_of_Commerce.pdf)
- Japan, announced 17 December 2025 under the Mobile Software Competition Act: 15% commission on purchases made on a website linked from an App Store app, 5% on digital sales in apps distributed outside the App Store, and alternative payment options must always be shown alongside Apple IAP. Kids-category apps cannot link out for transactions. — [Apple Newsroom, Dec 2025](https://www.apple.com/newsroom/2025/12/apple-announces-changes-to-ios-in-japan/)

### Inferences
- For a UK developer selling worldwide, the practical iOS position in November 2026 is: IAP in the app everywhere; an external-purchase button is allowed commission-free on the US storefront only; on the UK storefront no in-app pointer to a web shop is allowed until the CMA imposes a steering requirement and Apple implements it.
- The US zero-commission position is temporary by construction. Two things can end it: the district court setting a cost-based rate on remand, or the Supreme Court ruling (expected by June 2027). Do not build a business model that depends on 0%.
- In the EU a Small Business Program member pays 15% on IAP against 10% on a link-out, before paying a payment processor. The saving from link-outs is therefore a few points at most at Pixel Pitch's scale, and the 12-month lock-in applies.

### Gaps
- Whether the district court has set a link-out commission rate on remand: not found.
- A MacRumors headline of 12 August 2026 says the Supreme Court let Apple "delay App Store fee fight for 24 hours". I did not read it and do not know what it paused or whether anything followed.
- Full Japan schedule. Search fragments mention a 10% App Store rate "for the vast majority of developers, including members of the Small Business Program", a 21% figure and a 5% payment-processing fee, but I could not read the surrounding text, so do not quote those three.
- Whether Apple has made any UK-specific fee or link-out change in 2026: none found. The guideline text read in this session still treats the UK like every other non-US storefront.
- The guidelines page showed no last-updated date, and I read only the first 100,000 of about 114,000 characters.
- Whether the CMA's April 2026 call for views on "recent changes to Apple's and Google's app store rules, including in the UK" covered an Apple UK change: not read.

## 2. Google Play billing rules after Epic v. Google

### Takeaway
Google restructured its fees on 30 June 2026 in the US, UK and EEA. Play Billing is no longer mandatory there, steering to the web is allowed, and a small developer pays 10% service fee plus 5% if they use Play Billing. The rest of the world stays on the old 15%/30% schedule until a rollout due by September 2027.

### Cited Findings
- US, 12 September 2025: the Ninth Circuit upheld the Epic injunction. From 29 October 2025, for US users, developers may communicate about pricing outside Play, link to outside downloads and transactions, and Google will not require Play Billing. Programmes for this launched 9 December 2025. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/15582165?hl=en)
- 4 March 2026: Google and Epic settled and asked the court to enter a revised injunction. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/15582165?hl=en); [TechCrunch](https://techcrunch.com/2026/03/04/google-settles-with-epic-games-drops-its-play-store-commissions-to-20)
- New fee model, effective 30 June 2026 in the US, UK and EEA: service fee of 10% on a developer's first $1M of annual earnings whether the sale uses Play Billing, alternative billing or external web links; 10% on all auto-renewing subscriptions; a separate 5% billing fee only when Play Billing is used. — [Android Developers Blog, June 2026](https://developer.android.com/blog/posts/expanded-billing-choice-and-lower-fees-on-google-play?hl=en)
- Above $1M, per Google's fee help page: other transactions are 20% (users who first installed on or after the regional date) or 25% (existing installs), plus the 5% billing fee if Play Billing is used; external web links are 20%. Games Level Up / Apps Experience participants pay 15% or 20% plus the billing fee. — [Google Play Console Help, service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- Rollout: Australia and Japan from 30 September 2026 per Google's help page; press reported Australia, Japan and South Korea by end of 2026 and the rest of the world by September 2027. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en); [MacRumors, 24 Jun 2026](https://macrumors.com/2026/06/24/google-play-store-fee-change/)
- All other markets, until the rollout: 15% on the first $1M of annual revenue, 30% above, 15% on subscriptions. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- What developers in the UK, EEA and US may now do: offer other payment options, use a billing system of their choice, and link users to websites to buy. — [MacRumors, 24 Jun 2026](https://macrumors.com/2026/06/24/google-play-store-fee-change/); UK confirmed by the [CMA press release](https://www.gov.uk/government/news/cma-consults-on-new-requirements-for-apple-and-googles-mobile-platforms), which says the June terms allow steering "subject to certain restrictions"
- US reporting: developers enrolled in external content links and alternative billing must report transactions and pay service fees from 1 October 2026; a 21 October 2026 notice gives external-links developers until 1 February 2027 to report downloads and pay. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/15582165?hl=en)
- Older alternative-billing schemes: in South Korea and India the fee is the Play fee minus 4%. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)

### Inferences
- On Android in the UK, Pixel Pitch pays the same 15% as before if it keeps Play Billing (10% + 5%), or 10% plus its own processor's fee if it uses alternative billing or a link-out. With a card processor at roughly 3%, the saving is about two points, in exchange for handling VAT, refunds and chargebacks itself.
- Google now charges a service fee on linked-out web purchases. Unlike Apple in the US today, sending an Android user from the app to a web shop is not commission-free.

### Gaps
- The help page table did not render cleanly, so the mapping of rates to the "first $1M" and "standard" tiers relies on the blog post and press. Confirm in Play Console before modelling.
- Whether the court has finally approved the March 2026 settlement: not confirmed.
- Enrolment steps and UX restrictions for the UK steering programme: not read.
- Whether "User Choice Billing" survives as a named programme or was folded into "Billing Choice": not confirmed.

## 3. Commission rates, RevenueCat cost, VAT and a £4.99 worked example

### Takeaway
At Pixel Pitch's scale the store take is about 15% of the VAT-exclusive price on both platforms in the UK, and RevenueCat is free under $2,500 a month of tracked revenue, then 1%. A £4.99 purchase nets roughly £3.50.

### Cited Findings
- RevenueCat: free below $2.5K monthly tracked revenue (MTR); "Once you reach $2.5K MTR, you'll be charged 1%". MTR is measured in USD before the platform cut. — [RevenueCat pricing](https://www.revenuecat.com/pricing/)
- Google UK from 30 June 2026: 10% + 5% billing fee on the first $1M. — [Android Developers Blog](https://developer.android.com/blog/posts/expanded-billing-choice-and-lower-fees-on-google-play?hl=en)
- Apple EU from 1 October 2026: 15% IAP for Small Business Program members. — [Apple Newsroom](https://apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union)
- UK VAT ordering on Apple: a developer's worked example deducts 20% VAT from a £5.00 price first (leaving £4.17), then applies Apple's commission to the net. This is a forum post, not an Apple document. — [Apple Developer Forums](https://developer.apple.com/forums/thread/699667)

### Inferences
Worked example, £4.99 gem pack sold to a UK player, assuming commission is taken on the VAT-exclusive price on both stores (sourced for Apple only by the forum post above; unverified for Google):

| Step | Apple, Small Business Program (15%) | Apple, standard (30%) | Google UK, Play Billing (10% + 5%) |
|---|---|---|---|
| Price paid | £4.99 | £4.99 | £4.99 |
| UK VAT at 20% (£4.99 / 1.2 = £4.16 net) | £0.83 | £0.83 | £0.83 |
| Store fee on £4.16 | £0.62 | £1.25 | £0.62 |
| Developer proceeds | £3.53 | £2.91 | £3.53 |
| RevenueCat 1%, only in months above $2.5K MTR | about £0.04 to £0.05 | about £0.04 to £0.05 | about £0.04 to £0.05 |

- So about 71% of the sticker price reaches the developer at the small-developer rate, and about 58% at the standard rate.
- The RevenueCat pricing example ($25 at $2.5K) implies the 1% applies to all tracked revenue in a month above the threshold, not just the excess. The page does not say so outright.

### Gaps
- Apple Small Business Program terms for the UK storefront (15% under $1M of proceeds in the prior calendar year, enrolment required) and Apple's 30% standard rate outside the EU: background knowledge, not re-verified this session. Programme page: https://developer.apple.com/app-store/small-business-program/
- Whether the stores remit UK VAT on the developer's behalf: background knowledge is that both Apple and Google act as the seller of record or deemed supplier for UK consumer sales and remit VAT themselves. Not verified; one forum post found in search claimed Google does not handle VAT, which conflicts with my understanding. Confirm with an accountant.
- Whether RevenueCat's MTR counts VAT-inclusive prices: not stated on the pricing page.
- RevenueCat Web Billing fees: not on the pricing page.

## 4. Web purchases: selling on your own website and unlocking in the app

### Takeaway
A web shop that credits the player's account is allowed on both stores, provided the same items are also sold in the app through IAP on iOS. Where the app can advertise it differs: freely in the US on both platforms, on Android in the UK and EEA (with a Google fee), under Apple's new terms in the EU (with an Apple fee), and not at all inside the iOS app in the UK or the rest of the world.

### Cited Findings
- Apple permits cross-platform unlocks (3.1.3(b)): apps "may allow users to access content, subscriptions, or features they have acquired in your app on other platforms or your web site, including consumable items in multi-platform games, provided those items are also available as in-app purchases within the app." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple, in-app promotion: 3.1.3 apps "cannot, within the app, encourage users to use a purchasing method other than in-app purchase, except for apps on the United States storefront". Out-of-app communication (email, social, website) is allowed everywhere. — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Adoption: Bain estimates three-quarters of top-grossing mobile games now run their own web stores, up from 12% in 2019, and cites a GDC/Appcharge estimate that mobile direct-to-consumer revenue reached about $17 billion in the prior year, roughly 15% of mobile in-app purchase revenue. — [Bain Gaming Report 2026](https://www.bain.com/insights/game-distribution-half-your-players-already-buy-direct-gaming-report-2026/?linkId=1009147701)
- By genre: Sensor Tower (August 2026) says some games earn over 30% of revenue direct; casino leads web-shop share in the US in H1 2026 at about 30%, RPG is second, and strategy and especially puzzle have a low share. — [PocketGamer.biz](https://www.pocketgamer.biz/sensor-tower-reveals-the-hidden-impact-of-d2c-revenue-in-mobile-games/)
- Vendor figures: Xsolla reports overall mobile game revenue grew 0.2% in 2025 while US direct-to-consumer revenue grew 26%, and that some studios see as much as 70% of revenue through a web shop. Xsolla sells web shops, so treat this as an upper-bound marketing figure. — [Xsolla report](https://xsolla.com/blog/the-xsolla-report-vol-10-2026-d2c-is-reshaping-monetization); [Business Wire](https://secure.businesswire.com/news/home/20260928312597/en/Xsolla-Releases-The-Xsolla-Report-Mobile-D2C-Edition)

### Inferences
Where the app itself may point players at a web shop, November 2026:

| Market | iOS | Android |
|---|---|---|
| US | Allowed; no Apple commission for now (Supreme Court ruling due by June 2027) | Allowed; Google service fee applies on linked purchases |
| EU / EEA | Allowed under Apple's October 2026 terms; 15% (10% small business) | Allowed; 10% on first $1M |
| UK | Not allowed in-app; CMA decision pending | Allowed since 30 June 2026; 10% on first $1M |
| Japan | Allowed; 15% | New fee model from 30 September 2026 |
| Rest of world | Not allowed in-app | Old rules; in-app steering generally not allowed |

- Everywhere, the developer may email players, post on social media or run a website offer for the web shop, and a logged-in player's web purchase can appear in the app.
- Web-shop share is concentrated in genres with a small number of very high spenders. A casual card-collection game is closer to the low-share end. For a solo developer the realistic gain is a minority of revenue moving at a margin a few points better than the 15% store rate, against the work of being merchant of record (or paying Paddle/Xsolla 5% or more to be one).
- Pixel Pitch's existing design (server decides grants, idempotent actions, account-based ownership) is what a web shop needs: the purchase webhook credits the account server-side.

### Gaps
- Typical share of revenue moved by small or casual games specifically: no reliable source found.
- Current pricing for RevenueCat Web Billing, Paddle, Xsolla and Stripe: not researched this session.
- Google's exact rules on in-app steering in non-reformed markets: not read.

## 5. Loot-box and random-item rules for a pack-opening game

### Takeaway
Selling random packs for money or for bought currency is now the single biggest rating and compliance risk: since June 2026 it means PEGI 16 by default for new submissions, plus odds disclosure on both stores and exposure in Belgium and the Netherlands. Packs earned only through play appear to fall outside the "paid random items" definitions, though PEGI still rates daily-reward and time-limited-offer mechanics.

### Cited Findings
- Apple: "Apps offering 'loot boxes' or other mechanisms that provide randomized virtual items for purchase must disclose the odds of receiving each type of item to customers prior to purchase." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- PEGI, for titles submitted from June 2026: paid random items get PEGI 16 minimum. PEGI's definition is "in-game offers to purchase digital goods or premiums where players don't know exactly what they are getting"; examples include loot boxes, card packs, gacha and prize wheels, whether functional or cosmetic. — [Reed Smith](https://www.reedsmith.com/articles/pegi-launches-interactive-risk-categories-overhauls-age-ratings-for-loot-boxes-in-game-spending-and-communication-features/)
- The PEGI rule covers purchases with real money or virtual currency. — [TweakTown](https://www.tweaktown.com/news/114230/games-with-loot-boxes-now-automatically-rated-pegi-16-in-europe/index.html)
- Other new PEGI criteria: time-limited or quantity-limited purchase offers, PEGI 12 minimum; rewards for returning (daily quests, login streaks), PEGI 7 minimum with a new descriptor; mechanics that penalise not returning, PEGI 12 minimum; NFT or blockchain mechanics, PEGI 18; fully unrestricted communication with no blocking or reporting, PEGI 18. — [Reed Smith](https://www.reedsmith.com/articles/pegi-launches-interactive-risk-categories-overhauls-age-ratings-for-loot-boxes-in-game-spending-and-communication-features/); [Lewis Silkin](https://www.lewissilkin.com/insights/2026/03/18/pegi-announces-major-update-to-age-rating-criteria-what-games-businesses-need-to-102mn9y)
- Existing titles: "will not be re-rated" unless content updates warrant it. — [Reed Smith](https://www.reedsmith.com/articles/pegi-launches-interactive-risk-categories-overhauls-age-ratings-for-loot-boxes-in-game-spending-and-communication-features/); one lower-quality source claims PEGI began re-rating digital-only games in October 2026, which contradicts this — [tech-insider.org](https://tech-insider.org/pegi-loot-box-age-rating-2026/)
- UK: the government decided not to bring loot boxes under the Gambling Act and relies on industry-led protections (the Ukie principles), a position it says remains under review. In January 2026 it confirmed loot boxes are still not legally gambling. — [UK government response](https://gov.uk/government/consultations/loot-boxes-in-video-games-call-for-evidence/outcome/government-response-to-the-call-for-evidence-on-loot-boxes-in-video-games); [Lords debate, 15 Jan 2026](https://www.parallelparliament.co.uk/debate/2026-01-15/lords/lords-chamber/in-game-purchases-protections-for-children/ministerial-extracts)
- UK advertising: the ASA issued an enforcement notice requiring loot-box disclosure in mobile game ads and app store listings, with monitoring from 26 May 2026. — [Lewis Silkin](https://www.lewissilkin.com/insights/2026/02/27/new-tough-measures-brought-in-by-the-asa-on-advertising-loot-boxes-in-the-uk-102mknq)
- Belgium has classed paid loot boxes as games of chance since 2018; publishers have disabled the mechanic or not launched in Belgium and the Netherlands (PUBG, Diablo Immortal). — [GamesRadar](https://gamesradar.com/belgium-deems-loot-boxes-dangerous-to-children-and-society-threatens-publishers-with-prison-and-fines); [CMS](https://cms.law/en/bel/publication/loot-boxes-a-treasure-trove-of-gambling-regulatory-issues)
- EU: one trade source reports a draft Digital Fairness Act dated 12 November 2026 that would ban paid random rewards for minors and require probability disclosure. Single source, not adopted law. — [Focus Gaming News](https://focusgn.com/eu-digital-fairness-act-loot-boxes-gambling)

### Inferences
- Every definition found turns on purchase: Apple says "for purchase", PEGI says "offers to purchase". Packs granted only by playing, with no way to buy a pack or the currency that buys packs, sit outside both on their wording. No source confirmed this explicitly.
- The trap is indirect purchase. If gems are sold for money and gems buy random packs, that is a paid random item under PEGI (virtual currency is covered) and almost certainly under Apple's rule. To stay outside, packs must be buyable only with a currency that cannot be bought, or the paid route must show the exact contents before purchase.
- The season pass and daily login rewards still bring the lower-tier PEGI criteria into play (PEGI 7 for return rewards, PEGI 12 for time-limited offers or penalties for not returning). A football card game aimed at a broad audience should plan for PEGI 7 to 12 even with no paid random items.
- Store ratings for mobile come through the IARC questionnaire, which applies PEGI criteria in Europe, so the PEGI change reaches Google Play listings in the UK (inference; not confirmed this session).

### Gaps
- Google Play's odds-disclosure requirement: background knowledge is that Play's Payments policy requires odds to be disclosed before purchase for randomised items. Not re-verified. Policy page: https://support.google.com/googleplay/android-developer/answer/9858738
- Australia: background knowledge is that since 22 September 2024 games with paid loot boxes are classified at least M and simulated gambling R18+. Not re-verified.
- Netherlands: sources conflict on whether there is an outright ban or case-by-case restriction. Not resolved.
- Any PEGI mitigation that brings paid random items below 16: none found in the sources read.
- Text of the Ukie principles and their current compliance expectations: not read.
- Whether the UK government has published its commissioned research or next steps on loot boxes in 2026: not found.

## 6. Capacitor for a casual 2D game, compared with the alternatives

### Takeaway
Capacitor is a legitimate, officially supported route for store-shipped web-technology games and has first-party RevenueCat support, so the approach is sound for a UI-heavy card and idle game by a web developer. The evidence base is mostly vendor documentation and individual developer reports; I found no independent benchmark or list of commercial hits, so performance on low-end Android has to be proven on real devices.

### Cited Findings
- Capacitor publishes an official games guide stating that with broad WebGL and canvas support developers can build high-performance game experiences on modern mobile devices, and recommends starting from a game engine. — [Capacitor docs, Games](https://www.capacitorjs.com/docs/guides/games)
- Phaser, the main 2D web game engine, publishes its own Capacitor guide for iOS and Android. — [Phaser](https://phaser.io/tutorials/bring-your-phaser-game-to-ios-and-android-with-capacitor)
- RevenueCat ships an official Capacitor SDK, `@revenuecat/purchases-capacitor`, with iOS and Android setup. Version 15 will require Swift Package Manager on iOS. On Android the activity `launchMode` must be `standard` or `singleTop` or purchases can be cancelled. — [RevenueCat docs](https://www.revenuecat.com/docs/getting-started/installation/capacitor)
- Reported failure modes: a Phaser 3 + Capacitor Android build with white screens, texture failures and orientation problems; a developer working around an Android WebView canvas performance warning. Each is one developer's report. — [Phaser forum](https://phaser.discourse.group/t/phaser-3-capacitor-android-apk-white-screens-texture-rendering-failures-and-orientation-issues/15571); [DEV Community](https://dev.to/eonarheim/android-games-with-capacitor-and-javascript-fac)
- Device spread: one guide says recent flagships run WebGL games smoothly while budget devices may struggle with complex shaders or large canvases, and that emulators misrepresent WebView performance. Tutorial site, unverified. — [abratabia.com](https://www.abratabia.com/native-wrappers/capacitor-games.php)
- App Store guideline 4.2: "Your app should include features, content, and UI that elevate it beyond a repackaged website." — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Framework comparisons found were vendor blogs or opinion pieces. One summarises Capacitor as the route for teams with existing web code, with WebView and plugin limits as the main constraints; a vendor benchmark puts React Native at roughly 52 to 58 fps under load against 60 for Flutter. Low confidence. — [pkgpulse](https://www.pkgpulse.com/guides/best-mobile-frameworks-2026); [Forem](https://future.forem.com/del_rosario/ionic-capacitor-in-2026-is-web-first-viable-3c59)

### Inferences
- Guideline 4.2 targets thin wrappers around a website. A game with bundled assets, offline play, native purchases, push and haptics is not that, and web-technology games pass review routinely. The risk for Pixel Pitch is low provided the store build does not load its UI from a remote URL.
- Fit by option, for a solo web developer building a UI-heavy 2D casual game (my assessment from general knowledge, since the comparison sources were weak):

| Option | Speed for this developer | 2D performance | Purchases, ads, push | Main cost |
|---|---|---|---|---|
| Capacitor + React (current) | Fastest; one codebase also serves the web/PWA | Adequate for cards, menus and simple canvas; weakest on cheap Android | RevenueCat official; ads and push via plugins | WebView variance, audio latency, memory |
| React Native / Expo | Moderate; UI rewritten, React knowledge carries over | Better native UI; canvas games need Skia or similar | Strong | Loses the single web codebase |
| Flutter | Slow; new language | Strong and consistent | Strong | Full rewrite, weak web target |
| Unity / Godot | Slow; new engine | Best for action games | Unity strongest for ad mediation | Poor fit for form-heavy UI, large builds |
| Native (Swift + Kotlin) | Slowest; two codebases | Best | Best | Not realistic solo |

- The alternatives win on action-game performance and on advertising SDK coverage, neither of which is central to a card-collection and idle game. The case for switching would be measured frame drops or audio problems in the canvas mini-games on mid-range Android, not a general principle.
- The known WebView weak spots to test early are: sustained 60 fps canvas on a three-to-four-year-old budget Android phone, sound-effect latency (Web Audio rather than HTML audio elements), memory with large sprite sheets, and behaviour on older Android System WebView versions. If mini-games fall short, they can be simplified or frame-capped without abandoning the stack.

### Gaps
- Named, commercially successful store games built on Capacitor, Ionic or Cordova: none verified this session. Do not cite examples in the report without a source.
- AdMob and mediation support: background knowledge is that there is a community-maintained `@capacitor-community/admob` plugin and no first-party Google SDK for Capacitor, and that mediation coverage (AppLovin MAX, ironSource/Unity LevelPlay) is thinner than on Unity. Not verified this session.
- RevenueCat Capacitor SDK current version, supported Capacitor versions and whether it supports web: not stated on the page read.
- Quantified WebView performance, audio latency or memory figures on low-end Android: no reliable source found.
- Data on 4.2 rejection rates for Capacitor apps: none found.

## 7. Annual fees and account, rating and child-safety requirements

### Takeaway
The fixed costs are small, but two process hurdles matter for a solo developer: Google's 12-testers-for-14-days closed test on new personal accounts, and age rating and children's-code duties that get heavier if the game appeals to under-18s.

### Cited Findings
- Google Play: personal developer accounts created after 13 November 2023 must run a closed test with at least 12 testers opted in continuously for the preceding 14 days before applying for production access. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)
- Third-party sources add that organisation accounts are exempt and that the requirement applies per app. Not confirmed against Google's page. — [DEV Community](https://dev.to/theionproject/the-12-tester-rule-that-quietly-adds-two-weeks-to-your-first-google-play-launch-4bp3)
- A vendor guide states that from 31 August 2026 new apps and updates on Google Play must target API 36, and that apps with accounts need an in-app deletion path. Verify against Google's policy. — [Capgo](https://capgo.app/blog/how-to-put-a-web-app-on-the-app-store/)
- Apple's EU terms tie payment links to age: parental gate for under-18s, no link-outs for under-13s or in Kids-category apps. — [Apple Newsroom](https://apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union)
- PEGI's 2026 criteria link communication-feature ratings to UK Online Safety Act and EU DSA expectations: games accessible to minors should at least offer blocking, muting and reporting. — [Reed Smith](https://www.reedsmith.com/articles/pegi-launches-interactive-risk-categories-overhauls-age-ratings-for-loot-boxes-in-game-spending-and-communication-features/)

### Inferences
- Registering the Google account as an organisation (a UK limited company) appears to avoid the 12-tester requirement, at the cost of business verification. Worth confirming before creating the account.
- Do not place Pixel Pitch in Apple's Kids category: it blocks transaction links and brings stricter advertising and data rules.
- A pixel-art football game will plausibly be "likely to be accessed by children" under the UK Age Appropriate Design Code, which points to high-privacy defaults, minimal data collection and no nudging toward spending. If there is no chat or user-generated content, the Online Safety Act's user-to-user duties likely do not apply (my reading; not verified this session).

### Gaps
- Apple Developer Program at $99 a year (about £79) and Google Play's one-off $25 registration fee: background knowledge, not re-verified.
- Apple's 2025 age-rating overhaul (new 13+, 16+ and 18+ tiers replacing 12+ and 17+, with an updated questionnaire due by 31 January 2026): background knowledge; my search for it returned nothing, so it is unverified here.
- Google Play's current age-rating and families-policy requirements, and any 2026 age-assurance signals from either store: not researched.
- Authoritative text on Online Safety Act and Children's Code applicability to a single-player game with accounts: not read.
- Whether the Google organisation-account exemption is stated on Google's own page: not confirmed.
