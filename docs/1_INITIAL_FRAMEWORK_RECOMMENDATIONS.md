# Framework Recommendation for Building a Lark-Like Cross-Platform Platform

## Executive recommendation

As of **October 16, 2026**, I would **not choose Lynx/LynxJS as the main framework for this project yet**, even though Lynx is actively maintained and has improved significantly in 2026. Lynx now officially targets iOS, Android, Web, macOS, and Windows, and its latest GitHub release is listed as 4.1.0. However, its official UI library still describes Web and Desktop support as being under ongoing improvement, and the new Lynxtron desktop layer still has open issues around basic desktop-app capabilities such as keyboard input paths, notifications, fonts, packaging, and DevTools behavior. citeturn0search13turn14search0turn0search25turn4search4

For **your specific situation**, especially because your existing stack is already heavily React/TypeScript-based, my recommendation is:

> **React + TypeScript + Vite, packaged with Capacitor for iOS/Android and Electron for Windows/macOS/Linux.**

The important distinction is that I am **not recommending three separate applications**. I am recommending **one React application and one shared TypeScript codebase**, surrounded by thin native shells for the different targets.

The structure is essentially:

```text
                         ┌──────────────┐
                         │ React + TS   │
                         │ Shared App   │
                         └──────┬───────┘
                                │
                ┌───────────────┼────────────────┐
                │               │                │
                ▼               ▼                ▼
          Web Browser       Capacitor         Electron
                             │                  │
                       ┌─────┴─────┐      ┌─────┼─────┐
                       ▼           ▼      ▼     ▼     ▼
                      iOS       Android  Win   Mac   Linux
```

Capacitor officially supports iOS, Android, and the Web, takes an existing built web application, and packages it into native projects while exposing native functionality through JavaScript APIs. Electron embeds Chromium and Node.js and officially targets Windows, macOS, and Linux using one JavaScript/HTML/CSS application. citeturn1search24turn1search18turn15search0turn7search0

For a **Lark-type productivity application**, I prefer this approach over React Native, Lynx, NativeScript, or Tauri because your product will likely contain a lot of traditionally web-oriented UI: chat, rich-text editing, file management, tables, calendars, admin pages, settings, dashboards, search, embedded content, and possibly collaborative documents. A browser/DOM-based React codebase lets the same component system run directly on Web, inside Capacitor on mobile, and inside Chromium through Electron on desktop. Capacitor explicitly describes itself as a native runtime for modern web applications, while Electron runs standard web technologies on desktop. citeturn1search3turn7search0

My ranking for this project would be:

| Rank | Approach | Recommendation |
|---|---|---|
| **Best overall** | **React + Capacitor + Electron** | **Use this** |
| Best literal "one framework/CLI" | Quasar | Excellent technically, but requires Vue |
| Best if Rust is acceptable | Tauri 2 + React | Strong alternative |
| Best native-mobile-first option | React Native + Expo | Excellent mobile, weaker unified desktop story |
| Most interesting emerging option | Lynx + Lynxtron | Watch closely, but too early for this project |
| Mobile-native alternative | NativeScript | Good technology, wrong platform coverage |
| Mobile-web UI alternative | Framework7 | Viable, but offers little advantage over your React stack |

The most important point is this:

**Don't optimize for "one framework." Optimize for "one shared product codebase."**

Trying to force every platform through one rendering framework can actually increase risk. A shared React application plus mature platform shells gives you most of the economic benefits of "write once, deploy everywhere" without tying the entire project to a young runtime.

## What you are actually building

Before choosing a framework, it is worth being clear about what "similar to Lark" means.

Lark today is not just a messaging application. Its official product describes an integrated environment containing chat, documents, meetings, workflow automation, AI, email, calendar, developer integrations, project management, and related collaboration features. Lark's administration reporting separately tracks usage for Messenger, Docs, Calendar, Mail, Tasks, Video Meetings, Help Desk, Wiki, Base, and uploaded files. citeturn0search20turn9search0

That means the frontend framework is actually one of the easier decisions.

The difficult engineering areas are things such as:

