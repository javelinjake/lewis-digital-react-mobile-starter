// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.2"),
        .package(name: "AparajitaCapacitorSecureStorage", path: "../../../../../../node_modules/.pnpm/@aparajita+capacitor-secure-storage@8.0.1/node_modules/@aparajita/capacitor-secure-storage"),
        .package(name: "CapacitorCommunityInAppReview", path: "../../../../../../node_modules/.pnpm/@capacitor-community+in-app-review@8.0.0_@capacitor+core@8.5.2/node_modules/@capacitor-community/in-app-review"),
        .package(name: "CapacitorCommunityKeepAwake", path: "../../../../../../node_modules/.pnpm/@capacitor-community+keep-awake@8.0.1_@capacitor+core@8.5.2/node_modules/@capacitor-community/keep-awake"),
        .package(name: "CapacitorApp", path: "../../../../../../node_modules/.pnpm/@capacitor+app@8.1.1_@capacitor+core@8.5.2/node_modules/@capacitor/app"),
        .package(name: "CapacitorBrowser", path: "../../../../../../node_modules/.pnpm/@capacitor+browser@8.0.5_@capacitor+core@8.5.2/node_modules/@capacitor/browser"),
        .package(name: "CapacitorCamera", path: "../../../../../../node_modules/.pnpm/@capacitor+camera@8.2.4_@capacitor+core@8.5.2/node_modules/@capacitor/camera"),
        .package(name: "CapacitorClipboard", path: "../../../../../../node_modules/.pnpm/@capacitor+clipboard@8.0.1_@capacitor+core@8.5.2/node_modules/@capacitor/clipboard"),
        .package(name: "CapacitorDevice", path: "../../../../../../node_modules/.pnpm/@capacitor+device@8.0.3_@capacitor+core@8.5.2/node_modules/@capacitor/device"),
        .package(name: "CapacitorFilesystem", path: "../../../../../../node_modules/.pnpm/@capacitor+filesystem@8.1.5_@capacitor+core@8.5.2/node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorHaptics", path: "../../../../../../node_modules/.pnpm/@capacitor+haptics@8.0.2_@capacitor+core@8.5.2/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorKeyboard", path: "../../../../../../node_modules/.pnpm/@capacitor+keyboard@8.0.5_@capacitor+core@8.5.2/node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorLocalNotifications", path: "../../../../../../node_modules/.pnpm/@capacitor+local-notifications@8.3.1_@capacitor+core@8.5.2/node_modules/@capacitor/local-notifications"),
        .package(name: "CapacitorNetwork", path: "../../../../../../node_modules/.pnpm/@capacitor+network@8.0.1_@capacitor+core@8.5.2/node_modules/@capacitor/network"),
        .package(name: "CapacitorPreferences", path: "../../../../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.5.2/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorScreenOrientation", path: "../../../../../../node_modules/.pnpm/@capacitor+screen-orientation@8.0.2_@capacitor+core@8.5.2/node_modules/@capacitor/screen-orientation"),
        .package(name: "CapacitorShare", path: "../../../../../../node_modules/.pnpm/@capacitor+share@8.0.2_@capacitor+core@8.5.2/node_modules/@capacitor/share"),
        .package(name: "CapacitorSplashScreen", path: "../../../../../../node_modules/.pnpm/@capacitor+splash-screen@8.0.2_@capacitor+core@8.5.2/node_modules/@capacitor/splash-screen"),
        .package(name: "CapacitorStatusBar", path: "../../../../../../node_modules/.pnpm/@capacitor+status-bar@8.0.3_@capacitor+core@8.5.2/node_modules/@capacitor/status-bar"),
        .package(name: "CapawesomeCapacitorAppUpdate", path: "../../../../../../node_modules/.pnpm/@capawesome+capacitor-app-update@8.1.1_@capacitor+core@8.5.2/node_modules/@capawesome/capacitor-app-update"),
        .package(name: "CapawesomeCapacitorBackgroundTask", path: "../../../../../../node_modules/.pnpm/@capawesome+capacitor-background-task@8.0.3_@capacitor+core@8.5.2/node_modules/@capawesome/capacitor-background-task"),
        .package(name: "CapawesomeCapacitorBadge", path: "../../../../../../node_modules/.pnpm/@capawesome+capacitor-badge@8.0.4_@capacitor+core@8.5.2/node_modules/@capawesome/capacitor-badge"),
        .package(name: "CapgoCapacitorSocialLogin", path: "../../../../../../node_modules/.pnpm/@capgo+capacitor-social-login@8.7.7_@capacitor+core@8.5.2/node_modules/@capgo/capacitor-social-login"),
        .package(name: "RevenuecatPurchasesCapacitor", path: "../../../../../../node_modules/.pnpm/@revenuecat+purchases-capacitor@14.1.0_@capacitor+core@8.5.2/node_modules/@revenuecat/purchases-capacitor"),
        .package(name: "SentryCapacitor", path: "../../../../../../node_modules/.pnpm/@sentry+capacitor@4.5.0_@capacitor+core@8.5.2_@sentry+react@10.76.2_react@19.3.1_/node_modules/@sentry/capacitor")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "AparajitaCapacitorSecureStorage", package: "AparajitaCapacitorSecureStorage"),
                .product(name: "CapacitorCommunityInAppReview", package: "CapacitorCommunityInAppReview"),
                .product(name: "CapacitorCommunityKeepAwake", package: "CapacitorCommunityKeepAwake"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorCamera", package: "CapacitorCamera"),
                .product(name: "CapacitorClipboard", package: "CapacitorClipboard"),
                .product(name: "CapacitorDevice", package: "CapacitorDevice"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorNetwork", package: "CapacitorNetwork"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorScreenOrientation", package: "CapacitorScreenOrientation"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapawesomeCapacitorAppUpdate", package: "CapawesomeCapacitorAppUpdate"),
                .product(name: "CapawesomeCapacitorBackgroundTask", package: "CapawesomeCapacitorBackgroundTask"),
                .product(name: "CapawesomeCapacitorBadge", package: "CapawesomeCapacitorBadge"),
                .product(name: "CapgoCapacitorSocialLogin", package: "CapgoCapacitorSocialLogin"),
                .product(name: "RevenuecatPurchasesCapacitor", package: "RevenuecatPurchasesCapacitor"),
                .product(name: "SentryCapacitor", package: "SentryCapacitor")
            ]
        )
    ]
)
