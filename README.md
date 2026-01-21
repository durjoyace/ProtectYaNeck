# ProtectYaNeck 🛡️

A Chrome extension that scans sign-up and agreement pages in real time, highlights key legal risks, and delivers plain-language explanations to users.

## Features

- **Real-time Agreement Detection** - Automatically detects Terms of Service, Privacy Policies, and sign-up agreements
- **Risk Analysis** - Identifies concerning clauses like data sharing, auto-renewal, arbitration, and more
- **Plain-Language Summaries** - Translates legal jargon into easy-to-understand explanations
- **Visual Highlighting** - Color-coded risk indicators directly on the page
- **Freemium Model** - 5 free scans per month, unlimited with Pro subscription
- **Lawyer Referral** - Connect with legal professionals for complex agreements

## Risk Categories

| Category | Description |
|----------|-------------|
| 📤 Data Sharing | Third-party data sharing practices |
| 🔄 Auto-Renewal | Subscription renewal terms |
| 👥 Third-Party Access | Who can access your information |
| ⚠️ Liability Waiver | Limitation of company responsibility |
| ⚖️ Arbitration | Mandatory arbitration clauses |
| 💾 Data Retention | How long your data is kept |
| 🚫 Account Termination | Account suspension policies |
| 🌍 Jurisdiction | Governing laws and courts |

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build
```

### Loading the Extension

1. Build the project: `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `dist` folder

### Project Structure

```
ProtectYaNeck/
├── manifest.json          # Extension manifest (v3)
├── src/
│   ├── background/        # Service worker
│   ├── content/           # Content scripts (detection, overlay)
│   ├── popup/             # Extension popup UI
│   └── shared/            # Shared types and constants
├── assets/
│   └── icons/             # Extension icons
└── dist/                  # Built extension (generated)
```

## Tech Stack

- **TypeScript** - Type-safe development
- **React** - Popup UI components
- **Webpack** - Module bundling
- **Chrome Extension Manifest V3** - Modern extension APIs
- **Shadow DOM** - Isolated overlay styling

## Roadmap

- [x] Phase 1: Proof of Concept
  - [x] Agreement detection
  - [x] Basic risk analysis
  - [x] Overlay UI
- [ ] Phase 2: MVP Build
  - [ ] LLM-powered analysis
  - [ ] Payment integration (Stripe)
  - [ ] Lawyer referral system
- [ ] Phase 3: User Feedback
- [ ] Phase 4: Public Launch

## License

MIT