| Area | What it really involves |
|---|---|
| Messaging | realtime delivery, message ordering, unread counts, mentions, reactions, threads, attachments, presence |
| Files | upload, resumable download, permissions, thumbnails, object storage, virus/security checks |
| Notifications | web push, APNs, FCM, Windows/macOS notifications, badges, deep links |
| Documents | rich-text editing, autosave, history, comments, permissions, realtime co-editing |
| Meetings | WebRTC, camera/mic, screen share, bandwidth adaptation, reconnection, recording |
| Search | users, messages, files, documents, permissions-aware indexing |
| Organization | teams, users, roles, RBAC, groups, deactivation |
| Security | sessions, device management, permissions, audit logs, encryption policies |
| Desktop integration | system tray, notifications, screen capture, file associations, global shortcuts, auto-update |
| Mobile integration | push notifications, camera, microphone, background state, share sheet, deep links |

This is why your note that **you will only implement the Lark features your company actually uses** is the right approach. It changes this from "rebuild Lark" into "build an internal collaboration product with selected Lark-like modules."

That difference is enormous.

I would start by auditing your actual Lark usage. Lark's own administrative tooling separates usage by modules such as Messenger, Docs, Calendar, Mail, Tasks, Meetings, and Wiki, which is roughly how I would decompose your replacement as well. citeturn9search0turn9search8

There is also an important misconception around **"write once."**

No serious cross-platform stack gives you literally 100% identical code across:

- browser
- Android
- iOS
- Windows
- macOS
- Linux

Even frameworks specifically designed for cross-platform work expose platform differences. React Native explicitly provides platform-specific files and APIs, while Capacitor plugins often need Swift/Objective-C implementations on iOS or Java/Kotlin implementations on Android when Web APIs are insufficient. citeturn11search12turn15search0

A better engineering goal is:

> **One shared application, one shared business/domain layer, one shared API client, one shared design system, and very small platform-specific adapter layers.**

For your project, I would make **85%+ shared application code** an internal architecture target, rather than demanding theoretical 100% code sharing.

That last 10–15% is exactly where you *want* differences: mobile push notifications, desktop screen sharing, system tray behavior, mobile safe areas, background audio, file-system integration, window management, and app updates.

## Framework comparison

Here is the framework landscape I would seriously consider for this product.

| Framework / stack | Web | iOS / Android | Windows / macOS | Linux | JS/TS application code | Main advantages | Main problems | My verdict |
|---|---:|---:|---:|---:|---:|---|---|---|
| **React + Capacitor + Electron** | ✅ | ✅ | ✅ | ✅ | ✅ | Maximum React/web reuse, mature desktop runtime, mature mobile web runtime, huge web ecosystem | Two packaging runtimes; WebView-based mobile UI | **Best fit** |
| **Lynx + Lynxtron** | ✅ | ✅ | ✅ | ❌ currently for Lynxtron | ✅ mostly | Native/custom rendering, high performance, React-like frontend, rapidly developing | Young ecosystem, incomplete desktop/UI coverage, desktop tooling still settling | **Too risky today** |
| **Tauri 2 + React** | ✅ | ✅ | ✅ | ✅ | ⚠️ frontend yes, core Rust | One wrapper for mobile + desktop, small bundles, React-friendly | Rust toolchain/core, OS WebView differences, younger mobile ecosystem | **Excellent runner-up** |
| **React Native + Expo** | ✅ | ✅ | ⚠️ separate RN Windows/macOS | ⚠️ community/out-of-tree | ✅ mostly | Excellent native mobile ecosystem, Expo DX, native rendering | Desktop requires out-of-tree platforms, module compatibility becomes complicated | **Use if mobile is priority** |
| **Quasar** | ✅ | ✅ | ✅ | ✅ | ✅ | Probably the closest literal "one codebase / one CLI" answer | Vue instead of React; uses Capacitor/Electron underneath anyway | **Great, but wrong stack for you** |
| **Ionic React** | ✅ | ✅ | ⚠️ pair with Electron | ✅ with Electron | ✅ | React-native-feeling component library, integrates directly with your web skills | Primarily web/WebView UI; desktop still needs wrapper | **Good optional layer** |
| **NativeScript** | ⚠️ shared web code possible | ✅ | ❌ first-class desktop | ❌ | ✅ | Direct access to native platform APIs from TS/JS | Desktop requirement kills it for this project | **Not suitable** |
| **Framework7** | ✅ | ✅ | ⚠️ Electron integration possible | ⚠️ through desktop wrapper | ✅ | React support, mobile-oriented UI, Capacitor integration | Less compelling ecosystem than React + Capacitor directly | **Possible, not my choice** |

Capacitor officially defines Android, iOS, and Web as its supported application targets, and its plugin model exposes native APIs to JavaScript. Electron officially supplies Windows, macOS, and Linux desktop support from one JavaScript/HTML/CSS codebase. That combination is why the first row covers your full platform matrix without forcing you away from React. citeturn1search24turn15search0turn7search0

**Quasar** deserves special attention because it is probably the closest framework to exactly what you described. Its official documentation literally describes its model as "one codebase" targeting SPA, SSR, SSG, PWA, mobile through Capacitor/Cordova, and Windows/macOS/Linux desktop through Electron. Its CLI ties those build modes together. citeturn2search3turn2search15turn2search25

If you were already a Vue developer, Quasar would probably be my first recommendation.

But you already work with React, Next.js, TanStack, Zustand, React Query, and React Router. Switching the whole application to Vue primarily to get Quasar's CLI would save some infrastructure configuration while increasing application-development friction. Underneath, Quasar is still using the same basic approach I am recommending: **web application + Capacitor on mobile + Electron on desktop.** citeturn2search3turn2search15

So in your case, I would take the architecture and keep React.

**Tauri 2** is the strongest competitor. Tauri officially supports Linux, macOS, Windows, Android, and iOS from one application and allows any HTML/CSS/JavaScript frontend framework. citeturn0search3turn0search7turn2search12

The catch is your "JavaScript only" requirement. Tauri describes its architecture as JavaScript for the frontend with application logic in Rust, with Swift/Kotlin integrations when deeper native functionality is needed. Its core process is deliberately implemented in Rust. citeturn0search3turn10search3

It is therefore not truly a JavaScript-only platform.

More importantly for a Lark-like application, Tauri uses the **operating system's WebView** rather than shipping one Chromium engine. Windows uses WebView2, Android uses the Android WebView, and macOS/iOS/Linux use WebKit-based implementations. Tauri itself warns that this makes applications smaller but requires developers to keep platform differences in mind. citeturn10search0turn10search3

Electron takes the opposite approach: it ships Chromium and Node.js. citeturn7search0

That makes Electron heavier, but for an application containing complex editors, realtime media, advanced CSS, drag-and-drop, clipboard integration, and other browser-heavy functionality, **a predictable Chromium environment on every desktop OS is valuable**. That is an engineering tradeoff I would make for this specific product.

**React Native + Expo** remains excellent technology. Expo officially targets Android, iOS, and Web from one JavaScript/TypeScript project. citeturn1search10turn1search27

Desktop is where things get complicated. React Native treats Windows and macOS as out-of-tree platforms rather than core Android/iOS targets. Microsoft maintains React Native Windows and React Native macOS, but these are additional platform implementations with their own versioning and module compatibility concerns. React Native's own documentation categorizes React Native Windows, macOS, and Web as out-of-tree platforms. citeturn11search0turn11search1turn11search2

React Native Windows is very real and is used in Microsoft products including experiences inside Office, but using Android + iOS + Web + Windows + macOS together is a substantially more complicated dependency matrix than Expo's standard Android/iOS/Web workflow. citeturn1search11turn1search20

For a mobile-first consumer app, I might choose Expo.

For a desktop-and-web-heavy collaboration suite, I wouldn't.

**NativeScript** is still actively maintained. Its current documentation emphasizes direct native platform API access from TypeScript/JavaScript, and NativeScript 9.1 was released in August 2026. citeturn12search0turn12search12

But its strong point is native iOS/Android development, not unified Windows/macOS/Linux desktop development. Its own website primarily positions it around native iOS and Android applications. citeturn12search2

That removes it from serious contention here.

**Framework7** supports React and recognizes Capacitor, Electron, NW.js, desktop browsers, Android and iOS environments. citeturn8search1

It is perfectly usable, but for this project it adds another framework abstraction without solving a problem that React + Capacitor + Electron does not already solve.

## Lynx assessment

Lynx is much more interesting in October 2026 than it was even a year ago.

So to answer your question directly:

> **Yes, Lynx is actively maintained. No, I would not yet call its complete mobile + web + desktop application stack mature enough to make it the foundation of your company's Lark replacement.**

Those are two different questions.

Lynx is clearly maintained. Its official GitHub releases show a continuous sequence through 3.8, 3.9, 4.0 and 4.1, with 4.1.0 marked as the latest release and released in September 2026. Its 2026 roadmap also committed to increasing the release cadence and continuing work on multi-platform support, production infrastructure, UI components, diagnostics, and desktop. citeturn14search0turn4search2

The core concept is attractive. Lynx provides a web-inspired frontend development model and supports native/custom rendering instead of simply displaying everything in a browser WebView. Its website explicitly positions it as "write once, render anywhere," with iOS, Android, HarmonyOS, Web, and Desktop targets. citeturn0search13

Desktop support made a major jump in Lynx 3.7. Lynx declared macOS and Windows first-class platforms and reported 97% coverage of its supported CSS properties and 73% coverage of element attributes at that release. However, the same announcement explicitly said primitive coverage was still growing. citeturn4search0

That matters.

A Lark-style app is a **desktop-intensive productivity application**, not just a set of mobile screens. Keyboard interactions, clipboard behavior, text selection, drag-and-drop, file handling, multiple windows, notifications, system tray behavior, rich-text editing, accessibility, shortcuts, screen sharing, and focus behavior are core functionality.

Lynx's official `lynx-ui` documentation currently says its UI library has **full iOS and Android support**, while Harmony, Web, and Desktop are still receiving ongoing improvements. citeturn0search25

That sentence alone is enough for me not to bet an internal mission-critical productivity suite on it yet.

Lynxtron improves the situation significantly. It is now open source and describes itself as an Electron-like desktop application framework combining Node.js with the Lynx renderer. citeturn4search1

But its build documentation currently supports **macOS and Windows**, not Linux. citeturn4search8

More importantly, its current open issue tracker still contains issues covering areas such as keyboard event handling, notification API behavior, DevTools input emulation, fonts, application packaging/runtime behavior, and Windows UI behavior. citeturn4search4

That doesn't mean Lynxtron is bad. Early framework issue trackers are supposed to contain problems.

It means **you would be taking framework risk at the exact same time that you are already taking enormous product risk by rebuilding a collaboration platform.**

There is no business advantage in taking both risks simultaneously.

Lynx 4 also recently added `<webview>` support across Android, iOS, HarmonyOS, macOS, and Windows, making it possible to reuse existing web content from inside Lynx applications. citeturn0search29

That is useful, but for your application it raises an obvious question: if your document editor, dashboards, tables, embedded content, and perhaps meeting UI end up being web-oriented anyway, why put another rendering framework around them?

My Lynx verdict is therefore:

| Question | Answer |
|---|---|
| Is Lynx dead? | **Absolutely not** |
| Is it actively maintained? | **Yes** |
| Is mobile support serious? | **Yes** |
| Does it now support Web? | **Yes** |
| Does it now have Windows/macOS support? | **Yes** |
| Is desktop as mature as Electron? | **No** |
| Is its component ecosystem as broad as the normal React/Web ecosystem? | **No** |
| Is Linux currently a good target? | **No, not through Lynxtron today** |
| Would I build a prototype with it? | **Yes** |
| Would I build your company's main Lark replacement on it today? | **No** |

I would reevaluate Lynx in the future. Its pace of development is fast enough that this answer could materially change. But today I would rather let TikTok/Lynx's maintainers continue absorbing the framework maturity cost instead of making your internal product absorb it.

## Recommended architecture

For your background and this product, I would build the client like this:

```text
workspace/
│
├─ apps/
│  ├─ client/
│  │  ├─ src/
│  │  ├─ index.html
│  │  └─ vite.config.ts
│  │
│  ├─ desktop/
│  │  ├─ electron/
│  │  ├─ main.ts
│  │  └─ preload.ts
│  │
│  └─ mobile/
│     ├─ capacitor.config.ts
│     ├─ ios/
│     └─ android/
│
├─ packages/
│  ├─ ui/
│  ├─ auth/
│  ├─ chat/
│  ├─ documents/
│  ├─ meetings/
│  ├─ notifications/
│  ├─ files/
│  ├─ api-client/
│  ├─ realtime/
│  ├─ schemas/
│  └─ shared/
│
└─ package.json
```

The actual application under `apps/client` would be normal React/TypeScript.

Given your existing stack, I would lean toward:

```text
React
TypeScript
Vite
TanStack Router
TanStack Query
Zustand
```

rather than introducing a new UI/application framework just because the app needs to run natively.

The exact same React build becomes:

```text
Web:
React build
    ↓
CDN / web server

Mobile:
React build
    ↓
Capacitor
    ↓
iOS / Android app

Desktop:
React build
    ↓
Electron renderer
    ↓
Windows / macOS / Linux app
```

Capacitor's documented workflow literally copies the already-built web bundle into the Android and iOS projects and then synchronizes native dependencies. citeturn1search18

Its plugin system then gives your JavaScript code access to functionality such as notifications, network information, screen orientation, share actions, preferences and other device APIs. When functionality is unavailable as an official or community plugin, custom plugins can expose Swift/Objective-C or Java/Kotlin code through a common JavaScript API. citeturn15search0

Electron would provide the desktop integration.

That matters for a collaboration application because Electron already exposes mature APIs for capabilities such as desktop screen capture, global keyboard shortcuts, OS notifications, tray icons, screen/display information, media permissions, and other desktop integrations. citeturn15search1turn15search2turn15search3turn15search4

For example, Electron's `desktopCapturer` integrates with `getDisplayMedia()` for screen sharing, which is directly relevant if your Lark replacement includes meetings. citeturn15search1

Security needs to be treated seriously because Electron combines browser content with native desktop capabilities. Electron's own security guidance recommends keeping context isolation and process sandboxing enabled; both are defaults in current Electron versions. citeturn7search1

So the desktop boundary should look something like:

```text
┌─────────────────────────────┐
│ React renderer              │
│                             │
│ NO direct Node.js access    │
└─────────────┬───────────────┘
              │
        contextBridge
              │
┌─────────────▼───────────────┐
│ Electron preload            │
│ Small, explicit API surface │
└─────────────┬───────────────┘
              │
              │ IPC
              ▼
┌─────────────────────────────┐
│ Electron main process       │
│                             │
│ notifications               │
│ screen capture              │
│ file system                 │
│ updates                     │
│ tray                        │
│ OS integration              │
└─────────────────────────────┘
```

Do **not** expose unrestricted Node.js APIs to your React renderer.

For mobile, use the same idea:

```text
React application
       │
       ▼
Cross-platform abstraction

notifications.show()
files.pick()
camera.request()
share.open()
device.getInfo()
       │
       ├──────── Web implementation
       ├──────── Capacitor implementation
       └──────── Electron implementation
```

For example:

```ts
export interface PlatformAdapter {
  notifications: {
    requestPermission(): Promise<boolean>;
  };

  files: {
    pick(): Promise<SelectedFile[]>;
  };

  system: {
    openExternal(url: string): Promise<void>;
  };

  media: {
    requestCamera(): Promise<boolean>;
    requestMicrophone(): Promise<boolean>;
  };
}
```

Then:

```text
platform/
├─ web.ts
├─ capacitor.ts
├─ electron.ts
└─ index.ts
```

Your feature code should not care whether it is running in Electron, Safari, Android WebView, or Capacitor.

That architecture is more important than which framework logo appears in your `package.json`.

It also gives you an escape hatch. Suppose three years from now you decide that the Android/iOS client really needs React Native or Lynx for some performance-sensitive surfaces. Your API, business logic, schemas, realtime protocols, and backend do not need to change.

You replace only the presentation/runtime layer.

That is a much safer long-term architecture.

## Product and backend strategy

The frontend framework will not be the expensive part of replacing Lark.

You will save far more development time by **not building infrastructure that already has good open-source foundations**.

For collaborative documents, for example, Yjs is specifically designed as a CRDT for collaborative applications and automatically merges concurrent changes through shared data structures. Its own documentation positions it as infrastructure for applications similar to Google Docs and Figma. citeturn16search0

So if collaborative docs are actually required, I would investigate an architecture such as:

```text
Editor UI
   │
   ▼
Yjs document
   │
   ├── local persistence
   │
   └── realtime sync
            │
            ▼
      sync WebSocket server
            │
            ▼
      persistent storage
```

Do not begin by inventing your own operational-transform or CRDT algorithm.

For meetings, I would likewise avoid implementing a conferencing server from raw WebRTC.

LiveKit's open-source server is a horizontally scalable WebRTC Selective Forwarding Unit, and its JavaScript/TypeScript SDK supports audio, video, and data. The project can be self-hosted rather than requiring LiveKit Cloud. citeturn16search1turn16search5turn16search7turn16search13

That produces an architecture closer to:

```text
React / Electron / Capacitor
           │
           ▼
      LiveKit JS SDK
           │
           ▼
      LiveKit SFU
           │
     ┌─────┴─────┐
     ▼           ▼
   TURN        Redis
             if scaled
```

LiveKit's own architecture uses an SFU model so each publisher sends a stream to the server, which selectively forwards tracks to subscribers; distributed deployments can use Redis for multi-node routing. citeturn16search1

This is dramatically more realistic than making "video conferencing infrastructure" another project inside your Lark replacement.

A sensible modular system might therefore be:

```text
                        ┌─────────────────────┐
                        │ React application   │
                        │ Web/Capacitor/      │
                        │ Electron            │
                        └──────────┬──────────┘
                                   │
                     HTTPS / WebSocket
                                   │
             ┌─────────────────────▼────────────────────┐
             │              API Gateway                 │
             │             Node.js / Hono               │
             └─────────┬───────────────┬────────────────┘
                       │               │
            ┌──────────▼──────┐   ┌────▼───────────┐
            │ Collaboration   │   │ Realtime       │
            │ services        │   │ gateway        │
            └───────┬─────────┘   └────┬───────────┘
                    │                  │
          ┌─────────▼─────┐      ┌─────▼─────────┐
          │ PostgreSQL    │      │ Redis /       │
          │               │      │ pub-sub       │
          └───────────────┘      └───────────────┘

             Documents                   Meetings
                 │                          │
                 ▼                          ▼
                Yjs                     LiveKit
```

Your current backend stack is already suitable for building most of the normal business APIs around this. You do not need to choose the client framework based on the backend language.

The product itself should be feature-modular from day one.

I would think about the scope like this:

| Stage | Modules | Why |
|---|---|---|
| **Foundation** | login, organization, users, roles, permissions, sessions | Everything depends on it |
| **Communication core** | DMs, channels/groups, messages, reactions, mentions, attachments, unread state | Usually the central Lark replacement |
| **Platform integration** | notifications, deep links, file handling, mobile push, desktop tray | Required for users to actually adopt it |
| **Files/search** | file management, thumbnails, search, permissions | Quickly becomes essential |
| **Documents** | rich text, comments, versions, Yjs collaboration | Add only if Docs is heavily used |
| **Calendar/tasks** | scheduling, reminders, assignments | Add based on measured usage |
| **Meetings** | audio/video/screen share, preferably on LiveKit or similar | Expensive, so only build if necessary |
| **Advanced modules** | approvals, wiki, Base-like database, mail, AI | Only when business use justifies them |

This mirrors the fact that Lark itself consists of separable modules such as Messenger, Docs, Calendar, Mail, Tasks, Video Meetings, Wiki and Base. citeturn9search0turn9search2

There is also an important economic point for your boss.

The comparison should **not** be:

```text
Lark annual subscription
vs.
server hosting bill
```

It should be:

```text
Lark annual subscription
vs.

engineering development
+ ongoing engineering maintenance
+ servers
+ database
+ storage
+ backups
+ CDN/bandwidth
+ video bandwidth/servers
+ monitoring
+ email/push infrastructure
+ security work
+ Windows/macOS signing
+ Apple/Google release maintenance
+ incident response
+ upgrades
+ bug fixing
```

The break-even model should be calculated over several years:

```text
3-year Lark cost
            versus
Initial development
+ 3 years infrastructure
+ 3 years maintenance
```

That does **not** mean replacing Lark is necessarily a bad idea.

It can make excellent financial sense when:

- the company has many users;
- only a fraction of Lark's functionality is actually being used;
- your workflows are unusually custom;
- the company wants full control of its data and integrations;
- the platform can replace several other subscriptions as well.

But the savings come from **aggressive scope control and code sharing**, not from choosing a free framework.

That is another reason I would avoid Lynx for this project today. You are trying to reduce cost. Taking on framework-level risk works against that objective.

## Final decision

For your exact requirements, I would make the decision this way:

| Requirement | Selected approach |
|---|---|
| JavaScript / TypeScript | **React + TS** |
| Existing team skill fit | **Excellent** |
| Web | **Direct React web deployment** |
| Android | **Capacitor** |
| iOS | **Capacitor** |
| Windows | **Electron** |
| macOS | **Electron** |
| Linux later | **Electron already supports it** |
| Shared UI | **React components** |
| Shared state/business logic | **TypeScript packages** |
| Native mobile integration | **Capacitor plugins** |
| Native desktop integration | **Electron preload/main APIs** |
| Collaborative docs if required | **Yjs or similar CRDT infrastructure** |
| Meetings if required | **Self-hosted LiveKit or equivalent SFU** |
| Lynx | **Monitor, do not use as foundation yet** |

Electron officially supports Windows, macOS and Linux with one JavaScript codebase, while Capacitor officially supports iOS, Android and Web and provides a JavaScript-to-native plugin boundary. Together, those two runtimes cover every platform you listed while allowing the actual product UI and business logic to remain ordinary React/TypeScript. citeturn7search0turn1search24turn15search0

### Why I would use this instead of Lynx

**Maturity is more valuable than theoretical rendering performance for this project.**

Lynx is actively developed, but its Web/Desktop UI story is still being completed and Lynxtron's desktop framework is new enough that the current issue tracker still exposes gaps in desktop fundamentals. citeturn0search25turn4search1turn4search4

Electron, by contrast, already has established APIs for exactly the desktop capabilities a Lark-like application needs: screen capture, shortcuts, notifications, tray integration, multi-process isolation and media permissions. citeturn15search1turn15search2turn15search3turn15search4turn7search5

Capacitor already solves the corresponding problem for existing web applications on iOS and Android. citeturn1search3turn1search18

### Why not Tauri as the first choice

Tauri 2 is excellent and is probably the framework I would test most seriously against Electron. It officially supports all five operating-system targets from one codebase. citeturn0search3turn2search12

But it violates the strict interpretation of your JavaScript-only requirement because its application core is Rust, and its use of different system WebViews means your complex web UI can encounter engine differences between Windows, Android, macOS/iOS and Linux. citeturn0search3turn10search0turn10search3

For a small utility application, I might favor Tauri's smaller footprint.

For a Lark-like collaboration suite, I prefer Electron's predictable Chromium desktop environment.

### Why not React Native + Expo

Expo is arguably the best choice if Android/iOS are the center of the product. It gives you an excellent Android/iOS/Web development experience from a JavaScript/TypeScript project. citeturn1search10turn1search27

But your product treats **Web + Windows + macOS + Android + iOS as peers**. Windows and macOS are separate React Native implementations, and React Native itself categorizes those platforms as out-of-tree. citeturn11search2turn11search0

That is unnecessary complexity for you.

### Why not Quasar

Quasar is arguably the cleanest answer on paper. Its official promise is extremely close to your requirement: Web, PWA, iOS/Android through Capacitor, Windows/macOS/Linux through Electron, from one codebase and one CLI. citeturn2search3turn2search25

But it is Vue-based.

You would effectively switch from:

```text
React
+ Capacitor
+ Electron
```

to:

```text
Vue / Quasar
+ Capacitor
+ Electron
```

The underlying deployment architecture barely changes.

Given your existing React experience, that is not a trade I would make.

### Why the selected stack is the best fit

The final architecture I would approve is:

```text
                  ONE TYPESCRIPT MONOREPO

       ┌──────────────────────────────────┐
       │       React application          │
       │                                  │
       │ UI                               │
       │ routing                          │
       │ state                            │
       │ API client                       │
       │ realtime logic                   │
       │ chat                             │
       │ documents                        │
       │ calendar                         │
       │ file management                  │
       └───────────────┬──────────────────┘
                       │
           ┌───────────┼────────────┐
           │           │            │
           ▼           ▼            ▼

          WEB        MOBILE       DESKTOP
           │           │            │
           │       Capacitor     Electron
           │        /     \       /   |   \
           │       /       \     /    |    \
           ▼      ▼         ▼   ▼     ▼     ▼
        Browser  iOS     Android Win  macOS Linux
```

This gives you what you are actually looking for:

**one product, one React codebase, one TypeScript ecosystem, one backend, and multiple thin deployment shells.**

It does **not** promise the impossible idea that every platform-specific feature will require zero platform-specific code. Capacitor itself acknowledges native plugins may contain Swift/Objective-C or Java/Kotlin, and every serious cross-platform system ultimately has platform boundaries. citeturn15search0

But almost all of the code you will spend your time writing, your chat UI, document UI, settings, auth, state management, API integration, file browser, search, admin portal, calendars, tables, dialogs, forms and business logic, can remain ordinary React/TypeScript.

That is the version of **"write once, deploy everywhere"** I would trust for a production Lark replacement in 2026.

**Final recommendation: React + TypeScript + Vite as the shared application, Capacitor for iOS/Android, Electron for Windows/macOS/Linux. Keep Lynx on the watchlist, not in the critical path.**